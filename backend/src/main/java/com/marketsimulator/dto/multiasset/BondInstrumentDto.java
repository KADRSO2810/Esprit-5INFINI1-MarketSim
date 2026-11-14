package com.marketsimulator.dto.multiasset;

import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BondInstrumentDto {
    private String symbol;
    private String displayName;
    private String issuerType; // US_TREASURY, CORPORATE_IG, HIGH_YIELD, TIPS
    private String issuerName;

    private BigDecimal parValue; // standard 100.00 par convention
    private BigDecimal cleanPrice;
    private BigDecimal dirtyPrice;
    private BigDecimal accruedInterest;

    private BigDecimal couponRate; // annual coupon %
    private String paymentFrequency; // SEMI_ANNUAL, MONTHLY
    private BigDecimal maturityYears;

    private BigDecimal currentYield; // (Coupon / Clean Price) * 100
    private BigDecimal yieldToMaturity; // YTM %
    private BigDecimal macaulayDuration; // in years
    private BigDecimal modifiedDuration; // price sensitivity % per 100bps yield shift

    private BigDecimal change24hPct;
    private BigDecimal high24h;
    private BigDecimal low24h;

    private String tradingSession;
    private String marketDataSource;
    private Instant timestamp;
}
