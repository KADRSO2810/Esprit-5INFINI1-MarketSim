package com.marketsimulator.controller;

import com.marketsimulator.domain.AssetClass;
import com.marketsimulator.dto.multiasset.*;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.multiasset.BondMarketService;
import com.marketsimulator.service.multiasset.CommodityMarketService;
import com.marketsimulator.service.multiasset.ForexMarketService;
import com.marketsimulator.service.multiasset.MultiAssetMarketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/multi-asset")
@RequiredArgsConstructor
@Tag(name = "Multi-Asset Engine", description = "Forex, Fixed Income, Commodities & Multi-Asset Intelligence")
public class MultiAssetController {

    private final MultiAssetMarketService multiAssetService;
    private final ForexMarketService forexService;
    private final BondMarketService bondService;
    private final CommodityMarketService commodityService;
    private final UserRepository userRepository;

    // ── Instruments Catalog ──────────────────────────────────────────────────

    @Operation(summary = "List instruments across asset classes (EQUITY, CRYPTO, FOREX, BOND, COMMODITY)")
    @GetMapping("/instruments")
    public ResponseEntity<List<MarketInstrumentDto>> getInstruments(
            @RequestParam(required = false) AssetClass assetClass) {
        return ResponseEntity.ok(multiAssetService.getCatalog(assetClass));
    }

    @Operation(summary = "Get full instrument details by symbol")
    @GetMapping("/instruments/{symbol}")
    public ResponseEntity<MarketInstrumentDto> getInstrumentDetails(
            @PathVariable String symbol) {
        return ResponseEntity.ok(multiAssetService.getInstrumentDetails(symbol));
    }

    // ── Forex Market ─────────────────────────────────────────────────────────

    @Operation(summary = "List all major Forex pairs with live ECB rates and spreads")
    @GetMapping("/forex")
    public ResponseEntity<List<ForexQuoteDto>> getAllForexQuotes() {
        return ResponseEntity.ok(forexService.getAllForexQuotes());
    }

    @Operation(summary = "Get live quote for a specific Forex pair (e.g. EUR/USD or EURUSD)")
    @GetMapping("/forex/{pair}")
    public ResponseEntity<ForexQuoteDto> getForexQuote(@PathVariable String pair) {
        String decodedPair = pair.replace("-", "/");
        return ResponseEntity.ok(forexService.getQuote(decodedPair));
    }

    @Operation(summary = "Convert fiat currency using official ECB rates")
    @GetMapping("/forex/convert")
    public ResponseEntity<CurrencyConversionDto> convertCurrency(
            @RequestParam BigDecimal amount,
            @RequestParam String from,
            @RequestParam String to) {
        return ResponseEntity.ok(forexService.convert(amount, from, to));
    }

    // ── Bonds / Fixed Income ─────────────────────────────────────────────────

    @Operation(summary = "List benchmark fixed income instruments with Yields, YTM and Durations")
    @GetMapping("/bonds")
    public ResponseEntity<List<BondInstrumentDto>> getAllBonds() {
        return ResponseEntity.ok(bondService.getAllBondInstruments());
    }

    @Operation(summary = "Get details and analytics for a bond instrument")
    @GetMapping("/bonds/{symbol}")
    public ResponseEntity<BondInstrumentDto> getBondDetails(@PathVariable String symbol) {
        return ResponseEntity.ok(bondService.getBondInstrument(symbol));
    }

    // ── Commodities Market ───────────────────────────────────────────────────

    @Operation(summary = "List benchmark commodities (Gold, Silver, WTI, Brent, Natural Gas, Copper, Agriculture)")
    @GetMapping("/commodities")
    public ResponseEntity<List<CommodityInstrumentDto>> getAllCommodities() {
        return ResponseEntity.ok(commodityService.getAllCommodityInstruments());
    }

    @Operation(summary = "Get details and pricing for a commodity instrument")
    @GetMapping("/commodities/{symbol}")
    public ResponseEntity<CommodityInstrumentDto> getCommodityDetails(@PathVariable String symbol) {
        return ResponseEntity.ok(commodityService.getCommodityInstrument(symbol));
    }

    // ── Portfolio Multi-Asset Allocation ─────────────────────────────────────

    @Operation(summary = "Calculate multi-asset portfolio breakdown and diversification analytics")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/portfolio/allocation")
    public ResponseEntity<AssetAllocationBreakdownDto> getPortfolioAllocation(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") Long sessionId) {
        Long userId = resolveUserId(userDetails);
        return ResponseEntity.ok(multiAssetService.calculateAssetAllocation(userId, sessionId));
    }

    private Long resolveUserId(UserDetails userDetails) {
        if (userDetails == null) return 1L;
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
    }
}
