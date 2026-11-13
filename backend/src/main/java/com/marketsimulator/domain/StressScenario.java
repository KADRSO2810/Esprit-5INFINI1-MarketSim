package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "stress_scenarios")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StressScenario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User ownerUser;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "shocks_json", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String shocksJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public User getCreatedBy() {
        return ownerUser;
    }

    public void setCreatedBy(User user) {
        this.ownerUser = user;
    }

    public static class StressScenarioBuilder {
        public StressScenarioBuilder createdBy(User user) {
            this.ownerUser = user;
            return this;
        }
    }
}
