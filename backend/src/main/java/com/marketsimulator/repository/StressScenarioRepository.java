package com.marketsimulator.repository;

import com.marketsimulator.domain.StressScenario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StressScenarioRepository extends JpaRepository<StressScenario, Long> {
    List<StressScenario> findAllByOrderByCreatedAtDesc();
}
