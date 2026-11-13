package com.marketsimulator.repository;

import com.marketsimulator.domain.Bank;
import com.marketsimulator.domain.StressRun;
import com.marketsimulator.domain.XaiExplanation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface XaiExplanationRepository extends JpaRepository<XaiExplanation, Long> {
    List<XaiExplanation> findByRun(StressRun run);
    Optional<XaiExplanation> findByRunAndExplanationType(StressRun run, String explanationType);
    Optional<XaiExplanation> findByRunAndBankAndExplanationType(StressRun run, Bank bank, String explanationType);
    void deleteByRun(StressRun run);
}
