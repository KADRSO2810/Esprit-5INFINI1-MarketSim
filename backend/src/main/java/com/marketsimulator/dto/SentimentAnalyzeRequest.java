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
public class SentimentAnalyzeRequest {
    @Builder.Default
    private String model = "FINBERT";
    private List<SentimentItem> items;
    @Builder.Default
    private Boolean withExplanation = true;
    @Builder.Default
    private Integer topK = 8;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SentimentItem {
        private String id;
        private String text;
    }
}
