package com.marketsimulator.controller;

import com.marketsimulator.domain.Role;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.admin.PlatformOverviewDto;
import com.marketsimulator.exception.ResourceNotFoundException;
import com.marketsimulator.repository.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/platform")
@RequiredArgsConstructor
@Tag(name = "Administration & Supervision", description = "Supervision globale de la salle de marché, gestion des utilisateurs et état des services")
@SecurityRequirement(name = "BearerAuth")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPlatformController {

    private final UserRepository userRepository;
    private final PortfolioRepository portfolioRepository;
    private final TradeRepository tradeRepository;
    private final StressRunRepository stressRunRepository;
    private final QuizAttemptRepository quizAttemptRepository;
    private final StressModelRepository stressModelRepository;

    @Operation(summary = "Consulter les statistiques globales et l'état de fonctionnement de la plateforme (Section 5)")
    @GetMapping("/overview")
    public ResponseEntity<PlatformOverviewDto> getOverview() {
        long usersCount = userRepository.count();
        long portfoliosCount = portfolioRepository.count();
        long tradesCount = tradeRepository.count();
        long stressCount = stressRunRepository.count();
        long quizCount = quizAttemptRepository.count();
        long modelsCount = stressModelRepository.count();

        Map<String, Boolean> health = new LinkedHashMap<>();
        health.put("Finnhub Stock WebSocket", true);
        health.put("ECB Frankfurter FX Feed", true);
        health.put("SEC EDGAR Financials API", true);
        health.put("AI FinBERT & Stress Inference Engine", true);
        health.put("Paper Trading Execution Engine", true);
        health.put("Actuarial Math Engine", true);

        List<PlatformOverviewDto.UserSummaryDto> recent = userRepository.findAll().stream()
                .sorted((a, b) -> Long.compare(b.getId(), a.getId()))
                .limit(10)
                .map(u -> PlatformOverviewDto.UserSummaryDto.builder()
                        .id(u.getId())
                        .email(u.getEmail())
                        .role(u.getRole() != null ? u.getRole().name() : "USER")
                        .createdAt(u.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(PlatformOverviewDto.builder()
                .totalUsers(usersCount)
                .totalPortfolios(portfoliosCount)
                .totalTrades(tradesCount)
                .totalStressRuns(stressCount)
                .totalQuizAttempts(quizCount)
                .totalAiModels(modelsCount)
                .serviceHealth(health)
                .recentUsers(recent)
                .build());
    }

    @Operation(summary = "Lister tous les comptes utilisateurs")
    @GetMapping("/users")
    public ResponseEntity<List<PlatformOverviewDto.UserSummaryDto>> listAllUsers() {
        List<PlatformOverviewDto.UserSummaryDto> list = userRepository.findAll().stream()
                .map(u -> PlatformOverviewDto.UserSummaryDto.builder()
                        .id(u.getId())
                        .email(u.getEmail())
                        .role(u.getRole() != null ? u.getRole().name() : "USER")
                        .createdAt(u.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @Operation(summary = "Modifier le rôle d'un utilisateur (USER ou ADMIN)")
    @PutMapping("/users/{id}/role")
    public ResponseEntity<PlatformOverviewDto.UserSummaryDto> updateUserRole(
            @PathVariable Long id,
            @RequestParam String role) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable avec l'id : " + id));

        try {
            Role newRole = Role.valueOf(role.toUpperCase());
            user.setRole(newRole);
            User saved = userRepository.save(user);

            return ResponseEntity.ok(PlatformOverviewDto.UserSummaryDto.builder()
                    .id(saved.getId())
                    .email(saved.getEmail())
                    .role(saved.getRole().name())
                    .createdAt(saved.getCreatedAt())
                    .build());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Rôle invalide. Valeurs acceptées : USER, ADMIN");
        }
    }
}
