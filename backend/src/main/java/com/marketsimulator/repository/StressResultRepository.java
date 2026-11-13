package com.marketsimulator.repository;

import com.marketsimulator.domain.StressResult;
import com.marketsimulator.domain.StressRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StressResultRepository extends JpaRepository<StressResult, Long> {
    @Query("SELECT sr FROM StressResult sr JOIN FETCH sr.bank WHERE sr.run = :run ORDER BY sr.riskScore DESC")
    List<StressResult> findByRunOrderByRiskScoreDesc(@Param("run") StressRun run);

    void deleteByRun(StressRun run);
}
