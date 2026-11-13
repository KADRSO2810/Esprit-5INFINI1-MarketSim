package com.marketsimulator.controller;

import com.marketsimulator.domain.User;
import com.marketsimulator.dto.BankImportStats;
import com.marketsimulator.dto.StressModelDto;
import com.marketsimulator.dto.TrainModelRequest;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.BankDataImportService;
import com.marketsimulator.service.StressTestingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/stress")
@RequiredArgsConstructor
@Tag(name = "Admin Stress Testing", description = "Administration des données bancaires et modèles de stress testing")
@SecurityRequirement(name = "BearerAuth")
@PreAuthorize("hasRole('ADMIN')")
public class AdminStressController {

    private final BankDataImportService bankDataImportService;
    private final StressTestingService stressTestingService;
    private final UserRepository userRepository;

    @Operation(summary = "Importer des observations financières bancaires via fichier CSV")
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<BankImportStats> importCsv(@RequestParam("file") MultipartFile file) {
        BankImportStats stats = bankDataImportService.importCsv(file);
        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Entraîner un modèle ML sur les données bancaires importées")
    @PostMapping("/models/train")
    public ResponseEntity<StressModelDto> trainModel(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody TrainModelRequest request) {
        User user = resolveUser(userDetails);
        StressModelDto model = (user != null)
                ? stressTestingService.trainModel(request, user)
                : stressTestingService.trainModel(request);
        return ResponseEntity.ok(model);
    }

    @Operation(summary = "Télécharger le template CSV d'importation bancaire")
    @GetMapping(value = "/template", produces = "text/csv")
    public ResponseEntity<Resource> downloadTemplate() {
        Resource resource = new ClassPathResource("templates/stress_template.csv");
        if (!resource.exists()) {
            resource = new ClassPathResource("templates/bank_stress_template.csv");
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"stress_template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(resource);
    }

    private User resolveUser(UserDetails userDetails) {
        if (userDetails == null) return null;
        return userRepository.findByEmail(userDetails.getUsername()).orElse(null);
    }
}
