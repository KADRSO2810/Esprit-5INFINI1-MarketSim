package com.marketsimulator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.Role;
import com.marketsimulator.domain.StressRunStatus;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.CreateScenarioRequest;
import com.marketsimulator.dto.LaunchStressRunRequest;
import com.marketsimulator.dto.StressRunDto;
import com.marketsimulator.dto.StressScenarioDto;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.security.CustomUserDetailsService;
import com.marketsimulator.security.JwtAuthenticationEntryPoint;
import com.marketsimulator.security.JwtTokenProvider;
import com.marketsimulator.security.SecurityConfig;
import com.marketsimulator.service.StressTestingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StressController.class)
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class})
class StressControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private StressTestingService stressTestingService;
    @MockBean private UserRepository userRepository;
    @MockBean private JwtTokenProvider jwtTokenProvider;
    @MockBean private CustomUserDetailsService userDetailsService;

    @Test
    @DisplayName("GET /api/stress/scenarios without auth should return 401 Unauthorized")
    void listScenarios_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/stress/scenarios"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/stress/runs without auth should return 401 Unauthorized")
    void launchRun_withoutAuth_shouldReturn401() throws Exception {
        LaunchStressRunRequest req = LaunchStressRunRequest.builder()
                .scenarioId(1L)
                .modelId(2L)
                .build();

        mockMvc.perform(post("/api/stress/runs")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/stress/runs without auth should return 401 Unauthorized")
    void listRuns_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/stress/runs"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/stress/scenarios with USER role should create scenario")
    @WithMockUser(username = "user@test.com", roles = {"USER"})
    void createScenario_withUser_shouldReturn201() throws Exception {
        User user = User.builder().id(1L).email("user@test.com").role(Role.USER).build();
        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));

        CreateScenarioRequest request = CreateScenarioRequest.builder()
                .name("Crise Taux")
                .description("Choc de taux de +300 bps")
                .shocks(Map.of("interest_rate", 0.03, "gdp_growth", -0.02))
                .build();

        StressScenarioDto scenarioDto = StressScenarioDto.builder()
                .id(10L)
                .name("Crise Taux")
                .shocks(Map.of("interest_rate", 0.03, "gdp_growth", -0.02))
                .createdAt(LocalDateTime.now())
                .build();

        when(stressTestingService.createScenario(any(CreateScenarioRequest.class), any(User.class)))
                .thenReturn(scenarioDto);

        mockMvc.perform(post("/api/stress/scenarios")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.name").value("Crise Taux"));
    }

    @Test
    @DisplayName("POST /api/stress/runs with USER role should launch run")
    @WithMockUser(username = "user@test.com", roles = {"USER"})
    void launchRun_withUser_shouldReturn202() throws Exception {
        User user = User.builder().id(1L).email("user@test.com").role(Role.USER).build();
        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));

        LaunchStressRunRequest req = LaunchStressRunRequest.builder()
                .scenarioId(1L)
                .modelId(2L)
                .build();

        StressRunDto runDto = StressRunDto.builder()
                .id(100L)
                .scenarioId(1L)
                .modelId(2L)
                .status(StressRunStatus.QUEUED)
                .createdAt(LocalDateTime.now())
                .build();

        when(stressTestingService.launchRun(any(LaunchStressRunRequest.class), any(User.class)))
                .thenReturn(runDto);

        mockMvc.perform(post("/api/stress/runs")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.status").value("QUEUED"));
    }
}
