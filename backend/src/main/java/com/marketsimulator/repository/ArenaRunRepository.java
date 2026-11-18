package com.marketsimulator.repository;

import com.marketsimulator.domain.ArenaRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ArenaRunRepository extends JpaRepository<ArenaRun, Long> {

    List<ArenaRun> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<ArenaRun> findTop15ByOrderByScoreDesc();

    List<ArenaRun> findTop10ByBossIdOrderByScoreDesc(String bossId);

    @Query("SELECT COUNT(a) FROM ArenaRun a WHERE a.survived = true")
    long countTotalSurvivals();

    @Query("SELECT COUNT(a) FROM ArenaRun a")
    long countTotalRuns();
}
