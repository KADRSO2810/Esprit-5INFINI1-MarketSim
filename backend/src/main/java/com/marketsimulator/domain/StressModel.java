package com.marketsimulator.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "stress_models")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StressModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_user_id", nullable = false)
    private User ownerUser;

    @Column(nullable = false)
    private String name;

    @Column(name = "target_key", nullable = false, length = 64)
    private String targetKey;

    @Column(name = "feature_keys_json", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String featureKeysJson;

    @Column(name = "model_type", nullable = false, length = 64)
    private String modelType;

    @Column(name = "model_artifact_b64", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String modelArtifactB64;

    @Column(name = "metrics_json", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String metricsJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public String getModelUuid() {
        return modelArtifactB64 != null ? modelArtifactB64 : (id != null ? String.valueOf(id) : "");
    }

    public static class StressModelBuilder {
        public StressModelBuilder modelUuid(String uuid) {
            this.modelArtifactB64 = uuid;
            return this;
        }
    }
}
