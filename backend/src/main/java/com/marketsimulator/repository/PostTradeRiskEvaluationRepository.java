package com.marketsimulator.repository;

import com.marketsimulator.domain.PostTradeRiskEvaluation;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostTradeRiskEvaluationRepository extends JpaRepository<PostTradeRiskEvaluation, Long> {

    Optional<PostTradeRiskEvaluation> findFirstByPortfolioIdOrderByCreatedAtDesc(Long portfolioId);

    List<PostTradeRiskEvaluation> findByPortfolioIdOrderByCreatedAtDesc(Long portfolioId, Pageable pageable);
}
