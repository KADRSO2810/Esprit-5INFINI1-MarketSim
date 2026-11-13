package com.marketsimulator.repository;

import com.marketsimulator.domain.StressModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StressModelRepository extends JpaRepository<StressModel, Long> {
    List<StressModel> findAllByOrderByCreatedAtDesc();
}
