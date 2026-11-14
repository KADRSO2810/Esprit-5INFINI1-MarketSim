package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "market_assets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MarketAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 32)
    private String symbol;

    @Column(length = 255)
    private String name;

    @Column(length = 64)
    private String exchange;

    @Column(length = 16)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_class", length = 32, nullable = false)
    @Builder.Default
    private AssetClass assetClass = AssetClass.EQUITY;

    @Column(name = "quote_currency", length = 16)
    @Builder.Default
    private String quoteCurrency = "USD";

    @Column(name = "price_precision")
    @Builder.Default
    private Integer pricePrecision = 2;

    @Column(name = "min_quantity", precision = 18, scale = 6)
    @Builder.Default
    private BigDecimal minQuantity = BigDecimal.valueOf(0.0001);

    @Column(name = "unit", length = 32)
    @Builder.Default
    private String unit = "UNIT";

    @Column(name = "data_source", length = 32)
    @Builder.Default
    private String dataSource = "FINNHUB";

    @Column(name = "metadata_json", columnDefinition = "TEXT")
    private String metadataJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
