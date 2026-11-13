package com.marketsimulator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.Role;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.BacktestRequest;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.security.CustomUserDetailsService;
import com.marketsimulator.security.JwtAuthenticationEntryPoint;
import com.marketsimulator.security.JwtTokenProvider;
import com.marketsimulator.security.SecurityConfig;
import com.marketsimulator.service.BacktestService;
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
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BacktestController.class)
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class})
class BacktestControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private BacktestService backtestService;
    @MockBean private UserRepository userRepository;
    @MockBean private JwtTokenProvider jwtTokenProvider;
    @MockBean private CustomUserDetailsService userDetailsService;

    @Test
    @DisplayName("POST /api/backtests without token should return 401 Unauthorized")
    void launchBacktest_withoutAuth_shouldReturn401() throws Exception {
        BacktestRequest request = BacktestRequest.builder()
                .symbol("AAPL")
                .resolution("1")
                .fromEpochSec(Instant.now().minusSeconds(86400).getEpochSecond())
                .toEpochSec(Instant.now().getEpochSecond())
                .strategy("SMA_CROSS")
                .params(Map.of("fast", 20, "slow", 50))
                .initialCash(BigDecimal.valueOf(100000))
                .build();

        mockMvc.perform(post("/api/backtests")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "trader@example.com", roles = {"USER"})
    @DisplayName("POST /api/backtests with fast >= slow should return 400 Bad Request")
    void launchBacktest_fastGreaterOrEqualSlow_shouldReturn400() throws Exception {
        User user = User.builder().id(1L).email("trader@example.com").role(Role.USER).build();
        when(userRepository.findByEmail("trader@example.com")).thenReturn(Optional.of(user));

        when(backtestService.createAndQueueRun(anyLong(), any()))
                .thenThrow(new IllegalArgumentException("Le paramètre fast (50) doit être strictement inférieur à slow (20)."));

        BacktestRequest invalidRequest = BacktestRequest.builder()
                .symbol("AAPL")
                .resolution("1")
                .fromEpochSec(Instant.now().minusSeconds(86400).getEpochSecond())
                .toEpochSec(Instant.now().getEpochSecond())
                .strategy("SMA_CROSS")
                .params(Map.of("fast", 50, "slow", 20)) // Invalid : fast > slow !
                .initialCash(BigDecimal.valueOf(100000))
                .build();

        mockMvc.perform(post("/api/backtests")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());
    }
}
