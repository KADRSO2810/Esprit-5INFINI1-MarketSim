package com.marketsimulator.repository;

import com.marketsimulator.domain.PortfolioSnapshot;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PortfolioSnapshotRepository extends JpaRepository<PortfolioSnapshot, Long> {

    List<PortfolioSnapshot> findByPortfolioIdOrderByTsAsc(Long portfolioId, Pageable pageable);
}
