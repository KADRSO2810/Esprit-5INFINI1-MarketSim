package com.marketsimulator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.*;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.security.CustomUserDetailsService;
import com.marketsimulator.security.JwtAuthenticationEntryPoint;
import com.marketsimulator.security.JwtTokenProvider;
import com.marketsimulator.security.SecurityConfig;
import com.marketsimulator.service.StrategyEngineService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StrategyController.class)
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class})
class StrategyControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private StrategyEngineService strategyEngineService;
    @MockBean private UserRepository userRepository;
    @MockBean private JwtTokenProvider jwtTokenProvider;
    @MockBean private CustomUserDetailsService userDetailsService;

    @Test
    @DisplayName("GET /api/strategies without auth should return 401")
    void listStrategies_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/strategies"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/strategies with auth should return 200")
    @WithMockUser(username = "trader@test.com", roles = {"USER"})
    void listStrategies_withAuth_shouldReturn200() throws Exception {
        User user = User.builder().id(1L).email("trader@test.com").build();
        when(userRepository.findByEmail("trader@test.com")).thenReturn(Optional.of(user));

        StrategyDto strat = StrategyDto.builder()
                .id(1L)
                .name("SMA Golden Cross")
                .strategyType(StrategyType.SMA_CROSS)
                .symbols(List.of("AAPL"))
                .status(StrategyStatus.STOPPED)
                .build();

        when(strategyEngineService.listUserStrategies(user)).thenReturn(List.of(strat));

        mockMvc.perform(get("/api/strategies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("SMA Golden Cross"));
    }

    @Test
    @DisplayName("POST /api/strategies with valid request should return 201 Created")
    @WithMockUser(username = "trader@test.com", roles = {"USER"})
    void createStrategy_shouldReturn201() throws Exception {
        User user = User.builder().id(1L).email("trader@test.com").build();
        when(userRepository.findByEmail("trader@test.com")).thenReturn(Optional.of(user));

        CreateStrategyRequest req = CreateStrategyRequest.builder()
                .name("RSI Swing")
                .strategyType(StrategyType.RSI)
                .symbols(List.of("AAPL"))
                .params(Map.of("rsiPeriod", 14, "overbought", 70, "oversold", 30))
                .build();

        StrategyDto res = StrategyDto.builder()
                .id(5L)
                .name("RSI Swing")
                .strategyType(StrategyType.RSI)
                .symbols(List.of("AAPL"))
                .status(StrategyStatus.STOPPED)
                .build();

        when(strategyEngineService.createStrategy(eq(user), any(CreateStrategyRequest.class))).thenReturn(res);

        mockMvc.perform(post("/api/strategies")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.name").value("RSI Swing"));
    }

    @Test
    @DisplayName("POST /api/strategies/{id}/start should start strategy and return 200")
    @WithMockUser(username = "trader@test.com", roles = {"USER"})
    void startStrategy_shouldReturn200() throws Exception {
        User user = User.builder().id(1L).email("trader@test.com").build();
        when(userRepository.findByEmail("trader@test.com")).thenReturn(Optional.of(user));

        StrategyDto res = StrategyDto.builder()
                .id(1L)
                .name("SMA Cross")
                .status(StrategyStatus.RUNNING)
                .build();

        when(strategyEngineService.startStrategy(user, 1L)).thenReturn(res);

        mockMvc.perform(post("/api/strategies/1/start").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RUNNING"));
    }

    @Test
    @DisplayName("GET /api/strategies/{id}/signals should return signal history")
    @WithMockUser(username = "trader@test.com", roles = {"USER"})
    void getSignals_shouldReturnSignals() throws Exception {
        User user = User.builder().id(1L).email("trader@test.com").build();
        when(userRepository.findByEmail("trader@test.com")).thenReturn(Optional.of(user));

        StrategySignalDto sig = StrategySignalDto.builder()
                .id(10L)
                .strategyId(1L)
                .symbol("AAPL")
                .signal(SignalType.BUY)
                .price(BigDecimal.valueOf(180.50))
                .ts(Instant.now())
                .explanation(Map.of("rule", "Golden cross"))
                .build();

        when(strategyEngineService.getSignals(eq(user), eq(1L), anyInt())).thenReturn(List.of(sig));

        mockMvc.perform(get("/api/strategies/1/signals"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].signal").value("BUY"));
    }
}
