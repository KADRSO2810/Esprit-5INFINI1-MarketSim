package com.marketsimulator.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchlistRequest {

    @NotEmpty(message = "La liste des symboles ne peut pas être vide")
    private List<String> symbols;
}
