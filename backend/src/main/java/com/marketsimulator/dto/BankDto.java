package com.marketsimulator.dto;

import com.marketsimulator.domain.BankType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BankDto {
    private Long id;
    private String name;
    private String country;
    private BankType bankType;
    private long observationCount;
    private LocalDateTime createdAt;
}
