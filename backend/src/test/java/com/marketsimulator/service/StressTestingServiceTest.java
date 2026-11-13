package com.marketsimulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.*;
import com.marketsimulator.dto.CreateScenarioRequest;
import com.marketsimulator.dto.StressScenarioDto;
import com.marketsimulator.dto.TrainModelRequest;
import com.marketsimulator.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StressTestingServiceTest {

    @Mock private BankRepository bankRepository;
    @Mock private BankObservationRepository bankObservationRepository;
    @Mock private StressModelRepository stressModelRepository;
    @Mock private StressScenarioRepository stressScenarioRepository;
    @Mock private StressRunRepository stressRunRepository;
    @Mock private StressResultRepository stressResultRepository;
    @Mock private XaiExplanationRepository xaiExplanationRepository;
    @Mock private AiServiceClient aiServiceClient;

    private ObjectMapper objectMapper = new ObjectMapper();
    private StressTestingService stressTestingService;

    @BeforeEach
    void setUp() {
        stressTestingService = new StressTestingService(
                bankRepository,
                bankObservationRepository,
                stressModelRepository,
                stressScenarioRepository,
                stressRunRepository,
                stressResultRepository,
                xaiExplanationRepository,
                aiServiceClient,
                objectMapper
        );
        ReflectionTestUtils.setField(stressTestingService, "maxLocalXaiBanks", 10);
    }

    @Test
    @DisplayName("createScenario should save and return scenario DTO")
    void createScenario_shouldSaveAndReturnDto() {
        User user = User.builder().id(1L).email("admin@test.com").build();
        CreateScenarioRequest req = CreateScenarioRequest.builder()
                .name("Stagflation")
                .description("Inflation +4%, Chômage +2%")
                .shocks(Map.of("inflation_rate", 0.04, "unemployment_rate", 0.02))
                .build();

        when(stressScenarioRepository.save(any(StressScenario.class))).thenAnswer(invocation -> {
            StressScenario s = invocation.getArgument(0);
            s.setId(42L);
            return s;
        });

        StressScenarioDto dto = stressTestingService.createScenario(req, user);

        assertThat(dto).isNotNull();
        assertThat(dto.getId()).isEqualTo(42L);
        assertThat(dto.getName()).isEqualTo("Stagflation");
        assertThat(dto.getShocks()).containsEntry("inflation_rate", 0.04);
    }

    @Test
    @DisplayName("executeStressRunAsync should compute baseline, stressed, delta and persist results and XAI")
    void executeStressRunAsync_shouldComputeAndPersistResults() {
        User user = User.builder().id(1L).email("user@test.com").build();

        StressScenario scenario = StressScenario.builder()
                .id(1L)
                .name("Choc Taux")
                .shocksJson("{\"interest_rate\":0.03}")
                .build();

        StressModel model = StressModel.builder()
                .id(2L)
                .name("RandomForest CET1")
                .modelUuid("uuid-1234")
                .targetKey("expected_loss")
                .featureKeysJson("[\"interest_rate\",\"cet1_ratio\"]")
                .metricsJson("{\"mae\":0.1}")
                .build();

        StressRun run = StressRun.builder()
                .id(10L)
                .user(user)
                .scenario(scenario)
                .model(model)
                .status(StressRunStatus.QUEUED)
                .build();

        when(stressRunRepository.findById(10L)).thenReturn(Optional.of(run));

        Bank bank1 = Bank.builder().id(1L).name("Banque Nationale").bankType(BankType.CONVENTIONAL).build();
        BankObservation obs1 = BankObservation.builder()
                .id(101L)
                .bank(bank1)
                .periodDate(LocalDate.of(2025, 1, 1))
                .featuresJson("{\"interest_rate\":0.02,\"cet1_ratio\":14.5}")
                .targetJson("{\"expected_loss\":1.2}")
                .build();

        when(bankObservationRepository.findLatestObservationPerBank()).thenReturn(List.of(obs1));

        // Mock AI predict
        when(aiServiceClient.predict(any(), anyList(), anyList()))
                .thenReturn(Map.of(1L, 1.2)) // baseline
                .thenReturn(Map.of(1L, 2.5)); // stressed

        // Mock AI explain
        when(aiServiceClient.explain(any(), anyList(), eq("GLOBAL"), anyList()))
                .thenReturn(Map.of("global_importance", List.of(Map.of("feature", "interest_rate", "importance", 0.8))));
        when(aiServiceClient.explain(any(), anyList(), eq("LOCAL"), anyList()))
                .thenReturn(Map.of("local_explanations", List.of(Map.of("id", 1L, "contributions", List.of()))));

        stressTestingService.executeStressRunAsync(10L);

        // Verify status DONE
        assertThat(run.getStatus()).isEqualTo(StressRunStatus.DONE);
        verify(stressResultRepository).saveAll(anyList());
        verify(xaiExplanationRepository, times(2)).save(any(XaiExplanation.class));
    }
}
