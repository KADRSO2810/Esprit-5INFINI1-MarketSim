package com.marketsimulator.controller;

import com.marketsimulator.domain.User;
import com.marketsimulator.dto.learning.*;
import com.marketsimulator.exception.ResourceNotFoundException;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.learning.LearningService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/learning")
@RequiredArgsConstructor
@Tag(name = "Formation & Apprentissage", description = "Modules pédagogiques, fiches de cours, quiz QCM et scénarios de marché")
@SecurityRequirement(name = "BearerAuth")
public class LearningController {

    private final LearningService learningService;
    private final UserRepository userRepository;

    @Operation(summary = "Lister tous les modules d'apprentissage")
    @GetMapping("/modules")
    public ResponseEntity<List<LearningModuleDto>> getAllModules() {
        return ResponseEntity.ok(learningService.getAllModules());
    }

    @Operation(summary = "Consulter un module spécifique et ses leçons")
    @GetMapping("/modules/{id}")
    public ResponseEntity<LearningModuleDto> getModuleById(@PathVariable String id) {
        return learningService.getModuleById(id)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Module introuvable : " + id));
    }

    @Operation(summary = "Consulter le contenu détaillé d'une leçon")
    @GetMapping("/lessons/{lessonId}")
    public ResponseEntity<LearningLessonDto> getLessonById(@PathVariable String lessonId) {
        return learningService.getLessonById(lessonId)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Leçon introuvable : " + lessonId));
    }

    @Operation(summary = "Valider la complétion d'une leçon par l'utilisateur connecté")
    @PostMapping("/lessons/{lessonId}/complete")
    public ResponseEntity<Void> markLessonCompleted(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String lessonId) {
        User user = resolveUser(userDetails);
        learningService.markLessonCompleted(user, lessonId);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Lister tous les quiz disponibles")
    @GetMapping("/quizzes")
    public ResponseEntity<List<QuizDto>> getAllQuizzes() {
        return ResponseEntity.ok(learningService.getAllQuizzes());
    }

    @Operation(summary = "Récupérer un quiz pour le passer (bonnes réponses masquées)")
    @GetMapping("/quizzes/{quizId}")
    public ResponseEntity<QuizDto> getQuizById(@PathVariable String quizId) {
        return learningService.getQuizById(quizId, true)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz introuvable : " + quizId));
    }

    @Operation(summary = "Soumettre les réponses d'un quiz et obtenir la correction détaillée et les badges")
    @PostMapping("/quizzes/{quizId}/submit")
    public ResponseEntity<QuizResultDto> submitQuiz(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable String quizId,
            @RequestBody QuizSubmissionDto submission) {
        User user = resolveUser(userDetails);
        submission.setQuizId(quizId);
        QuizResultDto result = learningService.submitQuiz(user, submission);
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Lister les scénarios de marché interactifs et défis pédagogiques")
    @GetMapping("/scenarios")
    public ResponseEntity<List<MarketScenarioDto>> getMarketScenarios() {
        return ResponseEntity.ok(learningService.getMarketScenarios());
    }

    @Operation(summary = "Récupérer le profil d'apprentissage de l'utilisateur connecté (scores, badges, progression)")
    @GetMapping("/profile")
    public ResponseEntity<UserLearningProfileDto> getUserLearningProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(learningService.getUserLearningProfile(user));
    }

    private User resolveUser(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé avec l'email: " + userDetails.getUsername()));
    }
}
