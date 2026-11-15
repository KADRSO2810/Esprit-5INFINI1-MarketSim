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

            // Vérifier déblocage de premier pas
            unlockBadgeIfEligible(user, "FIRST_LESSON", "Premier Pas de Trader",
                    "A terminé sa première leçon théorique sur Market Simulator.", "PEDAGOGY");
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

        if (passed) {
            // Badges par domaine
            switch (quiz.getId()) {
                case "QUIZ_MARKET_BASICS" -> unlockBadgeIfEligible(user, "BADGE_BASICS", "Opérateur de Bourse Qualifié",
                        "A validé les mécanismes d'ordres et de microstructure avec brio.", "TRADING")
                        .ifPresent(newlyUnlocked::add);
                case "QUIZ_TECHNICAL" -> unlockBadgeIfEligible(user, "BADGE_CHARTIST", "Analyste Technique & Quant",
                        "Maîtrise des oscillateurs RSI, moyennes mobiles et backtesting.", "QUANTITATIVE")
                        .ifPresent(newlyUnlocked::add);
                case "QUIZ_MULTI_ASSET" -> unlockBadgeIfEligible(user, "BADGE_MULTI_ASSET", "Stratège Multi-Actifs",
                        "Expertise validée sur le Forex (Pips/ECB), Obligations (YTM/Duration) et Matières Premières.", "MULTI_ASSET")
                        .ifPresent(newlyUnlocked::add);
                case "QUIZ_FUNDAMENTAL" -> unlockBadgeIfEligible(user, "BADGE_CFA_ANALYST", "Analyste Financier Certifié",
                        "Déchiffrage certifié des états financiers SEC 10-K, ratios de valorisation et cash flows.", "FUNDAMENTALS")
                        .ifPresent(newlyUnlocked::add);
                case "QUIZ_RISK_STRESS" -> unlockBadgeIfEligible(user, "BADGE_RISK_MANAGER", "Risk Manager Bâle III & XAI",
                        "Contrôle de la VaR, scénarios de stress bancaire et explicabilité SHAP.", "RISK")
                        .ifPresent(newlyUnlocked::add);
                case "QUIZ_ACTUARIAL" -> unlockBadgeIfEligible(user, "BADGE_ACTUARY", "Actuaire & Modélisateur Agréé",
                        "Tarification GLM, simulations Monte Carlo et provisions Chain-Ladder IBNR.", "ACTUARY")
                        .ifPresent(newlyUnlocked::add);
            }

            // Vérifier si tous les quiz sont passés
            long passedCount = quizAttemptRepository.countByUserIdAndPassedTrue(user.getId());
            if (passedCount >= quizzesMap.size()) {
                unlockBadgeIfEligible(user, "BADGE_MASTER_MARKETS", "Master de Salle de Marché",
                        "Diplômé d'excellence ayant validé l'intégralité du cursus académique MarketSim.", "EXCELLENCE")
                        .ifPresent(newlyUnlocked::add);
            }
        }

        String feedback = passed
                ? "Félicitations ! Vous avez validé ce module avec " + percentage + "% de bonnes réponses."
                : "Score insuffisant (" + percentage + "%). Le seuil requis est de " + quiz.getPassingScorePct() + "%. Relisez la fiche de cours et retentez votre chance.";

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
                .map(b -> UserBadgeDto.builder()
                        .badgeCode(b.getBadgeCode())
                        .title(b.getTitle())
                        .description(b.getDescription())
                        .category(b.getCategory())
                        .unlockedAt(b.getUnlockedAt())
                        .build())
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

    private Optional<UserBadgeDto> unlockBadgeIfEligible(User user, String code, String title, String desc, String cat) {
        if (!badgeRepository.existsByUserIdAndBadgeCode(user.getId(), code)) {
            UserBadge b = UserBadge.builder()
                    .user(user)
                    .badgeCode(code)
                    .title(title)
                    .description(desc)
                    .category(cat)
                    .build();
            UserBadge saved = badgeRepository.save(b);
            return Optional.of(UserBadgeDto.builder()
                    .badgeCode(saved.getBadgeCode())
                    .title(saved.getTitle())
                    .description(saved.getDescription())
                    .category(saved.getCategory())
                    .unlockedAt(saved.getUnlockedAt() != null ? saved.getUnlockedAt() : LocalDateTime.now())
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
        // Quiz 1 : Market Basics
        QuizDto q1 = QuizDto.builder()
                .id("QUIZ_MARKET_BASICS")
                .moduleId("MOD_MARKET_BASICS")
                .title("Validation : Mécanismes d'Ordres & Microstructure")
                .description("Évaluez vos compétences sur le carnet d'ordres, l'exécution limite vs marché et les ordres stop.")
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
                                .build()
                ))
                .build();
        quizzesMap.put(q1.getId(), q1);

        // Quiz 2 : Analyse Technique
        QuizDto q2 = QuizDto.builder()
                .id("QUIZ_TECHNICAL")
                .moduleId("MOD_TECHNICAL_ANALYSIS")
                .title("Validation : Analyse Technique & Indicateurs Chartistes")
                .description("Vérifiez votre compréhension des moyennes mobiles, de l'indicateur RSI et des métriques de backtesting.")
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
                                .question("Quelle stratégie présente le meilleur ratio rendement/risque ?")
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
                                .build()
                ))
                .build();
        quizzesMap.put(q2.getId(), q2);

        // Quiz 3 : Multi-Actifs
        QuizDto q3 = QuizDto.builder()
                .id("QUIZ_MULTI_ASSET")
                .moduleId("MOD_MULTI_ASSET")
                .title("Validation : Marchés Multi-Actifs (Forex, Obligations, Commodities)")
                .description("Testez vos connaissances sur les paires de devises, les pips, le comportement des obligations et l'or.")
                .passingScorePct(75)
                .questions(List.of(
                        QuizQuestionDto.builder()
                                .id("Q3_1")
                                .question("Sur la paire EUR/USD, que vaut 1 pip de variation sur une position de 100 000 EUR ?")
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
                                .build()
                ))
                .build();
        quizzesMap.put(q3.getId(), q3);

        // Quiz 4 : Analyse Fondamentale
        QuizDto q4 = QuizDto.builder()
                .id("QUIZ_FUNDAMENTAL")
                .moduleId("MOD_FUNDAMENTAL")
                .title("Validation : Analyse Fondamentale & États Financiers SEC")
                .description("Vérifiez vos compétences d'analyse financière sur les dépôts 10-K, ratios de valorisation et trésorerie.")
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
                                .build()
                ))
                .build();
        quizzesMap.put(q4.getId(), q4);

        // Quiz 5 : Risques, Stress Testing & XAI
        QuizDto q5 = QuizDto.builder()
                .id("QUIZ_RISK_STRESS")
                .moduleId("MOD_RISK_STRESS")
                .title("Validation : Risques de Marché, Stress Testing & XAI")
                .description("Évaluez vos compétences sur la Value-at-Risk, les scénarios de stress bancaire et l'explicabilité SHAP.")
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
                                        "Une récession sévère combinée à une hausse des défauts de crédit (NPL) et une baisse des marchés",
                                        "Une baisse de 10 bps des taux avec croissance du PIB de 4%",
                                        "Une hausse des dépôts de détail sans aucun changement macroéconomique",
                                        "Une simplification réglementaire"
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
                                .build()
                ))
                .build();
        quizzesMap.put(q5.getId(), q5);

        // Quiz 6 : Actuariat
        QuizDto q6 = QuizDto.builder()
                .id("QUIZ_ACTUARIAL")
                .moduleId("MOD_ACTUARIAL")
                .title("Validation : Actuariat, Tarification & Provisionnement IBNR")
                .description("Vérifiez vos acquis sur la prime pure, le ratio combiné et la méthode de Chain-Ladder.")
                .passingScorePct(75)
                .questions(List.of(
                        QuizQuestionDto.builder()
                                .id("Q6_1")
                                .question("Comment se définit la Prime Pure d'un contrat d'assurance ?")
                                .options(List.of(
                                        "La prime commerciale majorée de la TVA",
                                        "Le produit de la fréquence attendue de sinistres par le coût moyen attendu d'un sinistre",
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
}
