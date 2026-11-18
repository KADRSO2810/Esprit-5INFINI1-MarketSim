package com.marketsimulator.service.duel;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.*;
import com.marketsimulator.dto.duel.*;
import com.marketsimulator.exception.ResourceNotFoundException;
import com.marketsimulator.repository.DuelMatchRepository;
import com.marketsimulator.repository.UserRepository;
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
public class DuelService {

    private final DuelMatchRepository duelMatchRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    private static final BigDecimal INITIAL_CAPITAL = new BigDecimal("50000.00");

    // ─────────────────────────────────────────────────────────────────────────────
    // SCÉNARIOS DE MARCHÉ À L'AVEUGLE (Blind Replays)
    // ─────────────────────────────────────────────────────────────────────────────

    public List<DuelScenarioDto> getScenarios() {
        return List.of(
                buildBtc2017Scenario(),
                buildNvda2023Scenario(),
                buildTsla2020Scenario(),
                buildBrexit2016Scenario()
        );
    }

    public DuelScenarioDto getScenarioById(String scenarioId) {
        return getScenarios().stream()
                .filter(s -> s.getId().equalsIgnoreCase(scenarioId))
                .findFirst()
                .orElse(buildBtc2017Scenario());
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CRÉATION DE DUELS
    // ─────────────────────────────────────────────────────────────────────────────

    @Transactional
    public DuelMatchDto createAiDuel(User challenger, CreateAiDuelRequest request) {
        DuelScenarioDto scenario = getScenarioById(request.getScenarioId());
        String token = UUID.randomUUID().toString().replace("-", "");

        // Simuler le run de l'Agent IA Quant sur ce scénario
        AiBotSimulationResult botResult = simulateBotTrading(scenario, request.getBotProfile());

        String opponentCurveJson = serializeCurve(botResult.equityCurve());

        DuelMatch match = DuelMatch.builder()
                .challenger(challenger)
                .opponentType(DuelOpponentType.AI_QUANT)
                .botProfile(request.getBotProfile())
                .scenarioId(scenario.getId())
                .scenarioTitle(scenario.getCodeName())
                .status(DuelStatus.ACTIVE)
                .inviteToken(token)
                .initialCapital(INITIAL_CAPITAL)
                .opponentPnl(botResult.finalPnl())
                .opponentRoi(botResult.roi())
                .opponentScore(botResult.score())
                .opponentTrades(botResult.tradesCount())
                .opponentEquityCurve(opponentCurveJson)
                .build();

        duelMatchRepository.save(match);
        return toDto(match, scenario);
    }

    @Transactional
    public DuelMatchDto createFriendDuel(User challenger, CreateFriendDuelRequest request) {
        DuelScenarioDto scenario = getScenarioById(request.getScenarioId());
        String token = UUID.randomUUID().toString().replace("-", "");

        // Trouver si l'ami existe déjà dans la base
        Optional<User> friendOpt = userRepository.findByEmail(request.getFriendEmail().trim().toLowerCase());

        DuelMatch match = DuelMatch.builder()
                .challenger(challenger)
                .opponentType(DuelOpponentType.HUMAN)
                .opponent(friendOpt.orElse(null))
                .opponentEmail(request.getFriendEmail().trim().toLowerCase())
                .scenarioId(scenario.getId())
                .scenarioTitle(scenario.getCodeName())
                .status(DuelStatus.PENDING)
                .inviteToken(token)
                .initialCapital(INITIAL_CAPITAL)
                .build();

        duelMatchRepository.save(match);
        return toDto(match, scenario);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SOUMISSION D'UN RUN ET CALCUL DU VAINQUEUR
    // ─────────────────────────────────────────────────────────────────────────────

    @Transactional
    public DuelMatchDto submitDuelRun(User user, SubmitDuelRunRequest request) {
        DuelMatch match;
        if (request.getMatchId() != null) {
            match = duelMatchRepository.findById(request.getMatchId())
                    .orElseThrow(() -> new ResourceNotFoundException("Match introuvable : " + request.getMatchId()));
        } else if (request.getInviteToken() != null) {
            match = duelMatchRepository.findByInviteToken(request.getInviteToken())
                    .orElseThrow(() -> new ResourceNotFoundException("Défi introuvable avec ce jeton d'invitation"));
        } else {
            throw new IllegalArgumentException("matchId ou inviteToken requis");
        }

        DuelScenarioDto scenario = getScenarioById(match.getScenarioId());
        int calculatedScore = computeScore(request.getNetPnl(), request.getMaxDrawdownPct(), request.getTradesCount());
        String curveJson = serializeCurve(request.getEquityCurve());

        boolean isChallenger = match.getChallenger().getId().equals(user.getId());
        boolean isOpponent = (match.getOpponent() != null && match.getOpponent().getId().equals(user.getId()))
                || (match.getOpponentEmail() != null && match.getOpponentEmail().equalsIgnoreCase(user.getEmail()));

        if (isChallenger) {
            match.setChallengerPnl(request.getNetPnl());
            match.setChallengerRoi(request.getReturnPct());
            match.setChallengerScore(calculatedScore);
            match.setChallengerTrades(request.getTradesCount() != null ? request.getTradesCount() : 0);
            match.setChallengerEquityCurve(curveJson);

            // Si c'est un duel contre IA, l'IA a déjà son run pré-enregistré : le duel est instantanément COMPLETED
            if (match.getOpponentType() == DuelOpponentType.AI_QUANT) {
                match.setStatus(DuelStatus.COMPLETED);
                match.setCompletedAt(LocalDateTime.now());
                resolveWinner(match);
            }
        } else if (isOpponent || match.getOpponentType() == DuelOpponentType.HUMAN) {
            // L'adversaire humain valide son run
            if (match.getOpponent() == null) {
                match.setOpponent(user);
            }
            match.setOpponentPnl(request.getNetPnl());
            match.setOpponentRoi(request.getReturnPct());
            match.setOpponentScore(calculatedScore);
            match.setOpponentTrades(request.getTradesCount() != null ? request.getTradesCount() : 0);
            match.setOpponentEquityCurve(curveJson);

            // Si le challenger a déjà fini son run (ou si status = ACTIVE), match terminé
            match.setStatus(DuelStatus.COMPLETED);
            match.setCompletedAt(LocalDateTime.now());
            resolveWinner(match);
        }

        duelMatchRepository.save(match);
        return toDto(match, scenario);
    }

    private void resolveWinner(DuelMatch match) {
        int challengerScore = match.getChallengerScore() != null ? match.getChallengerScore() : 0;
        int opponentScore = match.getOpponentScore() != null ? match.getOpponentScore() : 0;

        if (challengerScore > opponentScore) {
            match.setWinnerRole(DuelWinnerRole.CHALLENGER);
            match.setWinnerId(match.getChallenger().getId());
        } else if (opponentScore > challengerScore) {
            match.setWinnerRole(DuelWinnerRole.OPPONENT);
            if (match.getOpponent() != null) {
                match.setWinnerId(match.getOpponent().getId());
            }
        } else {
            match.setWinnerRole(DuelWinnerRole.TIE);
            match.setWinnerId(null);
        }
    }

    private int computeScore(BigDecimal pnl, BigDecimal maxDd, Integer trades) {
        double pnlVal = pnl != null ? pnl.doubleValue() : 0.0;
        double ddVal = maxDd != null ? maxDd.doubleValue() : 0.0;
        int t = trades != null ? trades : 0;

        // Base score = PnL ($) * 1.5, avec pénalité sur Drawdown (%)
        double score = (pnlVal * 1.5) - (ddVal * 250.0) + (t * 15.0);
        return (int) Math.max(0, Math.round(score + 1000));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CONSULTATION
    // ─────────────────────────────────────────────────────────────────────────────

    public DuelMatchDto getDuelById(Long matchId) {
        DuelMatch match = duelMatchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match introuvable : " + matchId));
        return toDto(match, getScenarioById(match.getScenarioId()));
    }

    public DuelMatchDto getDuelByInviteToken(String inviteToken) {
        DuelMatch match = duelMatchRepository.findByInviteToken(inviteToken)
                .orElseThrow(() -> new ResourceNotFoundException("Défi introuvable"));
        return toDto(match, getScenarioById(match.getScenarioId()));
    }

    public List<DuelMatchDto> getUserDuels(User user) {
        List<DuelMatch> matches = duelMatchRepository.findUserDuels(user.getId(), user.getEmail());
        return matches.stream()
                .map(m -> toDto(m, getScenarioById(m.getScenarioId())))
                .toList();
    }

    public List<DuelLeaderboardDto> getLeaderboard() {
        List<DuelMatch> completed = duelMatchRepository.findTop20ByStatusOrderByCompletedAtDesc(DuelStatus.COMPLETED);
        List<DuelLeaderboardDto> list = new ArrayList<>();
        int rank = 1;
        for (DuelMatch m : completed) {
            String winnerName = "Égalité";
            String loserName = "";
            BigDecimal winnerPnl = BigDecimal.ZERO;
            BigDecimal winnerRoi = BigDecimal.ZERO;
            int winnerScore = 0;

            if (m.getWinnerRole() == DuelWinnerRole.CHALLENGER) {
                winnerName = resolveUserName(m.getChallenger());
                loserName = m.getOpponentType() == DuelOpponentType.AI_QUANT ? ("Bot " + m.getBotProfile()) : (m.getOpponent() != null ? resolveUserName(m.getOpponent()) : m.getOpponentEmail());
                winnerPnl = m.getChallengerPnl();
                winnerRoi = m.getChallengerRoi();
                winnerScore = m.getChallengerScore() != null ? m.getChallengerScore() : 0;
            } else if (m.getWinnerRole() == DuelWinnerRole.OPPONENT) {
                winnerName = m.getOpponentType() == DuelOpponentType.AI_QUANT ? ("Bot " + m.getBotProfile()) : (m.getOpponent() != null ? resolveUserName(m.getOpponent()) : m.getOpponentEmail());
                loserName = resolveUserName(m.getChallenger());
                winnerPnl = m.getOpponentPnl();
                winnerRoi = m.getOpponentRoi();
                winnerScore = m.getOpponentScore() != null ? m.getOpponentScore() : 0;
            }

            list.add(DuelLeaderboardDto.builder()
                    .rank(rank++)
                    .matchId(m.getId())
                    .winnerName(winnerName)
                    .loserName(loserName)
                    .scenarioTitle(m.getScenarioTitle())
                    .winnerPnl(winnerPnl)
                    .winnerRoi(winnerRoi)
                    .winnerScore(winnerScore)
                    .completedAt(m.getCompletedAt())
                    .build());
        }
        return list;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SIMULATEUR D'AGENTS IA QUANT
    // ─────────────────────────────────────────────────────────────────────────────

    private record AiBotSimulationResult(
            BigDecimal finalPnl,
            BigDecimal roi,
            int score,
            int tradesCount,
            List<BigDecimal> equityCurve
    ) {}

    private AiBotSimulationResult simulateBotTrading(DuelScenarioDto scenario, DuelBotProfile profile) {
        List<DuelPricePointDto> prices = scenario.getPriceTrajectory();
        if (prices.isEmpty()) {
            return new AiBotSimulationResult(BigDecimal.ZERO, BigDecimal.ZERO, 500, 0, List.of(INITIAL_CAPITAL));
        }

        BigDecimal capital = INITIAL_CAPITAL;
        BigDecimal positionQty = BigDecimal.ZERO;
        BigDecimal cash = INITIAL_CAPITAL;
        List<BigDecimal> equity = new ArrayList<>();
        equity.add(capital);
        int trades = 0;
        BigDecimal peak = capital;
        BigDecimal maxDrawdown = BigDecimal.ZERO;

        for (int i = 1; i < prices.size(); i++) {
            BigDecimal currentPrice = prices.get(i).getClose();
            BigDecimal prevPrice = prices.get(i - 1).getClose();
            BigDecimal pctChange = currentPrice.subtract(prevPrice)
                    .divide(prevPrice, 6, RoundingMode.HALF_UP);

            // Décision selon le profil d'algorithme quant
            boolean buySignal = false;
            boolean sellSignal = false;

            if (profile == DuelBotProfile.HFT_MOMENTUM) {
                // Suit immédiatement l'accélération
                if (pctChange.compareTo(new BigDecimal("0.008")) > 0) buySignal = true;
                if (pctChange.compareTo(new BigDecimal("-0.008")) < 0) sellSignal = true;
            } else if (profile == DuelBotProfile.ALPHA_MEAN_REVERSION) {
                // Fade les excès : achète les chutes brusques, vend les montées paraboliques
                if (pctChange.compareTo(new BigDecimal("-0.012")) < 0) buySignal = true;
                if (pctChange.compareTo(new BigDecimal("0.015")) > 0) sellSignal = true;
            } else { // CTA_TREND_BREAKOUT
                // Breakout sur plusieurs pas
                if (i > 5) {
                    BigDecimal avgPrev = prices.get(i - 3).getClose();
                    if (currentPrice.compareTo(avgPrev) > 0 && positionQty.compareTo(BigDecimal.ZERO) == 0) {
                        buySignal = true;
                    }
                }
            }

            // Exécution
            if (buySignal && positionQty.compareTo(BigDecimal.ZERO) <= 0) {
                // Acheter pour ~30% du capital
                BigDecimal alloc = cash.multiply(new BigDecimal("0.35"));
                BigDecimal qtyToBuy = alloc.divide(currentPrice, 4, RoundingMode.HALF_UP);
                cash = cash.subtract(qtyToBuy.multiply(currentPrice));
                positionQty = positionQty.add(qtyToBuy);
                trades++;
            } else if (sellSignal && positionQty.compareTo(BigDecimal.ZERO) > 0) {
                // Clôturer position longue
                cash = cash.add(positionQty.multiply(currentPrice));
                positionQty = BigDecimal.ZERO;
                trades++;
            }

            BigDecimal currentEquity = cash.add(positionQty.multiply(currentPrice));
            equity.add(currentEquity.setScale(2, RoundingMode.HALF_UP));

            if (currentEquity.compareTo(peak) > 0) {
                peak = currentEquity;
            } else {
                BigDecimal dd = peak.subtract(currentEquity).divide(peak, 4, RoundingMode.HALF_UP);
                if (dd.compareTo(maxDrawdown) > 0) maxDrawdown = dd;
            }
        }

        BigDecimal finalEq = equity.get(equity.size() - 1);
        BigDecimal netPnl = finalEq.subtract(INITIAL_CAPITAL).setScale(2, RoundingMode.HALF_UP);
        BigDecimal roi = netPnl.divide(INITIAL_CAPITAL, 4, RoundingMode.HALF_UP);
        int score = computeScore(netPnl, maxDrawdown, trades);

        return new AiBotSimulationResult(netPnl, roi, score, trades, equity);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // UTILITAIRES DE MAPPAGE
    // ─────────────────────────────────────────────────────────────────────────────

    private DuelMatchDto toDto(DuelMatch match, DuelScenarioDto scenario) {
        List<BigDecimal> challengerCurve = deserializeCurve(match.getChallengerEquityCurve());
        List<BigDecimal> opponentCurve = deserializeCurve(match.getOpponentEquityCurve());

        String winnerName = null;
        if (match.getWinnerRole() == DuelWinnerRole.CHALLENGER) {
            winnerName = resolveUserName(match.getChallenger());
        } else if (match.getWinnerRole() == DuelWinnerRole.OPPONENT) {
            winnerName = match.getOpponentType() == DuelOpponentType.AI_QUANT ? ("Bot " + match.getBotProfile()) : (match.getOpponent() != null ? resolveUserName(match.getOpponent()) : match.getOpponentEmail());
        } else if (match.getWinnerRole() == DuelWinnerRole.TIE) {
            winnerName = "Égalité parfaite";
        }

        DuelMatchDto.DuelMatchDtoBuilder builder = DuelMatchDto.builder()
                .id(match.getId())
                .challengerId(match.getChallenger().getId())
                .challengerName(resolveUserName(match.getChallenger()))
                .opponentType(match.getOpponentType())
                .opponentId(match.getOpponent() != null ? match.getOpponent().getId() : null)
                .opponentName(match.getOpponent() != null ? resolveUserName(match.getOpponent()) : (match.getOpponentType() == DuelOpponentType.AI_QUANT ? "Bot Quant IA" : "Ami invité"))
                .opponentEmail(match.getOpponentEmail())
                .botProfile(match.getBotProfile())
                .scenarioId(match.getScenarioId())
                .scenarioTitle(match.getScenarioTitle())
                .status(match.getStatus())
                .inviteToken(match.getInviteToken())
                .inviteUrl("/app/duels/join?token=" + match.getInviteToken())
                .initialCapital(match.getInitialCapital())
                .challengerPnl(match.getChallengerPnl())
                .challengerRoi(match.getChallengerRoi())
                .challengerScore(match.getChallengerScore())
                .challengerTrades(match.getChallengerTrades())
                .challengerEquityCurve(challengerCurve)
                .opponentPnl(match.getOpponentPnl())
                .opponentRoi(match.getOpponentRoi())
                .opponentScore(match.getOpponentScore())
                .opponentTrades(match.getOpponentTrades())
                .opponentEquityCurve(opponentCurve)
                .winnerId(match.getWinnerId())
                .winnerRole(match.getWinnerRole())
                .winnerName(winnerName)
                .createdAt(match.getCreatedAt())
                .completedAt(match.getCompletedAt());

        // Le dévoilement (Big Reveal) est exposé dès que le match est terminé
        if (match.getStatus() == DuelStatus.COMPLETED && scenario != null) {
            builder.realAssetSymbol(scenario.getRealAssetSymbol())
                    .realAssetName(scenario.getRealAssetName())
                    .realPeriod(scenario.getRealPeriod())
                    .historicalContext(scenario.getHistoricalContext());
        }

        return builder.build();
    }

    private String serializeCurve(List<BigDecimal> curve) {
        if (curve == null || curve.isEmpty()) return "[]";
        try {
            return objectMapper.writeValueAsString(curve);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<BigDecimal> deserializeCurve(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DÉFINITION DES SCÉNARIOS BLIND HISTORIQUES
    // ─────────────────────────────────────────────────────────────────────────────

    private String resolveUserName(User u) {
        if (u == null || u.getEmail() == null) return "Trader";
        return u.getEmail().split("@")[0];
    }

    private DuelScenarioDto buildBtc2017Scenario() {
        List<DuelPricePointDto> points = new ArrayList<>();
        double p = 4300.0;
        Random rng = new Random(42);
        for (int i = 0; i < 120; i++) {
            double drift = (i < 90) ? 0.015 : -0.025; // Bulle puis crash brutal
            double shock = (rng.nextDouble() - 0.48) * 0.04;
            p = Math.max(100.0, p * (1.0 + drift + shock));
            points.add(DuelPricePointDto.builder()
                    .step(i + 1)
                    .open(BigDecimal.valueOf(p * 0.995).setScale(2, RoundingMode.HALF_UP))
                    .high(BigDecimal.valueOf(p * 1.015).setScale(2, RoundingMode.HALF_UP))
                    .low(BigDecimal.valueOf(p * 0.985).setScale(2, RoundingMode.HALF_UP))
                    .close(BigDecimal.valueOf(p).setScale(2, RoundingMode.HALF_UP))
                    .volume((long) (10000 + rng.nextInt(50000)))
                    .hint(i == 88 ? "ATH Majeur détecté - Volume en divergence" : (i == 95 ? "Cascade de liquidations - Support brisé" : null))
                    .build());
        }

        return DuelScenarioDto.builder()
                .id("BTC_2017")
                .codeName("ACTIF MYSTÈRE : DELTA-9")
                .category("Hyper-Croissance & Volatilité Extrême")
                .difficulty("EXTREME")
                .description("Un actif inconnu connaît une explosion parabolique sans précédent, suivie d'un retournement féroce. Sortez au sommet avant la purge.")
                .durationSeconds(120)
                .initialCapital(INITIAL_CAPITAL)
                .priceTrajectory(points)
                .realAssetSymbol("BTC/USD")
                .realAssetName("Bitcoin (Rally Historique 2017)")
                .realPeriod("Septembre - Décembre 2017")
                .historicalContext("La première frénésie mondiale crypto propulsant le Bitcoin de 4 000$ à 19 800$ avant une correction de -40% en quelques jours.")
                .build();
    }

    private DuelScenarioDto buildNvda2023Scenario() {
        List<DuelPricePointDto> points = new ArrayList<>();
        double p = 145.0;
        Random rng = new Random(101);
        for (int i = 0; i < 120; i++) {
            double drift = (i == 40) ? 0.22 : 0.005; // Gap des résultats IA
            double shock = (rng.nextDouble() - 0.49) * 0.02;
            p = Math.max(50.0, p * (1.0 + drift + shock));
            points.add(DuelPricePointDto.builder()
                    .step(i + 1)
                    .open(BigDecimal.valueOf(p * 0.998).setScale(2, RoundingMode.HALF_UP))
                    .high(BigDecimal.valueOf(p * 1.008).setScale(2, RoundingMode.HALF_UP))
                    .low(BigDecimal.valueOf(p * 0.992).setScale(2, RoundingMode.HALF_UP))
                    .close(BigDecimal.valueOf(p).setScale(2, RoundingMode.HALF_UP))
                    .volume((long) (50000 + rng.nextInt(150000)))
                    .hint(i == 40 ? "EARNINGS GAP +22% - Demande institutionnelle massive" : null)
                    .build());
        }

        return DuelScenarioDto.builder()
                .id("NVDA_AI_2023")
                .codeName("ACTIF MYSTÈRE : SILICON-AI")
                .category("Technologie & Super-Cycle IA")
                .difficulty("NORMAL")
                .description("Une action technologique bénéficie d'une rupture technologique historique. Surfez la tendance avec discipline.")
                .durationSeconds(120)
                .initialCapital(INITIAL_CAPITAL)
                .priceTrajectory(points)
                .realAssetSymbol("NVDA")
                .realAssetName("NVIDIA Corporation (Boom de l'IA Générative)")
                .realPeriod("Janvier - Juin 2023")
                .historicalContext("Le trimestre record propulsé par la demande mondiale pour les puces H100 et ChatGPT, transformant Nvidia en géant du trillion de dollars.")
                .build();
    }

    private DuelScenarioDto buildTsla2020Scenario() {
        List<DuelPricePointDto> points = new ArrayList<>();
        double p = 85.0;
        Random rng = new Random(77);
        for (int i = 0; i < 120; i++) {
            double drift = (i > 30 && i < 80) ? 0.018 : (i >= 80 ? -0.006 : 0.003);
            double shock = (rng.nextDouble() - 0.47) * 0.035;
            p = Math.max(20.0, p * (1.0 + drift + shock));
            points.add(DuelPricePointDto.builder()
                    .step(i + 1)
                    .open(BigDecimal.valueOf(p * 0.99).setScale(2, RoundingMode.HALF_UP))
                    .high(BigDecimal.valueOf(p * 1.02).setScale(2, RoundingMode.HALF_UP))
                    .low(BigDecimal.valueOf(p * 0.98).setScale(2, RoundingMode.HALF_UP))
                    .close(BigDecimal.valueOf(p).setScale(2, RoundingMode.HALF_UP))
                    .volume((long) (80000 + rng.nextInt(200000)))
                    .hint(i == 55 ? "Short-Squeeze en cours : Rachat forcé des positions vendeuses" : null)
                    .build());
        }

        return DuelScenarioDto.builder()
                .id("TSLA_2020")
                .codeName("ACTIF MYSTÈRE : QUANTUM-DRIVE")
                .category("Short Squeeze & Momentum")
                .difficulty("HARD")
                .description("Vendeurs à découvert piégés et ruée des traders particuliers. Le levier est à double tranchant.")
                .durationSeconds(120)
                .initialCapital(INITIAL_CAPITAL)
                .priceTrajectory(points)
                .realAssetSymbol("TSLA")
                .realAssetName("Tesla Inc. (Short Squeeze & Split)")
                .realPeriod("Année 2020")
                .historicalContext("La hausse stratosphérique de plus de +700% sur l'année 2020 détruisant les fonds de hedge funds short.")
                .build();
    }

    private DuelScenarioDto buildBrexit2016Scenario() {
        List<DuelPricePointDto> points = new ArrayList<>();
        double p = 1.4850;
        Random rng = new Random(888);
        for (int i = 0; i < 120; i++) {
            double drift = (i >= 45 && i <= 60) ? -0.015 : 0.001; // Crash Brexit
            double shock = (rng.nextDouble() - 0.50) * 0.012;
            p = Math.max(0.8000, p * (1.0 + drift + shock));
            points.add(DuelPricePointDto.builder()
                    .step(i + 1)
                    .open(BigDecimal.valueOf(p * 0.999).setScale(4, RoundingMode.HALF_UP))
                    .high(BigDecimal.valueOf(p * 1.004).setScale(4, RoundingMode.HALF_UP))
                    .low(BigDecimal.valueOf(p * 0.996).setScale(4, RoundingMode.HALF_UP))
                    .close(BigDecimal.valueOf(p).setScale(4, RoundingMode.HALF_UP))
                    .volume((long) (200000 + rng.nextInt(400000)))
                    .hint(i == 46 ? "FLASH EVENT GÉOPOLITIQUE : Résultats du dépouillement en direct" : null)
                    .build());
        }

        return DuelScenarioDto.builder()
                .id("EURUSD_BREXIT_2016")
                .codeName("ACTIF MYSTÈRE : TITAN-FOREX")
                .category("Devises & Choc Géopolitique")
                .difficulty("HARD")
                .description("Une devise majeure s'effondre pendant la nuit suite à un vote géopolitique historique. Jouez la baisse ou protégez vos arrières.")
                .durationSeconds(120)
                .initialCapital(INITIAL_CAPITAL)
                .priceTrajectory(points)
                .realAssetSymbol("GBP/USD")
                .realAssetName("Livre Sterling vs Dollar US (Nuit du Brexit)")
                .realPeriod("23 - 24 Juin 2016")
                .historicalContext("Le vote historique des Britanniques pour quitter l'UE provoquant l'effondrement de 12% de la livre en quelques heures.")
                .build();
    }
}
