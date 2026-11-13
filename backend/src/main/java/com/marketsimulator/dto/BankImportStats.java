package com.marketsimulator.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BankImportStats {
    private int totalRows;
    private int importedRows;
    private int newBanksCount;
    private int updatedBanksCount;
    private int errorCount;
    @Builder.Default
    private List<String> errors = new ArrayList<>();
    @Builder.Default
    private List<String> detectedFeatures = new ArrayList<>();
    @Builder.Default
    private List<String> detectedTargets = new ArrayList<>();

    @JsonProperty("rowsTotal")
    public int getRowsTotal() {
        return totalRows;
    }

    @JsonProperty("rowsInserted")
    public int getRowsInserted() {
        return importedRows;
    }

    @JsonProperty("rowsUpdated")
    public int getRowsUpdated() {
        return updatedBanksCount;
    }

    @JsonProperty("rowsFailed")
    public int getRowsFailed() {
        return errorCount;
    }
}
