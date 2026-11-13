package com.marketsimulator.dto;

import com.marketsimulator.domain.BankType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StressResultDto {
    private Long id;
    private Long bankId;
    private String bankName;
    private String country;
    private BankType bankType;
    private BigDecimal baselinePred;
    private BigDecimal stressedPred;
    private BigDecimal deltaPred;
    private Map<String, Object> baseline;
    private Map<String, Object> stressed;
    private Map<String, Object> delta;
    private BigDecimal riskScore;
}
