package com.marketsimulator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class XaiExplanationDto {
    private Long id;
    private Long runId;
    private Long bankId;
    private String bankName;
    private String explanationType; // "GLOBAL" or "LOCAL"
    private Map<String, Object> content;
}
