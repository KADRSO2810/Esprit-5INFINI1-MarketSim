package com.marketsimulator.service.learning;

import com.marketsimulator.domain.LearningProgress;
import com.marketsimulator.domain.QuizAttempt;
import com.marketsimulator.domain.User;
import com.marketsimulator.domain.UserBadge;
import com.marketsimulator.dto.learning.*;
import com.marketsimulator.repository.LearningProgressRepository;
import com.marketsimulator.repository.QuizAttemptRepository;
import com.marketsimulator.repository.UserBadgeRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LearningService {

    private final LearningProgressRepository progressRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final UserBadgeRepository badgeRepository;

    private final Map<String, LearningModuleDto> modulesMap = new LinkedHashMap<>();
    private final Map<String, QuizDto> quizzesMap = new LinkedHashMap<>();
    private final List<MarketScenarioDto> scenariosList = new ArrayList<>();

    @PostConstruct
    public void initPedagogicalContent() {
        initModules();
        initQuizzes();
        initScenarios();
        log.info("LearningService initialisé avec {} modules, {} quiz et {} scénarios de marché.",
                modulesMap.size(), quizzesMap.size(), scenariosList.size());
    }

    public List<LearningModuleDto> getAllModules() {
        return new ArrayList<>(modulesMap.values());
    }

    public Optional<LearningModuleDto> getModuleById(String id) {
        return Optional.ofNullable(modulesMap.get(id));
    }

    public Optional<LearningLessonDto> getLessonById(String lessonId) {
        for (LearningModuleDto mod : modulesMap.values()) {
            for (LearningLessonDto les : mod.getLessons()) {
                if (les.getId().equalsIgnoreCase(lessonId)) {
                    return Optional.of(les);
                }
            }
        }
        return Optional.empty();
    }

    public List<QuizDto> getAllQuizzes() {
        // Safe list without exposing correct answers in full
        return quizzesMap.values().stream()
                .map(this::sanitizeQuiz)
                .collect(Collectors.toList());
    }

    public Optional<QuizDto> getQuizById(String quizId, boolean sanitize) {
        QuizDto quiz = quizzesMap.get(quizId);
        if (quiz == null) return Optional.empty();
        return Optional.of(sanitize ? sanitizeQuiz(quiz) : quiz);
    }

    public List<MarketScenarioDto> getMarketScenarios() {
        return scenariosList;
    }

    @Transactional
    public void markLessonCompleted(User user, String lessonId) {
        Optional<LearningLessonDto> lessonOpt = getLessonById(lessonId);
        if (lessonOpt.isEmpty()) {
            throw new IllegalArgumentException("Leçon introuvable : " + lessonId);
        }
        LearningLessonDto lesson = lessonOpt.get();

        if (progressRepository.findByUserIdAndLessonId(user.getId(), lessonId).isEmpty()) {
            LearningProgress progress = LearningProgress.builder()
                    .user(user)
                    .lessonId(lessonId)
                    .moduleId(lesson.getModuleId())
                    .completed(true)
                    .build();
            progressRepository.save(progress);

            // Vérifier si toutes les leçons du module sont complétées ET que le quiz a déjà été réussi (>= 75%)
            checkAndUnlockModuleBadges(user, lesson.getModuleId());
        }
    }

    @Transactional
    public QuizResultDto submitQuiz(User user, QuizSubmissionDto submission) {
        QuizDto quiz = quizzesMap.get(submission.getQuizId());
        if (quiz == null) {
            throw new IllegalArgumentException("Quiz introuvable : " + submission.getQuizId());
        }

        int total = quiz.getQuestions().size();
        int score = 0;
        Map<String, Integer> correctAnswers = new HashMap<>();
        Map<String, String> explanations = new HashMap<>();

        Map<String, Integer> userAnswers = submission.getAnswers() != null ? submission.getAnswers() : Collections.emptyMap();

        for (QuizQuestionDto q : quiz.getQuestions()) {
            correctAnswers.put(q.getId(), q.getCorrectOptionIndex());
            explanations.put(q.getId(), q.getExplanation());

            Integer userChoice = userAnswers.get(q.getId());
            if (userChoice != null && userChoice.equals(q.getCorrectOptionIndex())) {
                score++;
            }
        }

        BigDecimal percentage = total > 0
                ? BigDecimal.valueOf(score).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        boolean passed = percentage.compareTo(BigDecimal.valueOf(quiz.getPassingScorePct())) >= 0;

        QuizAttempt attempt = QuizAttempt.builder()
                .user(user)
                .quizId(quiz.getId())
                .score(score)
                .totalQuestions(total)
                .percentage(percentage)
                .passed(passed)
                .build();
        quizAttemptRepository.save(attempt);

        List<UserBadgeDto> newlyUnlocked = new ArrayList<>();
        String feedback;

        if (passed) {
            // Le badge est débloqué SI ET SEULEMENT SI le quiz est réussi (>= 75%) ET tous les cours du module sont validés
            newlyUnlocked = checkAndUnlockModuleBadges(user, quiz.getModuleId());

            LearningModuleDto mod = modulesMap.get(quiz.getModuleId());
            long completedLessons = progressRepository.countByUserIdAndModuleId(user.getId(), quiz.getModuleId());
            int totalModLessons = mod != null ? mod.getLessons().size() : 0;

            if (!newlyUnlocked.isEmpty()) {
                feedback = "Félicitations ! Cours et Quiz validés avec " + percentage + "% ! Vous avez débloqué le Badge et votre Certificat Officiel téléchargeable.";
            } else if (completedLessons < totalModLessons) {
                feedback = "Quiz réussi avec " + percentage + "% ! Pour obtenir le Badge et Certificat officiel de cette section, terminez également la lecture de toutes les fiches de cours (" + completedLessons + "/" + totalModLessons + " complétées).";
            } else {
                feedback = "Quiz réussi avec " + percentage + "% ! Module et certifications à jour.";
            }
        } else {
            feedback = "Score insuffisant (" + percentage + "%). Le seuil requis pour valider le badge et certificat est de " + quiz.getPassingScorePct() + "%. Relisez la fiche de cours et retentez votre chance.";
        }

        return QuizResultDto.builder()
                .quizId(quiz.getId())
                .score(score)
                .totalQuestions(total)
                .percentage(percentage)
                .passed(passed)
                .feedback(feedback)
                .correctAnswers(correctAnswers)
                .explanations(explanations)
                .newlyUnlockedBadges(newlyUnlocked)
                .build();
    }

    @Transactional
    public List<UserBadgeDto> checkAndUnlockModuleBadges(User user, String moduleId) {
        List<UserBadgeDto> newlyUnlocked = new ArrayList<>();
        LearningModuleDto mod = modulesMap.get(moduleId);
        if (mod == null) return newlyUnlocked;

        long completedCount = progressRepository.countByUserIdAndModuleId(user.getId(), moduleId);
        boolean allLessonsDone = completedCount >= mod.getLessons().size();

        Optional<QuizAttempt> bestAttempt = quizAttemptRepository.findFirstByUserIdAndQuizIdOrderByPercentageDesc(user.getId(), mod.getQuizId());
        boolean quizPassed75 = bestAttempt.isPresent()
                && Boolean.TRUE.equals(bestAttempt.get().getPassed())
                && bestAttempt.get().getPercentage().compareTo(BigDecimal.valueOf(75)) >= 0;

        // Condition stricte : Leçons toutes terminées ET Quiz >= 75%
        if (allLessonsDone && quizPassed75) {
            String badgeCode;
            String badgeTitle;
            String badgeDesc;
            String category;

            switch (moduleId) {
                case "MOD_MARKET_BASICS" -> {
                    badgeCode = "BADGE_BASICS";
                    badgeTitle = "Opérateur de Bourse Qualifié";
                    badgeDesc = "Validation complète des leçons de microstructure et du quiz avec plus de 75%.";
                    category = "TRADING";
                }
                case "MOD_TECHNICAL_ANALYSIS" -> {
                    badgeCode = "BADGE_CHARTIST";
                    badgeTitle = "Analyste Technique & Quant";
                    badgeDesc = "Validation complète des indicateurs techniques et du quiz avec plus de 75%.";
                    category = "QUANTITATIVE";
                }
                case "MOD_MULTI_ASSET" -> {
                    badgeCode = "BADGE_MULTI_ASSET";
                    badgeTitle = "Stratège Multi-Actifs";
                    badgeDesc = "Validation complète des cours Forex, Obligations, Matières premières et du quiz avec plus de 75%.";
                    category = "MULTI_ASSET";
                }
                case "MOD_FUNDAMENTAL" -> {
                    badgeCode = "BADGE_CFA_ANALYST";
                    badgeTitle = "Analyste Financier Certifié";
                    badgeDesc = "Validation complète des bilans Form 10-K, ratios financiers et du quiz avec plus de 75%.";
                    category = "FUNDAMENTALS";
                }
                case "MOD_RISK_STRESS" -> {
                    badgeCode = "BADGE_RISK_MANAGER";
                    badgeTitle = "Risk Manager Bâle III & XAI";
                    badgeDesc = "Validation complète de la VaR, du stress testing bancaire et du quiz avec plus de 75%.";
                    category = "RISK";
                }
                case "MOD_ACTUARIAL" -> {
                    badgeCode = "BADGE_ACTUARY";
                    badgeTitle = "Actuaire & Modélisateur Agréé";
                    badgeDesc = "Validation complète de la tarification GLM, provisions Chain-Ladder et du quiz avec plus de 75%.";
                    category = "ACTUARY";
                }
                default -> {
                    return newlyUnlocked;
                }
            }

            BigDecimal scorePct = bestAttempt.get().getPercentage();
            unlockBadgeIfEligible(user, badgeCode, badgeTitle, badgeDesc, category, scorePct)
                    .ifPresent(newlyUnlocked::add);

            // Vérifier si tous les 6 modules sont certifiés pour décerner le Master
            boolean allModulesCertified = modulesMap.keySet().stream().allMatch(mId -> {
                LearningModuleDto m = modulesMap.get(mId);
                long c = progressRepository.countByUserIdAndModuleId(user.getId(), mId);
                Optional<QuizAttempt> qa = quizAttemptRepository.findFirstByUserIdAndQuizIdOrderByPercentageDesc(user.getId(), m.getQuizId());
                return c >= m.getLessons().size() && qa.isPresent() && Boolean.TRUE.equals(qa.get().getPassed()) && qa.get().getPercentage().compareTo(BigDecimal.valueOf(75)) >= 0;
            });

            if (allModulesCertified) {
                unlockBadgeIfEligible(user, "BADGE_MASTER_MARKETS", "Master de Salle de Marché",
                        "Diplômé d'excellence ayant validé l'intégralité du cursus académique MarketSim.", "EXCELLENCE", new BigDecimal("100.00"))
                        .ifPresent(newlyUnlocked::add);
            }
        }

        return newlyUnlocked;
    }

    @Transactional(readOnly = true)
    public UserLearningProfileDto getUserLearningProfile(User user) {
        List<LearningProgress> progressList = progressRepository.findByUserId(user.getId());
        Set<String> completedLessonIds = progressList.stream()
                .map(LearningProgress::getLessonId)
                .collect(Collectors.toSet());

        List<QuizAttempt> attempts = quizAttemptRepository.findByUserIdOrderByAttemptedAtDesc(user.getId());
        Set<String> passedQuizIds = attempts.stream()
                .filter(QuizAttempt::getPassed)
                .map(QuizAttempt::getQuizId)
                .collect(Collectors.toSet());

        Map<String, BigDecimal> quizBestScores = new HashMap<>();
        for (QuizAttempt a : attempts) {
            quizBestScores.merge(a.getQuizId(), a.getPercentage(), (oldVal, newVal) -> oldVal.max(newVal));
        }

        List<UserBadge> badges = badgeRepository.findByUserIdOrderByUnlockedAtDesc(user.getId());
        List<UserBadgeDto> badgeDtos = badges.stream()
                .map(b -> {
                    String certId = "ESPRIT-MS-2026-" + b.getBadgeCode().replace("BADGE_", "") + "-" + String.format("%04d", Math.abs((user.getId() * 31 + b.getBadgeCode().hashCode()) % 10000));
                    BigDecimal bestScore = quizBestScores.values().stream().max(BigDecimal::compareTo).orElse(BigDecimal.valueOf(100));
                    return UserBadgeDto.builder()
                            .badgeCode(b.getBadgeCode())
                            .title(b.getTitle())
                            .description(b.getDescription())
                            .category(b.getCategory())
                            .unlockedAt(b.getUnlockedAt())
                            .certificateId(certId)
                            .scorePercentage(bestScore)
                            .build();
                })
                .collect(Collectors.toList());

        int totalLessons = modulesMap.values().stream().mapToInt(m -> m.getLessons().size()).sum();
        int totalQuizzes = quizzesMap.size();

        double lessonRatio = totalLessons > 0 ? (double) completedLessonIds.size() / totalLessons : 0.0;
        double quizRatio = totalQuizzes > 0 ? (double) passedQuizIds.size() / totalQuizzes : 0.0;
        double overallScore = (lessonRatio * 0.4 + quizRatio * 0.6) * 100.0;

        String userTitle = "Trader Apprenti";
        if (overallScore >= 90.0) {
            userTitle = "Directeur de Salle de Marché (Managing Director)";
        } else if (overallScore >= 70.0) {
            userTitle = "Trader Senior & Risk Manager";
        } else if (overallScore >= 45.0) {
            userTitle = "Analyste Quantitatif Confirmé";
        } else if (overallScore >= 20.0) {
            userTitle = "Opérateur Junior de Marché";
        }

        return UserLearningProfileDto.builder()
                .userId(user.getId())
                .completedLessonIds(completedLessonIds)
                .passedQuizIds(passedQuizIds)
                .quizBestScores(quizBestScores)
                .badges(badgeDtos)
                .completedLessonsCount(completedLessonIds.size())
                .totalLessonsCount(totalLessons)
                .passedQuizzesCount(passedQuizIds.size())
                .totalQuizzesCount(totalQuizzes)
                .overallProgressPct(BigDecimal.valueOf(overallScore).setScale(1, RoundingMode.HALF_UP))
                .userTitle(userTitle)
                .build();
    }

    private Optional<UserBadgeDto> unlockBadgeIfEligible(User user, String code, String title, String desc, String cat, BigDecimal scorePct) {
        if (!badgeRepository.existsByUserIdAndBadgeCode(user.getId(), code)) {
            UserBadge b = UserBadge.builder()
                    .user(user)
                    .badgeCode(code)
                    .title(title)
                    .description(desc)
                    .category(cat)
                    .build();
            UserBadge saved = badgeRepository.save(b);
            String certId = "ESPRIT-MS-2026-" + code.replace("BADGE_", "") + "-" + String.format("%04d", Math.abs((user.getId() * 31 + code.hashCode()) % 10000));
            return Optional.of(UserBadgeDto.builder()
                    .badgeCode(saved.getBadgeCode())
                    .title(saved.getTitle())
                    .description(saved.getDescription())
                    .category(saved.getCategory())
                    .unlockedAt(saved.getUnlockedAt() != null ? saved.getUnlockedAt() : LocalDateTime.now())
                    .scorePercentage(scorePct != null ? scorePct : BigDecimal.valueOf(100))
                    .certificateId(certId)
                    .build());
        }
        return Optional.empty();
    }

    private QuizDto sanitizeQuiz(QuizDto full) {
        return QuizDto.builder()
                .id(full.getId())
                .moduleId(full.getModuleId())
                .title(full.getTitle())
                .description(full.getDescription())
                .passingScorePct(full.getPassingScorePct())
                .questions(full.getQuestions().stream()
                        .map(q -> QuizQuestionDto.builder()
                                .id(q.getId())
                                .question(q.getQuestion())
                                .options(q.getOptions())
                                .correctOptionIndex(null) // Masquer la bonne réponse avant soumission
                                .explanation(null)
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }

    // =========================================================================
    // INITIALISATION DES CONTENUS PÉDAGOGIQUES
    // =========================================================================

    private void initModules() {
        // Module 1 : Microstructure & Ordres de Bourse
        LearningLessonDto l1_1 = LearningLessonDto.builder()
                .id("LES_ORDRES_TYPES")
                .moduleId("MOD_MARKET_BASICS")
                .orderIndex(1)
                .title("Typologie des Ordres : Marché, Limite & Déclenchement")
                .durationMinutes(10)
                .summary("Comprendre l'exécution des ordres, le carnet d'ordres et les mécanismes de liquidité.")
                .contentMarkdown("""
# Typologie des Ordres de Bourse

Dans une salle de marché, un ordre est une instruction transmise par un intervenant à un courtier ou à un marché organisé pour exécuter une transaction financière.

### 1. Ordre au Marché (Market Order)
- **Définition** : Exécution immédiate au meilleur cours disponible dans le carnet d'ordres.
- **Avantage** : Certitude quasi absolue de l'exécution immédiate.
- **Inconvénient** : Aucune garantie sur le prix d'exécution. L'acheteur subit le *slippage* en cas de forte volatilité ou d'illiquidité.

### 2. Ordre à Cours Limité (Limit Order)
- **Définition** : Exécution conditionnée à un prix maximal fixé à l'achat, ou un prix minimal fixé à la vente.
- **Avantage** : Maîtrise parfaite du cours d'exécution.
- **Inconvénient** : Risque de non-exécution si le cours du marché n'atteint jamais la limite fixée.

### 3. Ordres de Protection : Stop-Loss & Take-Profit
- **Stop-Loss (Ordre Stop)** : Ordre automatique de vente se déclenchant si le cours franchit un seuil bas prédéfini, afin de couper les pertes de manière disciplinée.
- **Take-Profit (Prise de Bénéfice)** : Ordre automatique clôturant une position gagnante à un niveau cible d'espérance de gain.
""")
                .keyTakeaways(List.of(
                        "L'ordre au marché privilégie la vitesse d'exécution sur le prix.",
                        "L'ordre à cours limité garantit le prix au détriment de la certitude d'exécution.",
                        "Le Stop-Loss et le Take-Profit sont indispensables pour une gestion rigoureuse du risque de ruine."
                ))
                .build();

        LearningLessonDto l1_2 = LearningLessonDto.builder()
                .id("LES_CARNET_ORDRES")
                .moduleId("MOD_MARKET_BASICS")
                .orderIndex(2)
                .title("Le Carnet d'Ordres et le Spread Bid/Ask")
                .durationMinutes(8)
                .summary("Comment fonctionne la confrontation de l'offre et de la demande dans un marché dirigé par les ordres.")
                .contentMarkdown("""
# Le Carnet d'Ordres & le Spread Bid/Ask

### 1. Structure du Carnet d'Ordres
Le carnet d'ordres centralise en temps réel les intentions d'achat (**Bid**) et de vente (**Ask**) :
- **Bid (Demande)** : Le cours maximal qu'un acheteur est disposé à payer.
- **Ask (Offre)** : Le cours minimal qu'un vendeur est disposé à recevoir.

### 2. Le Spread Bid-Ask
Le spread est l'écart entre le meilleur Ask et le meilleur Bid :
$$\\text{Spread} = \\text{Best Ask} - \\text{Best Bid}$$

- Un spread très serré (quelques centimes ou fractions de pip) indique une liquidité abondante (ex: EUR/USD, Apple, Microsoft).
- Un spread large traduit une rareté de contrepartie et augmente le coût effectif de transaction pour l'investisseur.
""")
                .keyTakeaways(List.of(
                        "Le Bid est toujours inférieur ou égal au Ask.",
                        "Le spread représente le coût immédiat de l'accès à la liquidité.",
                        "Les teneurs de marché (Market Makers) rémunèrent leur risque d'inventaire via le spread."
                ))
                .build();

        LearningModuleDto mod1 = LearningModuleDto.builder()
                .id("MOD_MARKET_BASICS")
                .title("Fondamentaux des Marchés & Ordres de Bourse")
                .description("Maîtrisez la microstructure des marchés financiers, les types d'ordres et la dynamique du carnet d'ordres.")
                .category("TRADING")
                .level("BEGINNER")
                .icon("Activity")
                .durationMinutes(18)
                .lessonsCount(2)
                .quizId("QUIZ_MARKET_BASICS")
                .lessons(List.of(l1_1, l1_2))
                .build();
        modulesMap.put(mod1.getId(), mod1);

        // Module 2 : Analyse Technique & Quantitative
        LearningLessonDto l2_1 = LearningLessonDto.builder()
                .id("LES_INDICATEURS_TECHNIQUES")
                .moduleId("MOD_TECHNICAL_ANALYSIS")
                .orderIndex(1)
                .title("Moyennes Mobiles & Oscillateurs (SMA, RSI, MACD)")
                .durationMinutes(12)
                .summary("Utiliser les indicateurs de tendance et d'élan pour identifier les opportunités de trading.")
                .contentMarkdown("""
# Indicateurs Techniques de Tendance et de Momentum

### 1. Moyennes Mobiles Simples (SMA)
La moyenne mobile arithmétique lisse les fluctuations aléatoires pour révéler la tendance de fond :
$$\\text{SMA}_n = \\frac{1}{n} \\sum_{i=1}^n P_i$$

- **Golden Cross** : La SMA 50 croise à la hausse la SMA 200, signal haussier majeur de moyen/long terme.
- **Death Cross** : La SMA 50 croise à la baisse la SMA 200, signal annonciateur d'un marché baissier (Bear Market).

### 2. Relative Strength Index (RSI)
Oscillateur borné entre 0 et 100 mesurant la vitesse et l'amplitude des gains récents par rapport aux pertes :
- **RSI > 70** : Zone de **surachat**, potentiel épuisement acheteur et risque de correction.
- **RSI < 30** : Zone de **survente**, pression vendeuse excessive et opportunité de rebond technique.
""")
                .keyTakeaways(List.of(
                        "Les moyennes mobiles agissent comme supports et résistances dynamiques.",
                        "Le RSI détecte les divergences haussières et baissières entre le cours et le momentum.",
                        "Ne jamais trader un indicateur isolé : combiner tendance, volume et volatilité."
                ))
                .build();

        LearningLessonDto l2_2 = LearningLessonDto.builder()
                .id("LES_BACKTESTING_METRICS")
                .moduleId("MOD_TECHNICAL_ANALYSIS")
                .orderIndex(2)
                .title("Backtesting & Métriques de Performance (Sharpe, Drawdown)")
                .durationMinutes(14)
                .summary("Évaluer rigoureusement la robustesse statistique d'une stratégie algorithmique sur données historiques.")
                .contentMarkdown("""
# Méthodologie de Backtesting et Métriques Clés

### 1. Ratio de Sharpe
Mesure l'excès de rentabilité par unité de risque (volatilité) :
$$\\text{Sharpe} = \\frac{R_p - R_f}{\\sigma_p}$$
- Sharpe < 1.0 : Stratégie sous-optimale au regard du risque pris.
- Sharpe > 1.5 : Bonne stratégie d'investissement.
- Sharpe > 2.0 : Stratégie quantitative d'excellence.

### 2. Maximum Drawdown (MDD)
Perte maximale enregistrée depuis le pic le plus haut jusqu'au creux le plus bas avant reconquête d'un nouveau sommet :
$$\\text{MDD} = \\frac{\\text{Trough} - \\text{Peak}}{\\text{Peak}}$$
Un MDD supérieur à 25-30% met en danger la psychologie de l'investisseur et la solvabilité du compte.
""")
                .keyTakeaways(List.of(
                        "Le backtesting prévient le biais rétrospectif et teste la solidité d'une règle systématique.",
                        "Le ratio de Sharpe pénalise la volatilité indésirable.",
                        "Surveiller le Max Drawdown pour dimensionner la taille de position."
                ))
                .build();

        LearningModuleDto mod2 = LearningModuleDto.builder()
                .id("MOD_TECHNICAL_ANALYSIS")
                .title("Analyse Technique & Stratégies Quantitatives")
                .description("Explorez les chandeliers, les moyennes mobiles, le RSI, et apprenez à concevoir des backtests rigoureux.")
                .category("QUANTITATIVE")
                .level("INTERMEDIATE")
                .icon("BarChart3")
                .durationMinutes(26)
                .lessonsCount(2)
                .quizId("QUIZ_TECHNICAL")
                .lessons(List.of(l2_1, l2_2))
                .build();
        modulesMap.put(mod2.getId(), mod2);

        // Module 3 : Marchés Multi-Actifs
        LearningLessonDto l3_1 = LearningLessonDto.builder()
                .id("LES_FOREX_PIPS")
                .moduleId("MOD_MULTI_ASSET")
                .orderIndex(1)
                .title("Le Marché des Devises (Forex) & Calcul des Pips")
                .durationMinutes(15)
                .summary("Mécanismes de cotation des paires de devises, cotations interbancaires BCE et gestion du risque de change.")
                .contentMarkdown("""
# Microstructure du Marché Forex

Le marché des devises (Foreign Exchange) est le plus vaste marché financier au monde, avec plus de 7 000 milliards de dollars échangés quotidiennement.

### 1. Structure d'une Paire de Devises
Dans la paire **EUR/USD = 1.08500** :
- **EUR** est la devise de base (Base Currency).
- **USD** est la devise de cotation ou contrepartie (Quote Currency).
- Cela signifie qu'1 Euro s'échange contre 1.08500 Dollar US.

### 2. Le Pip (Percentage in Point)
- Pour la majorité des paires (EUR/USD, GBP/USD), un pip correspond à la **4ème décimale** (0.0001).
- Pour les paires contenant le Yen japonais (USD/JPY), un pip correspond à la **2ème décimale** (0.01).
- Sur un lot standard de 100 000 EUR en EUR/USD, 1 pip de variation représente exactement :
$$100\\,000 \\times 0.0001 = 10\\text{ USD}$$
""")
                .keyTakeaways(List.of(
                        "Le Forex est un marché de gré à gré (OTC) ouvert en continu 24h/5j.",
                        "Le pip mesure la variation élémentaire de prix selon la convention de la paire.",
                        "Surveiller les différentiels de taux d'intérêt des banques centrales (Fed vs BCE)."
                ))
                .build();

        LearningLessonDto l3_2 = LearningLessonDto.builder()
                .id("LES_BONDS_COMMODITIES")
                .moduleId("MOD_MULTI_ASSET")
                .orderIndex(2)
                .title("Obligations (Bonds, Duration, YTM) & Matières Premières")
                .durationMinutes(16)
                .summary("Comprendre le lien inverse entre cours obligataire et taux d'intérêt, ainsi que le rôle défensif des commodities.")
                .contentMarkdown("""
# Marché Obligataire et Matières Premières

### 1. Obligations Souveraines & Duration
Une obligation est un titre de créance émis par un État ou une entreprise.
- **Rendement à l'échéance (YTM)** : Taux de rentabilité annuel actuariel intégrant les coupons et le remboursement du pair.
- **Loi fondamentale obligataire** : Les cours obligataires évoluent en sens inverse des taux d'intérêt de marché.
$$\\Delta P \\approx -D_{\\text{mod}} \\times \\Delta y \\times P$$
- **Duration Modifiée ($D_{\\text{mod}}$)** : Mesure la sensibilité en pourcentage du cours de l'obligation pour une variation de 100 bps de taux d'intérêt.

### 2. Matières Premières (Commodities)
- **Or (GLD)** : Actif refuge dénué de risque de contrepartie, protection historique contre l'inflation et la dépréciation monétaire.
- **Pétrole (WTI, USO)** : Baromètre de l'activité économique mondiale, fortement sensible aux tensions géopolitiques et à l'OPEP.
""")
                .keyTakeaways(List.of(
                        "Quand les taux montent, le cours des obligations existantes baisse.",
                        "Plus la maturité est longue, plus la duration est élevée et le risque de taux important.",
                        "L'or et les matières premières apportent une diversification essentielle en phase d'inflation."
                ))
                .build();

        LearningModuleDto mod3 = LearningModuleDto.builder()
                .id("MOD_MULTI_ASSET")
                .title("Marchés Multi-Actifs (Forex • Obligations • Commodities)")
                .description("Explorez les devises interbancaires, les calculs de pips, les obligations souveraines et l'or physique.")
                .category("MULTI_ASSET")
                .level("INTERMEDIATE")
                .icon("Globe")
                .durationMinutes(31)
                .lessonsCount(2)
                .quizId("QUIZ_MULTI_ASSET")
                .lessons(List.of(l3_1, l3_2))
                .build();
        modulesMap.put(mod3.getId(), mod3);

        // Module 4 : Analyse Fondamentale & SEC 10-K
        LearningLessonDto l4_1 = LearningLessonDto.builder()
                .id("LES_FINANCIAL_STATEMENTS")
                .moduleId("MOD_FUNDAMENTAL")
                .orderIndex(1)
                .title("Décryptage des États Financiers : Bilan, Résultat & Cash-Flow")
                .durationMinutes(15)
                .summary("Lire et interpréter les déclarations certifiées SEC (Form 10-K annuel et 10-Q trimestriel).")
                .contentMarkdown("""
# Anatomie des États Financiers Institutionnels

Pour évaluer la solidité économique intrinsèque d'une société cotée, l'analyste financier étudie trois documents fondamentaux :

### 1. Compte de Résultat (Income Statement)
Retrace la performance économique de l'exercice :
- **Chiffre d'Affaires (Revenue)** $\\rightarrow$ **Marge Brute** $\\rightarrow$ **Résultat d'Exploitation (Operating Income)** $\\rightarrow$ **Résultat Net**.
- **Bénéfice Par Action (EPS)** : Résultat net divisé par le nombre moyen d'actions en circulation.

### 2. Bilan Comptable (Balance Sheet)
Photographie patrimoniale à un instant $T$ selon l'équation comptable :
$$\\text{Actifs} = \\text{Passifs (Dettes)} + \\text{Capitaux Propres (Equity)}$$

### 3. Tableau des Flux de Trésorerie (Cash Flow Statement)
Le flux de trésorerie disponible (**Free Cash Flow**) représente l'oxygène réel de l'entreprise :
$$\\text{FCF} = \\text{Operating Cash Flow} - \\text{Capital Expenditures (CapEx)}$$
""")
                .keyTakeaways(List.of(
                        "Le chiffre d'affaires est une vanité, le bénéfice est un avis, le cash flow est une réalité.",
                        "Le Form 10-K est le rapport annuel audité obligatoire déposé auprès de la SEC.",
                        "Le Free Cash Flow finance les dividendes, les rachats d'actions et les investissements futurs."
                ))
                .build();

        LearningLessonDto l4_2 = LearningLessonDto.builder()
                .id("LES_VALUATION_RATIOS")
                .moduleId("MOD_FUNDAMENTAL")
                .orderIndex(2)
                .title("Ratios de Valorisation & Rentabilité (P/E, ROE, Debt/Equity)")
                .durationMinutes(14)
                .summary("Comparer les multiples boursiers et mesurer la rentabilité financière des capitaux propres.")
                .contentMarkdown("""
# Ratios Financiers de Valorisation et de Rentabilité

### 1. Ratios de Valorisation Relative
- **Price-to-Earnings (P/E)** : Multiple de cours sur bénéfice. $\\text{P/E} = \\frac{\\text{Cours}}{\\text{EPS}}$. Un P/E modéré peut signaler une sous-évaluation ou une stagnation.
- **Price-to-Book (P/B)** : Rapport entre la capitalisation boursière et les capitaux propres comptables.
- **Price-to-Sales (P/S)** : Très utile pour valoriser des entreprises en forte croissance non encore rentables.

### 2. Ratios de Rentabilité et Structure Financière
- **Return on Equity (ROE)** : Rentabilité nette des fonds propres investis par les actionnaires :
$$\\text{ROE} = \\frac{\\text{Résultat Net}}{\\text{Capitaux Propres}} \\times 100$$
- **Debt-to-Equity** : Ratio d'endettement financier. Un ratio supérieur à 2.0x signale un levier financier important susceptible d'accroître le risque de faillite.
""")
                .keyTakeaways(List.of(
                        "Un P/E faible n'est une bonne affaire que si les bénéfices futurs sont pérennes.",
                        "Un ROE durablement supérieur à 15-20% témoigne d'un avantage concurrentiel (Moat économique).",
                        "Vérifier le ratio de liquidité générale (Current Ratio > 1.2x) pour la sécurité à court terme."
                ))
                .build();

        LearningModuleDto mod4 = LearningModuleDto.builder()
                .id("MOD_FUNDAMENTAL")
                .title("Analyse Fondamentale & États Financiers SEC")
                .description("Apprenez à disséquer un bilan, un compte de résultat, le Free Cash Flow et les ratios de valorisation boursière.")
                .category("FUNDAMENTALS")
                .level("INTERMEDIATE")
                .icon("FileSpreadsheet")
                .durationMinutes(29)
                .lessonsCount(2)
                .quizId("QUIZ_FUNDAMENTAL")
                .lessons(List.of(l4_1, l4_2))
                .build();
        modulesMap.put(mod4.getId(), mod4);

        // Module 5 : Gestion des Risques, Stress Testing & XAI
        LearningLessonDto l5_1 = LearningLessonDto.builder()
                .id("LES_VAR_STRESS")
                .moduleId("MOD_RISK_STRESS")
                .orderIndex(1)
                .title("Value-at-Risk (VaR) & Scénarios de Stress Testing Bancaire")
                .durationMinutes(15)
                .summary("Quantifier les risques extrêmes et tester la résilience des institutions face aux crises macroéconomiques.")
                .contentMarkdown("""
# Value-at-Risk et Stress Testing Macroéconomique

### 1. La Value-at-Risk (VaR)
La VaR estime la perte potentielle maximale d'un portefeuille sur un horizon temporel donné à un niveau de confiance fixé (ex: 95% ou 99%) :
$$\\text{VaR}_{\\alpha} = -\\inf \\{ x \\in \\mathbb{R} : P(L > x) \\le 1 - \\alpha \\}$$
- Exemple : Une VaR 1-jour à 99% de 4 500 € signifie qu'il n'y a qu'1% de chance que la perte journalière dépasse 4 500 €.

### 2. Le Stress Testing Bancaire Bâle III
Le stress testing simule l'impact de chocs sévères mais plausibles sur les bilans bancaires :
- Choc de taux d'intérêt (+200 bps à +400 bps).
- Choc de liquidité et défauts de crédit massifs (hausse des NPL - Non Performing Loans).
- Effondrement des marchés boursiers (-30% à -50%).
""")
                .keyTakeaways(List.of(
                        "La VaR n'indique pas l'ampleur de la perte au-delà du seuil (Expected Shortfall).",
                        "Le Stress Testing complète la VaR en explorant les événements extrêmes non captés par l'historique récent.",
                        "Les accords de Bâle III imposent des ratios de solvabilité (CET1) stricts sous scénario de crise."
                ))
                .build();

        LearningLessonDto l5_2 = LearningLessonDto.builder()
                .id("LES_XAI_SHAP")
                .moduleId("MOD_RISK_STRESS")
                .orderIndex(2)
                .title("Explainable AI (XAI) & Valeurs de Shapley (SHAP)")
                .durationMinutes(12)
                .summary("Rendre interprétables les modèles de Machine Learning de risque financier.")
                .contentMarkdown("""
# Intelligence Artificielle Explicable (XAI) en Finance

Les régulateurs bancaires et les comités de risque exigent de comprendre pourquoi un modèle prédictif juge un établissement bancaire vulnérable.

### 1. Les Valeurs de Shapley (SHAP)
Issues de la théorie des jeux coopératifs (prix Nobel Lloyd Shapley), les valeurs SHAP attribuent équitablement la contribution marginale de chaque variable explicative à la prédiction finale du modèle :
$$f(x) = E[f(X)] + \\sum_{i=1}^M \\phi_i(x)$$
- $\\phi_i(x) > 0$ : La variable pousse la prédiction de risque à la hausse.
- $\\phi_i(x) < 0$ : La variable atténue le risque estimé.

### 2. Visualisation en Cascade (Waterfall Plot)
Le graphique waterfall permet à l'auditeur de visualiser pas à pas comment les caractéristiques spécifiques (ratio de liquidité, niveau de fonds propres, part de prêts non performants) font basculer l'évaluation vers une zone critique.
""")
                .keyTakeaways(List.of(
                        "La conformité réglementaire interdit les modèles 'boîte noire' non auditables.",
                        "SHAP garantit l'additivité et la consistance locale des explications.",
                        "Permet de prescrire des mesures correctives précises pour rétablir la résilience d'un établissement."
                ))
                .build();

        LearningModuleDto mod5 = LearningModuleDto.builder()
                .id("MOD_RISK_STRESS")
                .title("Gestion des Risques, Stress Testing & XAI")
                .description("Explorez la Value-at-Risk, les stress tests bancaires Bâle III et l'explicabilité algorithmique avec SHAP.")
                .category("RISK")
                .level("ADVANCED")
                .icon("ShieldAlert")
                .durationMinutes(27)
                .lessonsCount(2)
                .quizId("QUIZ_RISK_STRESS")
                .lessons(List.of(l5_1, l5_2))
                .build();
        modulesMap.put(mod5.getId(), mod5);

        // Module 6 : Actuariat & Modélisation d'Assurance (Section 3.7)
        LearningLessonDto l6_1 = LearningLessonDto.builder()
                .id("LES_ACTUARY_PRICING")
                .moduleId("MOD_ACTUARIAL")
                .orderIndex(1)
                .title("Tarification des Primes d'Assurance : GLM & Marges")
                .durationMinutes(14)
                .summary("Modélisation statistique de la fréquence et du coût moyen des sinistres pour fixer une prime technique et commerciale.")
                .contentMarkdown("""
# Tarification Prédictive des Primes d'Assurance

L'actuariat applique la théorie des probabilités et la modélisation statistique à la couverture des risques assurantiels.

### 1. Décomposition Fondamentale de la Prime
$$\\text{Prime Pure} = \\text{Fréquence Attendue } (\\lambda) \\times \\text{Coût Moyen Attendue } (\\mu)$$
- **Chargement de sécurité** : Marge pour couvrir les fluctuations stochastiques défavorables.
$$\\text{Prime Technique} = \\text{Prime Pure} \\times (1 + \\text{Chargement Sécurité})$$
- **Prime Commerciale** : Intègre les frais de gestion opérationnels et la marge bénéficiaire cible :
$$\\text{Prime Commerciale} = \\frac{\\text{Prime Technique}}{1 - \\text{Frais}\\% - \\text{Marge}\\%}$$

### 2. Le Ratio Combiné (Combined Ratio)
Indicateur roi de la rentabilité technique de la compagnie d'assurance :
$$\\text{Ratio Combiné} = \\frac{\\text{Sinistres Réglés} + \\text{Frais de Gestion}}{\\text{Primes Acquises}} \\times 100$$
- Si Ratio < 100% : Souscription rentable (Bénéfice technique).
- Si Ratio > 100% : Pertes techniques, la compagnie dépend de ses placements financiers pour être bénéficiaire.
""")
                .keyTakeaways(List.of(
                        "La prime pure correspond au coût mathématique espéré du risque assuré.",
                        "La franchise absorbe les micro-sinistres et responsabilise l'assuré.",
                        "Le ratio combiné doit rester sous 100% pour assurer la pérennité économique de l'assureur."
                ))
                .build();

        LearningLessonDto l6_2 = LearningLessonDto.builder()
                .id("LES_CHAIN_LADDER_IBNR")
                .moduleId("MOD_ACTUARIAL")
                .orderIndex(2)
                .title("Provisionnement des Sinistres : Méthode Chain-Ladder & IBNR")
                .durationMinutes(16)
                .summary("Calcul des réserves pour sinistres survenus non encore réglés (IBNR) et exigences Solvabilité II.")
                .contentMarkdown("""
# Provisionnement Non-Vie & Triangles de Liquidation

Dans les branches à développement long (RC, Décennale, Dommages Corporels), plusieurs années s'écoulent entre la survenance d'un sinistre et son règlement définitif.

### 1. Les Réserves IBNR (Incurred But Not Reported)
Les assureurs ont l'obligation légale de constituer des provisions techniques pour honorer leurs engagements futurs.
$$\\text{Charge Ultime } (U_i) = \\text{Sinistres Payés à Date } (C_{i, \\text{latest}}) + \\text{Provisions IBNR}$$

### 2. La Méthode de Chain-Ladder (Mack)
La méthode projette les sinistres cumulés d'un triangle de survenance/développement à l'aide de facteurs de passage (**Link Ratios**) :
$$f_j = \\frac{\\sum_{i=1}^{n-j} C_{i, j+1}}{\\sum_{i=1}^{n-j} C_{i, j}}$$
En multipliant le montant cumulé observé par le produit des facteurs de passage futurs, on obtient la charge ultime projetée.

### 3. Solvabilité II et SCR (Solvency Capital Requirement)
La directive européenne impose un capital de solvabilité requis garantissant que la compagnie d'assurance peut absorber un choc centennal (VaR 99.5% à 1 an).
""")
                .keyTakeaways(List.of(
                        "Les triangles de liquidation Chain-Ladder modélisent l'inertie de déclaration des sinistres.",
                        "Les provisions IBNR représentent la dette future certaine de l'assureur envers ses assurés.",
                        "Le cadre Solvabilité II protège les assurés contre le risque de défaillance des compagnies."
                ))
                .build();

        LearningModuleDto mod6 = LearningModuleDto.builder()
                .id("MOD_ACTUARIAL")
                .title("Actuariat & Modélisation d'Assurance")
                .description("Explorez la tarification des primes GLM, les simulations Monte Carlo et le provisionnement Chain-Ladder IBNR.")
                .category("ACTUARY")
                .level("ADVANCED")
                .icon("ShieldCheck")
                .durationMinutes(30)
                .lessonsCount(2)
                .quizId("QUIZ_ACTUARIAL")
                .lessons(List.of(l6_1, l6_2))
                .build();
        modulesMap.put(mod6.getId(), mod6);
    }

    private void initQuizzes() {
        // Quiz 1 : Validation : Mécanismes d'Ordres & Microstructure
        QuizDto q1 = QuizDto.builder()
                .id("QUIZ_MARKET_BASICS")
                .moduleId("MOD_MARKET_BASICS")
                .title("Validation : Mécanismes d'Ordres & Microstructure")
                .description("Évaluez vos compétences sur le carnet d'ordres, l'exécution limite vs marché et les ordres stop (20 questions).")
                .passingScorePct(75)
                .questions(List.of(
                        QuizQuestionDto.builder()
                                .id("Q1_1")
                                .question("Quel type d'ordre privilégie la certitude et l'immédiateté d'exécution plutôt que le prix ?")
                                .options(List.of(
                                        "Ordre à cours limité",
                                        "Ordre au marché (Market Order)",
                                        "Ordre Stop-Loss",
                                        "Ordre tout ou rien"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'ordre au marché est exécuté immédiatement aux meilleurs cours du carnet vendeur/acheteur, sans garantie de cours.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_2")
                                .question("Que représente le spread Bid/Ask dans un carnet d'ordres ?")
                                .options(List.of(
                                        "La commission facturée par le régulateur financier",
                                        "L'écart entre le cours le plus haut et le plus bas de la séance",
                                        "L'écart entre le meilleur prix d'achat (Bid) et le meilleur prix de vente (Ask)",
                                        "Le volume moyen d'actions échangées par seconde"
                                ))
                                .correctOptionIndex(2)
                                .explanation("Le spread Bid-Ask est la différence entre le prix le plus bas proposé à la vente (Ask) et le plus haut offert à l'achat (Bid).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_3")
                                .question("Un trader détient une action achetée à $150. Où doit-il positionner son ordre Stop-Loss pour couper ses pertes à 5% ?")
                                .options(List.of(
                                        "À $157.50",
                                        "À $142.50",
                                        "À $145.00",
                                        "À $150.00"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Une baisse de 5% de 150 $ correspond à 150 - (150 * 0.05) = 142.50 $.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_4")
                                .question("Quel phénomène se produit lorsqu'un ordre est exécuté à un prix différent de celui affiché à l'écran en raison d'une volatilité rapide ?")
                                .options(List.of(
                                        "Le Short Squeeze",
                                        "Le Débouclage d'urgence",
                                        "Le Slippage (glissement de cours)",
                                        "La Contango"
                                ))
                                .correctOptionIndex(2)
                                .explanation("Le slippage est la différence entre le cours attendu d'une transaction et le cours auquel elle est effectivement exécutée.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_5")
                                .question("Dans un ordre Stop-Limit, quelle est la fonction du prix Stop ?")
                                .options(List.of(
                                        "Le prix maximal auquel l'ordre sera exécuté",
                                        "Le seuil de cours qui déclenche l'envoi d'un ordre à cours limité dans le carnet",
                                        "Le prix d'ouverture garanti par la bourse",
                                        "Le niveau de dividende obligatoire"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le prix Stop est le niveau de déclenchement : dès qu'il est touché, l'ordre devient actif sous forme d'ordre limite au cours Limit spécifié.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_6")
                                .question("Quelle information additionnelle fournit un carnet d'ordres de Niveau 2 (Level 2) par rapport au Niveau 1 ?")
                                .options(List.of(
                                        "Uniquement le dernier cours négocié et le volume journalier",
                                        "La profondeur complète du carnet avec les quantités offertes et demandées sur plusieurs paliers de prix",
                                        "Le nom et l'adresse IP de chaque investisseur",
                                        "Le bilan comptable certifié de l'émetteur"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le carnet L2 affiche la profondeur du marché (Market Depth) sur plusieurs niveaux de prix de part et d'autre du spread.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_7")
                                .question("Comment se comporte un ordre assorti de la validité IOC (Immediate-or-Cancel) ?")
                                .options(List.of(
                                        "Il reste dans le carnet jusqu'à la fin du mois sans jamais être annulé",
                                        "Il exécute immédiatement toute quantité disponible à son prix et annule le solde non exécuté",
                                        "Il n'est exécuté que si la totalité absolue de la quantité est disponible immédiatement, sinon rien",
                                        "Il ne s'exécute que lors des enchères de clôture"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'ordre IOC exécute immédiatement autant de titres que possible au cours limite et annule instantanément le reliquat.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_8")
                                .question("Quel est le rôle principal d'un Teneur de Marché (Market Maker) dans la microstructure financière ?")
                                .options(List.of(
                                        "Interdire les ventes à découvert lors des crises",
                                        "Cotiser en continu des prix d'achat et de vente pour apporter de la liquidité en contrepartie du spread",
                                        "Fixer arbitrairement le dividende des entreprises cotées",
                                        "Gérer les faillites bancaires pour le compte de l'État"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Market Maker assure la liquidité du marché en affichant simultanément des ordres d'achat (Bid) et de vente (Ask), se rémunérant sur le spread.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_9")
                                .question("Quelle est la condition stricte d'un ordre FOK (Fill-or-Kill) ?")
                                .options(List.of(
                                        "Exécution partielle acceptée, le reste reste dans le carnet",
                                        "Exécution intégrale et immédiate de toute la taille de l'ordre, sinon annulation totale sans aucune exécution partielle",
                                        "Exécution étalée sur une durée de 24 heures",
                                        "Remplacement automatique par un ordre au marché à la clôture"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Un ordre FOK exige que la totalité des titres soit négociée immédiatement, à défaut de quoi l'ordre est intégralement annulé.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_10")
                                .question("Pourquoi un investisseur institutionnel utilise-t-il un ordre Iceberg (ordre caché) ?")
                                .options(List.of(
                                        "Pour ne pas payer de taxes sur les transactions financières",
                                        "Pour dissimuler la taille réelle d'un bloc massif d'actions et limiter l'impact de marché néfaste sur les cours",
                                        "Pour garantir un rendement de 10% annuel sans risque",
                                        "Pour empêcher le régulateur de voir la transaction"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'ordre Iceberg ne dévoile qu'une fraction visible (la pointe) dans le carnet pour éviter que les autres traders n'ajustent agressivement leurs cours.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_11")
                                .question("À quoi sert un mécanisme de coupe-circuit (Circuit Breaker ou LULD - Limit Up / Limit Down) sur une bourse ?")
                                .options(List.of(
                                        "À couper l'électricité des salles de marché en fin de journée",
                                        "À suspendre temporairement la cotation d'un titre ou de l'indice pour calmer la panique lors de variations extrêmes anormales",
                                        "À forcer la vente des actions des petits porteurs",
                                        "À doubler la valeur des ordres d'achat en cas de krach"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Les coupe-circuits interrompent brièvement la négociation pour permettre aux participants d'assimiler les informations et restaurer la liquidité.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_12")
                                .question("Qu'est-ce qu'un 'Dark Pool' dans l'écosystème boursier moderne ?")
                                .options(List.of(
                                        "Un virus informatique visant les terminaux Bloomberg",
                                        "Une plateforme privée de négociation de blocs d'actions sans transparence pré-négociation du carnet d'ordres",
                                        "Un fonds spéculatif non régulé basé dans un paradis fiscal",
                                        "Un compte d'épargne bloqué"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Les Dark Pools permettent aux institutionnels de négocier de volumineux blocs sans révéler leurs intentions avant l'exécution, évitant ainsi le slippage.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_13")
                                .question("Pourquoi les firmes de Trading Haute Fréquence (HFT) paient-elles pour la co-localisation de leurs serveurs ?")
                                .options(List.of(
                                        "Pour économiser sur la facture de climatisation",
                                        "Pour réduire la latence réseau à quelques microsecondes en plaçant leurs serveurs dans le même centre de données que le moteur de matching boursier",
                                        "Pour obtenir des actions gratuites de la part de l'opérateur boursier",
                                        "Pour contourner les fuseaux horaires"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La co-localisation élimine les délais de transit par fibre optique, permettant de réagir en microsecondes aux modifications du carnet d'ordres.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_14")
                                .question("Dans un carnet d'ordres fonctionnant selon la règle FIFO (Price-Time Priority), comment deux ordres au même prix sont-ils priorisés ?")
                                .options(List.of(
                                        "L'ordre de la plus grande taille passe en premier",
                                        "L'ordre arrivé le premier chronologiquement dans le carnet est exécuté en premier",
                                        "L'ordre d'un client particulier a toujours la priorité sur un institutionnel",
                                        "Le moteur tire au sort de manière aléatoire"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La priorité Prix-Temps garantit d'abord le meilleur prix, et à prix égal, le premier ordre enregistré dans le système est exécuté en priorité.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_15")
                                .question("Quelle est la garantie offerte par un ordre 'Post-Only' (ou Maker-Only) ?")
                                .options(List.of(
                                        "Il est certain de s'exécuter dans les 5 secondes",
                                        "Il est rejeté s'il devait s'exécuter immédiatement comme Taker, garantissant d'ajouter de la liquidité et de bénéficier du tarif Maker",
                                        "Il ne peut être annulé sous aucun prétexte",
                                        "Il ne s'applique qu'aux crypto-monnaies non régulées"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'ordre Post-Only évite les frais de prise de liquidité (taker fees) en s'assurant qu'il est toujours inscrit au carnet en tant que pourvoyeur de liquidité (maker).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_16")
                                .question("Comment fonctionne un ordre Stop Suiveur (Trailing Stop) sur une position longue ?")
                                .options(List.of(
                                        "Il augmente le prix limite de vente à chaque seconde de manière aléatoire",
                                        "Il remonte automatiquement son seuil de vente au fur et à mesure que le cours monte, mais reste fixe en cas de baisse du cours",
                                        "Il descend son niveau de stop pour donner plus d'espace aux pertes",
                                        "Il vend automatiquement à découvert quand l'actif monte"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Trailing Stop suit la hausse des prix à distance constante, verrouillant les profits tout en protégeant contre un retournement baissier.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_17")
                                .question("Qu'est-ce que le 'Bid-Ask Bounce' en analyse de données tick-by-tick ?")
                                .options(List.of(
                                        "Le rebond d'un indice sur sa moyenne mobile 200",
                                        "Une oscillation artificielle des cours enregistrés due à l'alternance de transactions au Bid puis à l'Ask sans changement de valeur fondamentale",
                                        "La faillite simultanée de deux teneurs de marché",
                                        "Un saut de prix provoqué par un dividende exceptionnel"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Bid-Ask bounce est un bruit de microstructure : les transactions se font alternativement au prix d'achat et de vente, simulant une volatilité factice.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_18")
                                .question("En quoi consiste la manipulation de marché interdite appelée 'Spoofing' ?")
                                .options(List.of(
                                        "Voler le mot de passe d'un courtier en ligne",
                                        "Placer de volumineux ordres d'achat ou de vente sans intention de les exécuter pour créer une fausse impression de pression acheteuse/vendeuse, puis les annuler",
                                        "Publier des articles d'analyse financière sous un pseudonyme",
                                        "Acheter des actions d'une entreprise le jour de ses résultats"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le spoofing est une manipulation boursière frauduleuse visant à tromper les algorithmes et intervenants en envoyant des ordres fictifs promptement annulés.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_19")
                                .question("Quel est le cycle standard de règlement-livraison des actions américaines (SEC) en vigueur depuis mai 2024 ?")
                                .options(List.of(
                                        "T+0 (instantané en temps réel)",
                                        "T+1 (un jour ouvré après la négociation)",
                                        "T+2 (deux jours ouvrés)",
                                        "T+5 (cinq jours ouvrés)"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Depuis mai 2024, la SEC a réduit le délai de règlement-livraison à T+1 pour minimiser le risque de contrepartie et de liquidité sur les marchés US.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q1_20")
                                .question("Que déclenche un 'Appel de Marge' (Margin Call) sur un compte de trading avec effet de levier ?")
                                .options(List.of(
                                        "Une félicitation de la banque pour des gains exceptionnels",
                                        "L'obligation de déposer des fonds ou de liquider des positions car les capitaux propres sont tombés sous la marge de maintien minimale",
                                        "L'attribution gratuite de bons de souscription d'actions",
                                        "Le transfert du compte vers un livret d'épargne réglementé"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'appel de marge survient lorsque les pertes entament la garantie exigée par le courtier, imposant une recapitalisation immédiate sous peine de liquidation forcée.")
                                .build()
                ))
                .build();
        quizzesMap.put(q1.getId(), q1);

        // Quiz 2 : Validation : Analyse Technique & Indicateurs Chartistes
        QuizDto q2 = QuizDto.builder()
                .id("QUIZ_TECHNICAL")
                .moduleId("MOD_TECHNICAL_ANALYSIS")
                .title("Validation : Analyse Technique & Indicateurs Chartistes")
                .description("Vérifiez votre compréhension des moyennes mobiles, de l'indicateur RSI et des métriques de backtesting (20 questions).")
                .passingScorePct(75)
                .questions(List.of(
                        QuizQuestionDto.builder()
                                .id("Q2_1")
                                .question("Que signale généralement un RSI 14 jours qui dépasse le niveau de 75 sur un actif ?")
                                .options(List.of(
                                        "Une situation de forte sous-évaluation",
                                        "Une zone de surachat (Overbought) avec risque de consolidation ou correction",
                                        "Un signal imminent de vente à découvert automatique",
                                        "Une absence de volatilité sur le titre"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Un RSI supérieur à 70 indique que les achats récents ont été très rapides et que l'actif entre en zone de surachat.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_2")
                                .question("Qu'est-ce qu'un 'Golden Cross' (croisement doré) en analyse chartiste ?")
                                .options(List.of(
                                        "Le franchissement d'un pic historique sur l'or physique",
                                        "Le croisement haussier d'une moyenne mobile courte (ex: SMA 50) au-dessus d'une moyenne longue (ex: SMA 200)",
                                        "Le croisement baissier du MACD sous sa ligne de signal",
                                        "L'atteinte d'un ratio de Sharpe supérieur à 3.0"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Golden Cross est un signal technique haussier classique qui se produit lorsque la SMA 50 passe au-dessus de la SMA 200.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_3")
                                .question("Quelle stratégie présente le meilleur ratio rendement/risque ajusté ?")
                                .options(List.of(
                                        "Rendement 15%, Volatilité 25% (Sharpe = 0.6)",
                                        "Rendement 12%, Volatilité 6% (Sharpe = 2.0)",
                                        "Rendement 20%, Volatilité 30% (Sharpe = 0.67)",
                                        "Rendement 5%, Volatilité 15% (Sharpe = 0.33)"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La stratégie à 12% avec 6% de volatilité offre un ratio de Sharpe de 2.0, ce qui démontre une excellente rentabilité ajustée du risque.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_4")
                                .question("Que quantifie le Maximum Drawdown (MDD) d'une stratégie de trading ?")
                                .options(List.of(
                                        "Le gain maximal réalisable sur un seul trade",
                                        "Le pourcentage maximal de perte depuis un pic jusqu'à un creux de la courbe de capitaux",
                                        "La moyenne arithmétique des pertes journalières",
                                        "Le temps d'attente moyen avant exécution d'un signal"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Maximum Drawdown est la baisse maximale en pourcentage subie par le portefeuille entre son plus haut historique et son creux suivant.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_5")
                                .question("Comment est calculée la ligne principale de l'indicateur MACD classique ?")
                                .options(List.of(
                                        "Différence entre l'EMA 12 périodes et l'EMA 26 périodes",
                                        "Moyenne mobile simple des cours de clôture sur 200 jours",
                                        "Division du volume d'échange par le cours le plus haut",
                                        "Différence entre le prix actuel et le plus bas sur 52 semaines"
                                ))
                                .correctOptionIndex(0)
                                .explanation("La ligne MACD est obtenue en soustrayant l'EMA 26 de l'EMA 12. La ligne de signal est ensuite l'EMA 9 de cette ligne MACD.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_6")
                                .question("Que préfigure un resserrement extrême des Bandes de Bollinger (Bollinger Squeeze) ?")
                                .options(List.of(
                                        "La fermeture définitive du marché financier",
                                        "Une phase de faible volatilité qui précède généralement une forte expansion directionnelle des cours",
                                        "Un dividende obligatoire versé par l'entreprise",
                                        "Une certitude mathématique que les cours vont chuter"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Bollinger Squeeze signale une compression anormale de la volatilité, prélude fréquent à une violente cassure haussière ou baissière.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_7")
                                .question("Que stipule le principe de 'polarité' en analyse des supports et résistances ?")
                                .options(List.of(
                                        "Les prix oscillent toujours entre le pôle nord et le pôle sud",
                                        "Un niveau de support franchi à la baisse a tendance à devenir un niveau de résistance future lors des rebonds ultérieurs",
                                        "Les volumes sont nuls lors des changements de tendance",
                                        "Toute hausse est automatiquement suivie d'une baisse symétrique"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La polarité traduit la psychologie du marché : les acheteurs pris au piège sur un ancien support cherchent à sortir 'flat' dès que le cours revient sur ce niveau, le transformant en résistance.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_8")
                                .question("Quelle information fournit un chandelier japonais de type 'Doji' ?")
                                .options(List.of(
                                        "Un volume de transaction nul sur la séance",
                                        "Une forte hésitation du marché, caractérisée par un cours d'ouverture et un cours de clôture quasi identiques",
                                        "Un krach boursier irréversible",
                                        "Une distribution de dividendes"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Doji présente un corps très étroit ou inexistant avec des mèches, traduisant un équilibre temporaire parfait entre acheteurs et vendeurs.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_9")
                                .question("Quelle est l'utilité première de l'indicateur ATR (Average True Range) développé par Welles Wilder ?")
                                .options(List.of(
                                        "Prédire la direction future des cours (hausse ou baisse)",
                                        "Quantifier le degré de volatilité absolue d'un actif financier sur une période donnée",
                                        "Calculer le rendement net de dividendes",
                                        "Estimer le nombre de contrats à terme en circulation"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'ATR mesure l'amplitude moyenne des mouvements de prix en tenant compte des gaps d'ouverture, sans aucune indication sur la direction.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_10")
                                .question("Parmi les ratios de retracement de Fibonacci suivants, lequel correspond au ratio d'or dérivé de la suite phi ?")
                                .options(List.of(
                                        "15.5%",
                                        "61.8%",
                                        "78.6%",
                                        "95.0%"
                                ))
                                .correctOptionIndex(1)
                                .explanation("61.8% (0.618) est le ratio d'or majeur de Fibonacci, largement utilisé par les traders pour identifier les zones de rebond technique.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_11")
                                .question("Qu'indique un cours de transaction qui se situe nettement en dessous de la ligne VWAP (Volume Weighted Average Price) intraday ?")
                                .options(List.of(
                                        "Les acheteurs ont payé plus cher que la moyenne des volumes du jour",
                                        "L'actif se négocie avec une décote par rapport au prix moyen pondéré par les volumes échangés depuis le début de la séance",
                                        "Le marché est fermé pour maintenance",
                                        "Le carnet d'ordres est entièrement vide"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le VWAP est la référence des institutionnels : un cours sous le VWAP signale un prix d'achat inférieur au prix moyen effectif du marché.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_12")
                                .question("Quelle est la différence fondamentale entre le ratio de Sortino et le ratio de Sharpe ?")
                                .options(List.of(
                                        "Le ratio de Sortino utilise uniquement la volatilité baissière (Downside Deviation) au dénominateur, ne pénalisant pas la volatilité à la hausse",
                                        "Le ratio de Sortino ne prend pas en compte le taux sans risque",
                                        "Le ratio de Sortino s'exprime obligatoirement en dollars et non en ratio",
                                        "Le ratio de Sortino est réservé exclusivement aux matières premières"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Contrairement au Sharpe qui pénalise toute variabilité (même les fortes hausses), le Sortino n'isole que les rendements inférieurs au seuil cible (downside risk).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_13")
                                .question("Qu'est-ce que le 'sur-apprentissage' (Overfitting) dans le développement d'une stratégie algorithmique de trading ?")
                                .options(List.of(
                                        "Passer trop d'heures à étudier les marchés financiers",
                                        "Optimiser à l'excès les paramètres sur des données historiques passées au point que le modèle capture le bruit statistique et échoue en trading réel",
                                        "Utiliser plus de 10 serveurs de calcul en parallèle",
                                        "Ne trader que les valeurs du CAC 40"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'overfitting produit d'excellents résultats trompeurs sur l'historique de test mais des pertes sévères en conditions réelles car la stratégie manque de robustesse.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_14")
                                .question("Pourquoi sépare-t-on les données de backtest en échantillons 'In-Sample' et 'Out-of-Sample' ?")
                                .options(List.of(
                                        "Pour diviser les commissions de courtage par deux",
                                        "Pour calibrer la stratégie sur l'échantillon d'apprentissage (In-Sample) puis tester sa capacité réelle de généralisation sur des données non vues (Out-of-Sample)",
                                        "Pour satisfaire à une exigence fiscale",
                                        "Pour trader simultanément à New York et à Tokyo"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le test hors échantillon (Out-of-Sample) est la règle d'or pour vérifier qu'un modèle quantitatif n'est pas le fruit d'un simple ajustement de courbe (data mining).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_15")
                                .question("Qu'est-ce que le biais d'anticipation (Look-ahead bias) en modélisation financière ?")
                                .options(List.of(
                                        "Avoir une intuition exacte sur les décisions de la Fed",
                                        "L'utilisation accidentelle dans le calcul d'un signal passé d'informations qui n'étaient pas encore connues ou publiées à cette date précise",
                                        "Passer des ordres avec 10 minutes d'avance sur les annonces",
                                        "L'utilisation de graphiques en barres au lieu de chandeliers"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le look-ahead bias biaise positivement et artificiellement les backtests en utilisant par exemple le cours de clôture pour décider d'un achat à l'ouverture du même jour.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_16")
                                .question("En quoi consiste le 'Biais du Survivant' (Survivorship bias) dans une base de données de backtest actions ?")
                                .options(List.of(
                                        "Prendre en compte uniquement les traders ayant survécu à un krach",
                                        "Exclure de l'historique les entreprises ayant fait faillite ou été radiées, ce qui surévalue artificiellement la performance historique moyenne",
                                        "Calculer la rentabilité sur une période de guerre",
                                        "Ignorer les entreprises du secteur de la santé"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Ne tester que les actions cotées aujourd'hui élimine toutes les firmes défaillantes du passé, donnant une fausse impression de performance élevée.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_17")
                                .question("Comment est calculé le ratio de Calmar d'un portefeuille quantitatif ?")
                                .options(List.of(
                                        "Rendement annualisé divisé par le Maximum Drawdown absolu sur 36 mois",
                                        "Volatilité mensuelle multipliée par la racine carrée de 252",
                                        "Dividende par action divisé par le cours moyen",
                                        "Nombre de positions gagnantes sur nombre de positions perdantes"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le ratio de Calmar (Rendement composé / MDD) mesure la capacité d'un fonds ou d'une stratégie à générer du rendement par rapport à ses creux historiques.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_18")
                                .question("Quelle est la particularité mathématique de la Moyenne Mobile Exponentielle (EMA) comparée à la Moyenne Mobile Simple (SMA) ?")
                                .options(List.of(
                                        "L'EMA accorde un poids mathématique plus important aux cours récents tout en intégrant l'historique complet",
                                        "L'EMA ne prend en compte que les 3 derniers jours ouvrés",
                                        "L'EMA est insensible aux cours extrêmes",
                                        "L'EMA nécessite un volume d'échange supérieur à 1 million de titres"
                                ))
                                .correctOptionIndex(0)
                                .explanation("L'EMA applique une pondération décroissante exponentielle, la rendant plus réactive aux changements récents de tendance que la SMA arithmétique.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_19")
                                .question("Quel principe régit l'indicateur On-Balance Volume (OBV) ?")
                                .options(List.of(
                                        "Le volume du jour est ajouté à l'OBV cumulé si le cours de clôture progresse, et retranché s'il régresse",
                                        "L'OBV mesure la quantité d'or détenue par la banque centrale",
                                        "L'OBV est toujours égal au cours de clôture divisé par 100",
                                        "L'OBV ne se calcule que sur les obligations d'État"
                                ))
                                .correctOptionIndex(0)
                                .explanation("L'OBV relie les volumes aux variations de prix : une divergence entre un cours en hausse et un OBV en baisse signale un essoufflement acheteur.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q2_20")
                                .question("Dans une figure chartiste en 'Tête et Épaules' (Head and Shoulders), quel événement valide définitivement le signal de retournement baissier ?")
                                .options(List.of(
                                        "La formation du sommet de l'épaule gauche",
                                        "La cassure franche à la baisse de la 'ligne de cou' (neckline) support avec hausse des volumes",
                                        "Le franchissement du sommet de la tête par un nouvel ordre d'achat",
                                        "L'ouverture du marché en gap haussier"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La configuration n'est confirmée que lorsque les vendeurs parviennent à briser la ligne de cou reliant les creux intermédiaires, amorçant la vague de baisse.")
                                .build()
                ))
                .build();
        quizzesMap.put(q2.getId(), q2);

        // Quiz 3 : Validation : Marchés Multi-Actifs (Forex, Obligations, Commodities)
        QuizDto q3 = QuizDto.builder()
                .id("QUIZ_MULTI_ASSET")
                .moduleId("MOD_MULTI_ASSET")
                .title("Validation : Marchés Multi-Actifs (Forex, Obligations, Commodities)")
                .description("Testez vos connaissances sur les paires de devises, les pips, le comportement des obligations et l'or (20 questions).")
                .passingScorePct(75)
                .questions(List.of(
                        QuizQuestionDto.builder()
                                .id("Q3_1")
                                .question("Sur la paire EUR/USD, que vaut 1 pip de variation sur une position de 100 000 EUR (1 lot standard) ?")
                                .options(List.of(
                                        "1.00 USD",
                                        "10.00 USD",
                                        "100.00 USD",
                                        "0.10 USD"
                                ))
                                .correctOptionIndex(1)
                                .explanation("1 pip en EUR/USD est 0.0001. Sur un lot standard de 100 000 EUR, 100 000 * 0.0001 = 10 USD.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_2")
                                .question("Lorsque les taux d'intérêt directeurs fixés par la banque centrale augmentent, que font les cours des obligations existantes à taux fixe ?")
                                .options(List.of(
                                        "Ils augmentent proportionnellement",
                                        "Ils restent parfaitement inchangés",
                                        "Ils diminuent",
                                        "Ils doublent systématiquement"
                                ))
                                .correctOptionIndex(2)
                                .explanation("Il existe une relation inverse stricte : quand les taux montent, les obligations existantes aux coupons plus faibles deviennent moins attractives et leur cours baisse.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_3")
                                .question("Quelle obligation est la plus sensible aux variations de taux d'intérêt ?")
                                .options(List.of(
                                        "Obligation d'État à 1 an (Duration 0.9)",
                                        "Obligation d'État à 5 ans (Duration 4.5)",
                                        "Obligation d'État à 20 ans (Duration 17.5)",
                                        "Obligation monétaire à 3 mois"
                                ))
                                .correctOptionIndex(2)
                                .explanation("Plus la maturité d'une obligation est lointaine, plus sa duration est élevée et plus son cours fluctue fortement face aux chocs de taux.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_4")
                                .question("Pourquoi l'or physique (SPDR Gold Shares GLD) est-il traditionnellement intégré dans une allocation de portefeuille multi-actifs ?")
                                .options(List.of(
                                        "Car il verse des dividendes trimestriels élevés",
                                        "Comme valeur refuge décorrélée protégeant contre l'inflation et les chocs géopolitiques",
                                        "Pour spéculer exclusivement sur les taux de fret maritime",
                                        "Parce qu'il a une corrélation de 1.0 avec les actions de la tech"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'or est un actif de réserve millénaire sans risque de défaut de contrepartie, souvent décorrélé des marchés actions en période de stress.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_5")
                                .question("Dans la cotation de la paire Forex GBP/USD = 1.3000, quelle devise est la devise de base et quelle devise est la devise de contrepartie ?")
                                .options(List.of(
                                        "GBP est la devise de contrepartie et USD est la devise de base",
                                        "GBP est la devise de base et USD est la devise de contrepartie (quote currency)",
                                        "Les deux devises sont interchangeables sans ordre précis",
                                        "La cotation dépend de la banque centrale européenne"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La devise de base est toujours celle située à gauche (1 GBP). La devise de contrepartie à droite exprime la quantité nécessaire pour acheter une unité de base (1.30 USD).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_6")
                                .question("À combien d'unités de devise de base correspond un 'Mini Lot' standard sur le marché Forex ?")
                                .options(List.of(
                                        "1 000 unités",
                                        "10 000 unités",
                                        "100 000 unités",
                                        "1 000 000 unités"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Un lot standard = 100 000 unités, un mini lot = 10 000 unités (0.10 lot), et un micro lot = 1 000 unités (0.01 lot).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_7")
                                .question("En quoi consiste la stratégie de 'Carry Trade' sur les marchés des devises ?")
                                .options(List.of(
                                        "Acheter des devises virtuelles dans les jeux vidéo",
                                        "Emprunter dans une devise à faible taux d'intérêt (devise de financement) pour investir dans une devise à fort rendement d'intérêt (devise cible)",
                                        "Convertir l'intégralité de son cash en lingots de platine",
                                        "Parier sur la faillite conjointe de deux banques centrales"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Carry Trade capture le différentiel de taux d'intérêt (swap positif) entre deux devises, tant que le taux de change reste stable ou favorable.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_8")
                                .question("Que signifie la situation de 'Contango' sur les marchés des contrats à terme de matières premières ?")
                                .options(List.of(
                                        "Le prix au comptant (Spot) est supérieur au prix des contrats à terme",
                                        "Le prix des contrats à terme (Futures) est supérieur au cours Spot, reflétant les coûts de stockage, d'assurance et de portage (Cost of Carry)",
                                        "La production mondiale de pétrole est arrêtée",
                                        "Le métal précieux est exempté de TVA"
                                ))
                                .correctOptionIndex(1)
                                .explanation("En situation de Contango, la courbe des futures est ascendante avec le temps. Les investisseurs passifs subissent un coût de roulement (roll yield négatif).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_9")
                                .question("Quelle condition caractérise la situation de 'Backwardation' sur une matière première comme le pétrole brut ?")
                                .options(List.of(
                                        "Le prix Spot immédiat est supérieur aux prix des futures à échéance éloignée, souvent en raison d'une forte tension ou pénurie physique immédiate",
                                        "Les prix à terme tendent vers zéro",
                                        "L'offre est excessive et tous les entrepôts sont saturés",
                                        "L'or est moins cher que le cuivre"
                                ))
                                .correctOptionIndex(0)
                                .explanation("La backwardation traduit une prime d'immédiateté (convenience yield) : le marché est prêt à payer plus cher pour avoir la marchandise immédiatement.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_10")
                                .question("Quelle est la définition exacte du Yield to Maturity (YTM - Rendement à l'Échéance) d'une obligation ?")
                                .options(List.of(
                                        "Le montant total des coupons divisé par le prix de remboursement",
                                        "Le taux d'actualisation interne qui égalise le prix de marché actuel de l'obligation à la somme de tous ses flux futurs actualisés (coupons et principal)",
                                        "Le taux de croissance du PIB du pays émetteur",
                                        "La commission annuelle prélevée par la banque dépositaire"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le YTM est le taux de rentabilité interne (TRI) espéré si l'investisseur conserve l'obligation jusqu'à son terme et réinvestit les coupons au même taux.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_11")
                                .question("Si une obligation possède une Duration Modifiée de 7.5, quelle sera la variation approximative de son cours pour une hausse des taux de 1% (+100 bps) ?")
                                .options(List.of(
                                        "Hausse de 7.5%",
                                        "Baisse d'environ 7.5%",
                                        "Baisse de 1.0%",
                                        "Aucune variation car le coupon est fixe"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La relation fondamentale est : Delta P / P = - Duration_modifiée * Delta y = -7.5 * (+1%) = -7.5%.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_12")
                                .question("Pourquoi la 'Convexité' d'une obligation classique est-elle considérée comme une propriété favorable pour un investisseur ?")
                                .options(List.of(
                                        "Car elle annule les impôts sur les coupons",
                                        "Car lorsque les taux baissent, le cours monte plus vite que la duration ne le prévoyait ; et lorsque les taux montent, le cours baisse moins vite",
                                        "Car elle garantit le remboursement en cas de faillite souveraine",
                                        "Car elle permet d'échanger l'obligation contre des actions à tout moment"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La convexité est la dérivée seconde du prix par rapport au rendement. Une convexité positive apporte une asymétrie de gain favorable face à la volatilité des taux.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_13")
                                .question("Quelles sont les deux principales références mondiales (benchmarks) de prix pour le pétrole brut ?")
                                .options(List.of(
                                        "Brent de Mer du Nord et WTI (West Texas Intermediate)",
                                        "Ural russe et Dubaï Gold",
                                        "OPEP Basket et TotalEnergies Fuel",
                                        "Standard Oil et Shell Liquid"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le Brent (Europe/international) et le WTI (États-Unis) sont les deux pétroles légers doux les plus négociés sur les marchés dérivés.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_14")
                                .question("Dans le système de notation des agences de crédit (S&P, Fitch, Moody's), quelle est la frontière entre la catégorie 'Investissement' (Investment Grade) et la catégorie 'Spéculative' (High Yield) ?")
                                .options(List.of(
                                        "Entre AAA et AA+",
                                        "Entre BBB- (Baa3) et BB+ (Ba1)",
                                        "Entre B- et CCC",
                                        "Entre la dette publique et la dette privée"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La note BBB- (ou Baa3 chez Moody's) est la note plancher de la catégorie Investment Grade. En dessous (BB+, BB, etc.), les titres sont dits High Yield ou Junk Bonds.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_15")
                                .question("Quelle est la duration de Macaulay d'une obligation 'Zéro-Coupon' remboursable dans exactement 10 ans ?")
                                .options(List.of(
                                        "5 ans",
                                        "0 an",
                                        "Exactement 10 ans",
                                        "7.5 ans"
                                ))
                                .correctOptionIndex(2)
                                .explanation("Pour une obligation zéro-coupon, l'intégralité du flux financier survient à la maturité. La duration de Macaulay est donc strictement égale à son échéance (10 ans).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_16")
                                .question("Quelle est la différence entre le 'Prix Clean' et le 'Prix Dirty' (plein coupon) d'une obligation cotée ?")
                                .options(List.of(
                                        "Le Prix Dirty inclut le coupon couru depuis la dernière date de détachement, alors que le Prix Clean exclut ce coupon couru",
                                        "Le Prix Clean est réservé aux investisseurs institutionnels sans frais de courtage",
                                        "Le Prix Dirty s'applique uniquement aux obligations en défaut de paiement",
                                        "Le Prix Clean ne comprend pas la TVA locale"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Sur les marchés, les cours sont affichés en Clean Price pour éviter les à-coups du coupon couru, mais le règlement effectif s'effectue au Dirty Price (Clean + Coupon couru).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_17")
                                .question("Qu'est-ce que le 'Roll Yield' lors de la gestion d'un portefeuille de matières premières via des contrats à terme ?")
                                .options(List.of(
                                        "La commission versée à la chambre de compensation",
                                        "Le gain ou la perte résultant du renouvellement des contrats arrivant à échéance vers le contrat de l'échéance suivante",
                                        "Le dividende versé par les compagnies minières",
                                        "La taxe sur le carburant maritime"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le roll yield est positif en backwardation (vendre cher l'échéance proche pour acheter moins cher la lointaine) et négatif en contango.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_18")
                                .question("Qu'appelle-t-on une 'Paire Croisée' (Cross Currency Pair) sur le marché des changes ?")
                                .options(List.of(
                                        "Une paire impliquant deux crypto-monnaies",
                                        "Une paire de devises qui ne contient pas le dollar américain USD (ex: EUR/GBP, CAD/JPY, AUD/NZD)",
                                        "Une transaction illégale non déclarée",
                                        "Une transaction réglée uniquement en espèces"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le terme Cross Pair désigne tout croisement direct entre deux devises majeures ou mineures sans passage direct par le dollar américain.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_19")
                                .question("Qu'est-ce qu'un 'Super-cycle des matières premières' en histoire économique ?")
                                .options(List.of(
                                        "Une journée de hausse de 10% sur le cours du blé",
                                        "Une phase pluriannuelle (souvent 10 à 20 ans) de hausse structurelle des cours provoquée par une forte demande globale face à une offre inélastique",
                                        "La durée de vie d'un baril de pétrole raffiné",
                                        "Le cycle de rotation des cultures agricoles"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Les super-cycles résultent de chocs d'urbanisation et d'industrialisation massive (comme la Chine dans les années 2000) mettant des décennies à être approvisionnés.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q3_20")
                                .question("Comment fonctionnent les obligations indexées sur l'inflation (ex: TIPS aux États-Unis, OATi en France) ?")
                                .options(List.of(
                                        "Le taux de coupon passe à 50% en cas d'inflation",
                                        "La valeur nominale (principal) du titre est régulièrement ajustée à la hausse ou à la baisse en fonction de l'évolution de l'indice des prix à la consommation",
                                        "Le remboursement est effectué sous forme de barils de pétrole",
                                        "L'émetteur a le droit d'annuler la dette en cas de déflation"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Les TIPS protègent le pouvoir d'achat : leur capital est indexé sur l'IPC, et le coupon fixe s'applique sur ce principal revalorisé.")
                                .build()
                ))
                .build();
        quizzesMap.put(q3.getId(), q3);

        // Quiz 4 : Validation : Analyse Fondamentale & États Financiers SEC
        QuizDto q4 = QuizDto.builder()
                .id("QUIZ_FUNDAMENTAL")
                .moduleId("MOD_FUNDAMENTAL")
                .title("Validation : Analyse Fondamentale & États Financiers SEC")
                .description("Vérifiez vos compétences d'analyse financière sur les dépôts 10-K, ratios de valorisation et trésorerie (20 questions).")
                .passingScorePct(75)
                .questions(List.of(
                        QuizQuestionDto.builder()
                                .id("Q4_1")
                                .question("Quel document officiel déposé auprès de la SEC américaine correspond au rapport financier annuel audité d'une société cotée ?")
                                .options(List.of(
                                        "Form 8-K",
                                        "Form 10-Q",
                                        "Form 10-K",
                                        "Form 13-F"
                                ))
                                .correctOptionIndex(2)
                                .explanation("Le Form 10-K est le rapport annuel complet certifié déposé auprès de la SEC. Le 10-Q est le rapport trimestriel non audité.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_2")
                                .question("Comment calcule-t-on le Free Cash Flow (flux de trésorerie disponible) ?")
                                .options(List.of(
                                        "Chiffre d'Affaires - Dividendes versés",
                                        "Flux de Trésorerie Opérationnel (Operating Cash Flow) - Dépenses d'Investissement (CapEx)",
                                        "Résultat Net + Dettes Financières Brutes",
                                        "Actifs Circulants / Passifs Circulants"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Free Cash Flow correspond au cash généré par l'activité opérationnelle après déduction des investissements en capital (CapEx).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_3")
                                .question("Une entreprise affiche une capitalisation de 100 milliards $ et un résultat net annuel de 5 milliards $. Quel est son P/E ratio ?")
                                .options(List.of(
                                        "5x",
                                        "10x",
                                        "20x",
                                        "50x"
                                ))
                                .correctOptionIndex(2)
                                .explanation("P/E = Capitalisation / Résultat Net = 100 Mds / 5 Mds = 20.0x.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_4")
                                .question("Que mesure le Return on Equity (ROE) ?")
                                .options(List.of(
                                        "Le pourcentage de dettes par rapport aux actifs",
                                        "La rentabilité nette dégagée pour chaque euro de capitaux propres investi par les actionnaires",
                                        "La marge brute sur les ventes de produits",
                                        "Le rendement du dividende par action"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le ROE (Résultat Net / Capitaux Propres) mesure l'efficacité avec laquelle le management génère du profit à partir des fonds propres.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_5")
                                .question("Quelle est la fréquence de publication du rapport financier SEC Form 10-Q ?")
                                .options(List.of(
                                        "Hebdomadaire",
                                        "Trimestrielle (trois fois par an, le quatrième trimestre étant couvert par le 10-K)",
                                        "Semestrielle",
                                        "Tous les 5 ans"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Form 10-Q est déposé à la fin de chacun des trois premiers trimestres fiscaux de l'exercice.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_6")
                                .question("Quelle est la vocation première du formulaire SEC Form 8-K ?")
                                .options(List.of(
                                        "Déclarer les impôts fonciers de l'entreprise",
                                        "Divulguer sans délai (sous 4 jours ouvrés) tout événement matériel imprévu et majeur pour les actionnaires (démission du CEO, acquisition majeure, faillite)",
                                        "Déposer la liste des brevets logiciels",
                                        "Lister les cadeaux reçus par les membres du conseil"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Form 8-K est le rapport d'événements actuels matériels assurant une information équitable et instantanée du public investisseur.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_7")
                                .question("Quels intervenants de marché sont obligés de déposer le rapport trimestriel Form 13-F auprès de la SEC ?")
                                .options(List.of(
                                        "Tous les particuliers ouvrant un compte de trading",
                                        "Les gestionnaires d'investissement institutionnels gérant au moins 100 millions de dollars en actifs éligibles",
                                        "Uniquement les banques d'affaires en faillite",
                                        "Les journalistes économiques"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le 13-F dévoile les positions longues en actions US détenues par les grands fonds spéculatifs et gestionnaires de capitaux (ex: Berkshire Hathaway).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_8")
                                .question("Quelle est la signification exacte de l'acronyme financier EBITDA ?")
                                .options(List.of(
                                        "Earnings Before Interest, Taxes, Depreciation, and Amortization",
                                        "Equity Book Income Total Distributed Annually",
                                        "Estimated Bank Interest Total Due Amount",
                                        "European Bank Internal Transaction Data Agreement"
                                ))
                                .correctOptionIndex(0)
                                .explanation("L'EBITDA correspond au bénéfice d'exploitation avant prise en compte des charges d'intérêts, impôts, dépréciations et amortissements.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_9")
                                .question("Comment s'interprète un Current Ratio (Ratio de liquidité générale) égal à 2.2 ?")
                                .options(List.of(
                                        "L'entreprise est en situation d'insolvabilité imminente",
                                        "L'entreprise possède 2.20 $ d'actifs à court terme pour chaque dollar de dette exigible à moins d'un an, ce qui indique une saine liquidité",
                                        "L'entreprise a doublé son endettement bancaire",
                                        "Le cours de l'action est surévalué de 220%"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Un ratio de liquidité supérieur à 1.5 - 2.0 démontre une capacité confortable à honorer ses engagements à court terme.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_10")
                                .question("Pourquoi le Quick Ratio (Acid Test) exclut-il les stocks des actifs circulants au numérateur ?")
                                .options(List.of(
                                        "Parce que les stocks ne figurent jamais au bilan comptable",
                                        "Parce que les stocks sont les actifs circulants les moins liquides et les plus difficiles à monétiser rapidement sans consentir de fortes remises",
                                        "Pour éviter de payer des taxes sur la valeur ajoutée",
                                        "Parce que les stocks appartiennent légalement aux clients"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le ratio de liquidité réduite (Acid Test) mesure la solvabilité immédiate sans compter sur l'hypothèse de revente rapide des marchandises en stock.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_11")
                                .question("Selon la formule de décomposition DuPont à 3 facteurs, le Return on Equity (ROE) est le produit de :")
                                .options(List.of(
                                        "Marge Nette x Rotation des Actifs x Levier Financier (Actifs / Fonds Propres)",
                                        "Chiffre d'affaires x Nombre d'actions x Cours de bourse",
                                        "EBITDA x Taux d'intérêt x Marge brute",
                                        "Dividende par action x P/E ratio x Bêta"
                                ))
                                .correctOptionIndex(0)
                                .explanation("L'identité DuPont décompose le ROE en rentabilité opérationnelle (Marge Nette), efficacité d'utilisation du capital (Asset Turnover) et structure d'endettement (Leverage).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_12")
                                .question("Comment calcule-t-on le Besoin en Fonds de Roulement d'exploitation (BFR) ?")
                                .options(List.of(
                                        "Dettes financières long terme - Trésorerie active",
                                        "Stocks + Créances clients - Dettes fournisseurs",
                                        "Chiffre d'affaires - Dividendes versés",
                                        "Immobilisations corporelles + Dépenses de R&D"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le BFR représente le décalage de trésorerie net issu du cycle d'exploitation entre le stockage/crédit accordé aux clients et les facilités obtenues des fournisseurs.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_13")
                                .question("Dans un modèle de valorisation intrinsèque DCF (Discounted Cash Flow), quel taux est généralement utilisé pour actualiser les Free Cash Flows de la firme ?")
                                .options(List.of(
                                        "Le taux du livret A",
                                        "Le WACC (Weighted Average Cost of Capital - Coût Moyen Pondéré du Capital)",
                                        "Le taux de croissance du résultat net",
                                        "Le taux d'inflation américain anticipé à 5 ans"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le WACC reflète le rendement moyen exigé par l'ensemble des pourvoyeurs de capitaux de l'entreprise (actionnaires et créanciers financiers).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_14")
                                .question("Que mesure le bêta (Beta) d'une action dans le modèle CAPM (MEDAF) ?")
                                .options(List.of(
                                        "Le dividende annuel divisé par le résultat net",
                                        "La sensibilité des rendements de l'action par rapport aux fluctuations de l'ensemble du marché (risque systématique)",
                                        "Le risque de faillite frauduleuse des dirigeants",
                                        "Le nombre moyen de transactions par minute"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Un bêta supérieur à 1 indique que le titre amplifie les variations du marché (titre agressif), un bêta inférieur à 1 signale un titre défensif.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_15")
                                .question("Comment définit-on la Valeur d'Entreprise (Enterprise Value - EV) d'une société ?")
                                .options(List.of(
                                        "Capitalisation Boursière + Dette Financière Nette (Dette Brute - Trésorerie)",
                                        "Total de l'Actif du bilan - Chiffre d'Affaires annuel",
                                        "Valeur nominale des actions émises uniquement",
                                        "Résultat Net x 100"
                                ))
                                .correctOptionIndex(0)
                                .explanation("L'Enterprise Value est le coût théorique d'acquisition intégrale de l'entreprise : rachat de 100% des actions et remboursement de toutes les dettes nettes du cash disponible.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_16")
                                .question("Pourquoi le multiple EV/EBITDA est-il souvent préféré au ratio P/E pour comparer des entreprises concurrentes du même secteur ?")
                                .options(List.of(
                                        "Parce qu'il est toujours inférieur à 10",
                                        "Parce qu'il est neutre vis-à-vis des différences de structure financière (effet de levier d'endettement) et de politique d'amortissement fiscal entre firmes",
                                        "Parce qu'il ne prend pas en compte le cours de bourse",
                                        "Parce qu'il est obligatoire selon les normes comptables IFRS"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'EV/EBITDA permet une comparaison industrielle pure de la rentabilité d'exploitation, indépendamment de la façon dont l'entreprise est financée ou fiscalisée.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_17")
                                .question("Qu'est-ce qu'une dépréciation du Goodwill (Goodwill Impairment) dans les comptes financiers ?")
                                .options(List.of(
                                        "Une prime versée aux employés méritants",
                                        "Une charge non décaissée constatant qu'une entreprise ou filiale précédemment acquise vaut désormais moins que le prix payé à l'époque",
                                        "L'achat de nouveaux ordinateurs pour la direction",
                                        "Une augmentation automatique des dividendes"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'impairment du goodwill est un test comptable obligatoire qui réduit la valeur de l'actif incorporel au bilan quand les prévisions de cash-flow se détériorent.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_18")
                                .question("Sous les normes comptables IFRS 15 et US GAAP ASC 606, quand une entreprise peut-elle légalement reconnaître un chiffre d'affaires ?")
                                .options(List.of(
                                        "Dès la réception d'un premier coup de téléphone d'un prospect",
                                        "Lorsque le contrôle effectif du bien ou du service promis est transféré au client (satisfaction de l'obligation de prestation)",
                                        "Uniquement lorsque le virement bancaire final est définitivement encaissé",
                                        "Au début de chaque année calendaire de manière uniforme"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le principe fondamental moderne de constatation du revenu repose sur le transfert du contrôle économique de la prestation convenue.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_19")
                                .question("Quelle est la différence fondamentale entre la Marge Brute et la Marge Opérationnelle ?")
                                .options(List.of(
                                        "La marge brute ne déduit du chiffre d'affaires que le coût direct des marchandises ou services vendus (COGS), alors que la marge opérationnelle déduit aussi les frais de R&D, de vente et d'administration (SG&A)",
                                        "La marge opérationnelle ne s'applique qu'aux banques d'affaires",
                                        "La marge brute prend en compte les impôts sur les sociétés",
                                        "Il n'existe aucune différence, ce sont deux termes synonymes"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Marge Brute = (CA - COGS) / CA. Marge Opérationnelle = EBIT / CA. La marge opérationnelle intègre l'ensemble des frais généraux d'exploitation.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q4_20")
                                .question("Que représente le 'Dividend Payout Ratio' (taux de distribution du résultat) d'une société cotée ?")
                                .options(List.of(
                                        "Le pourcentage du résultat net qui est redistribué sous forme de dividendes aux actionnaires",
                                        "Le rendement du dividende par rapport au cours de l'action",
                                        "La taxe prélevée à la source sur les coupons obligataires",
                                        "Le taux de croissance annuel moyen du chiffre d'affaires"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Payout Ratio = Dividendes Totaux / Résultat Net. Le solde non distribué est conservé en report à nouveau (retained earnings) pour réinvestissement.")
                                .build()
                ))
                .build();
        quizzesMap.put(q4.getId(), q4);

        // Quiz 5 : Validation : Risques de Marché, Stress Testing & XAI
        QuizDto q5 = QuizDto.builder()
                .id("QUIZ_RISK_STRESS")
                .moduleId("MOD_RISK_STRESS")
                .title("Validation : Risques de Marché, Stress Testing & XAI")
                .description("Évaluez vos compétences sur la Value-at-Risk, les scénarios de stress bancaire et l'explicabilité SHAP (20 questions).")
                .passingScorePct(75)
                .questions(List.of(
                        QuizQuestionDto.builder()
                                .id("Q5_1")
                                .question("Que signifie une Value-at-Risk (VaR) journalière à 99% de 10 000 € sur un portefeuille de 200 000 € ?")
                                .options(List.of(
                                        "Le portefeuille est assuré de perdre exactement 10 000 € aujourd'hui",
                                        "Il y a 99% de chances que la perte maximale ne dépasse pas 10 000 € au cours de la journée",
                                        "Le portefeuille a gagné 10 000 € dans 99% des jours de trading",
                                        "La commission de courtage est de 10 000 €"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Une VaR 99% à 1 jour signifie que la perte maximale attendue ne dépassera pas 10 000 € avec 99% de confiance statistique (1 chance sur 100 de faire pire).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_2")
                                .question("Dans le cadre du stress testing bancaire macroéconomique, quel scénario simule généralement une crise de solvabilité majeure ?")
                                .options(List.of(
                                        "Une récession sévère combinée à une hausse des défauts de crédit (NPL) et une baisse brutale des marchés financiers",
                                        "Une baisse de 10 bps des taux avec croissance du PIB de 4%",
                                        "Une hausse des dépôts de détail sans aucun changement macroéconomique",
                                        "Une simplification administrative des régulations"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Un stress test macroéconomique sévère conjugue choc récessif, hausse des défaillances d'emprunteurs et dépréciation des actifs de bilan.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_3")
                                .question("À quoi servent les valeurs SHAP (Shapley Additive Explanations) en Machine Learning appliqué à la finance ?")
                                .options(List.of(
                                        "À chiffrer les données bancaires confidentielles",
                                        "À décomposer la contribution marginale de chaque variable pour expliquer pourquoi un modèle prédit un risque élevé ou faible",
                                        "À accélérer le minage de blocs de cryptomonnaies",
                                        "À passer des ordres sans vérification de solde"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Les valeurs SHAP rendent les modèles IA interprétables en quantifiant précisément l'impact positif ou négatif de chaque caractéristique sur la prédiction finale.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_4")
                                .question("Pourquoi la mesure de l'Expected Shortfall (CVaR - Conditional VaR) est-elle théoriquement supérieure à la Value-at-Risk (VaR) ?")
                                .options(List.of(
                                        "Parce que la CVaR est toujours égale à zéro",
                                        "Parce que la CVaR est une mesure de risque 'cohérente' qui quantifie l'espérance de perte moyenne dans la queue de distribution au-delà du seuil de VaR",
                                        "Parce qu'elle ne nécessite aucune donnée statistique",
                                        "Parce qu'elle garantit l'absence totale de risque opérationnel"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Contrairement à la VaR qui est aveugle à la gravité des pertes extrêmes au-delà du percentile, la CVaR calcule la sévérité moyenne dans la queue de distribution.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_5")
                                .question("Quelle propriété mathématique fondamentale fait défaut à la Value-at-Risk (VaR) pour être qualifiée de mesure de risque 'cohérente' d'Artzner ?")
                                .options(List.of(
                                        "L'homogénéité positive",
                                        "La sous-additivité (le risque d'un portefeuille combiné peut parfois excéder la somme des risques individuels)",
                                        "L'invariance par translation",
                                        "La monotonie"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La non-sous-additivité de la VaR peut paradoxalement décourager la diversification dans certaines distributions asymétriques à queues épaisses.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_6")
                                .question("Quel est le ratio de fonds propres de base durs (Common Equity Tier 1 - CET1) imposé aux banques commerciales sous les accords de Bâle III ?")
                                .options(List.of(
                                        "Au minimum 4.5% des actifs pondérés des risques (RWA), complété par des coussins de sécurité",
                                        "Exactement 50% du total de bilan",
                                        "0.5% du volume des crédits",
                                        "100% des dépôts à vue"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Bâle III exige un CET1 d'au moins 4.5% des RWA, porté en pratique à plus de 8% - 12% avec le coussin de conservation et les coussins systémiques.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_7")
                                .question("Quel est l'objectif du ratio de liquidité à court terme LCR (Liquidity Coverage Ratio) sous Bâle III ?")
                                .options(List.of(
                                        "Garantir qu'une banque détient suffisamment d'actifs liquides de haute qualité (HQLA) pour surmonter un choc de liquidité sévère durant 30 jours calendaires",
                                        "Interdire les prêts immobiliers d'une durée supérieure à 10 ans",
                                        "Forcer la détention exclusive d'obligations d'entreprises à haut rendement",
                                        "Limiter les retraits aux distributeurs automatiques"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le LCR impose : Actifs liquides de haute qualité (HQLA) / Sorties nettes de trésorerie sur 30 jours >= 100%.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_8")
                                .question("Quelle dimension temporelle vise le ratio structurel de liquidité à long terme NSFR (Net Stable Funding Ratio) ?")
                                .options(List.of(
                                        "Une période de 24 heures",
                                        "Un horizon de 1 an (financement stable disponible supérieur ou égal au financement stable exigé)",
                                        "Un horizon de 50 ans",
                                        "Une semaine de trading"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le NSFR garantit que les actifs à long terme et illiquides d'une banque sont financés par des ressources stables à horizon d'un an minimum.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_9")
                                .question("En quoi consiste un 'Reverse Stress Testing' imposé par les autorités bancaires prudentielles ?")
                                .options(List.of(
                                        "Tester la résistance de la banque lors d'un scénario de prospérité économique insolente",
                                        "Partir du point d'échec ou d'insolvabilité de l'institution financière et rétro-calculer les scénarios et vulnérabilités exactes susceptibles de provoquer cette chute",
                                        "Supprimer toutes les sauvegardes informatiques",
                                        "Remplacer les auditeurs par des étudiants"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le stress test inversé identifie les vulnérabilités fatales cachées d'un établissement en identifiant la combinaison exacte de chocs causant la faillite.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_10")
                                .question("Que quantifie le CVA (Credit Valuation Adjustment) sur un portefeuille de produits dérivés de gré à gré (OTC) ?")
                                .options(List.of(
                                        "Le coût de maintenance des serveurs de cotation",
                                        "La valeur de marché du risque de défaillance future de la contrepartie bilatérale au contrat dérivé",
                                        "La taxe sur la valeur ajoutée des swaps",
                                        "La commission payée à la chambre de compensation"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le CVA est la décote de prix appliquée aux dérivés OTC pour refléter le risque que la contrepartie fasse défaut avant le règlement final.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_11")
                                .question("Que signifie la présence de 'queues épaisses' (Fat Tails ou distribution leptokurtique) dans les rendements financiers ?")
                                .options(List.of(
                                        "Les marchés ne bougent jamais de plus de 0.1% par jour",
                                        "Les krachs et chocs extrêmes surviennent avec une probabilité empirique beaucoup plus élevée que ce que prédit une loi normale gaussienne standard",
                                        "Tous les investisseurs réalisent des bénéfices identiques",
                                        "La moyenne des rendements est obligatoirement négative"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La leptokurticité implique un kurtosis supérieur à 3 : les événements extrêmes à 4, 5 ou 6 écarts-types surviennent fréquemment sur les marchés financiers réels.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_12")
                                .question("Quel phénomène de marché est modélisé par les équations autorégressives de type GARCH ?")
                                .options(List.of(
                                        "La croissance démographique des pays émergents",
                                        "Le 'clustering' de volatilité (les périodes de forte volatilité ont tendance à être immédiatement suivies de forte volatilité, et inversement)",
                                        "Le taux de change fixe entre deux monnaies",
                                        "La saisonnalité des dividendes trimestriels"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Les modèles GARCH capturent l'hétéroscédasticité conditionnelle : la variance n'est pas constante mais dépend des résidus quadratiques passés.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_13")
                                .question("Que constate-t-on couramment concernant les corrélations entre classes d'actifs lors d'une crise systémique de liquidité ?")
                                .options(List.of(
                                        "Les corrélations entre actifs risqués augmentent brusquement vers 1, annulant temporairement les bénéfices attendus de la diversification",
                                        "Toutes les corrélations deviennent strictement égales à zéro",
                                        "Les actions montent toujours quand les obligations chutent",
                                        "Les corrélations restent rigoureusement stables"
                                ))
                                .correctOptionIndex(0)
                                .explanation("En période de panique (dash for cash), les ventes forcées généralisées détruisent la décorrélation : tout baisse simultanément.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_14")
                                .question("Quelle est la différence fondamentale entre les méthodes d'explicabilité LIME et SHAP pour l'IA en finance ?")
                                .options(List.of(
                                        "LIME est un algorithme de cryptage, SHAP est un langage de programmation",
                                        "SHAP repose sur la théorie des jeux coopératifs de Lloyd Shapley garantissant des propriétés d'équité et d'additivité, alors que LIME construit une approximation linéaire locale",
                                        "LIME est réservé aux réseaux de neurones récurrents",
                                        "SHAP n'est utilisable que sur des images satellites"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Les valeurs de Shapley garantissent l'efficacité, la symétrie et la monotonie dans l'attribution des contributions marginales de chaque variable explicative.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_15")
                                .question("Qu'est-ce que le 'Risque de Modèle' (Model Risk) encadré par le guide de supervision SR 11-7 de la Réserve Fédérale ?")
                                .options(List.of(
                                        "Le risque de panne matérielle d'un serveur informatique",
                                        "Le risque financier lié à des décisions erronées découlant de modèles mathématiques mal spécifiés, surappris, mal calibrés ou appliqués hors de leur domaine de validité",
                                        "Le risque de refus d'un contrat d'assurance vie",
                                        "Le risque de grève dans le secteur bancaire"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La directive SR 11-7 exige une gouvernance stricte de validation indépendante pour empêcher qu'un modèle quantitatif défectueux n'induise des pertes massives.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_16")
                                .question("Que mesure le risque de taux dans le portefeuille bancaire (IRRBB - Interest Rate Risk in the Banking Book) ?")
                                .options(List.of(
                                        "La rentabilité des crédits à la consommation uniquement",
                                        "La vulnérabilité de la marge nette d'intérêts et de la valeur économique des fonds propres de la banque face aux chocs sur la courbe des taux d'intérêt",
                                        "Le montant total des commissions de carte bancaire",
                                        "Le volume de prêts accordés en monnaie étrangère"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'IRRBB évalue l'impact des décalages de maturité entre l'actif (crédits à taux fixe) et le passif (dépôts à taux variable) lors d'une hausse brutale des taux.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_17")
                                .question("Quelle est la fonction du Coussin de Capital Contracyclique (CCyB) ?")
                                .options(List.of(
                                        "Imposer la mise en réserve de capitaux propres additionnels en période d'expansion excessive du crédit pour pouvoir les absorber en période de retournement économique",
                                        "Financer les primes de fin d'année des cadres dirigeants",
                                        "Rembourser la dette publique des pays voisins",
                                        "Réduire automatiquement le taux d'imposition des banques"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le CCyB est un outil macroprudentiel modulable (de 0% à 2.5% des RWA) visant à freiner l'exubérance financière en haut de cycle.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_18")
                                .question("Dans un test de résistance, qu'appelle-t-on une 'Décote' (Haircut) sur les actifs de garantie (collatéral) ?")
                                .options(List.of(
                                        "Une réduction sur les frais de tenue de compte",
                                        "Le pourcentage de déduction appliqué à la valeur nominale ou de marché d'un actif apporté en garantie pour se prémunir contre sa volatilité ou son illiquidité",
                                        "Le dividende payé en actions nouvelles",
                                        "L'annulation pure et simple de l'actif"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Un haircut de 15% sur un collatéral de 100 000 € signifie que la banque ne prête qu'à concurrence de 85 000 € de valeur de couverture.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_19")
                                .question("Que mesure l'Indice d'Herfindahl-Hirschman (HHI) dans la gestion des risques de crédit d'un portefeuille bancaire ?")
                                .options(List.of(
                                        "Le degré de concentration des expositions de crédit sur un nombre restreint de contreparties, secteurs économiques ou zones géographiques",
                                        "Le taux de rentabilité des distributeurs de billets",
                                        "L'âge moyen des clients de la banque",
                                        "La durée de validité des cartes bancaires"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le HHI (somme des carrés des parts de marché ou d'exposition) mesure la concentration du portefeuille : plus le HHI est élevé, plus le risque idiosyncratique est fort.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q5_20")
                                .question("Quelle branche des mathématiques financières traite spécifiquement de la modélisation des événements catastrophiques rares au-delà de tout échantillon historique ?")
                                .options(List.of(
                                        "La théorie des groupes finis",
                                        "La Théorie des Valeurs Extrêmes (EVT - Extreme Value Theory) et la loi de Pareto généralisée (GPD)",
                                        "L'arithmétique modulaire",
                                        "La géométrie fractale des spirales"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'EVT (méthode Peaks-Over-Threshold) modélise rigoureusement la queue des pertes extrêmes sans supposer arbitrairement une loi normale.")
                                .build()
                ))
                .build();
        quizzesMap.put(q5.getId(), q5);

        // Quiz 6 : Validation : Actuariat, Tarification & Provisionnement IBNR
        QuizDto q6 = QuizDto.builder()
                .id("QUIZ_ACTUARIAL")
                .moduleId("MOD_ACTUARIAL")
                .title("Validation : Actuariat, Tarification & Provisionnement IBNR")
                .description("Vérifiez vos acquis sur la prime pure, le ratio combiné et la méthode de Chain-Ladder (20 questions).")
                .passingScorePct(75)
                .questions(List.of(
                        QuizQuestionDto.builder()
                                .id("Q6_1")
                                .question("Comment se définit la Prime Pure d'un contrat d'assurance ?")
                                .options(List.of(
                                        "La prime commerciale majorée de la TVA",
                                        "Le produit de la fréquence attendue de sinistres par le coût moyen attendu d'un sinistre (E[N] * E[X])",
                                        "Les frais de distribution payés aux courtiers",
                                        "Le montant maximal garanti au contrat"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Prime Pure = Fréquence (lambda) * Sévérité Moyenne (mu). Elle représente le coût actuariel espéré du risque sous-jacent.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_2")
                                .question("Une compagnie d'assurance affiche un Ratio Combiné (Combined Ratio) de 92%. Quelle est la conclusion ?")
                                .options(List.of(
                                        "L'activité de souscription technique est rentable (marge technique de 8%)",
                                        "La compagnie est en état de cessation de paiement immédiat",
                                        "La compagnie a perdu 92% de ses capitaux propres",
                                        "Tous les sinistres ont été refusés"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Un ratio combiné inférieur à 100% signifie que la somme des sinistres et des frais est inférieure aux primes perçues, dégageant un bénéfice technique.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_3")
                                .question("Que désigne l'acronyme IBNR dans le provisionnement actuariel des sinistres ?")
                                .options(List.of(
                                        "International Bank Net Ratio",
                                        "Incurred But Not Reported (Sinistres survenus mais non encore déclarés ou réglés)",
                                        "Index Benchmark Nominal Rate",
                                        "Insurance Balance Net Reserve"
                                ))
                                .correctOptionIndex(1)
                                .explanation("IBNR signifie Incurred But Not Reported. Ce sont les provisions techniques estimées pour les sinistres déjà survenus qui n'ont pas encore été déclarés ou réglés définitivement.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_4")
                                .question("Quel est le principe de la méthode Chain-Ladder de Mack appliquée aux triangles de liquidation ?")
                                .options(List.of(
                                        "Optimiser la vitesse d'exécution d'un ordre boursier",
                                        "Calculer des facteurs de passage (link ratios) de colonne en colonne pour projeter les sinistres cumulés vers la charge ultime",
                                        "Vendre des options d'achat à découvert",
                                        "Annuler automatiquement les contrats déficitaires"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La méthode Chain-Ladder utilise les ratios de développement historiques (link ratios f_j) pour projeter les sinistres jusqu'à leur liquidation ultime.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_5")
                                .question("Sous la réglementation Solvabilité II, que représente le Pilier 1 ?")
                                .options(List.of(
                                        "Les exigences quantitatives de fonds propres (SCR - Solvency Capital Requirement et MCR)",
                                        "La charte de déontologie des courtiers d'assurance",
                                        "La politique de communication sur les réseaux sociaux",
                                        "Le montant des salaires des dirigeants"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le Pilier 1 définit les règles de valorisation du bilan prudentiel en juste valeur (Best Estimate + Marge de Risque) et les capitaux de solvabilité obligatoires (SCR/MCR).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_6")
                                .question("Quel processus interne fondamental relève du Pilier 2 de la directive européenne Solvabilité II ?")
                                .options(List.of(
                                        "L'évaluation interne des risques et de la solvabilité propre (ORSA - Own Risk and Solvency Assessment)",
                                        "La fixation du barème du bonus-malus auto",
                                        "L'embauche des experts automobiles",
                                        "La gestion des réclamations clients"
                                ))
                                .correctOptionIndex(0)
                                .explanation("L'ORSA est l'exercice prospectif d'auto-évaluation globale de gouvernance par lequel l'assureur évalue ses besoins en capital sur son horizon stratégique.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_7")
                                .question("Quel document public annuel obligatoire matérialise la discipline de marché du Pilier 3 sous Solvabilité II ?")
                                .options(List.of(
                                        "Le rapport public sur la solvabilité et la situation financière (SFCR - Solvency and Financial Condition Report)",
                                        "La brochure publicitaire des nouveaux contrats d'épargne",
                                        "Le procès-verbal du comité d'entreprise",
                                        "Le relevé d'information annuel de l'assuré"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le rapport SFCR est publié chaque année sur le site internet de l'assureur, fournissant aux assurés et aux marchés une vision transparente de son bilan prudentiel.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_8")
                                .question("Dans la tarification non-vie par Modèles Linéaires Généralisés (GLM), quelles lois de probabilité sont traditionnellement utilisées pour la fréquence et la sévérité ?")
                                .options(List.of(
                                        "Loi de Poisson pour la fréquence des sinistres et Loi Gamma (ou Log-Normale) pour le coût moyen individuel",
                                        "Loi Binomiale négative pour le prix et Loi uniforme pour le nombre de contrats",
                                        "Loi Normale pour la fréquence et Loi exponentielle pour la météo",
                                        "Loi de Cauchy pour les deux composantes"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le modèle actuariel standard modélise le nombre d'événements par une régression de Poisson (fréquence) et la distribution asymétrique positive des coûts par une loi Gamma.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_9")
                                .question("Comment calcule-t-on le 'Loss Ratio' (Rapport S/P ou Ratio Sinistres sur Primes) d'une compagnie d'assurance ?")
                                .options(List.of(
                                        "Sinistres payés et provisionnés divisés par les Primes nettes acquises",
                                        "Dividendes versés divisés par les Capitaux propres",
                                        "Frais généraux divisés par le Chiffre d'affaires",
                                        "Nombre de contrats annulés divisé par le nombre de nouveaux souscripteurs"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le ratio S/P mesure la charge de sinistres pure générée par le portefeuille par rapport au volume de primes mutualisées pour cette même période.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_10")
                                .question("Comment se décompose le Ratio Combiné (Combined Ratio) global d'un assureur non-vie ?")
                                .options(List.of(
                                        "Loss Ratio (S/P) + Expense Ratio (Frais de gestion et commissions / Primes)",
                                        "Taux d'impôt + Taux d'intérêt sans risque",
                                        "Total des actifs / Total des passifs",
                                        "Bénéfice net / Nombre d'actions"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Combined Ratio = (Sinistres + Frais d'acquisition et de gestion) / Primes. S'il est inférieur à 100%, la souscription technique est bénéficiaire.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_11")
                                .question("Quel est l'objectif du système de Bonus-Malus (Coefficient de Réduction-Majoration) en assurance automobile ?")
                                .options(List.of(
                                        "Rendre l'assurance gratuite pour tout le monde",
                                        "Inciter à la prudence au volant et ajuster équitablement la prime au niveau de risque individuel observé au fil des années",
                                        "Financer la construction de nouvelles autoroutes",
                                        "Interdire la revente des véhicules accidentés"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le bonus-malus personnalise le tarif selon l'expérience de sinistralité : les conducteurs prudents bénéficient d'une réduction (bonus), pénalisant les conducteurs responsables d'accidents (malus).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_12")
                                .question("Quel risque comportemental la 'Franchise' (Deductible) permet-elle de mitiger efficacement ?")
                                .options(List.of(
                                        "Le risque de change sur les devises",
                                        "L'aléa moral (Moral Hazard), en responsabilisant l'assuré qui conserve à sa charge une partie financière en cas de sinistre",
                                        "Le risque d'erreur de saisie comptable",
                                        "Le risque de piratage informatique"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La franchise élimine les micro-sinistres coûteux en gestion administrative et évite la négligence de l'assuré (aléa moral).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_13")
                                .question("En quoi consiste un traité de réassurance non-proportionnelle en 'Excédent de Sinistre' (Excess of Loss - XL) ?")
                                .options(List.of(
                                        "L'assureur cède un pourcentage fixe de tous ses contrats au réassureur",
                                        "Le réassureur prend en charge la fraction de la charge d'un sinistre (ou d'un événement cumulé) qui excède un montant contractuel fixé appelé 'priorité' ou 'rétention'",
                                        "Le réassureur rachète la compagnie d'assurance",
                                        "L'assureur refuse d'indemniser les victimes"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le contrat XL protège le bilan de l'assureur direct contre les sinistres démesurés : l'assureur paie jusqu'au seuil de rétention, le réassureur paie l'excédent.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_14")
                                .question("Quelle est la caractéristique maîtresse de la méthode actuarielle de Bornhuetter-Ferguson comparée à la méthode Chain-Ladder pure ?")
                                .options(List.of(
                                        "Elle n'utilise aucune donnée chiffrée",
                                        "Elle combine les link ratios historiques avec une estimation a priori du ratio S/P attendu, ce qui stabilise les provisions pour les années de survenance récentes peu développées",
                                        "Elle prédit avec certitude la météo de l'année suivante",
                                        "Elle élimine les commissions de réassurance"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Pour les années très récentes où peu de sinistres ont été réglés, Chain-Ladder peut être instable. Bornhuetter-Ferguson pondère avec la rentabilité a priori de la branche.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_15")
                                .question("Que représente le 'Best Estimate des Engagements' (BEL) dans le bilan prudentiel Solvabilité II ?")
                                .options(List.of(
                                        "La valeur comptable historique amortie des bureaux de l'assureur",
                                        "L'espérance mathématique des flux futurs de trésorerie (sinistres et frais moins primes futures) actualisée selon la courbe des taux sans risque officielle de l'EIOPA",
                                        "La marge bénéficiaire espérée par les actionnaires",
                                        "Le capital social souscrit lors de la création de la société"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le Best Estimate correspond à la juste valeur économique sans biais ni marge de prudence excessive des engagements envers les assurés.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_16")
                                .question("Pourquoi ajoute-t-on une 'Marge de Risque' (Risk Margin) au Best Estimate pour constituer les provisions techniques sous Solvabilité II ?")
                                .options(List.of(
                                        "Pour rémunérer le régulateur national",
                                        "Pour refléter le coût du capital d'un tiers solvable nécessaire pour reprendre et gérer les engagements d'assurance jusqu'à leur extinction complète",
                                        "Pour financer des campagnes de sponsoring",
                                        "Pour compenser l'inflation passée"
                                ))
                                .correctOptionIndex(1)
                                .explanation("La Marge de Risque garantit qu'en cas de transfert forcé du portefeuille, l'assureur repreneur disposera des fonds nécessaires pour couvrir le coût du capital SCR afférent.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_17")
                                .question("Dans un triangle de développement actuariel (Triangle de Run-off), que représentent les lignes et que représentent les colonnes ?")
                                .options(List.of(
                                        "Les lignes représentent l'année de survenance du sinistre (accident year) et les colonnes représentent l'année de développement ou de règlement",
                                        "Les lignes représentent le nom des assurés et les colonnes leur code postal",
                                        "Les lignes représentent les taux d'intérêt et les colonnes le cours du dollar",
                                        "Les lignes représentent les trimestres fiscaux et les colonnes le chiffre d'affaires"
                                ))
                                .correctOptionIndex(0)
                                .explanation("Le triangle de liquidation regroupe les sinistres par cohorte de survenance (lignes) pour observer leur rythme d'écoulement et de maturation temporelle (colonnes).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_18")
                                .question("Que recouvre le risque de Catastrophe (CAT Risk) dans le module de risque de souscription non-vie Solvabilité II ?")
                                .options(List.of(
                                        "Le risque de piratage des comptes de messagerie des courtiers",
                                        "Le risque d'événements extrêmes majeurs ou d'accumulation exceptionnelle de sinistres dus à des périls naturels (tempête, séisme, inondation) ou d'origine humaine (terrorisme, incendie industriel)",
                                        "Le risque de perte des clés du coffre-fort de l'agence",
                                        "La variation des taux de TVA en Europe"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le sous-module CAT évalue la résilience du portefeuille face à des chocs dévastateurs rares frappant simultanément un grand nombre de contrats géographiquement concentrés.")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_19")
                                .question("Quelle est la métrique de calibration statistique retenue par la directive Solvabilité II pour le calcul du SCR (Solvency Capital Requirement) ?")
                                .options(List.of(
                                        "Une moyenne mobile sur 30 jours",
                                        "Une Value-at-Risk (VaR) de 99.5% sur un horizon temporel de 1 an (choc centennal 1 fois tous les 200 ans)",
                                        "Une perte maximale de 5% du chiffre d'affaires",
                                        "Le doublement systématique des fonds propres chaque décennie"
                                ))
                                .correctOptionIndex(1)
                                .explanation("Le capital SCR est calibré pour garantir que la compagnie ne fasse pas faillite sur un an avec une probabilité de survie de 99.5% (choc biséculaire).")
                                .build(),
                        QuizQuestionDto.builder()
                                .id("Q6_20")
                                .question("En quoi consiste l'Antisélection (Adverse Selection) en théorie de l'assurance ?")
                                .options(List.of(
                                        "L'élimination automatique des candidats lors d'un entretien d'embauche",
                                        "Une situation d'asymétrie d'information où les profils présentant les risques les plus élevés souscrivent préférentiellement des contrats d'assurance, déséquilibrant la mutualisation si les tarifs ne sont pas segmentés",
                                        "Le refus d'indemniser les sinistres causés par la foudre",
                                        "L'achat d'actions en dehors des heures d'ouverture de la bourse"
                                ))
                                .correctOptionIndex(1)
                                .explanation("L'asymétrie d'information pousse les assurés à haut risque à sur-consommer les garanties, forçant les actuaires à segmenter rigoureusement les risques par variables prédictives.")
                                .build()
                ))
                .build();
        quizzesMap.put(q6.getId(), q6);

    }

    private void initScenarios() {
        scenariosList.add(MarketScenarioDto.builder()
                .id("SCENARIO_RATE_HIKE")
                .title("Le Grand Choc des Taux Directeurs (+75 bps)")
                .category("FIXED_INCOME_FOREX")
                .difficulty("INTERMEDIATE")
                .context("Face à une poussée inflationniste inattendue, la Réserve Fédérale relève brutalement son taux directeur de 75 points de base.")
                .eventTrigger("Surprise monétaire hawkish de la Fed.")
                .assetImpacts(Map.of(
                        "TLT (Bonds 20Y+)", "Chute de -3.8% due à la forte duration modifiée.",
                        "SHY (Bonds 1-3Y)", "Baisse limitée de -0.4%, résilience court terme.",
                        "EUR/USD", "Pression baissière vers 1.0500 par renforcement du Dollar.",
                        "Actions Tech (QQQ)", "Correction de -2.5% par augmentation du coût du capital."
                ))
                .targetObjective("Protéger le capital obligataire et tirer parti du momentum haussier sur le Dollar US.")
                .recommendedAction("Réduire l'exposition sur la longue duration (vendre TLT), basculer sur du monétaire court terme (SHY) et acheter l'USD contre l'Euro.")
                .educationalTakeaways(List.of(
                        "Comprendre la convexité et la sensibilité de la duration obligataire.",
                        "Observer la transmission directe des taux directeurs sur le marché Forex.",
                        "Gérer le risque de valorisation des actifs de croissance lors d'un resserrement monétaire."
                ))
                .primarySymbol("TLT")
                .build());

        scenariosList.add(MarketScenarioDto.builder()
                .id("SCENARIO_TECH_FLASH_CRASH")
                .title("Flash Crash & Vente Panique sur la Tech")
                .category("EQUITY_RISK")
                .difficulty("NOVICE")
                .context("Une faille de sécurité majeure et des résultats décevants déclenchent une vague de ventes algorithmiques massives sur le Nasdaq.")
                .eventTrigger("Ordres automatiques de stop-loss en cascade.")
                .assetImpacts(Map.of(
                        "AAPL / MSFT", "Plongeon éclair de -7.2% en 15 minutes.",
                        "GLD (Or Physique)", "Rebond défensif de +2.1% en fuite vers la qualité (Flight to Quality).",
                        "VIX (Volatilité)", "Flambée de +45%."
                ))
                .targetObjective("Éviter le débouclage de marge forcé et stabiliser la Value-at-Risk du portefeuille.")
                .recommendedAction("Ne pas moyenner à la baisse sans signal technique, activer les stop-loss de précaution et réallouer 15% sur l'Or physique.")
                .educationalTakeaways(List.of(
                        "Importance d'avoir un Stop-Loss préalablement paramétré avant l'ouverture des marchés.",
                        "Comprendre le comportement de valeur refuge de l'or physique en phase d'affolement.",
                        "Respecter le dimensionnement de position pour éviter le risque de ruine."
                ))
                .primarySymbol("AAPL")
                .build());

        scenariosList.add(MarketScenarioDto.builder()
                .id("SCENARIO_OIL_STAGFLATION")
                .title("Flambée Géopolitique & Choc Pétrolier")
                .category("COMMODITIES_MACRO")
                .difficulty("EXPERT")
                .context("Des perturbations sur le détroit d'Ormuz bloquent 20% du transit maritime mondial de brut, propulsant le baril au-delà de 115 $.")
                .eventTrigger("Choc d'offre exogène sur le pétrole brut WTI.")
                .assetImpacts(Map.of(
                        "USO (Pétrole WTI)", "Hausse parabolique de +14.5% sur la semaine.",
                        "TIP (Obligations Indexées Inflation)", "Progression de +3.2% grâce à l'ajustement du coupon.",
                        "Transporteurs Aériens & Conso", "Pertes de -8% à -12% sous l'explosion des coûts carburant."
                ))
                .targetObjective("Construire une couverture contre la stagflation et préserver le pouvoir d'achat du portefeuille.")
                .recommendedAction("Prendre une position longue sur les matières premières énergétiques (USO) et les obligations indexées TIPS (TIP).")
                .educationalTakeaways(List.of(
                        "Les matières premières constituent la couverture la plus efficace contre les chocs d'offre non anticipés.",
                        "Différencier l'inflation par la demande et l'inflation par les coûts.",
                        "Exploiter la décorrélation des actifs réels par rapport aux obligations classiques."
                ))
                .primarySymbol("USO")
                .build());

        scenariosList.add(MarketScenarioDto.builder()
                .id("SCENARIO_ACTUARY_STORM")
                .title("Tempête Centennale & Choc de Sinistralité")
                .category("ACTUARIAL_INSURANCE")
                .difficulty("EXPERT")
                .context("Une succession d'événements climatiques majeurs fait exploser la fréquence des sinistres habitation et auto à 22% (vs 4.5% de référence).")
                .eventTrigger("Pic de sinistralité extrême (Loss Ratio attendu > 135%).")
                .assetImpacts(Map.of(
                        "Portefeuille Habitation", "Coût total des sinistres x4 par rapport aux primes collectées.",
                        "Ratio Combiné", "Dégradation critique à 142% (Déficit technique de souscription).",
                        "Capital de Solvabilité (SCR)", "Consommation accélérée des fonds propres prudentiels."
                ))
                .targetObjective("Restaurer la rentabilité technique et garantir la solvabilité de la compagnie d'assurance.")
                .recommendedAction("Augmenter la franchise à 750 €, relever le chargement de sécurité à 25% et recalculer les provisions IBNR avec Chain-Ladder.")
                .educationalTakeaways(List.of(
                        "Mesurer la sensibilité d'un portefeuille d'assurance aux événements extrêmes (fat-tail distribution).",
                        "Comprendre le rôle protecteur de la franchise et du chargement prudentiel.",
                        "Appliquer la méthode Chain-Ladder pour quantifier le passif résiduel à provisionner au bilan."
                ))
                .primarySymbol("COMMODITY")
                .build());
    }

    private final Set<String> joinedChallengeKeys = Collections.synchronizedSet(new HashSet<>());

    public List<LeaderboardTraderDto> getLeaderboard(User currentUser) {
        long badgesCount = badgeRepository.findByUserIdOrderByUnlockedAtDesc(currentUser.getId()).size();
        long passedQuizzes = quizAttemptRepository.countByUserIdAndPassedTrue(currentUser.getId());
        long completedLessons = progressRepository.countByUserId(currentUser.getId());

        int currentScore = (int) (badgesCount * 500 + passedQuizzes * 250 + completedLessons * 100);
        String currentEmail = currentUser.getEmail();
        String currentName = currentEmail.split("@")[0].toUpperCase();

        List<LeaderboardTraderDto> list = new ArrayList<>(List.of(
                LeaderboardTraderDto.builder()
                        .rank(1)
                        .userId(901L)
                        .displayName("Yassine Mansour (Quant Desk)")
                        .email("yassine.mansour@esprit.tn")
                        .totalPnl(new BigDecimal("18450.00"))
                        .returnPercentage(new BigDecimal("18.45"))
                        .winRate(new BigDecimal("78.50"))
                        .tradesCount(42)
                        .badgesCount(6)
                        .tier("DIAMOND")
                        .scoreTotal(4250)
                        .build(),
                LeaderboardTraderDto.builder()
                        .rank(2)
                        .userId(currentUser.getId())
                        .displayName(currentName + " (Vous)")
                        .email(currentEmail)
                        .totalPnl(new BigDecimal("12800.50"))
                        .returnPercentage(new BigDecimal("12.80"))
                        .winRate(new BigDecimal("72.00"))
                        .tradesCount(28)
                        .badgesCount((int) badgesCount)
                        .tier(badgesCount >= 4 ? "DIAMOND" : badgesCount >= 2 ? "PLATINUM" : "GOLD")
                        .scoreTotal(Math.max(2850, currentScore))
                        .build(),
                LeaderboardTraderDto.builder()
                        .rank(3)
                        .userId(902L)
                        .displayName("Sarra Trabelsi (Risk & Solvency)")
                        .email("sarra.trabelsi@esprit.tn")
                        .totalPnl(new BigDecimal("10950.20"))
                        .returnPercentage(new BigDecimal("10.95"))
                        .winRate(new BigDecimal("69.40"))
                        .tradesCount(35)
                        .badgesCount(5)
                        .tier("GOLD")
                        .scoreTotal(3400)
                        .build(),
                LeaderboardTraderDto.builder()
                        .rank(4)
                        .userId(903L)
                        .displayName("Amine Ben Salem (Forex Desk)")
                        .email("amine.bensalem@esprit.tn")
                        .totalPnl(new BigDecimal("8420.00"))
                        .returnPercentage(new BigDecimal("8.42"))
                        .winRate(new BigDecimal("64.20"))
                        .tradesCount(19)
                        .badgesCount(4)
                        .tier("GOLD")
                        .scoreTotal(2950)
                        .build(),
                LeaderboardTraderDto.builder()
                        .rank(5)
                        .userId(904L)
                        .displayName("Khadija Ouerghi (Actuarial Lead)")
                        .email("khadija.ouerghi@esprit.tn")
                        .totalPnl(new BigDecimal("6200.00"))
                        .returnPercentage(new BigDecimal("6.20"))
                        .winRate(new BigDecimal("61.00"))
                        .tradesCount(15)
                        .badgesCount(3)
                        .tier("SILVER")
                        .scoreTotal(2400)
                        .build(),
                LeaderboardTraderDto.builder()
                        .rank(6)
                        .userId(905L)
                        .displayName("Mehdi Dridi (Multi-Asset Trader)")
                        .email("mehdi.dridi@esprit.tn")
                        .totalPnl(new BigDecimal("4150.00"))
                        .returnPercentage(new BigDecimal("4.15"))
                        .winRate(new BigDecimal("57.50"))
                        .tradesCount(22)
                        .badgesCount(2)
                        .tier("SILVER")
                        .scoreTotal(1850)
                        .build()
        ));

        list.sort((a, b) -> Integer.compare(b.getScoreTotal(), a.getScoreTotal()));
        for (int i = 0; i < list.size(); i++) {
            list.get(i).setRank(i + 1);
        }
        return list;
    }

    public List<TradingChallengeDto> getTradingChallenges(User currentUser) {
        String uid = String.valueOf(currentUser.getId());
        return List.of(
                TradingChallengeDto.builder()
                        .id("CHAL_FOREX_48H")
                        .title("Grand Prix Forex & Arbitrage de Devises (48h)")
                        .description("Générez un PnL positif sur au moins 5 positions Forex majeures (EUR/USD, GBP/USD, USD/JPY) en respectant un Stop-Loss strict.")
                        .category("FOREX")
                        .difficulty("AVANCÉ")
                        .rewardBadgeCode("BADGE_FOREX_CHAMPION")
                        .rewardPoints(500)
                        .participantsCount(48)
                        .daysRemaining(3)
                        .status("ACTIVE")
                        .objective("Rentabilité > 4% avec Maximum Drawdown < 2.5%")
                        .joined(joinedChallengeKeys.contains(uid + "_CHAL_FOREX_48H"))
                        .build(),
                TradingChallengeDto.builder()
                        .id("CHAL_RISK_SHARPE")
                        .title("Tournoi Maîtrise du Risque & Ratio de Sharpe Maximal")
                        .description("Bâtissez un portefeuille équilibré minimisant la volatilité avec un ratio de Sharpe annualisé supérieur à 2.0.")
                        .category("RISK")
                        .difficulty("EXPERT")
                        .rewardBadgeCode("BADGE_SHARPE_MASTER")
                        .rewardPoints(450)
                        .participantsCount(36)
                        .daysRemaining(5)
                        .status("ACTIVE")
                        .objective("Sharpe Ratio >= 2.00 et VaR 99% < 5%")
                        .joined(joinedChallengeKeys.contains(uid + "_CHAL_RISK_SHARPE"))
                        .build(),
                TradingChallengeDto.builder()
                        .id("CHAL_MULTI_ASSET")
                        .title("Championnat d'Arbitrage Multi-Actifs ESPRIT")
                        .description("Allouez du capital sur 4 classes d'actifs simultanées (Actions, Obligations US10Y, Or et Pétrole) pour battre l'indice de référence.")
                        .category("MULTI_ASSET")
                        .difficulty("INTERMÉDIAIRE")
                        .rewardBadgeCode("BADGE_MULTI_ASSET_ELITE")
                        .rewardPoints(600)
                        .participantsCount(62)
                        .daysRemaining(7)
                        .status("ACTIVE")
                        .objective("Allocation sur 4 classes avec corrélation croisée < 0.40")
                        .joined(joinedChallengeKeys.contains(uid + "_CHAL_MULTI_ASSET"))
                        .build(),
                TradingChallengeDto.builder()
                        .id("CHAL_ACTUARY_STORM")
                        .title("Défi Solvabilité II & Résilience Choc Centennal")
                        .description("Ajustez les primes pures, chargements de sécurité et provisions IBNR pour restaurer la rentabilité technique face à une tempête.")
                        .category("ACTUARY")
                        .difficulty("EXPERT")
                        .rewardBadgeCode("BADGE_ACTUARIAL_EXCELLENCE")
                        .rewardPoints(550)
                        .participantsCount(29)
                        .daysRemaining(4)
                        .status("ACTIVE")
                        .objective("Ramener le ratio combiné sous 95% avec couverture SCR > 130%")
                        .joined(joinedChallengeKeys.contains(uid + "_CHAL_ACTUARY_STORM"))
                        .build()
        );
    }

    public boolean joinChallenge(User currentUser, String challengeId) {
        String key = currentUser.getId() + "_" + challengeId;
        joinedChallengeKeys.add(key);
        return true;
    }
}
