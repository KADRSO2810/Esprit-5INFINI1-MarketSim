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
    @DisplayName("Devrait enregistrer la complétion d'une leçon et débloquer le badge Premier Pas")
    void shouldMarkLessonCompletedAndUnlockBadge() {
        learningService.markLessonCompleted(testUser, "LES_ORDRES_TYPES");

        assertThat(progressStore).hasSize(1);
        assertThat(progressStore.get(0).getLessonId()).isEqualTo("LES_ORDRES_TYPES");

        assertThat(badgeStore).hasSize(1);
        assertThat(badgeStore.get(0).getBadgeCode()).isEqualTo("FIRST_LESSON");
    }

    @Test
    @DisplayName("Devrait valider un quiz avec 100% et débloquer le badge correspondant")
    void shouldSubmitQuizSuccessfully() {
        QuizSubmissionDto submission = QuizSubmissionDto.builder()
                .quizId("QUIZ_MARKET_BASICS")
                .answers(Map.of(
                        "Q1_1", 1, // correct
                        "Q1_2", 2, // correct
                        "Q1_3", 1, // correct
                        "Q1_4", 2  // correct
                ))
                .build();

        QuizResultDto result = learningService.submitQuiz(testUser, submission);

        assertThat(result).isNotNull();
        assertThat(result.getScore()).isEqualTo(4);
        assertThat(result.getTotalQuestions()).isEqualTo(4);
        assertThat(result.getPercentage()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(result.isPassed()).isTrue();
        assertThat(result.getNewlyUnlockedBadges()).hasSize(1);
        assertThat(result.getNewlyUnlockedBadges().get(0).getBadgeCode()).isEqualTo("BADGE_BASICS");
    }

    @Test
    @DisplayName("Devrait calculer avec précision le profil d'apprentissage et le titre honorifique")
    void shouldCalculateLearningProfile() {
        learningService.markLessonCompleted(testUser, "LES_ORDRES_TYPES");

        QuizSubmissionDto submission = QuizSubmissionDto.builder()
                .quizId("QUIZ_MARKET_BASICS")
                .answers(Map.of("Q1_1", 1, "Q1_2", 2, "Q1_3", 1, "Q1_4", 2))
                .build();
        learningService.submitQuiz(testUser, submission);

        UserLearningProfileDto profile = learningService.getUserLearningProfile(testUser);

        assertThat(profile).isNotNull();
        assertThat(profile.getCompletedLessonsCount()).isEqualTo(1);
        assertThat(profile.getPassedQuizzesCount()).isEqualTo(1);
        assertThat(profile.getBadges()).hasSize(2); // FIRST_LESSON + BADGE_BASICS
        assertThat(profile.getOverallProgressPct()).isGreaterThan(BigDecimal.ZERO);
        assertThat(profile.getUserTitle()).isNotEmpty();
    }
}
