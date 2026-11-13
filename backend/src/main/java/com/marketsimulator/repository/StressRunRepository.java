package com.marketsimulator.repository;

import com.marketsimulator.domain.StressRun;
import com.marketsimulator.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StressRunRepository extends JpaRepository<StressRun, Long> {
    List<StressRun> findByOwnerUserOrderByCreatedAtDesc(User user);

    default List<StressRun> findByUserOrderByCreatedAtDesc(User user) {
        return findByOwnerUserOrderByCreatedAtDesc(user);
    }

    default List<StressRun> findAllByUserOrderByCreatedAtDesc(User user) {
        return findByOwnerUserOrderByCreatedAtDesc(user);
    }

    List<StressRun> findAllByOrderByCreatedAtDesc();
}
