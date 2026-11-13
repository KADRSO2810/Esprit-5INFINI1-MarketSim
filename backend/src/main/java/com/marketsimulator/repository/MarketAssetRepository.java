package com.marketsimulator.repository;

import com.marketsimulator.domain.MarketAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MarketAssetRepository extends JpaRepository<MarketAsset, Long> {
    Optional<MarketAsset> findBySymbol(String symbol);
    boolean existsBySymbol(String symbol);
}
