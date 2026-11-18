package com.marketsimulator.service.arena;

import com.marketsimulator.domain.ArenaRun;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.arena.*;
import com.marketsimulator.repository.ArenaRunRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class FlashCrashArenaService {

    private final ArenaRunRepository arenaRunRepository;

    /**
     * Retourne la liste des Boss de crise macroéconomique disponibles dans l'arène.
     */
    public List<ArenaBossDto> getBosses() {
        return List.of(
                buildLehmanBoss(),
                buildCovidBoss(),
                buildStagflationBoss(),
                buildBlackMondayBoss()
        );
    }

    /**
     * Retourne les données complètes d'un Boss (avec trajectoire 180s et événements chronométrés).
     */
    public Optional<ArenaBossDto> getBossById(String bossId) {
        return getBosses().stream()
                .filter(b -> b.getId().equalsIgnoreCase(bossId))
                .findFirst();
    }

    /**
     * Enregistre le run d'un joueur, calcule le score quantitatif, la note (SSS à F) et le débrief d'audit.
     */
    @Transactional
    public ArenaRunResponse recordArenaRun(User user, ArenaRunRequest request) {
        double initialEquity = request.getInitialEquity();
        double finalEquity = Math.max(0.0, request.getFinalEquity());
        double netPnl = finalEquity - initialEquity;
        double returnPct = initialEquity > 0 ? (netPnl / initialEquity) * 100.0 : -100.0;
        double maxDrawdownPct = Math.abs(request.getMaxDrawdownPct());
        boolean survived = Boolean.TRUE.equals(request.getSurvived()) && finalEquity > 5000.0;
        int survivalSeconds = request.getSurvivalSeconds();
        int actionsTaken = request.getActionsTaken() != null ? request.getActionsTaken() : 0;
        int hedgesCount = request.getHedgesCount() != null ? request.getHedgesCount() : 0;

        // Calcul du Score Institutionnel E-Sport (Max 5000 pts)
        int score = calculateScore(survived, initialEquity, finalEquity, maxDrawdownPct, hedgesCount, survivalSeconds);
        String rankGrade = calculateRankGrade(survived, finalEquity, initialEquity, maxDrawdownPct, netPnl);
        String auditFeedback = generateAuditFeedback(rankGrade, request.getBossId(), finalEquity, maxDrawdownPct);
        String titleEarned = determineTitle(rankGrade, score);
        int xpEarned = Math.max(50, score / 5);

        ArenaRun arenaRun = ArenaRun.builder()
                .user(user)
                .bossId(request.getBossId().toUpperCase())
                .initialEquity(BigDecimal.valueOf(initialEquity).setScale(2, RoundingMode.HALF_UP))
                .finalEquity(BigDecimal.valueOf(finalEquity).setScale(2, RoundingMode.HALF_UP))
                .netPnl(BigDecimal.valueOf(netPnl).setScale(2, RoundingMode.HALF_UP))
                .returnPct(BigDecimal.valueOf(returnPct).setScale(4, RoundingMode.HALF_UP))
                .maxDrawdownPct(BigDecimal.valueOf(maxDrawdownPct).setScale(4, RoundingMode.HALF_UP))
                .survivalSeconds(survivalSeconds)
                .survived(survived)
                .rankGrade(rankGrade)
                .score(score)
                .actionsTaken(actionsTaken)
                .hedgesCount(hedgesCount)
                .build();

        ArenaRun saved = arenaRunRepository.save(arenaRun);

        String bossName = getBossName(request.getBossId());

        return ArenaRunResponse.builder()
                .id(saved.getId())
                .bossId(saved.getBossId())
                .bossName(bossName)
                .initialEquity(initialEquity)
                .finalEquity(finalEquity)
                .netPnl(netPnl)
                .returnPct(returnPct)
                .maxDrawdownPct(maxDrawdownPct)
                .survivalSeconds(survivalSeconds)
                .survived(survived)
                .rankGrade(rankGrade)
                .score(score)
                .xpEarned(xpEarned)
                .titleEarned(titleEarned)
                .auditFeedback(auditFeedback)
                .createdAt(saved.getCreatedAt() != null ? saved.getCreatedAt() : LocalDateTime.now())
                .build();
    }

    /**
     * Classement mondial / podium de l'arène Flash Crash
     */
    public List<ArenaLeaderboardEntryDto> getLeaderboard() {
        List<ArenaRun> runs = arenaRunRepository.findTop15ByOrderByScoreDesc();
        List<ArenaLeaderboardEntryDto> result = new ArrayList<>();

        int rank = 1;
        for (ArenaRun r : runs) {
            String userName = r.getUser() != null ? r.getUser().getEmail().split("@")[0] : "Trader Inconnu";
            result.add(ArenaLeaderboardEntryDto.builder()
                    .rank(rank++)
                    .runId(r.getId())
                    .traderName(userName)
                    .bossId(r.getBossId())
                    .bossName(getBossName(r.getBossId()))
                    .finalEquity(r.getFinalEquity().doubleValue())
                    .netPnl(r.getNetPnl().doubleValue())
                    .returnPct(r.getReturnPct().doubleValue())
                    .maxDrawdownPct(r.getMaxDrawdownPct().doubleValue())
                    .survivalSeconds(r.getSurvivalSeconds())
                    .survived(r.getSurvived())
                    .rankGrade(r.getRankGrade())
                    .score(r.getScore())
                    .date(r.getCreatedAt())
                    .build());
        }

        // Si la base contient moins de 3 runs, enrichir avec les scores historiques de référence ESPRIT
        if (result.size() < 3) {
            result.addAll(generateReferenceLeaderboard(result.size() + 1));
        }

        return result;
    }

    /**
     * Historique des runs du joueur connecté
     */
    public List<ArenaRunResponse> getUserHistory(User user) {
        List<ArenaRun> runs = arenaRunRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        return runs.stream().map(r -> ArenaRunResponse.builder()
                .id(r.getId())
                .bossId(r.getBossId())
                .bossName(getBossName(r.getBossId()))
                .initialEquity(r.getInitialEquity().doubleValue())
                .finalEquity(r.getFinalEquity().doubleValue())
                .netPnl(r.getNetPnl().doubleValue())
                .returnPct(r.getReturnPct().doubleValue())
                .maxDrawdownPct(r.getMaxDrawdownPct().doubleValue())
                .survivalSeconds(r.getSurvivalSeconds())
                .survived(r.getSurvived())
                .rankGrade(r.getRankGrade())
                .score(r.getScore())
                .xpEarned(Math.max(50, r.getScore() / 5))
                .titleEarned(determineTitle(r.getRankGrade(), r.getScore()))
                .auditFeedback(generateAuditFeedback(r.getRankGrade(), r.getBossId(), r.getFinalEquity().doubleValue(), r.getMaxDrawdownPct().doubleValue()))
                .createdAt(r.getCreatedAt())
                .build()
        ).toList();
    }

    // --- Moteurs de Notation & Audit Algorithmique ---

    private int calculateScore(boolean survived, double initialEquity, double finalEquity, double maxDrawdownPct, int hedgesCount, int survivalSeconds) {
        if (!survived) {
            // Liquidé ou abandon : score basé uniquement sur le temps de survie
            return Math.min(800, survivalSeconds * 4);
        }

        double equityRatio = finalEquity / initialEquity;
        int baseEquityScore = (int) Math.round(equityRatio * 1800);
        int survivalBonus = 1200;
        int drawdownPenalty = (int) Math.round(maxDrawdownPct * 12);
        int tacticalHedgeBonus = Math.min(800, hedgesCount * 150);

        int total = baseEquityScore + survivalBonus - drawdownPenalty + tacticalHedgeBonus;
        return Math.max(100, Math.min(5000, total));
    }

    private String calculateRankGrade(boolean survived, double finalEquity, double initialEquity, double maxDrawdownPct, double netPnl) {
        if (!survived || finalEquity <= 10000.0) {
            return "F";
        }
        if (netPnl > 0 && maxDrawdownPct <= 12.0) {
            return "SSS"; // God-tier quant
        }
        if (netPnl >= -5000.0 && maxDrawdownPct <= 20.0) {
            return "S";
        }
        if (finalEquity >= initialEquity * 0.80) {
            return "A";
        }
        if (finalEquity >= initialEquity * 0.60) {
            return "B";
        }
        return "C";
    }

    private String determineTitle(String rankGrade, int score) {
        return switch (rankGrade) {
            case "SSS" -> "Légende Vivante du Risque Macro";
            case "S" -> "Grand Maître des Chocs Systémiques";
            case "A" -> "Gestionnaire de Crise Institutionnel";
            case "B" -> "Trader Survivant de Volatilité";
            case "C" -> "Rescapé du Krach Boursier";
            default -> "Trader Liquidé sous Pression";
        };
    }

    private String generateAuditFeedback(String rankGrade, String bossId, double finalEquity, double maxDrawdownPct) {
        return switch (rankGrade) {
            case "SSS" -> "Performance d'élite absolue. Vos couvertures contrariantes et votre timing sur les actifs refuges ont généré un PnL positif en pleine tempête. Vous rejoignez le top 1% des quants mondiaux.";
            case "S" -> "Excellente résilience macroéconomique. Le capital est intact avec un drawdown remarquablement contenu à " + String.format(Locale.US, "%.1f", maxDrawdownPct) + "%. Vos réflexes sur les safe-havens ont sauvé votre desk.";
            case "A" -> "Gestion du risque robuste. Vous survivez au choc avec plus de 80% de votre capital de départ ($" + String.format(Locale.US, "%.0f", finalEquity) + "). Pensez à déclencher vos hedges encore plus tôt pour décrocher le rang S.";
            case "B" -> "Survie assurée mais éprouvante. Le portefeuille a absorbé un drawdown significatif (" + String.format(Locale.US, "%.1f", maxDrawdownPct) + "%). Votre exposition en actions est restée trop lourde au cœur du débouclage de levier.";
            case "C" -> "Survie in extremis. Votre capital a frôlé la liquidation forcée. En situation de panique macroéconomique, la règle de base est de basculer en 'Flight to Cash' sans hésitation.";
            default -> "LIQUIDATION TOTALE (Game Over). L'emballement de la volatilité a englouti votre marge. Lors des prochains runs, activez immédiatement le Hedge Or ou le refuge 100% Cash dès les premiers avertissements d'urgence.";
        };
    }

    private String getBossName(String bossId) {
        if (bossId == null) return "Boss Inconnu";
        return switch (bossId.toUpperCase()) {
            case "LEHMAN_2008" -> "Faillite Lehman Brothers (2008)";
            case "COVID_2020" -> "Flash Crash Covid-19 (2020)";
            case "STAGFLATION_2022" -> "Choc Stagflation & Ukraine (2022)";
            case "BLACK_MONDAY_1987" -> "Le Krach du Lundi Noir (1987)";
            default -> bossId;
        };
    }

    // --- Génération des Scénarios de Boss ---

    private ArenaBossDto buildLehmanBoss() {
        List<ArenaCrisisEventDto> events = List.of(
                ArenaCrisisEventDto.builder()
                        .timeSec(15)
                        .headline("ALERTE ROUGE : Lehman Brothers dépose le Bilan sous le Chapitre 11 !")
                        .severity("COLLAPSE")
                        .source("BLOOMBERG WIRES")
                        .shockMultiplier(1.4)
                        .hint("Le secteur bancaire plonge. Basculez une partie de votre capital vers l'Or (GLD) !")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(45)
                        .headline("AIG en détresse de liquidité : Demande d'un sauvetage fédéral de $85 Mds.")
                        .severity("CRITICAL")
                        .source("REUTERS EMERGENCY")
                        .shockMultiplier(1.6)
                        .hint("Les CDS explosent. Activez le Panic Short pour capturer la cascade baissière.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(85)
                        .headline("GEL DU MARCHÉ DU CRÉDIT : Le spread TED explose à 460 points de base.")
                        .severity("PANIC")
                        .source("FEDERAL RESERVE DESK")
                        .shockMultiplier(2.0)
                        .hint("Liquidité au point mort. Le Flight to Cash permet de sécuriser vos gains.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(125)
                        .headline("REJET DU PLAN PAULSON : La Chambre des Représentants vote NON au plan de sauvetage !")
                        .severity("COLLAPSE")
                        .source("WALL STREET JOURNAL")
                        .shockMultiplier(2.3)
                        .hint("Pire chute historique en points du Dow Jones (-777 pts). Ne restez pas acheteur !")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(155)
                        .headline("Adoption finale du plan Paulson revisité ($700 Mds) : Fin de l'hémorragie immédiate.")
                        .severity("INTERVENTION")
                        .source("CONGRESS PRESS")
                        .shockMultiplier(0.7)
                        .hint("Point d'inflexion potentiel : Déclenchez 'Buy The Dip' pour maximiser votre score SSS !")
                        .build()
        );

        List<ArenaPricePointDto> trajectory = generateCrisisTrajectory(1250.0, -0.42, 89.5, 180, 0.08);

        return ArenaBossDto.builder()
                .id("LEHMAN_2008")
                .name("Faillite Lehman Brothers")
                .subtitle("Choc Systémique de Liquidité Interbancaire & Débâcle des Subprimes")
                .year(2008)
                .difficulty("LÉGENDAIRE")
                .themeColor("rose")
                .initialEquity(100000.0)
                .durationSeconds(180)
                .lore("15 Septembre 2008. 158 ans d'histoire balayés en 24h. Le système financier mondial est à quelques centimètres d'un arrêt total des paiements.")
                .mechanicsDescription("Choc de liquidité asymétrique, débouclage violent de levier, spreads de marché décuplés et faux rebonds trompeurs.")
                .historicalMaxDrawdown(56.8)
                .vixSpike(89.5)
                .assetName("Banking & Financials Index (XLF)")
                .initialPrice(1250.0)
                .events(events)
                .priceTrajectory(trajectory)
                .build();
    }

    private ArenaBossDto buildCovidBoss() {
        List<ArenaCrisisEventDto> events = List.of(
                ArenaCrisisEventDto.builder()
                        .timeSec(20)
                        .headline("L'OMS déclare la Pandémie Mondiale de Covid-19 : Fermeture des frontières.")
                        .severity("CRITICAL")
                        .source("WHO BRIEFING")
                        .shockMultiplier(1.5)
                        .hint("Confinement global en vue. Les flux de cash se tarissent.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(50)
                        .headline("CIRCUIT BREAKER ACTIVÉ : S&P 500 suspendu 15 minutes après -7% à l'ouverture !")
                        .severity("COLLAPSE")
                        .source("NYSE DISPATCH")
                        .shockMultiplier(1.8)
                        .hint("Ordres bloqués. Préparez un Short ou du Cash dès la réouverture.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(95)
                        .headline("GUERRE DES PRIX DU PÉTROLE : L'Arabie Saoudite inonde le marché, brut à $20.")
                        .severity("PANIC")
                        .source("ENERGY INTELLIGENCE")
                        .shockMultiplier(2.2)
                        .hint("Double choc offre/demande. Volatilité record sur le VIX (>80).")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(135)
                        .headline("BAZOOKA DE LA FED : QE ILLIMITÉ et rachat direct de dettes d'entreprises !")
                        .severity("INTERVENTION")
                        .source("FEDERAL RESERVE WIRES")
                        .shockMultiplier(0.5)
                        .hint("Injections monétaires massives : Moment idéal pour un 'Buy The Dip' agressif !")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(165)
                        .headline("Rebond vertigineux 'V-Shape' : Les valeurs technologiques mènent la charge.")
                        .severity("INTERVENTION")
                        .source("MARKET PULSE")
                        .shockMultiplier(0.4)
                        .hint("Accélération haussière brutale vers la clôture de la séance.")
                        .build()
        );

        List<ArenaPricePointDto> trajectory = generateCrisisTrajectory(3380.0, -0.34, 82.7, 180, 0.12);

        return ArenaBossDto.builder()
                .id("COVID_2020")
                .name("Flash Crash Covid-19")
                .subtitle("Arrêt Cardiaque de l'Économie Mondiale & VIX Parabolique")
                .year(2020)
                .difficulty("EXTRÊME")
                .themeColor("amber")
                .initialEquity(100000.0)
                .durationSeconds(180)
                .lore("Mars 2020. La baisse boursière la plus rapide de 30% de toute l'histoire contemporaine, suivie par les plus monumentales injections de liquidité jamais vues.")
                .mechanicsDescription("Volatilité supersonique, suspensions de cotations, puis rallye de rebond en V extrêmement violent soutenu par la Fed.")
                .historicalMaxDrawdown(35.4)
                .vixSpike(82.7)
                .assetName("S&P 500 Index (SPX)")
                .initialPrice(3380.0)
                .events(events)
                .priceTrajectory(trajectory)
                .build();
    }

    private ArenaBossDto buildStagflationBoss() {
        List<ArenaCrisisEventDto> events = List.of(
                ArenaCrisisEventDto.builder()
                        .timeSec(20)
                        .headline("OFFENSIVE GÉOPOLITIQUE : Début des hostilités en Ukraine, le gaz s'envole.")
                        .severity("COLLAPSE")
                        .source("EUROPEAN DISPATCH")
                        .shockMultiplier(1.4)
                        .hint("L'énergie explose. Les valeurs de croissance subissent des ventes massives.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(60)
                        .headline("SANCTIONS FINANCIÈRES : Gel des réserves de la Banque Centrale de Russie.")
                        .severity("CRITICAL")
                        .source("BRUSSELS PRESS")
                        .shockMultiplier(1.6)
                        .hint("Rupture de chaînes d'approvisionnement des métaux et engrais.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(100)
                        .headline("INFLATION RECORD À 9.1% : La Fed monte ses taux de 75 bps en urgence.")
                        .severity("PANIC")
                        .source("BLS INFLATION REPORT")
                        .shockMultiplier(2.1)
                        .hint("Krach obligataire simultané : Le portefeuille 60/40 traditionnel ne protège plus.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(140)
                        .headline("Menace de pénurie énergétique majeure en Europe et arrêt de Nord Stream.")
                        .severity("PANIC")
                        .source("ENERGY CRISIS DESK")
                        .shockMultiplier(1.7)
                        .hint("Refuge impératif sur les matières premières ou 100% Cash.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(165)
                        .headline("Remplissage des stocks européens à 90% et pic d'inflation atteint.")
                        .severity("INTERVENTION")
                        .source("COMMODITIES DAILY")
                        .shockMultiplier(0.6)
                        .hint("Soulagement macroéconomique et rebond technique de fin de séance.")
                        .build()
        );

        List<ArenaPricePointDto> trajectory = generateCrisisTrajectory(410.0, -0.26, 36.4, 180, 0.05);

        return ArenaBossDto.builder()
                .id("STAGFLATION_2022")
                .name("Choc Stagflation & Ukraine")
                .subtitle("Crise Énergétique, Rupture Géopolitique et Resserrement Monétaire Express")
                .year(2022)
                .difficulty("HARDCORE")
                .themeColor("purple")
                .initialEquity(100000.0)
                .durationSeconds(180)
                .lore("2022. Le retour du spectre de 1970 : inflation à deux chiffres, baril de brut à $130 et fin brutale de l'ère de l'argent gratuit.")
                .mechanicsDescription("Corrélation positive toxique actions/obligations, krach de la Tech, flambée brutale des rendements obligataires.")
                .historicalMaxDrawdown(25.2)
                .vixSpike(36.4)
                .assetName("Tech & Energy Global Basket")
                .initialPrice(410.0)
                .events(events)
                .priceTrajectory(trajectory)
                .build();
    }

    private ArenaBossDto buildBlackMondayBoss() {
        List<ArenaCrisisEventDto> events = List.of(
                ArenaCrisisEventDto.builder()
                        .timeSec(15)
                        .headline("OUVERTURE DU LUNDI NOIR : Ordres de vente massifs non exécutés sur le NYSE.")
                        .severity("CRITICAL")
                        .source("AP WALL STREET")
                        .shockMultiplier(1.6)
                        .hint("Les téléscripteurs ont 2 heures de retard. N'achetez pas à l'aveugle !")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(50)
                        .headline("BOUCLE DE RÉTROACTION ALGOS : La 'Portfolio Insurance' vend des contrats à tout prix.")
                        .severity("COLLAPSE")
                        .source("CHICAGO MERCANTILE EXCHANGE")
                        .shockMultiplier(2.5)
                        .hint("Cascade mécanique d'arbitrage. Chute libre sans acheteurs en face.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(95)
                        .headline("PANIC SELLING TOTAL : Le Dow Jones plonge de plus de 500 points (-22.6%).")
                        .severity("PANIC")
                        .source("FINANCIAL NEWS NETWORK")
                        .shockMultiplier(2.8)
                        .hint("Pire séance journalière de l'histoire moderne.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(140)
                        .headline("Alan Greenspan prépare le 'Greenspan Put' : Promesse de liquidités illimitées.")
                        .severity("INTERVENTION")
                        .source("FEDERAL RESERVE SPECIAL")
                        .shockMultiplier(0.4)
                        .hint("Naissance de la politique de soutien systématique de la Réserve Fédérale.")
                        .build(),
                ArenaCrisisEventDto.builder()
                        .timeSec(165)
                        .headline("Fin de panique : Les acheteurs institutionnels de valeur reviennent à la clôture.")
                        .severity("INTERVENTION")
                        .source("NYSE DISPATCH")
                        .shockMultiplier(0.5)
                        .hint("Rebond technique de clôture.")
                        .build()
        );

        List<ArenaPricePointDto> trajectory = generateCrisisTrajectory(2246.0, -0.226, 150.0, 180, 0.15);

        return ArenaBossDto.builder()
                .id("BLACK_MONDAY_1987")
                .name("Le Krach du Lundi Noir")
                .subtitle("Le Premier Bug Systémique des Algorithmes de Portfolio Insurance")
                .year(1987)
                .difficulty("ÉPIQUE")
                .themeColor("red")
                .initialEquity(100000.0)
                .durationSeconds(180)
                .lore("19 Octobre 1987. -22.6% en quelques heures. La démonstration historique qu'un algorithme sans garde-fous de liquidité peut pulvériser un marché.")
                .mechanicsDescription("Déconnexion cash/futures, slippage monstrueux, carnet d'ordres totalement vidé côté acheteur.")
                .historicalMaxDrawdown(22.6)
                .vixSpike(150.0)
                .assetName("Dow Jones Industrial Average (DJIA)")
                .initialPrice(2246.0)
                .events(events)
                .priceTrajectory(trajectory)
                .build();
    }

    /**
     * Génère une trajectoire de prix calibrée seconde par seconde pour les 180 secondes du run.
     */
    private List<ArenaPricePointDto> generateCrisisTrajectory(double initialPrice, double targetMaxDrop, double maxVix, int totalSeconds, double intradayVol) {
        List<ArenaPricePointDto> trajectory = new ArrayList<>(totalSeconds);
        double currentPrice = initialPrice;
        Random rng = new Random(42); // Seed déterministe pour une courbe reproductible et équitable

        for (int t = 0; t <= totalSeconds; t++) {
            double progress = (double) t / totalSeconds;
            double dropShape;

            // Forme de vague de crise : descente graduelle puis panique (t:0->0.7) puis creux et rebond partiel (t:0.7->1.0)
            if (progress <= 0.70) {
                // Descente progressive vers le creux
                double normalizedT = progress / 0.70;
                dropShape = targetMaxDrop * Math.pow(normalizedT, 1.35);
            } else {
                // Creux puis rebond partiel d'intervention
                double reboundT = (progress - 0.70) / 0.30;
                double bottomDrop = targetMaxDrop;
                double reboundRecovery = Math.abs(targetMaxDrop) * 0.35 * Math.sin(reboundT * (Math.PI / 2.0));
                dropShape = bottomDrop + reboundRecovery;
            }

            // Bruit de marché stochastique (micro-volatilité réaliste)
            double noise = (rng.nextDouble() - 0.48) * intradayVol * (1.0 + Math.abs(dropShape) * 2.0);
            double totalReturn = dropShape + noise;

            currentPrice = initialPrice * (1.0 + totalReturn);

            // VIX corrélé négativement avec le prix
            double vixBase = 18.0;
            double vixStress = Math.abs(dropShape) * (maxVix - vixBase) * 2.2;
            double vix = Math.min(maxVix, Math.max(vixBase, vixBase + vixStress + (rng.nextDouble() - 0.5) * 4.0));

            // Indice de liquidité (s'effondre au creux)
            double liquidity = Math.max(0.05, 1.0 - (Math.abs(dropShape) / Math.abs(targetMaxDrop)) * 0.90);

            trajectory.add(ArenaPricePointDto.builder()
                    .timeSec(t)
                    .price(Math.round(currentPrice * 100.0) / 100.0)
                    .vix(Math.round(vix * 10.0) / 10.0)
                    .marketReturnPct(Math.round(totalReturn * 10000.0) / 100.0)
                    .liquidityIndex(Math.round(liquidity * 100.0) / 100.0)
                    .build());
        }

        return trajectory;
    }

    private List<ArenaLeaderboardEntryDto> generateReferenceLeaderboard(int startRank) {
        return List.of(
                ArenaLeaderboardEntryDto.builder()
                        .rank(startRank)
                        .runId(9001L)
                        .traderName("Yassine Mansour (Quant Desk)")
                        .bossId("LEHMAN_2008")
                        .bossName("Faillite Lehman Brothers (2008)")
                        .finalEquity(118450.0)
                        .netPnl(18450.0)
                        .returnPct(18.45)
                        .maxDrawdownPct(7.8)
                        .survivalSeconds(180)
                        .survived(true)
                        .rankGrade("SSS")
                        .score(4820)
                        .date(LocalDateTime.now().minusDays(2))
                        .build(),
                ArenaLeaderboardEntryDto.builder()
                        .rank(startRank + 1)
                        .runId(9002L)
                        .traderName("Sarra Trabelsi (Risk & Solvency)")
                        .bossId("COVID_2020")
                        .bossName("Flash Crash Covid-19 (2020)")
                        .finalEquity(109200.0)
                        .netPnl(9200.0)
                        .returnPct(9.20)
                        .maxDrawdownPct(11.4)
                        .survivalSeconds(180)
                        .survived(true)
                        .rankGrade("S")
                        .score(4350)
                        .date(LocalDateTime.now().minusDays(3))
                        .build(),
                ArenaLeaderboardEntryDto.builder()
                        .rank(startRank + 2)
                        .runId(9003L)
                        .traderName("Amine Ben Salem (Forex Desk)")
                        .bossId("STAGFLATION_2022")
                        .bossName("Choc Stagflation & Ukraine (2022)")
                        .finalEquity(94500.0)
                        .netPnl(-5500.0)
                        .returnPct(-5.50)
                        .maxDrawdownPct(16.2)
                        .survivalSeconds(180)
                        .survived(true)
                        .rankGrade("A")
                        .score(3720)
                        .date(LocalDateTime.now().minusDays(4))
                        .build()
        );
    }
}
