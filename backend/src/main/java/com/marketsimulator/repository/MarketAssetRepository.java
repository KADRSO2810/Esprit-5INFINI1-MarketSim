package com.marketsimulator.repository;

import com.marketsimulator.domain.AssetClass;
import com.marketsimulator.domain.MarketAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MarketAssetRepository extends JpaRepository<MarketAsset, Long> {
    Optional<MarketAsset> findBySymbol(String symbol);
    boolean existsBySymbol(String symbol);
    List<MarketAsset> findByAssetClass(AssetClass assetClass);
    List<MarketAsset> findByNameContainingIgnoreCaseOrSymbolContainingIgnoreCase(String name, String symbol);
}
