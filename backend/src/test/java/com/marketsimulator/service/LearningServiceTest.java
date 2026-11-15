package com.marketsimulator.service;

import com.marketsimulator.domain.LearningProgress;
import com.marketsimulator.domain.QuizAttempt;
import com.marketsimulator.domain.Role;
import com.marketsimulator.domain.User;
import com.marketsimulator.domain.UserBadge;
import com.marketsimulator.dto.learning.*;
import com.marketsimulator.repository.LearningProgressRepository;
import com.marketsimulator.repository.QuizAttemptRepository;
import com.marketsimulator.repository.UserBadgeRepository;
import com.marketsimulator.service.learning.LearningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class LearningServiceTest {

    private LearningService learningService;

    private List<LearningProgress> progressStore;
    private List<QuizAttempt> attemptStore;
    private List<UserBadge> badgeStore;
    private User testUser;

    @SuppressWarnings("unchecked")
    private <T> T createInMemoryRepo(Class<T> repoInterface) {
        return (T) Proxy.newProxyInstance(
                repoInterface.getClassLoader(),
                new Class<?>[]{repoInterface},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("save".equals(name)) {
                        Object entity = args[0];
                        if (entity instanceof LearningProgress lp) {
                            lp.setId((long) (progressStore.size() + 1));
                            progressStore.add(lp);
                        } else if (entity instanceof QuizAttempt qa) {
                            qa.setId((long) (attemptStore.size() + 1));
                            attemptStore.add(qa);
                        } else if (entity instanceof UserBadge ub) {
                            ub.setId((long) (badgeStore.size() + 1));
                            badgeStore.add(ub);
                        }
                        return entity;
                    }
                    if ("findByUserIdAndLessonId".equals(name)) {
                        Long uid = (Long) args[0];
                        String lid = (String) args[1];
                        return progressStore.stream()
                                .filter(p -> p.getUser().getId().equals(uid) && p.getLessonId().equals(lid))
                                .findFirst();
                    }
                    if ("findByUserId".equals(name)) {
                        Long uid = (Long) args[0];
                        if (repoInterface.equals(LearningProgressRepository.class)) {
                            return progressStore.stream().filter(p -> p.getUser().getId().equals(uid)).toList();
                        }
                    }
                    if ("findByUserIdOrderByAttemptedAtDesc".equals(name)) {
                        Long uid = (Long) args[0];
                        return attemptStore.stream().filter(a -> a.getUser().getId().equals(uid)).toList();
                    }
                    if ("findByUserIdOrderByUnlockedAtDesc".equals(name)) {
                        Long uid = (Long) args[0];
                        return badgeStore.stream().filter(b -> b.getUser().getId().equals(uid)).toList();
                    }
                    if ("existsByUserIdAndBadgeCode".equals(name)) {
                        Long uid = (Long) args[0];
                        String code = (String) args[1];
                        return badgeStore.stream().anyMatch(b -> b.getUser().getId().equals(uid) && b.getBadgeCode().equals(code));
                    }
                    if ("countByUserIdAndPassedTrue".equals(name)) {
                        Long uid = (Long) args[0];
                        return attemptStore.stream().filter(a -> a.getUser().getId().equals(uid) && Boolean.TRUE.equals(a.getPassed())).count();
                    }
                    if ("countByUserId".equals(name)) {
                        Long uid = (Long) args[0];
                        return progressStore.stream().filter(p -> p.getUser().getId().equals(uid)).count();
                    }
                    if ("countByUserIdAndModuleId".equals(name)) {
                        Long uid = (Long) args[0];
                        String mid = (String) args[1];
                        return progressStore.stream().filter(p -> p.getUser().getId().equals(uid) && p.getModuleId().equals(mid)).count();
                    }
                    if ("findFirstByUserIdAndQuizIdOrderByPercentageDesc".equals(name)) {
                        Long uid = (Long) args[0];
                        String qid = (String) args[1];
                        return attemptStore.stream()
                                .filter(a -> a.getUser().getId().equals(uid) && a.getQuizId().equals(qid))
                                .max(Comparator.comparing(QuizAttempt::getPercentage));
                    }
                    return null;
                }
        );
    }

    @BeforeEach
    void setUp() {
        progressStore = new ArrayList<>();
        attemptStore = new ArrayList<>();
        badgeStore = new ArrayList<>();

        LearningProgressRepository progressRepo = createInMemoryRepo(LearningProgressRepository.class);
        QuizAttemptRepository quizRepo = createInMemoryRepo(QuizAttemptRepository.class);
        UserBadgeRepository badgeRepo = createInMemoryRepo(UserBadgeRepository.class);

        learningService = new LearningService(progressRepo, quizRepo, badgeRepo);
        learningService.initPedagogicalContent();

        testUser = User.builder()
                .id(1L)
                .email("student@marketsimulator.com")
                .role(Role.USER)
                .build();
    }

    @Test
    @DisplayName("Devrait charger les 6 modules pédagogiques et leurs leçons détaillées")
    void shouldLoadAllModulesAndLessons() {
        List<LearningModuleDto> modules = learningService.getAllModules();
        assertThat(modules).hasSize(6);

        Optional<LearningLessonDto> lesson = learningService.getLessonById("LES_ORDRES_TYPES");
        assertThat(lesson).isPresent();
        assertThat(lesson.get().getModuleId()).isEqualTo("MOD_MARKET_BASICS");
        assertThat(lesson.get().getKeyTakeaways()).isNotEmpty();
        assertThat(lesson.get().getContentMarkdown()).contains("Ordre au Marché");
    }

    @Test
    @DisplayName("Devrait exiger cours terminés ET quiz >= 75% pour débloquer le badge et certificat")
    void shouldUnlockBadgeOnlyWhenBothLessonsAndQuizAreCompleted() {
        // 1. Passage du quiz sans avoir terminé les leçons -> Aucun badge de module débloqué
        QuizDto quiz = learningService.getQuizById("QUIZ_MARKET_BASICS", false).orElseThrow();
        assertThat(quiz.getQuestions()).hasSize(20);

        Map<String, Integer> answers = new HashMap<>();
        for (QuizQuestionDto q : quiz.getQuestions()) {
            answers.put(q.getId(), q.getCorrectOptionIndex());
        }

        QuizSubmissionDto submission = QuizSubmissionDto.builder()
                .quizId("QUIZ_MARKET_BASICS")
                .answers(answers)
                .build();

        QuizResultDto initialResult = learningService.submitQuiz(testUser, submission);
        assertThat(initialResult.isPassed()).isTrue();
        assertThat(initialResult.getNewlyUnlockedBadges()).isEmpty(); // Leçons pas encore faites
        assertThat(initialResult.getFeedback()).contains("terminez également la lecture de toutes les fiches de cours");

        // 2. L'utilisateur valide les 2 leçons du module
        learningService.markLessonCompleted(testUser, "LES_ORDRES_TYPES");
        learningService.markLessonCompleted(testUser, "LES_CARNET_ORDRES");

        // 3. Le badge est maintenant débloqué avec son certificat
        assertThat(badgeStore).hasSize(1);
        UserBadge badge = badgeStore.get(0);
        assertThat(badge.getBadgeCode()).isEqualTo("BADGE_BASICS");

        // 4. Profil utilisateur avec certificat
        UserLearningProfileDto profile = learningService.getUserLearningProfile(testUser);
        assertThat(profile.getBadges()).hasSize(1);
        assertThat(profile.getBadges().get(0).getCertificateId()).contains("ESPRIT-MS-2026-BASICS");
        assertThat(profile.getBadges().get(0).getScorePercentage()).isEqualByComparingTo(new BigDecimal("100.00"));
    }
}
