package com.marketsimulator.controller;

import com.marketsimulator.dto.CandleDto;
import com.marketsimulator.dto.MarketQuoteDto;
import com.marketsimulator.dto.WatchlistRequest;
import com.marketsimulator.dto.WatchlistResponse;
import com.marketsimulator.service.FinnhubCandleService;
import com.marketsimulator.service.market.MarketDataIngestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
@Tag(name = "Market Data", description = "Endpoints de gestion de la watchlist et cotations de marché")
public class MarketController {

    private final MarketDataIngestionService ingestionService;
    private final FinnhubCandleService candleService;

    @Operation(summary = "Obtenir la watchlist active", description = "Renvoie la liste des symboles actuellement surveillés")
    @GetMapping("/watchlist")
    public ResponseEntity<WatchlistResponse> getWatchlist() {
        List<String> symbols = ingestionService.getWatchlist();
        return ResponseEntity.ok(new WatchlistResponse(symbols));
    }

    @Operation(
            summary = "Mettre à jour la watchlist",
            description = "Remplace la liste des symboles surveillés et synchronise les souscriptions Finnhub en direct",
            security = @SecurityRequirement(name = "BearerAuth")
    )
    @PostMapping("/watchlist")
    public ResponseEntity<WatchlistResponse> updateWatchlist(@Valid @RequestBody WatchlistRequest request) {
        List<String> updated = ingestionService.updateWatchlist(request.getSymbols());
        return ResponseEntity.ok(new WatchlistResponse(updated));
    }

    @Operation(summary = "Obtenir les derniers prix connus", description = "Renvoie la dernière cotation en mémoire ou en base pour chaque symbole actif")
    @GetMapping("/last-quotes")
    public ResponseEntity<List<MarketQuoteDto>> getLastQuotes() {
        return ResponseEntity.ok(ingestionService.getLastQuotes());
    }

    @Operation(summary = "Obtenir l'historique des cotations d'un symbole", description = "Renvoie les cotations stockées en base MariaDB pour un symbole donné")
    @GetMapping("/quotes")
    public ResponseEntity<List<MarketQuoteDto>> getQuotes(
            @RequestParam String symbol,
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(ingestionService.getRecentQuotes(symbol, limit));
    }

    @Operation(summary = "Obtenir les chandeliers (bougies japonaises) pour un symbole", description = "Renvoie les bougies réelles OHLCV selon la résolution demandée (1, 3, 5, 15, 30, 60, D)")
    @GetMapping("/candles")
    public ResponseEntity<List<CandleDto>> getCandles(
            @RequestParam String symbol,
            @RequestParam(defaultValue = "15") String resolution,
            @RequestParam(required = false) Long from,
            @RequestParam(required = false) Long to,
            @RequestParam(defaultValue = "false") boolean refresh) {

        Instant toInstant = to != null ? Instant.ofEpochSecond(to) : Instant.now();
        Instant fromInstant;

        if (from != null) {
            fromInstant = Instant.ofEpochSecond(from);
        } else {
            fromInstant = switch (resolution.toUpperCase()) {
                case "1" -> toInstant.minus(1, ChronoUnit.DAYS);
                case "3", "5" -> toInstant.minus(5, ChronoUnit.DAYS);
                case "15" -> toInstant.minus(14, ChronoUnit.DAYS);
                case "30" -> toInstant.minus(30, ChronoUnit.DAYS);
                case "60" -> toInstant.minus(60, ChronoUnit.DAYS);
                case "D" -> toInstant.minus(180, ChronoUnit.DAYS);
                default -> toInstant.minus(14, ChronoUnit.DAYS);
            };
        }

        List<CandleDto> candles = candleService.getCandleDtos(symbol, resolution, fromInstant, toInstant, refresh);
        return ResponseEntity.ok(candles);
    }
}
