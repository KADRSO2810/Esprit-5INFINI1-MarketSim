package com.marketsimulator.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.marketsimulator.dto.MarketQuoteDto;
import com.marketsimulator.dto.fundamental.*;
import com.marketsimulator.service.market.FinnhubFundamentalProvider;
import com.marketsimulator.service.market.MarketDataIngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service central d'analyse fondamentale d'entreprise et d'agrégation d'états financiers GAAP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FundamentalAnalysisService {

    private final FinnhubFundamentalProvider fundamentalProvider;
    private final FinancialRatiosService ratiosService;
    private final MarketDataIngestionService marketDataIngestionService;

    // Répertoire des valeurs d'actions majeures et crypto supportées
    private static final List<CompanySearchItemDto> CATALOG = List.of(
            CompanySearchItemDto.builder().symbol("AAPL").name("Apple Inc.").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("MSFT").name("Microsoft Corporation").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/MSFT.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("NVDA").name("NVIDIA Corporation").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NVDA.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("GOOGL").name("Alphabet Inc. (Google)").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/GOOGL.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("AMZN").name("Amazon.com Inc.").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMZN.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("META").name("Meta Platforms Inc.").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/META.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("TSLA").name("Tesla Inc.").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/TSLA.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("NFLX").name("Netflix Inc.").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/NFLX.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("AMD").name("Advanced Micro Devices").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AMD.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("INTC").name("Intel Corporation").type("EQUITY").exchange("NASDAQ").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/INTC.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("JPM").name("JPMorgan Chase & Co.").type("EQUITY").exchange("NYSE").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/JPM.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("DIS").name("The Walt Disney Company").type("EQUITY").exchange("NYSE").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/DIS.png").fundamentalSupported(true).build(),
            CompanySearchItemDto.builder().symbol("BABA").name("Alibaba Group").type("EQUITY").exchange("NYSE").logoUrl("https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/BABA.png").fundamentalSupported(true).build(),
            // Cryptomonnaies (non éligibles aux rapports 10-K)
            CompanySearchItemDto.builder().symbol("BINANCE:BTCUSDT").name("Bitcoin / USDT").type("CRYPTO").exchange("Binance").logoUrl("").fundamentalSupported(false).build(),
            CompanySearchItemDto.builder().symbol("BINANCE:ETHUSDT").name("Ethereum / USDT").type("CRYPTO").exchange("Binance").logoUrl("").fundamentalSupported(false).build(),
            CompanySearchItemDto.builder().symbol("BINANCE:SOLUSDT").name("Solana / USDT").type("CRYPTO").exchange("Binance").logoUrl("").fundamentalSupported(false).build(),
            CompanySearchItemDto.builder().symbol("BINANCE:BNBUSDT").name("BNB / USDT").type("CRYPTO").exchange("Binance").logoUrl("").fundamentalSupported(false).build()
    );

    /**
     * Recherche de sociétés pour l'autocomplétion.
     */
    public List<CompanySearchItemDto> searchCompanies(String query) {
        if (query == null || query.trim().isEmpty()) {
            return CATALOG.stream().filter(CompanySearchItemDto::isFundamentalSupported).limit(8).collect(Collectors.toList());
        }
        String q = query.trim().toUpperCase();
        return CATALOG.stream()
                .filter(item -> item.getSymbol().toUpperCase().contains(q) || item.getName().toUpperCase().contains(q))
                .limit(10)
                .collect(Collectors.toList());
    }

    /**
     * Récupère le profil complet d'une entreprise.
     */
    public CompanyProfileDto getCompanyProfile(String rawSymbol) {
        if (fundamentalProvider.isCrypto(rawSymbol)) {
            return CompanyProfileDto.builder()
                    .symbol(rawSymbol)
                    .name(rawSymbol)
                    .isEquity(false)
                    .finnhubIndustry("Crypto-Asset")
                    .sector("Digital Assets")
                    .build();
        }

        String symbol = rawSymbol.toUpperCase().trim();
        Optional<JsonNode> profileNodeOpt = fundamentalProvider.getCompanyProfile(symbol);

        if (profileNodeOpt.isEmpty()) {
            // Profil minimal par défaut si non disponible chez le provider
            return CompanyProfileDto.builder()
                    .symbol(symbol)
                    .name(symbol)
                    .currency("USD")
                    .isEquity(true)
                    .finnhubIndustry("Actions Cotées")
                    .sector("Marchés Financiers")
                    .build();
        }

        JsonNode p = profileNodeOpt.get();
        return CompanyProfileDto.builder()
                .symbol(p.path("ticker").asText(symbol))
                .name(p.path("name").asText(symbol))
                .country(p.path("country").asText("US"))
                .currency(p.path("currency").asText("USD"))
                .exchange(p.path("exchange").asText("US Exchanges"))
                .ipoDate(p.path("ipo").asText(""))
                .marketCapitalization(getDecimal(p, "marketCapitalization"))
                .shareOutstanding(getDecimal(p, "shareOutstanding"))
                .finnhubIndustry(p.path("finnhubIndustry").asText("Général"))
                .sector(p.path("finnhubIndustry").asText("Technologie"))
                .logoUrl(p.path("logo").asText(""))
                .weburl(p.path("weburl").asText(""))
                .phone(p.path("phone").asText(""))
                .isEquity(true)
                .build();
    }

    /**
     * Vue d'ensemble fondamentale complète pour le Dashboard institutionnel.
     */
    public CompanyFundamentalOverviewDto getCompanyOverview(String rawSymbol) {
        if (rawSymbol == null || rawSymbol.trim().isEmpty()) {
            return CompanyFundamentalOverviewDto.builder()
                    .symbol("N/A")
                    .available(false)
                    .message("Symbole boursier non spécifié.")
                    .build();
        }

        String symbol = rawSymbol.toUpperCase().trim();

        if (fundamentalProvider.isCrypto(symbol)) {
            return CompanyFundamentalOverviewDto.builder()
                    .symbol(symbol)
                    .available(false)
                    .provider("Non applicable")
                    .message("L'actif " + symbol + " est une cryptomonnaie décentralisée et ne dépose pas d'états financiers GAAP (Form 10-K / 10-Q) auprès de la SEC.")
                    .build();
        }

        CompanyProfileDto profile = getCompanyProfile(symbol);
        Optional<JsonNode> metricsOpt = fundamentalProvider.getFinancialMetrics(symbol);
        Optional<JsonNode> annualRepOpt = fundamentalProvider.getFinancialsReported(symbol, false);
        Optional<JsonNode> quarterlyRepOpt = fundamentalProvider.getFinancialsReported(symbol, true);

        // Parsing des états financiers annuels et trimestriels
        List<IncomeStatementDto> annualIncome = parseIncomeStatements(annualRepOpt);
        List<BalanceSheetDto> annualBalance = parseBalanceSheets(annualRepOpt);
        List<CashFlowStatementDto> annualCashFlow = parseCashFlowStatements(annualRepOpt);

        List<IncomeStatementDto> quarterlyIncome = parseIncomeStatements(quarterlyRepOpt);
        List<BalanceSheetDto> quarterlyBalance = parseBalanceSheets(quarterlyRepOpt);
        List<CashFlowStatementDto> quarterlyCashFlow = parseCashFlowStatements(quarterlyRepOpt);

        // Dernières déclarations
        IncomeStatementDto latestIncome = !annualIncome.isEmpty() ? annualIncome.get(0) : (!quarterlyIncome.isEmpty() ? quarterlyIncome.get(0) : null);
        IncomeStatementDto prevIncome = annualIncome.size() > 1 ? annualIncome.get(1) : (quarterlyIncome.size() > 1 ? quarterlyIncome.get(1) : null);

        BalanceSheetDto latestBalance = !annualBalance.isEmpty() ? annualBalance.get(0) : (!quarterlyBalance.isEmpty() ? quarterlyBalance.get(0) : null);
        CashFlowStatementDto latestCashFlow = !annualCashFlow.isEmpty() ? annualCashFlow.get(0) : (!quarterlyCashFlow.isEmpty() ? quarterlyCashFlow.get(0) : null);
        CashFlowStatementDto prevCashFlow = annualCashFlow.size() > 1 ? annualCashFlow.get(1) : (quarterlyCashFlow.size() > 1 ? quarterlyCashFlow.get(1) : null);

        // Cours de marché en direct
        BigDecimal currentPrice = null;
        try {
            MarketQuoteDto quote = marketDataIngestionService.getLatestQuote(symbol);
            if (quote != null && quote.getPrice() != null) {
                currentPrice = quote.getPrice();
            }
        } catch (Exception ignored) {
        }

        // Calcul des ratios fondamentaux
        CompanyRatiosDto ratios = ratiosService.computeRatios(
                symbol,
                profile,
                latestIncome,
                prevIncome,
                latestBalance,
                latestCashFlow,
                prevCashFlow,
                metricsOpt.orElse(null),
                currentPrice
        );

        // Historique des séries temporelles (trié par ordre chronologique ancien -> récent pour les graphiques)
        List<HistoricalFinancialPointDto> historicalAnnual = buildHistoricalTrends(annualIncome, annualCashFlow);
        List<HistoricalFinancialPointDto> historicalQuarterly = buildHistoricalTrends(quarterlyIncome, quarterlyCashFlow);

        // KPI d'en-tête
        String reportingPeriod = latestIncome != null ? latestIncome.getPeriodLabel() : "Dernier Exercice";
        BigDecimal rev = latestIncome != null ? latestIncome.getRevenue() : null;
        BigDecimal netInc = latestIncome != null ? latestIncome.getNetIncome() : null;
        BigDecimal eps = latestIncome != null ? latestIncome.getEpsDiluted() : null;
        BigDecimal fcf = latestCashFlow != null ? latestCashFlow.getFreeCashFlow() : null;

        BigDecimal roe = findRatioValue(ratios.getProfitabilityRatios(), "roe");
        BigDecimal dToE = findRatioValue(ratios.getHealthRatios(), "debtToEquity");
        BigDecimal pe = findRatioValue(ratios.getValuationRatios(), "peRatio");
        BigDecimal divY = findRatioValue(ratios.getValuationRatios(), "dividendYield");
        BigDecimal revGr = findRatioValue(ratios.getGrowthRatios(), "revenueGrowthYoY");
        BigDecimal epsGr = findRatioValue(ratios.getGrowthRatios(), "epsGrowthYoY");

        return CompanyFundamentalOverviewDto.builder()
                .symbol(symbol)
                .available(true)
                .provider("Finnhub SEC Financials Reported + Standard US-GAAP")
                .dataFreshness("Rapports Officiels SEC Form 10-K / 10-Q")
                .profile(profile)
                .currentPrice(currentPrice)
                .latestIncomeStatement(latestIncome)
                .latestBalanceSheet(latestBalance)
                .latestCashFlowStatement(latestCashFlow)
                .ratios(ratios)
                .historicalAnnual(historicalAnnual)
                .historicalQuarterly(historicalQuarterly)
                .reportingPeriod(reportingPeriod)
                .latestRevenue(rev)
                .latestNetIncome(netInc)
                .latestEps(eps)
                .roe(roe)
                .debtToEquity(dToE)
                .peRatio(pe)
                .dividendYield(divY)
                .revenueGrowthYoY(revGr)
                .epsGrowthYoY(epsGr)
                .freeCashFlow(fcf)
                .evaluatedAt(Instant.now())
                .build();
    }

    /**
     * Récupère les états financiers complets (Compte de résultat, Bilan, Cash-Flow).
     */
    public CompanyFinancialStatementsDto getCompanyFinancialStatements(String rawSymbol, String frequency) {
        String symbol = rawSymbol.toUpperCase().trim();
        boolean quarterly = "QUARTERLY".equalsIgnoreCase(frequency);

        if (fundamentalProvider.isCrypto(symbol)) {
            return CompanyFinancialStatementsDto.builder()
                    .symbol(symbol)
                    .frequency(frequency)
                    .available(false)
                    .provider("Non applicable")
                    .message("Aucun état financier pour les actifs crypto.")
                    .build();
        }

        Optional<JsonNode> repOpt = fundamentalProvider.getFinancialsReported(symbol, quarterly);
        if (repOpt.isEmpty()) {
            return CompanyFinancialStatementsDto.builder()
                    .symbol(symbol)
                    .frequency(frequency)
                    .available(false)
                    .provider("Finnhub")
                    .message("États financiers non disponibles pour le symbole " + symbol)
                    .build();
        }

        List<IncomeStatementDto> ic = parseIncomeStatements(repOpt);
        List<BalanceSheetDto> bs = parseBalanceSheets(repOpt);
        List<CashFlowStatementDto> cf = parseCashFlowStatements(repOpt);

        return CompanyFinancialStatementsDto.builder()
                .symbol(symbol)
                .frequency(quarterly ? "QUARTERLY" : "ANNUAL")
                .available(true)
                .provider("Finnhub SEC Financials Reported")
                .dataFreshness(quarterly ? "SEC Form 10-Q Trimestriel" : "SEC Form 10-K Annuel")
                .incomeStatements(ic)
                .balanceSheets(bs)
                .cashFlowStatements(cf)
                .retrievedAt(Instant.now())
                .build();
    }

    /**
     * Comparaison multi-entreprises (2 à 5 sociétés).
     */
    public CompanyComparisonDto compareCompanies(List<String> rawSymbols) {
        if (rawSymbols == null || rawSymbols.isEmpty()) {
            return CompanyComparisonDto.builder()
                    .symbols(List.of())
                    .comparisonRows(List.of())
                    .warnings(List.of("Aucun symbole spécifié pour la comparaison."))
                    .comparedAt(Instant.now())
                    .build();
        }

        List<String> validSymbols = rawSymbols.stream()
                .map(String::toUpperCase)
                .map(String::trim)
                .distinct()
                .limit(5)
                .collect(Collectors.toList());

        List<CompanyProfileDto> profiles = new ArrayList<>();
        Map<String, CompanyFundamentalOverviewDto> overviews = new LinkedHashMap<>();
        List<String> warnings = new ArrayList<>();

        for (String sym : validSymbols) {
            if (fundamentalProvider.isCrypto(sym)) {
                warnings.add(sym + " est un crypto-actif et ne possède pas d'états financiers comparables.");
                continue;
            }
            try {
                CompanyFundamentalOverviewDto overview = getCompanyOverview(sym);
                overviews.put(sym, overview);
                if (overview.getProfile() != null) {
                    profiles.add(overview.getProfile());
                }
            } catch (Exception e) {
                warnings.add("Impossible de récupérer les données fondamentales pour " + sym + " : " + e.getMessage());
            }
        }

        List<CompanyComparisonDto.ComparisonMetricRowDto> rows = new ArrayList<>();

        // 1. Chiffre d'Affaires (CA)
        rows.add(buildComparisonRow("revenue", "Chiffre d'Affaires (CA)", "GENERAL", "$B",
                "Chiffre d'affaires total annuel le plus récent", validSymbols, overviews,
                ov -> ov.getLatestRevenue() != null ? ov.getLatestRevenue().divide(BigDecimal.valueOf(1_000_000_000), 2, RoundingMode.HALF_UP).doubleValue() : null,
                val -> val != null ? "$" + String.format("%.2f", val) + "B" : "N/A", true));

        // 2. Croissance du CA YoY
        rows.add(buildComparisonRow("revenueGrowth", "Croissance du CA (YoY)", "GROWTH", "%",
                "Taux de croissance du chiffre d'affaires sur les 12 derniers mois", validSymbols, overviews,
                ov -> ov.getRevenueGrowthYoY() != null ? ov.getRevenueGrowthYoY().doubleValue() : null,
                val -> val != null ? String.format("%.2f", val) + "%" : "N/A", true));

        // 3. Résultat Net
        rows.add(buildComparisonRow("netIncome", "Résultat Net Annuel", "PROFITABILITY", "$B",
                "Bénéfice net total attribuable aux actionnaires", validSymbols, overviews,
                ov -> ov.getLatestNetIncome() != null ? ov.getLatestNetIncome().divide(BigDecimal.valueOf(1_000_000_000), 2, RoundingMode.HALF_UP).doubleValue() : null,
                val -> val != null ? "$" + String.format("%.2f", val) + "B" : "N/A", true));

        // 4. Bénéfice par Action (BPA / EPS)
        rows.add(buildComparisonRow("eps", "Bénéfice par Action (BPA Dilué)", "PROFITABILITY", "$",
                "Bénéfice net par action", validSymbols, overviews,
                ov -> ov.getLatestEps() != null ? ov.getLatestEps().doubleValue() : null,
                val -> val != null ? "$" + String.format("%.2f", val) : "N/A", true));

        // 5. P/E Ratio
        rows.add(buildComparisonRow("pe", "Price-to-Earnings (P/E)", "VALUATION", "x",
                "Multiple de bénéfice net (cours / bénéfice)", validSymbols, overviews,
                ov -> ov.getPeRatio() != null ? ov.getPeRatio().doubleValue() : null,
                val -> val != null ? String.format("%.2f", val) + "x" : "N/A", false)); // plus bas est attractif

        // 6. Return on Equity (ROE)
        rows.add(buildComparisonRow("roe", "Return on Equity (ROE)", "PROFITABILITY", "%",
                "Rentabilité des capitaux propres investis", validSymbols, overviews,
                ov -> ov.getRoe() != null ? ov.getRoe().doubleValue() : null,
                val -> val != null ? String.format("%.2f", val) + "%" : "N/A", true));

        // 7. Marge Nette
        rows.add(buildComparisonRow("netMargin", "Marge Nette", "PROFITABILITY", "%",
                "Marge bénéficiaire nette en pourcentage des ventes", validSymbols, overviews,
                ov -> {
                    BigDecimal m = findRatioValue(ov.getRatios() != null ? ov.getRatios().getProfitabilityRatios() : null, "netMargin");
                    return m != null ? m.doubleValue() : null;
                },
                val -> val != null ? String.format("%.2f", val) + "%" : "N/A", true));

        // 8. Debt-to-Equity (D/E)
        rows.add(buildComparisonRow("debtToEquity", "Debt-to-Equity (Levier)", "HEALTH", "x",
                "Niveau d'endettement par rapport aux capitaux propres", validSymbols, overviews,
                ov -> ov.getDebtToEquity() != null ? ov.getDebtToEquity().doubleValue() : null,
                val -> val != null ? String.format("%.2f", val) + "x" : "N/A", false)); // plus bas est plus sain

        // 9. Rendement du Dividende
        rows.add(buildComparisonRow("dividendYield", "Rendement du Dividende", "VALUATION", "%",
                "Rendement annuel des dividendes", validSymbols, overviews,
                ov -> ov.getDividendYield() != null ? ov.getDividendYield().doubleValue() : null,
                val -> val != null ? String.format("%.2f", val) + "%" : "0.00%", true));

        // 10. Free Cash Flow
        rows.add(buildComparisonRow("fcf", "Free Cash Flow (FCF)", "GENERAL", "$B",
                "Flux de trésorerie disponible réel après investissements", validSymbols, overviews,
                ov -> ov.getFreeCashFlow() != null ? ov.getFreeCashFlow().divide(BigDecimal.valueOf(1_000_000_000), 2, RoundingMode.HALF_UP).doubleValue() : null,
                val -> val != null ? "$" + String.format("%.2f", val) + "B" : "N/A", true));

        return CompanyComparisonDto.builder()
                .symbols(validSymbols)
                .profiles(profiles)
                .comparisonRows(rows)
                .warnings(warnings)
                .comparedAt(Instant.now())
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MÉTHODES DE PARSING US-GAAP DES ÉTATS FINANCIERS
    // ─────────────────────────────────────────────────────────────────────────

    private List<IncomeStatementDto> parseIncomeStatements(Optional<JsonNode> reportedOpt) {
        List<IncomeStatementDto> result = new ArrayList<>();
        if (reportedOpt.isEmpty() || !reportedOpt.get().has("data")) return result;

        for (JsonNode filing : reportedOpt.get().get("data")) {
            int year = filing.path("year").asInt();
            int quarter = filing.path("quarter").asInt();
            String form = filing.path("form").asText("10-K");
            String filedDate = filing.path("filedDate").asText();
            String startDate = filing.path("startDate").asText();
            String endDate = filing.path("endDate").asText();

            JsonNode icNode = filing.path("report").path("ic");
            if (icNode.isMissingNode() || !icNode.isArray() || icNode.isEmpty()) continue;

            Map<String, BigDecimal> concepts = extractConcepts(icNode);

            BigDecimal revenue = getAnyConcept(concepts,
                    "revenuefromcontractwithcustomerexcludingassessedtax", "salesrevenuenet", "revenues", "revenue");
            BigDecimal cogs = getAnyConcept(concepts,
                    "costofgoodsandservicessold", "costofgoodssold", "costofrevenue");
            BigDecimal grossProfit = getAnyConcept(concepts, "grossprofit");
            if (grossProfit == null && revenue != null && cogs != null) {
                grossProfit = revenue.subtract(cogs);
            }

            BigDecimal rd = getAnyConcept(concepts, "researchanddevelopmentexpense");
            BigDecimal sga = getAnyConcept(concepts, "sellinggeneralandadministrativeexpense");
            BigDecimal opex = getAnyConcept(concepts, "operatingexpenses");

            BigDecimal opInc = getAnyConcept(concepts, "operatingincomeloss", "operatingincome");
            BigDecimal netInc = getAnyConcept(concepts, "netincomeloss", "netincome");

            BigDecimal epsBasic = getAnyConcept(concepts, "earningspersharebasic");
            BigDecimal epsDiluted = getAnyConcept(concepts, "earningspersharediluted");

            BigDecimal sharesBasic = getAnyConcept(concepts, "weightedaveragenumberofsharesoutstandingbasic");
            BigDecimal sharesDiluted = getAnyConcept(concepts, "weightedaveragenumberofdilutedsharesoutstanding");

            BigDecimal tax = getAnyConcept(concepts, "incometaxexpensebenefit");
            BigDecimal pretax = getAnyConcept(concepts,
                    "incomelossfromcontinuingoperationsbeforeincometaxesextraordinaryitemsnoncontrollinginterest",
                    "incomelossfromcontinuingoperationsbeforeincometaxesminorityinterestandincomeearningslossfromequitymethodinvestments");

            // Marges calculées
            BigDecimal grossMargin = null;
            if (grossProfit != null && revenue != null && revenue.compareTo(BigDecimal.ZERO) > 0) {
                grossMargin = grossProfit.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP);
            }
            BigDecimal opMargin = null;
            if (opInc != null && revenue != null && revenue.compareTo(BigDecimal.ZERO) > 0) {
                opMargin = opInc.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP);
            }
            BigDecimal netMargin = null;
            if (netInc != null && revenue != null && revenue.compareTo(BigDecimal.ZERO) > 0) {
                netMargin = netInc.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP);
            }

            String periodLabel = quarter > 0 ? ("Q" + quarter + " " + year) : ("FY " + year);

            result.add(IncomeStatementDto.builder()
                    .periodLabel(periodLabel)
                    .year(year)
                    .quarter(quarter)
                    .form(form)
                    .filedDate(filedDate)
                    .startDate(startDate)
                    .endDate(endDate)
                    .revenue(revenue)
                    .costOfGoodsSold(cogs)
                    .grossProfit(grossProfit)
                    .researchAndDevelopment(rd)
                    .sellingGeneralAdmin(sga)
                    .operatingExpenses(opex)
                    .operatingIncome(opInc)
                    .pretaxIncome(pretax)
                    .incomeTax(tax)
                    .netIncome(netInc)
                    .epsBasic(epsBasic)
                    .epsDiluted(epsDiluted)
                    .sharesBasic(sharesBasic)
                    .sharesDiluted(sharesDiluted)
                    .grossMarginPct(grossMargin)
                    .operatingMarginPct(opMargin)
                    .netMarginPct(netMargin)
                    .build());
        }
        return result;
    }

    private List<BalanceSheetDto> parseBalanceSheets(Optional<JsonNode> reportedOpt) {
        List<BalanceSheetDto> result = new ArrayList<>();
        if (reportedOpt.isEmpty() || !reportedOpt.get().has("data")) return result;

        for (JsonNode filing : reportedOpt.get().get("data")) {
            int year = filing.path("year").asInt();
            int quarter = filing.path("quarter").asInt();
            String form = filing.path("form").asText("10-K");
            String filedDate = filing.path("filedDate").asText();

            JsonNode bsNode = filing.path("report").path("bs");
            if (bsNode.isMissingNode() || !bsNode.isArray() || bsNode.isEmpty()) continue;

            Map<String, BigDecimal> concepts = extractConcepts(bsNode);

            BigDecimal cash = getAnyConcept(concepts, "cashandcashequivalentsatcarryingvalue", "cashandcashequivalents");
            BigDecimal marketableSec = getAnyConcept(concepts, "marketablesecuritiescurrent", "shortterminvestments");
            BigDecimal totalCash = cash;
            if (cash != null && marketableSec != null) {
                totalCash = cash.add(marketableSec);
            } else if (marketableSec != null) {
                totalCash = marketableSec;
            }

            BigDecimal rec = getAnyConcept(concepts, "accountsreceivablenetcurrent");
            BigDecimal inv = getAnyConcept(concepts, "inventorynet", "inventories");
            BigDecimal otherCurAssets = getAnyConcept(concepts, "otherassetscurrent");
            BigDecimal curAssets = getAnyConcept(concepts, "assetscurrent");

            BigDecimal ppe = getAnyConcept(concepts, "propertyplantequipmentnet");
            BigDecimal totalAssets = getAnyConcept(concepts, "assets");

            BigDecimal ap = getAnyConcept(concepts, "accountspayablecurrent", "accountspayable");
            BigDecimal shortDebt = getAnyConcept(concepts, "longtermdebtcurrent", "commercialpaper", "shorttermborrowings");
            BigDecimal curLiab = getAnyConcept(concepts, "liabilitiescurrent");

            BigDecimal longDebt = getAnyConcept(concepts, "longtermdebtnoncurrent");
            BigDecimal totalLiab = getAnyConcept(concepts, "liabilities");

            BigDecimal totalDebt = null;
            if (shortDebt != null && longDebt != null) {
                totalDebt = shortDebt.add(longDebt);
            } else if (longDebt != null) {
                totalDebt = longDebt;
            } else if (shortDebt != null) {
                totalDebt = shortDebt;
            }

            BigDecimal equity = getAnyConcept(concepts, "stockholdersequity");
            BigDecimal totalLiabAndEq = getAnyConcept(concepts, "liabilitiesandstockholdersequity");

            BigDecimal wc = (curAssets != null && curLiab != null) ? curAssets.subtract(curLiab) : null;
            BigDecimal netDebt = (totalDebt != null && totalCash != null) ? totalDebt.subtract(totalCash) : totalDebt;

            String periodLabel = quarter > 0 ? ("Q" + quarter + " " + year) : ("FY " + year);

            result.add(BalanceSheetDto.builder()
                    .periodLabel(periodLabel)
                    .year(year)
                    .quarter(quarter)
                    .form(form)
                    .filedDate(filedDate)
                    .cashAndEquivalents(cash)
                    .shortTermInvestments(marketableSec)
                    .totalCashAndShortTerm(totalCash)
                    .accountsReceivable(rec)
                    .inventory(inv)
                    .otherCurrentAssets(otherCurAssets)
                    .currentAssets(curAssets)
                    .propertyPlantEquipmentNet(ppe)
                    .totalAssets(totalAssets)
                    .accountsPayable(ap)
                    .shortTermDebt(shortDebt)
                    .currentLiabilities(curLiab)
                    .longTermDebt(longDebt)
                    .totalLiabilities(totalLiab)
                    .totalDebt(totalDebt)
                    .totalStockholdersEquity(equity)
                    .totalLiabilitiesAndEquity(totalLiabAndEq)
                    .workingCapital(wc)
                    .netDebt(netDebt)
                    .build());
        }
        return result;
    }

    private List<CashFlowStatementDto> parseCashFlowStatements(Optional<JsonNode> reportedOpt) {
        List<CashFlowStatementDto> result = new ArrayList<>();
        if (reportedOpt.isEmpty() || !reportedOpt.get().has("data")) return result;

        for (JsonNode filing : reportedOpt.get().get("data")) {
            int year = filing.path("year").asInt();
            int quarter = filing.path("quarter").asInt();
            String form = filing.path("form").asText("10-K");
            String filedDate = filing.path("filedDate").asText();

            JsonNode cfNode = filing.path("report").path("cf");
            if (cfNode.isMissingNode() || !cfNode.isArray() || cfNode.isEmpty()) continue;

            Map<String, BigDecimal> concepts = extractConcepts(cfNode);

            BigDecimal netIncome = getAnyConcept(concepts, "netincomeloss");
            BigDecimal da = getAnyConcept(concepts, "depreciationdepletionandamortization");
            BigDecimal sbc = getAnyConcept(concepts, "sharebasedcompensation");
            BigDecimal ocf = getAnyConcept(concepts, "netcashprovidedbyusedinoperatingactivities");

            BigDecimal capex = getAnyConcept(concepts, "paymentstoacquirepropertyplantandequipment", "paymentstoacquireproductiveassets");
            if (capex != null) capex = capex.abs(); // Convention CapEx positive pour le calcul FCF

            BigDecimal icf = getAnyConcept(concepts, "netcashprovidedbyusedininvestingactivities");
            BigDecimal fcfCalculated = (ocf != null && capex != null) ? ocf.subtract(capex) : ocf;

            BigDecimal repurchases = getAnyConcept(concepts, "paymentsforrepurchaseofcommonstock");
            BigDecimal dividends = getAnyConcept(concepts, "paymentsofdividends");
            BigDecimal fcfFinancing = getAnyConcept(concepts, "netcashprovidedbyusedinfinancingactivities");

            String periodLabel = quarter > 0 ? ("Q" + quarter + " " + year) : ("FY " + year);

            result.add(CashFlowStatementDto.builder()
                    .periodLabel(periodLabel)
                    .year(year)
                    .quarter(quarter)
                    .form(form)
                    .filedDate(filedDate)
                    .netIncome(netIncome)
                    .depreciationAmortization(da)
                    .stockBasedCompensation(sbc)
                    .operatingCashFlow(ocf)
                    .capitalExpenditures(capex)
                    .investingCashFlow(icf)
                    .commonStockRepurchase(repurchases)
                    .dividendsPaid(dividends)
                    .financingCashFlow(fcfFinancing)
                    .freeCashFlow(fcfCalculated)
                    .build());
        }
        return result;
    }

    private List<HistoricalFinancialPointDto> buildHistoricalTrends(
            List<IncomeStatementDto> incomeList,
            List<CashFlowStatementDto> cashFlowList) {

        List<HistoricalFinancialPointDto> points = new ArrayList<>();
        Map<String, CashFlowStatementDto> cfMap = cashFlowList.stream()
                .collect(Collectors.toMap(CashFlowStatementDto::getPeriodLabel, c -> c, (a, b) -> a));

        for (IncomeStatementDto ic : incomeList) {
            CashFlowStatementDto cf = cfMap.get(ic.getPeriodLabel());
            points.add(HistoricalFinancialPointDto.builder()
                    .periodLabel(ic.getPeriodLabel())
                    .year(ic.getYear())
                    .quarter(ic.getQuarter())
                    .revenue(ic.getRevenue())
                    .grossProfit(ic.getGrossProfit())
                    .operatingIncome(ic.getOperatingIncome())
                    .netIncome(ic.getNetIncome())
                    .eps(ic.getEpsDiluted())
                    .operatingCashFlow(cf != null ? cf.getOperatingCashFlow() : null)
                    .freeCashFlow(cf != null ? cf.getFreeCashFlow() : null)
                    .capitalExpenditures(cf != null ? cf.getCapitalExpenditures() : null)
                    .grossMarginPct(ic.getGrossMarginPct())
                    .operatingMarginPct(ic.getOperatingMarginPct())
                    .netMarginPct(ic.getNetMarginPct())
                    .build());
        }

        // Tri chronologique : du plus ancien au plus récent pour les graphiques
        points.sort(Comparator.comparingInt(HistoricalFinancialPointDto::getYear)
                .thenComparingInt(HistoricalFinancialPointDto::getQuarter));
        return points;
    }

    private Map<String, BigDecimal> extractConcepts(JsonNode arrayNode) {
        Map<String, BigDecimal> map = new HashMap<>();
        for (JsonNode item : arrayNode) {
            String concept = item.path("concept").asText("").toLowerCase().trim();
            if (concept.startsWith("us-gaap_")) {
                concept = concept.substring("us-gaap_".length());
            } else if (concept.contains("_")) {
                concept = concept.substring(concept.indexOf('_') + 1);
            }
            if (item.has("value") && !item.get("value").isNull()) {
                try {
                    map.put(concept, BigDecimal.valueOf(item.get("value").asDouble()));
                } catch (Exception ignored) {
                }
            }
        }
        return map;
    }

    private BigDecimal getAnyConcept(Map<String, BigDecimal> map, String... conceptKeys) {
        for (String k : conceptKeys) {
            BigDecimal val = map.get(k.toLowerCase());
            if (val != null) return val;
        }
        return null;
    }

    private BigDecimal getDecimal(JsonNode node, String field) {
        if (node != null && node.has(field) && !node.get(field).isNull()) {
            return BigDecimal.valueOf(node.get(field).asDouble());
        }
        return null;
    }

    private BigDecimal findRatioValue(List<FinancialRatioItemDto> list, String key) {
        if (list == null) return null;
        return list.stream()
                .filter(r -> r.getKey().equalsIgnoreCase(key))
                .findFirst()
                .map(FinancialRatioItemDto::getValue)
                .orElse(null);
    }

    private CompanyComparisonDto.ComparisonMetricRowDto buildComparisonRow(
            String key,
            String label,
            String category,
            String unit,
            String description,
            List<String> symbols,
            Map<String, CompanyFundamentalOverviewDto> overviews,
            java.util.function.Function<CompanyFundamentalOverviewDto, Double> extractor,
            java.util.function.Function<Double, String> formatter,
            boolean higherIsBetter) {

        Map<String, String> formattedValues = new HashMap<>();
        Map<String, Double> rawValues = new HashMap<>();

        String bestSym = null;
        Double bestVal = null;

        for (String s : symbols) {
            CompanyFundamentalOverviewDto ov = overviews.get(s);
            if (ov == null) {
                formattedValues.put(s, "N/A");
                continue;
            }
            Double d = extractor.apply(ov);
            if (d != null) {
                rawValues.put(s, d);
                formattedValues.put(s, formatter.apply(d));

                if (bestVal == null) {
                    bestVal = d;
                    bestSym = s;
                } else if (higherIsBetter && d > bestVal) {
                    bestVal = d;
                    bestSym = s;
                } else if (!higherIsBetter && d < bestVal) {
                    bestVal = d;
                    bestSym = s;
                }
            } else {
                formattedValues.put(s, "N/A");
            }
        }

        return CompanyComparisonDto.ComparisonMetricRowDto.builder()
                .key(key)
                .label(label)
                .category(category)
                .unit(unit)
                .description(description)
                .valuesBySymbol(formattedValues)
                .rawValuesBySymbol(rawValues)
                .bestSymbol(bestSym)
                .higherIsBetter(higherIsBetter)
                .build();
    }
}
