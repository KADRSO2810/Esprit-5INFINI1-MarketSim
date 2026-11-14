package com.marketsimulator.service;

import com.marketsimulator.domain.AssetClass;
import com.marketsimulator.domain.MarketAsset;
import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.Position;
import com.marketsimulator.dto.multiasset.AssetAllocationBreakdownDto;
import com.marketsimulator.dto.multiasset.BondInstrumentDto;
import com.marketsimulator.dto.multiasset.CommodityInstrumentDto;
import com.marketsimulator.dto.multiasset.CurrencyConversionDto;
import com.marketsimulator.dto.multiasset.ForexQuoteDto;
import com.marketsimulator.repository.MarketAssetRepository;
import com.marketsimulator.repository.PortfolioRepository;
import com.marketsimulator.repository.PositionRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import com.marketsimulator.service.multiasset.BondMarketService;
import com.marketsimulator.service.multiasset.CommodityMarketService;
import com.marketsimulator.service.multiasset.ForexMarketService;
import com.marketsimulator.service.multiasset.MultiAssetMarketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MultiAssetMarketServiceTest {

    @Mock
    private MarketAssetRepository assetRepository;

    @Mock
    private PortfolioRepository portfolioRepository;

    @Mock
    private PositionRepository positionRepository;

    @Mock
    private MarketDataIngestionService ingestionService;

    private ForexMarketService forexService;
    private BondMarketService bondService;
    private CommodityMarketService commodityService;
    private MultiAssetMarketService multiAssetService;

    @BeforeEach
    void setUp() {
        forexService = new ForexMarketService();
        bondService = new BondMarketService();
        commodityService = new CommodityMarketService();

        multiAssetService = new MultiAssetMarketService(
                assetRepository,
                forexService,
                bondService,
                commodityService,
                ingestionService,
                portfolioRepository,
                positionRepository
        );
    }

    @Test
    @DisplayName("Devrait classifier correctement chaque classe d'actifs")
    void shouldResolveAssetClassCorrectly() {
        assertThat(AssetClass.fromSymbol("AAPL")).isEqualTo(AssetClass.EQUITY);
        assertThat(AssetClass.fromSymbol("MSFT")).isEqualTo(AssetClass.EQUITY);
        assertThat(AssetClass.fromSymbol("BINANCE:BTCUSDT")).isEqualTo(AssetClass.CRYPTO);
        assertThat(AssetClass.fromSymbol("ETHUSDT")).isEqualTo(AssetClass.CRYPTO);
        assertThat(AssetClass.fromSymbol("EUR/USD")).isEqualTo(AssetClass.FOREX);
        assertThat(AssetClass.fromSymbol("USD/JPY")).isEqualTo(AssetClass.FOREX);
        assertThat(AssetClass.fromSymbol("TLT")).isEqualTo(AssetClass.BOND);
        assertThat(AssetClass.fromSymbol("IEF")).isEqualTo(AssetClass.BOND);
        assertThat(AssetClass.fromSymbol("GLD")).isEqualTo(AssetClass.COMMODITY);
        assertThat(AssetClass.fromSymbol("USO")).isEqualTo(AssetClass.COMMODITY);
    }

    @Test
    @DisplayName("Devrait calculer correctement les cotations Forex (Bid, Ask, Pips, Valeur du Pip)")
    void shouldCalculateForexQuotesAccurately() {
        ForexQuoteDto eurusd = forexService.getQuote("EUR/USD");

        assertThat(eurusd).isNotNull();
        assertThat(eurusd.getSymbol()).isEqualTo("EUR/USD");
        assertThat(eurusd.getBaseCurrency()).isEqualTo("EUR");
        assertThat(eurusd.getQuoteCurrency()).isEqualTo("USD");
        assertThat(eurusd.getPipSize()).isEqualByComparingTo(new BigDecimal("0.0001"));
        assertThat(eurusd.getBid()).isLessThan(eurusd.getMidPrice());
        assertThat(eurusd.getAsk()).isGreaterThan(eurusd.getMidPrice());
        assertThat(eurusd.getSpreadPrice()).isPositive();
        assertThat(eurusd.getPipValueUsd()).isEqualByComparingTo(new BigDecimal("10.0000")); // standard 100k lot

        ForexQuoteDto usdjpy = forexService.getQuote("USD/JPY");
        assertThat(usdjpy.getPipSize()).isEqualByComparingTo(new BigDecimal("0.01"));
        assertThat(usdjpy.getBid()).isLessThan(usdjpy.getMidPrice());
    }

    @Test
    @DisplayName("Devrait convertir les devises en temps réel via les taux BCE")
    void shouldConvertCurrenciesAccurately() {
        CurrencyConversionDto conversion = forexService.convert(new BigDecimal("1000"), "EUR", "USD");
        assertThat(conversion).isNotNull();
        assertThat(conversion.getFromCurrency()).isEqualTo("EUR");
        assertThat(conversion.getToCurrency()).isEqualTo("USD");
        assertThat(conversion.getExchangeRate()).isPositive();
        assertThat(conversion.getConvertedAmount()).isPositive();
    }

    @Test
    @DisplayName("Devrait exécuter les calculs mathématiques obligataires (Rendement, YTM, Duration)")
    void shouldCalculateBondMetricsAccurately() {
        BondInstrumentDto tlt = bondService.getBondInstrument("TLT");

        assertThat(tlt).isNotNull();
        assertThat(tlt.getSymbol()).isEqualTo("TLT");
        assertThat(tlt.getParValue()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(tlt.getCleanPrice()).isPositive();
        assertThat(tlt.getDirtyPrice()).isGreaterThan(tlt.getCleanPrice());
        assertThat(tlt.getAccruedInterest()).isPositive();
        assertThat(tlt.getCurrentYield()).isPositive();
        assertThat(tlt.getYieldToMaturity()).isPositive();
        assertThat(tlt.getModifiedDuration()).isPositive();
        assertThat(tlt.getModifiedDuration()).isLessThan(tlt.getMacaulayDuration());
    }

    @Test
    @DisplayName("Devrait fournir les métadonnées physiques des matières premières")
    void shouldProvideCommodityMetadataAccurately() {
        CommodityInstrumentDto gold = commodityService.getCommodityInstrument("GLD");

        assertThat(gold).isNotNull();
        assertThat(gold.getSymbol()).isEqualTo("GLD");
        assertThat(gold.getCommodityGroup()).isEqualTo("PRECIOUS_METALS");
        assertThat(gold.getUnit()).contains("Once");
        assertThat(gold.getPhysicalBacking()).contains("LBMA");
        assertThat(gold.getCurrentPrice()).isPositive();
        assertThat(gold.getBid()).isLessThan(gold.getAsk());

        CommodityInstrumentDto oil = commodityService.getCommodityInstrument("USO");
        assertThat(oil.getCommodityGroup()).isEqualTo("ENERGY");
        assertThat(oil.getUnit()).contains("Baril");
    }

    @Test
    @DisplayName("Devrait ventiler l'allocation du portefeuille multi-actifs avec précision")
    void shouldCalculateMultiAssetPortfolioAllocation() {
        Portfolio portfolio = Portfolio.builder()
                .id(1L)
                .cashBalance(new BigDecimal("50000.00"))
                .build();

        List<Position> positions = List.of(
                Position.builder().symbol("AAPL").quantity(new BigDecimal("50")).avgPrice(new BigDecimal("220.00")).build(),
                Position.builder().symbol("TLT").quantity(new BigDecimal("100")).avgPrice(new BigDecimal("90.00")).build(),
                Position.builder().symbol("GLD").quantity(new BigDecimal("30")).avgPrice(new BigDecimal("250.00")).build()
        );

        when(portfolioRepository.findByUserId(1L)).thenReturn(Optional.of(portfolio));
        when(positionRepository.findByPortfolioId(1L)).thenReturn(positions);

        AssetAllocationBreakdownDto allocation = multiAssetService.calculateAssetAllocation(1L, 0L);

        assertThat(allocation).isNotNull();
        assertThat(allocation.getTotalPortfolioValue()).isGreaterThan(new BigDecimal("50000.00"));
        assertThat(allocation.getCashBalance()).isEqualByComparingTo(new BigDecimal("50000.00"));
        assertThat(allocation.getSlices()).hasSize(5); // 5 classes d'actifs
        assertThat(allocation.isDiversified()).isTrue();
    }
}
