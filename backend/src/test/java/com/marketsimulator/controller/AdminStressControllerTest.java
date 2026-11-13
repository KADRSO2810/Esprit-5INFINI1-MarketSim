package com.marketsimulator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.Role;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.BankImportStats;
import com.marketsimulator.dto.StressModelDto;
import com.marketsimulator.dto.TrainModelRequest;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.security.CustomUserDetailsService;
import com.marketsimulator.security.JwtAuthenticationEntryPoint;
import com.marketsimulator.security.JwtTokenProvider;
import com.marketsimulator.security.SecurityConfig;
import com.marketsimulator.service.BankDataImportService;
import com.marketsimulator.service.StressTestingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminStressController.class)
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class})
class AdminStressControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private BankDataImportService bankDataImportService;
    @MockBean private StressTestingService stressTestingService;
    @MockBean private UserRepository userRepository;
    @MockBean private JwtTokenProvider jwtTokenProvider;
    @MockBean private CustomUserDetailsService userDetailsService;

    @Test
    @DisplayName("POST /api/admin/stress/import without auth should return 401 Unauthorized")
    void importCsv_withoutAuth_shouldReturn401() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.csv", "text/csv", "bank_name,bank_type,period_date\nBank A,CONVENTIONAL,2025-01-01".getBytes());

        mockMvc.perform(multipart("/api/admin/stress/import").file(file).with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/admin/stress/import with USER role should return 403 Forbidden")
    @WithMockUser(username = "user@test.com", roles = {"USER"})
    void importCsv_withUserRole_shouldReturn403() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.csv", "text/csv", "bank_name,bank_type,period_date\nBank A,CONVENTIONAL,2025-01-01".getBytes());

        mockMvc.perform(multipart("/api/admin/stress/import").file(file).with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/admin/stress/import with ADMIN role should return 200 OK")
    @WithMockUser(username = "admin@test.com", roles = {"ADMIN"})
    void importCsv_withAdminRole_shouldReturn200() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.csv", "text/csv", "bank_name,bank_type,period_date\nBank A,CONVENTIONAL,2025-01-01".getBytes());

        when(bankDataImportService.importCsv(any())).thenReturn(BankImportStats.builder()
                .totalRows(1)
                .importedRows(1)
                .build());

        mockMvc.perform(multipart("/api/admin/stress/import").file(file).with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/admin/stress/models/train without auth should return 401 Unauthorized")
    void trainModel_withoutAuth_shouldReturn401() throws Exception {
        TrainModelRequest req = TrainModelRequest.builder()
                .name("RF Target")
                .targetKey("target")
                .featureKeys(List.of("cet1", "npl_ratio"))
                .modelType("RANDOM_FOREST")
                .build();

        mockMvc.perform(post("/api/admin/stress/models/train")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/admin/stress/models/train with USER role should return 403 Forbidden")
    @WithMockUser(username = "user@test.com", roles = {"USER"})
    void trainModel_withUserRole_shouldReturn403() throws Exception {
        TrainModelRequest req = TrainModelRequest.builder()
                .name("RF Target")
                .targetKey("target")
                .featureKeys(List.of("cet1", "npl_ratio"))
                .modelType("RANDOM_FOREST")
                .build();

        mockMvc.perform(post("/api/admin/stress/models/train")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/admin/stress/models/train with ADMIN role should return 200 OK")
    @WithMockUser(username = "admin@test.com", roles = {"ADMIN"})
    void trainModel_withAdminRole_shouldReturn200() throws Exception {
        User admin = User.builder().id(1L).email("admin@test.com").role(Role.ADMIN).build();
        when(userRepository.findByEmail("admin@test.com")).thenReturn(Optional.of(admin));

        TrainModelRequest req = TrainModelRequest.builder()
                .name("RF Target")
                .targetKey("target")
                .featureKeys(List.of("cet1", "npl_ratio"))
                .modelType("RANDOM_FOREST")
                .build();

        when(stressTestingService.trainModel(any(TrainModelRequest.class), any(User.class)))
                .thenReturn(StressModelDto.builder().id(1L).name("RF Target").build());

        mockMvc.perform(post("/api/admin/stress/models/train")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }
}
