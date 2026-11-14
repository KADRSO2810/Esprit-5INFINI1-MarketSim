package com.marketsimulator.dto.fundamental;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompanyProfileDto {
    private String symbol;
    private String name;
    private String country;
    private String currency;
    private String exchange;
    private String ipoDate;
    private BigDecimal marketCapitalization; // en millions USD
    private BigDecimal shareOutstanding;    // en millions d'actions
    private String finnhubIndustry;
    private String sector;
    private String logoUrl;
    private String weburl;
    private String phone;
    private boolean isEquity;
}
