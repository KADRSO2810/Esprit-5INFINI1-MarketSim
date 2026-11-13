package com.marketsimulator.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class FinnhubCandleResponse {

    @JsonProperty("c")
    private List<Double> close;

    @JsonProperty("h")
    private List<Double> high;

    @JsonProperty("l")
    private List<Double> low;

    @JsonProperty("o")
    private List<Double> open;

    @JsonProperty("s")
    private String status; // "ok" or "no_data"

    @JsonProperty("t")
    private List<Long> timestamps; // Epoch seconds

    @JsonProperty("v")
    private List<Double> volume;
}
