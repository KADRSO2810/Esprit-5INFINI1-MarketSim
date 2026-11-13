package com.marketsimulator.controller;

import com.marketsimulator.domain.User;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.StressTestingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stress")
@RequiredArgsConstructor
@Tag(name = "Stress Testing", description = "Simulations de résilience bancaire et explicabilité XAI")
@SecurityRequirement(name = "BearerAuth")
public class StressController {

    private final StressTestingService stressTestingService;
    private final UserRepository userRepository;

    @Operation(summary = "Télécharger le modèle de fichier CSV pour l'import de données")
    @GetMapping(value = "/template", produces = "text/csv")
    public ResponseEntity<Resource> downloadTemplate() {
        Resource resource = new ClassPathResource("templates/bank_stress_template.csv");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"bank_stress_template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(resource);
    }

    @Operation(summary = "Lister toutes les banques enregistrées")
    @GetMapping("/banks")
    public ResponseEntity<List<BankDto>> listBanks() {
        return ResponseEntity.ok(stressTestingService.listBanks());
    }

    @Operation(summary = "Lister tous les modèles de prédiction ML disponibles")
    @GetMapping("/models")
    public ResponseEntity<List<StressModelDto>> listModels() {
        return ResponseEntity.ok(stressTestingService.listModels());
    }

    @Operation(summary = "Lister tous les scénarios macro-économiques de stress")
    @GetMapping("/scenarios")
    public ResponseEntity<List<StressScenarioDto>> listScenarios() {
        return ResponseEntity.ok(stressTestingService.listScenarios());
    }

    @Operation(summary = "Créer un nouveau scénario de choc macro-économique")
    @PostMapping("/scenarios")
    public ResponseEntity<StressScenarioDto> createScenario(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody CreateScenarioRequest request) {
        User user = resolveUser(userDetails);
        StressScenarioDto scenario = stressTestingService.createScenario(request, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(scenario);
    }

    @Operation(summary = "Lancer un nouveau stress test par IA")
    @PostMapping("/runs")
    public ResponseEntity<StressRunDto> launchRun(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody LaunchStressRunRequest request) {
        User user = resolveUser(userDetails);
        StressRunDto run = stressTestingService.launchRun(request, user);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(run);
    }

    @Operation(summary = "Lister les stress tests exécutés par l'utilisateur connecté")
    @GetMapping("/runs")
    public ResponseEntity<List<StressRunDto>> listRuns(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(stressTestingService.listUserRuns(user));
    }

    @Operation(summary = "Obtenir les détails complets et métriques agrégées d'un run")
    @GetMapping("/runs/{id}")
    public ResponseEntity<StressRunDetailDto> getRunDetail(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(stressTestingService.getRunDetail(id, user));
    }

    @Operation(summary = "Obtenir les résultats détaillés par banque pour un run")
    @GetMapping("/runs/{id}/results")
    public ResponseEntity<List<StressResultDto>> getRunResults(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(stressTestingService.getRunResults(id, user));
    }

    @Operation(summary = "Obtenir l'explication XAI (Globale ou Locale par banque)")
    @GetMapping("/runs/{id}/xai")
    public ResponseEntity<XaiExplanationDto> getRunXai(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestParam(value = "type", defaultValue = "GLOBAL") String type,
            @RequestParam(value = "bankId", required = false) Long bankId) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(stressTestingService.getXaiExplanation(id, type, bankId, user));
    }

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé avec l'email: " + userDetails.getUsername()));
    }
}
