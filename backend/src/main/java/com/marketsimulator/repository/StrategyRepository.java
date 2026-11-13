package com.marketsimulator.repository;

import com.marketsimulator.domain.Strategy;
import com.marketsimulator.domain.StrategyStatus;
import com.marketsimulator.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StrategyRepository extends JpaRepository<Strategy, Long> {

    List<Strategy> findByOwnerUserOrderByCreatedAtDesc(User user);

    List<Strategy> findByStatus(StrategyStatus status);

    Optional<Strategy> findByIdAndOwnerUser(Long id, User user);
}
