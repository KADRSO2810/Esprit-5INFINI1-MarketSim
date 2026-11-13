package com.marketsimulator.controller;

import com.marketsimulator.dto.CandleDto;
import com.marketsimulator.service.FinnhubCandleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/candles")
@RequiredArgsConstructor
@Tag(name = "Candles", description = "Données historiques OHLCV réelles issues de Finnhub REST")
@SecurityRequirement(name = "BearerAuth")
public class CandleController {

    private final FinnhubCandleService candleService;

    @Operation(summary = "Récupérer les bougies réelles OHLCV (depuis le cache MariaDB ou Finnhub)")
    @GetMapping
    public ResponseEntity<List<CandleDto>> getCandles(
            @RequestParam String symbol,
            @RequestParam(defaultValue = "1") String resolution,
            @RequestParam Long fromEpochSec,
            @RequestParam Long toEpochSec,
            @RequestParam(defaultValue = "false") boolean refresh) {

        Instant from = Instant.ofEpochSecond(fromEpochSec);
        Instant to = Instant.ofEpochSecond(toEpochSec);

        List<CandleDto> candles = candleService.getCandleDtos(symbol, resolution, from, to, refresh);
        return ResponseEntity.ok(candles);
    }
}
