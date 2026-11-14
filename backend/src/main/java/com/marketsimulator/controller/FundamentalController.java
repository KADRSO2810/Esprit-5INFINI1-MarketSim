package com.marketsimulator.controller;

import com.marketsimulator.dto.fundamental.*;
import com.marketsimulator.service.FundamentalAnalysisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fundamentals")
@RequiredArgsConstructor
@Tag(name = "Fundamental Analysis", description = "Institutional fundamental analysis, SEC financial statements (10-K, 10-Q), ratios and company comparison")
@SecurityRequirement(name = "bearerAuth")
public class FundamentalController {

    private final FundamentalAnalysisService fundamentalService;

    @Operation(summary = "Get full fundamental overview of a company (profile, latest statements, ratios, historical trends)")
    @GetMapping("/overview")
    public ResponseEntity<CompanyFundamentalOverviewDto> getOverview(
            @RequestParam(defaultValue = "AAPL") String symbol) {
        return ResponseEntity.ok(fundamentalService.getCompanyOverview(symbol));
    }

    @Operation(summary = "Get company profile information")
    @GetMapping("/profile")
    public ResponseEntity<CompanyProfileDto> getProfile(
            @RequestParam(defaultValue = "AAPL") String symbol) {
        return ResponseEntity.ok(fundamentalService.getCompanyProfile(symbol));
    }

    @Operation(summary = "Get official reported financial statements (Income, Balance, Cash Flow) with ANNUAL (10-K) or QUARTERLY (10-Q)")
    @GetMapping("/statements")
    public ResponseEntity<CompanyFinancialStatementsDto> getFinancialStatements(
            @RequestParam(defaultValue = "AAPL") String symbol,
            @RequestParam(defaultValue = "ANNUAL") String frequency) {
        return ResponseEntity.ok(fundamentalService.getCompanyFinancialStatements(symbol, frequency));
    }

    @Operation(summary = "Get fundamental financial ratios (Valuation, Profitability, Health, Growth)")
    @GetMapping("/ratios")
    public ResponseEntity<CompanyRatiosDto> getRatios(
            @RequestParam(defaultValue = "AAPL") String symbol) {
        CompanyFundamentalOverviewDto overview = fundamentalService.getCompanyOverview(symbol);
        return ResponseEntity.ok(overview.getRatios());
    }

    @Operation(summary = "Compare 2 to 5 companies across key valuation, growth, and profitability metrics")
    @PostMapping("/compare")
    public ResponseEntity<CompanyComparisonDto> compareCompanies(
            @RequestBody List<String> symbols) {
        return ResponseEntity.ok(fundamentalService.compareCompanies(symbols));
    }

    @Operation(summary = "Search companies and ticker autocomplete")
    @GetMapping("/search")
    public ResponseEntity<List<CompanySearchItemDto>> search(
            @RequestParam(required = false, defaultValue = "") String query) {
        return ResponseEntity.ok(fundamentalService.searchCompanies(query));
    }
}
