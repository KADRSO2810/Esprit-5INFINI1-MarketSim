package com.marketsimulator.repository;

import com.marketsimulator.domain.LimitOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LimitOrderRepository extends JpaRepository<LimitOrder, Long> {
    List<LimitOrder> findByUserIdAndStatus(Long userId, String status);
    List<LimitOrder> findByUserIdAndSessionIdAndStatus(Long userId, Long sessionId, String status);
    List<LimitOrder> findBySymbolAndStatus(String symbol, String status);
    List<LimitOrder> findByStatus(String status);
}
