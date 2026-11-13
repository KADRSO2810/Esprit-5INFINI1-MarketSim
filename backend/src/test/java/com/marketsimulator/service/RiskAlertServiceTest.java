package com.marketsimulator.service;

import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.RiskAlert;
import com.marketsimulator.domain.RiskLimit;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.CorrelationMatrixDto;
import com.marketsimulator.dto.PositionRiskContributionDto;
import com.marketsimulator.dto.RiskAlertDto;
import com.marketsimulator.dto.SectorConcentrationDto;
import com.marketsimulator.repository.RiskAlertRepository;
import com.marketsimulator.repository.RiskLimitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RiskAlertServiceTest {

    @Mock private RiskAlertRepository alertRepository;
    @Mock private RiskLimitRepository limitRepository;

    private RiskAlertService alertService;

    private User testUser;
    private Portfolio testPortfolio;

    @BeforeEach
    void setUp() {
        alertService = new RiskAlertService(alertRepository, limitRepository);
        testUser = User.builder().id(100L).email("user@test.com").build();
        testPortfolio = Portfolio.builder().id(1L).user(testUser).build();
    }

    @Test
    void evaluateAndSyncAlerts_triggersAlertsOnExcessiveExposureAndConcentration() {
        RiskLimit limits = RiskLimit.builder()
                .maxPortfolioExposurePct(new BigDecimal("100.00"))
                .maxAssetExposurePct(new BigDecimal("20.00"))
                .maxSectorExposurePct(new BigDecimal("40.00"))
                .build();
        when(limitRepository.findByUserId(100L)).thenReturn(Optional.of(limits));

        var posRisk = PositionRiskContributionDto.builder()
                .symbol("NVDA")
                .weightPct(new BigDecimal("35.00")) // Exceeds 20% limit
                .riskContributionPct(new BigDecimal("50.00"))
                .build();

        var sectorRisk = SectorConcentrationDto.builder()
                .sector("Technology")
                .weightPct(new BigDecimal("55.00")) // Exceeds 40% limit
                .symbols(List.of("NVDA"))
                .build();

        when(alertRepository.findFirstByUserIdAndAlertTypeAndCreatedAtAfterOrderByCreatedAtDesc(any(), any(), any()))
                .thenReturn(Optional.empty());

        when(alertRepository.findByUserIdAndAcknowledgedFalseOrderByCreatedAtDesc(100L))
                .thenReturn(List.of(
                        RiskAlert.builder()
                                .id(1L)
                                .alertType("ASSET_CONCENTRATION_EXCEEDED_NVDA")
                                .severity("WARNING")
                                .title("Surconcentration d'actif")
                                .description("NVDA dépasse 20%")
                                .build()
                ));

        List<RiskAlertDto> alerts = alertService.evaluateAndSyncAlerts(
                testUser,
                testPortfolio,
                new BigDecimal("100000.00"),
                new BigDecimal("105.00"), // Exceeds 100% portfolio limit
                new BigDecimal("6.50"),   // Exceeds 5% VaR
                new BigDecimal("40.00"),  // Exceeds 35% vol
                new BigDecimal("-12.50"), // -12.5% drawdown
                List.of(posRisk),
                List.of(sectorRisk),
                null
        );

        assertThat(alerts).isNotEmpty();
        // Verify repository save was called for the detected alerts
        verify(alertRepository, atLeastOnce()).save(any(RiskAlert.class));
    }
}
