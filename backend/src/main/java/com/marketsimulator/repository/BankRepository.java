package com.marketsimulator.repository;

import com.marketsimulator.domain.Bank;
import com.marketsimulator.domain.BankType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BankRepository extends JpaRepository<Bank, Long> {
    Optional<Bank> findByNameIgnoreCase(String name);
    List<Bank> findByBankType(BankType bankType);

    @Query("SELECT b.id, b.name, b.country, b.bankType, COUNT(bo.id) FROM Bank b LEFT JOIN BankObservation bo ON bo.bank = b GROUP BY b.id, b.name, b.country, b.bankType ORDER BY b.name ASC")
    List<Object[]> findAllWithObservationCount();
}
