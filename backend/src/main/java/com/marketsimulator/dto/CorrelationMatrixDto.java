package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CorrelationMatrixDto {
    private List<String> symbols;
    private double[][] matrix;
    private List<CorrelatedPairDto> highlyCorrelatedPairs;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CorrelatedPairDto {
        private String symbolA;
        private String symbolB;
        private double correlation;
        private String warning;
    }
}
