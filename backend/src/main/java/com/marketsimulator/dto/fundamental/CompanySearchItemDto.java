package com.marketsimulator.dto.fundamental;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompanySearchItemDto {
    private String symbol;
    private String name;
    private String type; // "EQUITY" ou "CRYPTO"
    private String exchange;
    private String logoUrl;
    private boolean fundamentalSupported;
}
