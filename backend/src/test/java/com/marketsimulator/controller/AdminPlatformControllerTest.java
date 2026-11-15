package com.marketsimulator.controller;

import com.marketsimulator.domain.Role;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.admin.PlatformOverviewDto;
import com.marketsimulator.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Proxy;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class AdminPlatformControllerTest {

    private AdminPlatformController adminPlatformController;

    private List<User> userStore;

    @SuppressWarnings("unchecked")
    private <T> T createRepoProxy(Class<T> clazz) {
        return (T) Proxy.newProxyInstance(
                clazz.getClassLoader(),
                new Class<?>[]{clazz},
                (proxy, method, args) -> {
                    String name = method.getName();
                    if ("count".equals(name)) {
                        if (clazz.equals(UserRepository.class)) return (long) userStore.size();
                        return 42L;
                    }
                    if ("findAll".equals(name)) {
                        if (clazz.equals(UserRepository.class)) return userStore;
                        return Collections.emptyList();
                    }
                    if ("findById".equals(name)) {
                        Long id = (Long) args[0];
                        return userStore.stream().filter(u -> u.getId().equals(id)).findFirst();
                    }
                    if ("save".equals(name)) {
                        return args[0];
                    }
                    return null;
                }
        );
    }

    @BeforeEach
    void setUp() {
        userStore = new ArrayList<>();
        userStore.add(User.builder().id(1L).email("admin@marketsimulator.com").role(Role.ADMIN).build());
        userStore.add(User.builder().id(2L).email("trader@marketsimulator.com").role(Role.USER).build());

        UserRepository userRepo = createRepoProxy(UserRepository.class);
        PortfolioRepository portfolioRepo = createRepoProxy(PortfolioRepository.class);
        TradeRepository tradeRepo = createRepoProxy(TradeRepository.class);
        StressRunRepository stressRunRepo = createRepoProxy(StressRunRepository.class);
        QuizAttemptRepository quizRepo = createRepoProxy(QuizAttemptRepository.class);
        StressModelRepository modelRepo = createRepoProxy(StressModelRepository.class);

        adminPlatformController = new AdminPlatformController(
                userRepo, portfolioRepo, tradeRepo, stressRunRepo, quizRepo, modelRepo
        );
    }

    @Test
    @DisplayName("Devrait retourner la synthèse globale de la plateforme pour la supervision admin")
    void shouldReturnPlatformOverview() {
        ResponseEntity<PlatformOverviewDto> response = adminPlatformController.getOverview();

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        PlatformOverviewDto body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.getTotalUsers()).isEqualTo(2);
        assertThat(body.getServiceHealth()).containsKey("Finnhub Stock WebSocket");
        assertThat(body.getServiceHealth()).containsKey("ECB Frankfurter FX Feed");
        assertThat(body.getRecentUsers()).hasSize(2);
    }

    @Test
    @DisplayName("Devrait modifier le rôle d'un utilisateur")
    void shouldUpdateUserRole() {
        ResponseEntity<PlatformOverviewDto.UserSummaryDto> response =
                adminPlatformController.updateUserRole(2L, "ADMIN");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        PlatformOverviewDto.UserSummaryDto updated = response.getBody();
        assertThat(updated).isNotNull();
        assertThat(updated.getRole()).isEqualTo("ADMIN");
    }
}
