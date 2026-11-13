package com.marketsimulator.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SentimentAnalyzeResponse {

    private List<SentimentResultItem> results;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SentimentResultItem {
        private String id;
        private String label; // POSITIVE, NEGATIVE, NEUTRAL
        private Map<String, Double> scores;
        private Map<String, Object> explanation;
    }
}
