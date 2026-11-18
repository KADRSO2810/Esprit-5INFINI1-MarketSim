package com.marketsimulator.repository;

import com.marketsimulator.domain.DuelMatch;
import com.marketsimulator.domain.DuelStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DuelMatchRepository extends JpaRepository<DuelMatch, Long> {

    Optional<DuelMatch> findByInviteToken(String inviteToken);

    List<DuelMatch> findByChallengerIdOrOpponentIdOrderByCreatedAtDesc(Long challengerId, Long opponentId);

    List<DuelMatch> findByOpponentEmailIgnoreCaseAndStatusOrderByCreatedAtDesc(String opponentEmail, DuelStatus status);

    List<DuelMatch> findTop20ByStatusOrderByCompletedAtDesc(DuelStatus status);

    @Query("SELECT d FROM DuelMatch d WHERE d.challenger.id = :userId OR d.opponent.id = :userId OR LOWER(d.opponentEmail) = LOWER(:email) ORDER BY d.createdAt DESC")
    List<DuelMatch> findUserDuels(@Param("userId") Long userId, @Param("email") String email);
}
