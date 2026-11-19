package com.marketsimulator.service.challenge;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.CustomChallenge;
import com.marketsimulator.domain.CustomChallengeRun;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.challenge.*;
import com.marketsimulator.dto.duel.DuelPricePointDto;
import com.marketsimulator.exception.ResourceNotFoundException;
import com.marketsimulator.repository.CustomChallengeRepository;
import com.marketsimulator.repository.CustomChallengeRunRepository;
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
public class CustomChallengeService {

    private final CustomChallengeRepository challengeRepository;
    private final CustomChallengeRunRepository runRepository;
    private final ObjectMapper objectMapper;

    // ─────────────────────────────────────────────────────────────────────────────
    // CRÉATION PAR L'ADMINISTRATEUR
    // ─────────────────────────────────────────────────────────────────────────────

    @Transactional
    public CustomChallengeDto createChallenge(User admin, CreateCustomChallengeRequest request) {
        List<ChallengePhaseDto> phases = request.getPhases();
        if (phases == null || phases.isEmpty()) {
            phases = generateDefaultPhases(request.getDurationMinutes());
        }

        // Génération de la trajectoire point par point d'après les phases créées manuellement
        List<DuelPricePointDto> trajectory = generateTrajectoryFromPhases(
                request.getInitialPrice(),
                request.getDurationMinutes(),
                phases
        );

        String phasesJson = serialize(phases);
        String trajectoryJson = serialize(trajectory);

        CustomChallenge challenge = CustomChallenge.builder()
                .creator(admin)
                .assetName(request.getAssetName())
                .assetSymbol(request.getAssetSymbol().toUpperCase())
                .category(request.getCategory())
                .description(request.getDescription())
                .durationMinutes(request.getDurationMinutes())
                .initialPrice(request.getInitialPrice())
                .initialCapital(request.getInitialCapital() != null ? request.getInitialCapital() : new BigDecimal("50000.00"))
                .maxLeverage(request.getMaxLeverage() != null ? request.getMaxLeverage() : 5)
                .status("ACTIVE")
                .timelineEvents(phasesJson)
                .generatedTrajectory(trajectoryJson)
                .build();

        challengeRepository.save(challenge);
        return toDto(challenge, phases, trajectory);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // CONSULTATION
    // ─────────────────────────────────────────────────────────────────────────────

    public List<CustomChallengeDto> getActiveChallenges() {
        List<CustomChallenge> list = challengeRepository.findByStatusOrderByCreatedAtDesc("ACTIVE");
        if (list.isEmpty()) {
            return List.of(buildInitialDefaultChallenge());
        }
        return list.stream().map(this::toDto).toList();
    }

    public CustomChallengeDto getChallengeById(Long id) {
        CustomChallenge c = challengeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Défi personnalisé introuvable : " + id));
        return toDto(c);
    }

    @Transactional
    public void deleteChallenge(Long id, User admin) {
        CustomChallenge c = challengeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Défi introuvable : " + id));
        challengeRepository.delete(c);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SOUMISSION D'UN RUN ET CLASSEMENT
    // ─────────────────────────────────────────────────────────────────────────────

    @Transactional
    public CustomChallengeRun submitRun(User user, SubmitChallengeRunRequest request) {
        CustomChallenge challenge = challengeRepository.findById(request.getChallengeId())
                .orElseThrow(() -> new ResourceNotFoundException("Défi introuvable : " + request.getChallengeId()));

        int score = computeScore(request.getNetPnl(), request.getMaxDrawdownPct(), request.getTradesCount());
        String curveJson = serialize(request.getEquityCurve());

        CustomChallengeRun run = CustomChallengeRun.builder()
                .challenge(challenge)
                .user(user)
                .mode(request.getMode() != null ? request.getMode() : "SOLO")
                .finalEquity(request.getFinalEquity())
                .netPnl(request.getNetPnl())
                .returnPct(request.getReturnPct())
                .maxDrawdownPct(request.getMaxDrawdownPct() != null ? request.getMaxDrawdownPct() : BigDecimal.ZERO)
                .tradesCount(request.getTradesCount() != null ? request.getTradesCount() : 0)
                .score(score)
                .equityCurve(curveJson)
                .build();

        return runRepository.save(run);
    }

    public List<ChallengeLeaderboardDto> getLeaderboard(Long challengeId) {
        List<CustomChallengeRun> runs = runRepository.findTop25ByChallengeIdOrderByScoreDesc(challengeId);
        List<ChallengeLeaderboardDto> list = new ArrayList<>();
        int rank = 1;
        for (CustomChallengeRun r : runs) {
            String name = r.getUser() != null && r.getUser().getEmail() != null
                    ? r.getUser().getEmail().split("@")[0]
                    : "Trader";
            list.add(ChallengeLeaderboardDto.builder()
                    .rank(rank++)
                    .runId(r.getId())
                    .traderName(name)
                    .mode(r.getMode())
                    .finalEquity(r.getFinalEquity())
                    .netPnl(r.getNetPnl())
                    .returnPct(r.getReturnPct())
                    .maxDrawdownPct(r.getMaxDrawdownPct())
                    .tradesCount(r.getTradesCount())
                    .score(r.getScore())
                    .completedAt(r.getCompletedAt())
                    .build());
        }
        return list;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MOTEUR DE GÉNÉRATION DE TRAJECTOIRE MANUELLE
    // ─────────────────────────────────────────────────────────────────────────────

    private List<DuelPricePointDto> generateTrajectoryFromPhases(
            BigDecimal initialPrice,
            int durationMinutes,
            List<ChallengePhaseDto> phases
    ) {
        int totalSteps = 120; // 120 bougies par session
        List<DuelPricePointDto> trajectory = new ArrayList<>();
        double currentPrice = initialPrice.doubleValue();
        Random rng = new Random(1337);

        // Trier les phases par ordre chronologique
        phases.sort(Comparator.comparingInt(ChallengePhaseDto::getStartMinute));

        for (int step = 0; step < totalSteps; step++) {
            // Déterminer la minute correspondante
            double currentMin = (step / (double) totalSteps) * durationMinutes;

            // Trouver la phase active
            ChallengePhaseDto activePhase = phases.stream()
                    .filter(p -> currentMin >= p.getStartMinute() && currentMin <= p.getEndMinute())
                    .findFirst()
                    .orElse(phases.get(phases.size() - 1));

            double targetChange = activePhase.getTargetPriceChangePct() != null ? activePhase.getTargetPriceChangePct() : 0.0;
            double phaseDurationMin = Math.max(1, activePhase.getEndMinute() - activePhase.getStartMinute());
            int phaseSteps = (int) Math.max(1, (phaseDurationMin / durationMinutes) * totalSteps);

            // Drift par pas
            double drift = (targetChange / 100.0) / phaseSteps;

            // Bruit selon la volatilité
            double volMultiplier = switch (activePhase.getVolatilityLevel() != null ? activePhase.getVolatilityLevel() : "MEDIUM") {
                case "LOW" -> 0.005;
                case "HIGH" -> 0.025;
                case "EXTREME" -> 0.045;
                default -> 0.012; // MEDIUM
            };

            double shock = (rng.nextDouble() - 0.49) * volMultiplier;
            currentPrice = Math.max(0.50, currentPrice * (1.0 + drift + shock));

            // Si c'est le début de la phase, injecter le breaking news de l'admin
            String hint = null;
            if (activePhase.getBreakingNewsHeadline() != null && !activePhase.getBreakingNewsHeadline().isBlank()) {
                double minDistance = Math.abs(currentMin - activePhase.getStartMinute());
                if (minDistance < (durationMinutes / (double) totalSteps)) {
                    hint = "🔴 NEWS OFFICIELLE : " + activePhase.getBreakingNewsHeadline();
                }
            }

            BigDecimal pClose = BigDecimal.valueOf(currentPrice).setScale(2, RoundingMode.HALF_UP);
            BigDecimal pOpen = BigDecimal.valueOf(currentPrice * (1.0 - (rng.nextDouble() - 0.5) * 0.008)).setScale(2, RoundingMode.HALF_UP);
            BigDecimal pHigh = BigDecimal.valueOf(Math.max(pOpen.doubleValue(), pClose.doubleValue()) * (1.0 + rng.nextDouble() * 0.009)).setScale(2, RoundingMode.HALF_UP);
            BigDecimal pLow = BigDecimal.valueOf(Math.min(pOpen.doubleValue(), pClose.doubleValue()) * (1.0 - rng.nextDouble() * 0.009)).setScale(2, RoundingMode.HALF_UP);
            long vol = (long) (15000 + rng.nextInt(60000));

            trajectory.add(DuelPricePointDto.builder()
                    .step(step + 1)
                    .open(pOpen)
                    .high(pHigh)
                    .low(pLow)
                    .close(pClose)
                    .volume(vol)
                    .hint(hint)
                    .build());
        }

        return trajectory;
    }

    private List<ChallengePhaseDto> generateDefaultPhases(int durationMinutes) {
        int m1 = durationMinutes / 4;
        int m2 = durationMinutes / 2;
        int m3 = (durationMinutes * 3) / 4;

        return List.of(
                ChallengePhaseDto.builder()
                        .phaseOrder(1)
                        .name("Accumulation & Test du Marché")
                        .startMinute(0)
                        .endMinute(m1)
                        .trendType("BULLISH")
                        .targetPriceChangePct(8.0)
                        .volatilityLevel("LOW")
                        .breakingNewsHeadline("Introduction en bourse de l'Actif X sous forte demande")
                        .breakingNewsSeverity("INFO")
                        .build(),
                ChallengePhaseDto.builder()
                        .phaseOrder(2)
                        .name("Choc Surprise & Flash Dump")
                        .startMinute(m1)
                        .endMinute(m2)
                        .trendType("PARABOLIC_CRASH")
                        .targetPriceChangePct(-28.0)
                        .volatilityLevel("EXTREME")
                        .breakingNewsHeadline("Alerte de liquidité : Vente massive d'un investisseur institutionnel")
                        .breakingNewsSeverity("PANIC")
                        .build(),
                ChallengePhaseDto.builder()
                        .phaseOrder(3)
                        .name("Zone Piège & Whipsaws")
                        .startMinute(m2)
                        .endMinute(m3)
                        .trendType("VOLATILE_RANGE")
                        .targetPriceChangePct(4.0)
                        .volatilityLevel("HIGH")
                        .breakingNewsHeadline("Bataille féroce entre acheteurs et vendeurs sur le support clé")
                        .breakingNewsSeverity("WARNING")
                        .build(),
                ChallengePhaseDto.builder()
                        .phaseOrder(4)
                        .name("Short Squeeze & Rally Final")
                        .startMinute(m3)
                        .endMinute(durationMinutes)
                        .trendType("RECOVERY_SQUEEZE")
                        .targetPriceChangePct(45.0)
                        .volatilityLevel("HIGH")
                        .breakingNewsHeadline("Annonce d'un partenariat technologique mondial : Rachat forcé des vendeurs")
                        .breakingNewsSeverity("EUPHORIA")
                        .build()
        );
    }

    private CustomChallengeDto buildInitialDefaultChallenge() {
        List<ChallengePhaseDto> phases = generateDefaultPhases(15);
        List<DuelPricePointDto> trajectory = generateTrajectoryFromPhases(new BigDecimal("100.00"), 15, phases);

        return CustomChallengeDto.builder()
                .id(1L)
                .creatorId(1L)
                .creatorName("Admin ESPRIT")
                .assetName("Actif X : Quantum Energy")
                .assetSymbol("QNTX")
                .category("Technologie de Rupture & Énergie")
                .description("Scénario officiel créé par l'Admin. 15 minutes d'intense trading sur un actif synthétique mêlant accumulation, flash dump et short squeeze parabolique.")
                .durationMinutes(15)
                .initialPrice(new BigDecimal("100.00"))
                .initialCapital(new BigDecimal("50000.00"))
                .maxLeverage(5)
                .status("ACTIVE")
                .phases(phases)
                .trajectory(trajectory)
                .totalParticipants(12)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private int computeScore(BigDecimal pnl, BigDecimal maxDd, Integer trades) {
        double pnlVal = pnl != null ? pnl.doubleValue() : 0.0;
        double ddVal = maxDd != null ? maxDd.doubleValue() : 0.0;
        int t = trades != null ? trades : 0;
        double score = (pnlVal * 1.5) - (ddVal * 250.0) + (t * 15.0);
        return (int) Math.max(0, Math.round(score + 1000));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MAPPAGE DTO & SÉRIALISATION
    // ─────────────────────────────────────────────────────────────────────────────

    private CustomChallengeDto toDto(CustomChallenge c) {
        List<ChallengePhaseDto> phases = deserializePhases(c.getTimelineEvents());
        List<DuelPricePointDto> trajectory = deserializeTrajectory(c.getGeneratedTrajectory());
        return toDto(c, phases, trajectory);
    }

    private CustomChallengeDto toDto(CustomChallenge c, List<ChallengePhaseDto> phases, List<DuelPricePointDto> trajectory) {
        String creatorName = c.getCreator() != null && c.getCreator().getEmail() != null
                ? c.getCreator().getEmail().split("@")[0]
                : "Admin";

        return CustomChallengeDto.builder()
                .id(c.getId())
                .creatorId(c.getCreator() != null ? c.getCreator().getId() : 1L)
                .creatorName(creatorName)
                .assetName(c.getAssetName())
                .assetSymbol(c.getAssetSymbol())
                .category(c.getCategory())
                .description(c.getDescription())
                .durationMinutes(c.getDurationMinutes())
                .initialPrice(c.getInitialPrice())
                .initialCapital(c.getInitialCapital())
                .maxLeverage(c.getMaxLeverage())
                .status(c.getStatus())
                .phases(phases)
                .trajectory(trajectory)
                .totalParticipants(0)
                .createdAt(c.getCreatedAt())
                .build();
    }

    private String serialize(Object obj) {
        if (obj == null) return "[]";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<ChallengePhaseDto> deserializePhases(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private List<DuelPricePointDto> deserializeTrajectory(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
