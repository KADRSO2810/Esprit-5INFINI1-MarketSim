package com.marketsimulator.repository;

import com.marketsimulator.domain.Bank;
import com.marketsimulator.domain.BankObservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface BankObservationRepository extends JpaRepository<BankObservation, Long> {

    Optional<BankObservation> findByBankAndPeriodDate(Bank bank, LocalDate periodDate);

    List<BankObservation> findByBankOrderByPeriodDateDesc(Bank bank);

    @Query("SELECT bo FROM BankObservation bo JOIN FETCH bo.bank ORDER BY bo.periodDate ASC")
    List<BankObservation> findAllWithBank();

    /**
     * Finds latest observation per bank.
     */
    @Query("SELECT bo FROM BankObservation bo JOIN FETCH bo.bank b " +
           "WHERE bo.periodDate = (SELECT MAX(bo2.periodDate) FROM BankObservation bo2 WHERE bo2.bank = b)")
    List<BankObservation> findLatestObservationPerBank();
}
