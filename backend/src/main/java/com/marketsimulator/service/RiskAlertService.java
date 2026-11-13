package com.marketsimulator.service;

import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.RiskAlert;
import com.marketsimulator.domain.RiskLimit;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.CorrelationMatrixDto;
import com.marketsimulator.dto.PositionRiskContributionDto;
import com.marketsimulator.dto.RiskAlertDto;
import com.marketsimulator.dto.SectorConcentrationDto;
import com.marketsimulator.exception.ResourceNotFoundException;
import com.marketsimulator.repository.RiskAlertRepository;
import com.marketsimulator.repository.RiskLimitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RiskAlertService {

    private final RiskAlertRepository alertRepository;
    private final RiskLimitRepository limitRepository;

    private static final Duration DEDUPLICATION_WINDOW = Duration.ofMinutes(15);

    @Transactional
    public List<RiskAlertDto> evaluateAndSyncAlerts(
            User user,
            Portfolio portfolio,
            BigDecimal equity,
            BigDecimal totalExposurePct,
            BigDecimal var95Pct,
            BigDecimal annualizedVolPct,
            BigDecimal currentDrawdownPct,
            List<PositionRiskContributionDto> positions,
            List<SectorConcentrationDto> sectors,
            CorrelationMatrixDto correlationMatrix) {

        if (equity.compareTo(BigDecimal.ZERO) <= 0 || positions.isEmpty()) {
            return List.of();
        }

        // Fetch limits or use defaults
        RiskLimit limits = limitRepository.findByUserId(user.getId())
                .orElseGet(() -> RiskLimit.builder()
                        .maxRiskPerTradePct(PreTradeRiskService.DEFAULT_MAX_RISK_PER_TRADE_PCT)
                        .maxAssetExposurePct(PreTradeRiskService.DEFAULT_MAX_ASSET_EXPOSURE_PCT)
                        .maxSectorExposurePct(PreTradeRiskService.DEFAULT_MAX_SECTOR_EXPOSURE_PCT)
                        .maxPortfolioExposurePct(PreTradeRiskService.DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT)
                        .build());

        List<RiskAlertCandidate> candidates = new ArrayList<>();

        // 1. Portfolio Exposure Alert
        BigDecimal maxPortfolioExp = limits.getMaxPortfolioExposurePct();
        if (totalExposurePct.compareTo(maxPortfolioExp) > 0) {
            candidates.add(new RiskAlertCandidate(
                    "PORTFOLIO_EXPOSURE_EXCEEDED",
                    "CRITICAL",
                    "Exposition globale dépassée",
                    String.format("L'exposition globale du portefeuille (%.2f%%) dépasse la limite configurée (%.2f%%).",
                            totalExposurePct, maxPortfolioExp),
                    "totalExposurePct",
                    totalExposurePct,
                    maxPortfolioExp,
                    positions.stream().map(PositionRiskContributionDto::getSymbol).collect(Collectors.toList()),
                    "Réduisez ou allégez des positions pour ramener l'exposition sous " + maxPortfolioExp + "%."
            ));
        } else if (totalExposurePct.compareTo(maxPortfolioExp.multiply(new BigDecimal("0.90"))) > 0) {
            candidates.add(new RiskAlertCandidate(
                    "PORTFOLIO_EXPOSURE_APPROACHING",
                    "WARNING",
                    "Exposition globale proche de la limite",
                    String.format("L'exposition du portefeuille (%.2f%%) approche la limite autorisée (%.2f%%).",
                            totalExposurePct, maxPortfolioExp),
                    "totalExposurePct",
                    totalExposurePct,
                    maxPortfolioExp,
                    positions.stream().map(PositionRiskContributionDto::getSymbol).collect(Collectors.toList()),
                    "Surveillez attentivement les ouvertures de nouvelles positions."
            ));
        }

        // 2. Asset Concentration Alert
        BigDecimal maxAssetExp = limits.getMaxAssetExposurePct();
        for (var pos : positions) {
            if (pos.getWeightPct().compareTo(maxAssetExp) > 0) {
                candidates.add(new RiskAlertCandidate(
                        "ASSET_CONCENTRATION_EXCEEDED_" + pos.getSymbol(),
                        "WARNING",
                        "Surconcentration d'actif : " + pos.getSymbol(),
                        String.format("L'actif %s représente %.2f%% de l'equity (limite max : %.2f%%).",
                                pos.getSymbol(), pos.getWeightPct(), maxAssetExp),
                        "assetWeightPct",
                        pos.getWeightPct(),
                        maxAssetExp,
                        List.of(pos.getSymbol()),
                        String.format("Rééquilibrez en réduisant l'exposition sur %s pour respecter la limite de %.2f%%.",
                                pos.getSymbol(), maxAssetExp)
                ));
            }
        }

        // 3. Sector Concentration Alert
        BigDecimal maxSectorExp = limits.getMaxSectorExposurePct();
        for (var sec : sectors) {
            if (sec.getWeightPct().compareTo(maxSectorExp) > 0) {
                candidates.add(new RiskAlertCandidate(
                        "SECTOR_CONCENTRATION_EXCEEDED_" + sec.getSector(),
                        "WARNING",
                        "Surconcentration sectorielle : " + sec.getSector(),
                        String.format("Le secteur %s concentre %.2f%% de l'equity (limite max : %.2f%%).",
                                sec.getSector(), sec.getWeightPct(), maxSectorExp),
                        "sectorWeightPct",
                        sec.getWeightPct(),
                        maxSectorExp,
                        sec.getSymbols(),
                        String.format("Diversifiez vos investissements hors du secteur %s pour limiter le risque systémique sectoriel.",
                                sec.getSector())
                ));
            }
        }

        // 4. Drawdown Alert
        if (currentDrawdownPct != null) {
            BigDecimal absDd = currentDrawdownPct.abs();
            if (absDd.compareTo(new BigDecimal("20.00")) >= 0) {
                candidates.add(new RiskAlertCandidate(
                        "DRAWDOWN_CRITICAL",
                        "CRITICAL",
                        "Drawdown Sévère Détecté",
                        String.format("Le portefeuille subit actuellement un drawdown de -%.2f%% par rapport à son sommet historique.", absDd),
                        "currentDrawdownPct",
                        absDd,
                        new BigDecimal("20.00"),
                        positions.stream().map(PositionRiskContributionDto::getSymbol).collect(Collectors.toList()),
                        "Envisagez de couper les positions en perte ou de resserrer vos Stop-Loss pour préserver le capital restant."
                ));
            } else if (absDd.compareTo(new BigDecimal("10.00")) >= 0) {
                candidates.add(new RiskAlertCandidate(
                        "DRAWDOWN_WARNING",
                        "WARNING",
                        "Drawdown Modéré Détecté",
                        String.format("Le portefeuille est en drawdown de -%.2f%% sous son plus haut historique.", absDd),
                        "currentDrawdownPct",
                        absDd,
                        new BigDecimal("10.00"),
                        positions.stream().map(PositionRiskContributionDto::getSymbol).collect(Collectors.toList()),
                        "Activez des ordres Stop-Loss stricts et évitez d'augmenter le levier."
                ));
            }
        }

        // 5. Value at Risk (VaR 95%) Alert
        if (var95Pct != null && var95Pct.compareTo(new BigDecimal("5.00")) > 0) {
            String sev = var95Pct.compareTo(new BigDecimal("10.00")) > 0 ? "CRITICAL" : "WARNING";
            candidates.add(new RiskAlertCandidate(
                    "VAR95_ELEVATED",
                    sev,
                    "Value at Risk (95%) Élevée",
                    String.format("La VaR 95%% quotidienne estimée s'élève à %.2f%% de l'equity.", var95Pct),
                    "var95Pct",
                    var95Pct,
                    new BigDecimal("5.00"),
                    positions.stream().map(PositionRiskContributionDto::getSymbol).collect(Collectors.toList()),
                    "La perte statistique quotidienne à 95% est atypiquement élevée. Réduisez la taille des positions les plus volatiles."
            ));
        }

        // 6. High Correlation Alert
        if (correlationMatrix != null && correlationMatrix.getHighlyCorrelatedPairs() != null) {
            for (var pair : correlationMatrix.getHighlyCorrelatedPairs()) {
                candidates.add(new RiskAlertCandidate(
                        "HIGH_CORRELATION_" + pair.getSymbolA() + "_" + pair.getSymbolB(),
                        "WARNING",
                        "Positions Fortement Corrélées",
                        String.format("Corrélation de %.2f entre %s et %s (dépasse 0.85).",
                                pair.getCorrelation(), pair.getSymbolA(), pair.getSymbolB()),
                        "correlation",
                        BigDecimal.valueOf(pair.getCorrelation()).setScale(4, RoundingMode.HALF_UP),
                        new BigDecimal("0.8500"),
                        List.of(pair.getSymbolA(), pair.getSymbolB()),
                        "Ces deux positions évoluent de concert, réduisant l'effet de diversification. Envisagez de diversifier vers un autre secteur ou actif décorrélé."
                ));
            }
        }

        // 7. Volatility Alert
        if (annualizedVolPct != null && annualizedVolPct.compareTo(new BigDecimal("35.00")) > 0) {
            candidates.add(new RiskAlertCandidate(
                    "VOLATILITY_ELEVATED",
                    "WARNING",
                    "Volatilité du Portefeuille Élevée",
                    String.format("La volatilité annualisée du portefeuille atteint %.2f%% (seuil recommandé : 35%%).", annualizedVolPct),
                    "annualizedVolPct",
                    annualizedVolPct,
                    new BigDecimal("35.00"),
                    positions.stream().map(PositionRiskContributionDto::getSymbol).collect(Collectors.toList()),
                    "Augmentez la part de liquidité ou investissez dans des actifs à bêta modéré."
            ));
        }

        // Persist deduplicated candidates
        Instant cutoff = Instant.now().minus(DEDUPLICATION_WINDOW);
        for (var c : candidates) {
            var recentOpt = alertRepository.findFirstByUserIdAndAlertTypeAndCreatedAtAfterOrderByCreatedAtDesc(
                    user.getId(), c.alertType, cutoff);

            if (recentOpt.isEmpty()) {
                RiskAlert alert = RiskAlert.builder()
                        .user(user)
                        .portfolio(portfolio)
                        .alertType(c.alertType)
                        .severity(c.severity)
                        .title(c.title)
                        .description(c.description)
                        .metricName(c.metricName)
                        .metricValue(c.metricValue)
                        .thresholdValue(c.thresholdValue)
                        .affectedSymbols(String.join(",", c.affectedSymbols))
                        .suggestion(c.suggestion)
                        .acknowledged(false)
                        .createdAt(Instant.now())
                        .build();
                alertRepository.save(alert);
            }
        }

        return alertRepository.findByUserIdAndAcknowledgedFalseOrderByCreatedAtDesc(user.getId()).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RiskAlertDto> getActiveAlerts(Long userId) {
        return alertRepository.findByUserIdAndAcknowledgedFalseOrderByCreatedAtDesc(userId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RiskAlertDto> getAllAlerts(Long userId, Pageable pageable) {
        return alertRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public RiskAlertDto acknowledgeAlert(Long alertId, Long userId) {
        RiskAlert alert = alertRepository.findByIdAndUserId(alertId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Alerte de risque introuvable avec l'id : " + alertId));
        alert.setAcknowledged(true);
        alert = alertRepository.save(alert);
        return mapToDto(alert);
    }

    public RiskAlertDto mapToDto(RiskAlert entity) {
        List<String> symbols = entity.getAffectedSymbols() != null && !entity.getAffectedSymbols().isBlank()
                ? Arrays.asList(entity.getAffectedSymbols().split(","))
                : List.of();

        return RiskAlertDto.builder()
                .id(entity.getId())
                .alertType(entity.getAlertType())
                .severity(entity.getSeverity())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .metricName(entity.getMetricName())
                .metricValue(entity.getMetricValue())
                .thresholdValue(entity.getThresholdValue())
                .affectedSymbols(symbols)
                .suggestion(entity.getSuggestion())
                .acknowledged(entity.isAcknowledged())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    private static class RiskAlertCandidate {
        final String alertType;
        final String severity;
        final String title;
        final String description;
        final String metricName;
        final BigDecimal metricValue;
        final BigDecimal thresholdValue;
        final List<String> affectedSymbols;
        final String suggestion;

        RiskAlertCandidate(String alertType, String severity, String title, String description,
                            String metricName, BigDecimal metricValue, BigDecimal thresholdValue,
                            List<String> affectedSymbols, String suggestion) {
            this.alertType = alertType;
            this.severity = severity;
            this.title = title;
            this.description = description;
            this.metricName = metricName;
            this.metricValue = metricValue;
            this.thresholdValue = thresholdValue;
            this.affectedSymbols = affectedSymbols != null ? affectedSymbols : List.of();
            this.suggestion = suggestion;
        }
    }
}
