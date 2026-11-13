package com.marketsimulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.*;
import com.marketsimulator.dto.*;
import com.marketsimulator.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StressTestingService {

    private final BankRepository bankRepository;
    private final BankObservationRepository bankObservationRepository;
    private final StressModelRepository stressModelRepository;
    private final StressScenarioRepository stressScenarioRepository;
    private final StressRunRepository stressRunRepository;
    private final StressResultRepository stressResultRepository;
    private final XaiExplanationRepository xaiExplanationRepository;
    private final AiServiceClient aiServiceClient;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private UserRepository userRepository;

    @Value("${app.stress.max-local-xai-banks:10}")
    private int maxLocalXaiBanks;

    // =========================================================================
    // 1. Modèles & Entraînement
    // =========================================================================

    @Transactional
    public StressModelDto trainModel(TrainModelRequest req, User user) {
        List<BankObservation> observations = bankObservationRepository.findAllWithBank();
        if (observations == null || observations.size() < 3) {
            throw new IllegalArgumentException("Impossible d'entraîner un modèle : au moins 3 observations bancaires sont requises en base. Veuillez d'abord importer un CSV.");
        }

        String targetKey = req.getTargetKey();
        List<String> featureKeys = req.getFeatureKeys();

        // Build training dataset
        List<Map<String, Object>> dataset = new ArrayList<>();
        Set<String> discoveredFeatures = new LinkedHashSet<>();

        for (BankObservation obs : observations) {
            try {
                Map<String, Object> featMap = objectMapper.readValue(obs.getFeaturesJson(), new TypeReference<>() {});
                Map<String, Object> targetMap = objectMapper.readValue(obs.getTargetJson(), new TypeReference<>() {});

                // Target value lookup
                Double targetVal = null;
                if (targetMap.containsKey(targetKey)) {
                    targetVal = ((Number) targetMap.get(targetKey)).doubleValue();
                } else if (featMap.containsKey(targetKey)) {
                    targetVal = ((Number) featMap.get(targetKey)).doubleValue();
                }

                if (targetVal == null) continue;

                Map<String, Double> numFeatures = new HashMap<>();
                for (Map.Entry<String, Object> entry : featMap.entrySet()) {
                    if (entry.getKey().equalsIgnoreCase(targetKey)) continue;
                    if (entry.getValue() instanceof Number) {
                        numFeatures.put(entry.getKey(), ((Number) entry.getValue()).doubleValue());
                        discoveredFeatures.add(entry.getKey());
                    }
                }

                Map<String, Object> row = new HashMap<>();
                row.put("features", numFeatures);
                row.put("target", targetVal);
                dataset.add(row);

            } catch (Exception e) {
                log.warn("Erreur lecture observation {}: {}", obs.getId(), e.getMessage());
            }
        }

        if (dataset.size() < 3) {
            throw new IllegalArgumentException("La variable cible '" + targetKey + "' est absente ou non numérique dans les observations importées.");
        }

        List<String> finalFeatures = (featureKeys != null && !featureKeys.isEmpty())
                ? featureKeys
                : new ArrayList<>(discoveredFeatures);

        // Call Python AI Service
        Map<String, Object> aiResponse = aiServiceClient.trainModel(
                req.getModelType(),
                targetKey,
                finalFeatures,
                dataset
        );

        String artifactB64 = (String) (aiResponse.containsKey("modelArtifactB64")
                ? aiResponse.get("modelArtifactB64")
                : aiResponse.get("model_artifact_b64"));
        if (artifactB64 == null) {
            artifactB64 = (String) aiResponse.get("model_id");
        }
        if (artifactB64 == null) {
            artifactB64 = "DUMMY_ARTIFACT_B64";
        }

        Map<String, Object> metrics = (Map<String, Object>) aiResponse.get("metrics");
        if (metrics == null) {
            metrics = new LinkedHashMap<>();
        }
        Object featImp = aiResponse.containsKey("featureImportance")
                ? aiResponse.get("featureImportance")
                : aiResponse.get("feature_importance");
        if (featImp != null) {
            metrics.put("featureImportance", featImp);
            metrics.put("feature_importance", featImp);
        }

        try {
            StressModel model = StressModel.builder()
                    .ownerUser(user)
                    .name(req.getName())
                    .modelType(req.getModelType() != null ? req.getModelType() : "RANDOM_FOREST")
                    .targetKey(targetKey)
                    .featureKeysJson(objectMapper.writeValueAsString(finalFeatures))
                    .modelArtifactB64(artifactB64)
                    .metricsJson(objectMapper.writeValueAsString(metrics))
                    .build();

            model = stressModelRepository.save(model);
            return toModelDto(model);
        } catch (Exception e) {
            log.error("Erreur persistance du modèle : {}", e.getMessage(), e);
            throw new RuntimeException("Erreur de persistance du modèle : " + e.getMessage(), e);
        }
    }

    @Transactional
    public StressModelDto trainModel(TrainModelRequest req) {
        User defaultUser = null;
        if (userRepository != null) {
            defaultUser = userRepository.findAll().stream().findFirst().orElse(null);
        }
        return trainModel(req, defaultUser);
    }

    public List<StressModelDto> listModels() {
        return stressModelRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toModelDto)
                .collect(Collectors.toList());
    }

    // =========================================================================
    // 2. Scénarios
    // =========================================================================

    @Transactional
    public StressScenarioDto createScenario(CreateScenarioRequest req, User user) {
        try {
            StressScenario scenario = StressScenario.builder()
                    .name(req.getName())
                    .description(req.getDescription())
                    .shocksJson(objectMapper.writeValueAsString(req.getShocks()))
                    .ownerUser(user)
                    .build();

            scenario = stressScenarioRepository.save(scenario);
            return toScenarioDto(scenario);
        } catch (Exception e) {
            throw new RuntimeException("Erreur création de scénario : " + e.getMessage(), e);
        }
    }

    public List<StressScenarioDto> listScenarios() {
        return stressScenarioRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toScenarioDto)
                .collect(Collectors.toList());
    }

    // =========================================================================
    // 3. Exécution d'un Stress Test
    // =========================================================================

    @Transactional
    public StressRunDto launchRun(LaunchStressRunRequest req, User user) {
        StressScenario scenario = stressScenarioRepository.findById(req.getScenarioId())
                .orElseThrow(() -> new IllegalArgumentException("Scénario introuvable avec ID: " + req.getScenarioId()));

        StressModel model = stressModelRepository.findById(req.getModelId())
                .orElseThrow(() -> new IllegalArgumentException("Modèle introuvable avec ID: " + req.getModelId()));

        StressRun run = StressRun.builder()
                .ownerUser(user)
                .scenario(scenario)
                .model(model)
                .status(StressRunStatus.QUEUED)
                .build();

        run = stressRunRepository.save(run);

        // Async execution
        executeStressRunAsync(run.getId());

        return toRunDto(run);
    }

    @Async
    public void executeStressRunAsync(Long runId) {
        log.info("Début de l'exécution asynchrone du stress test runId={}", runId);
        Optional<StressRun> runOpt = stressRunRepository.findById(runId);
        if (runOpt.isEmpty()) return;

        StressRun run = runOpt.get();
        run.setStatus(StressRunStatus.RUNNING);
        run.setStartedAt(LocalDateTime.now());
        stressRunRepository.save(run);

        try {
            StressScenario scenario = run.getScenario();
            StressModel model = run.getModel();
            if (model == null) throw new IllegalStateException("Aucun modèle associé au run.");

            Map<String, Double> shocks = objectMapper.readValue(scenario.getShocksJson(), new TypeReference<>() {});
            List<String> featureKeys = objectMapper.readValue(model.getFeatureKeysJson(), new TypeReference<>() {});

            // Load latest observation for each bank
            List<BankObservation> latestObsList = bankObservationRepository.findLatestObservationPerBank();
            if (latestObsList.isEmpty()) {
                throw new IllegalStateException("Aucune observation bancaire en base de données pour exécuter le stress test.");
            }

            List<Map<String, Object>> baselineRows = new ArrayList<>();
            List<Map<String, Object>> stressedRows = new ArrayList<>();
            Map<Long, Bank> bankMap = new HashMap<>();

            for (BankObservation obs : latestObsList) {
                Bank b = obs.getBank();
                bankMap.put(b.getId(), b);

                Map<String, Object> feats = objectMapper.readValue(obs.getFeaturesJson(), new TypeReference<>() {});
                Map<String, Double> baselineFeats = new HashMap<>();
                Map<String, Double> stressedFeats = new HashMap<>();

                for (String fk : featureKeys) {
                    double val = 0.0;
                    if (feats.get(fk) instanceof Number) {
                        val = ((Number) feats.get(fk)).doubleValue();
                    }
                    baselineFeats.put(fk, val);

                    // Apply shock if matches
                    double shockDelta = shocks.getOrDefault(fk, 0.0);
                    stressedFeats.put(fk, val + shockDelta);
                }

                // Row for AI predict
                Map<String, Object> bRow = new HashMap<>();
                bRow.put("id", b.getId());
                bRow.put("features", baselineFeats);
                baselineRows.add(bRow);

                Map<String, Object> sRow = new HashMap<>();
                sRow.put("id", b.getId());
                sRow.put("name", b.getName());
                sRow.put("features", stressedFeats);
                stressedRows.add(sRow);
            }

            // Call AI predict for Baseline and Stressed using model artifact
            Map<Long, Double> baselinePreds = aiServiceClient.predict(model.getModelArtifactB64(), featureKeys, baselineRows);
            Map<Long, Double> stressedPreds = aiServiceClient.predict(model.getModelArtifactB64(), featureKeys, stressedRows);

            List<StressResult> resultsToSave = new ArrayList<>();

            for (Map<String, Object> bRow : baselineRows) {
                Long bankId = (Long) bRow.get("id");
                Bank bank = bankMap.get(bankId);
                Double baseVal = baselinePreds.getOrDefault(bankId, 0.0);
                Double stressVal = stressedPreds.getOrDefault(bankId, 0.0);
                Double deltaVal = stressVal - baseVal;

                BigDecimal riskScore = BigDecimal.valueOf(Math.max(0.0, deltaVal))
                        .setScale(6, RoundingMode.HALF_UP);

                StressResult res = StressResult.builder()
                        .run(run)
                        .bank(bank)
                        .baselinePred(BigDecimal.valueOf(baseVal).setScale(6, RoundingMode.HALF_UP))
                        .stressedPred(BigDecimal.valueOf(stressVal).setScale(6, RoundingMode.HALF_UP))
                        .deltaPred(BigDecimal.valueOf(deltaVal).setScale(6, RoundingMode.HALF_UP))
                        .riskScore(riskScore)
                        .build();

                resultsToSave.add(res);
            }

            stressResultRepository.saveAll(resultsToSave);

            // =================================================================
            // XAI Computations
            // =================================================================
            try {
                // 1. Global Explanation
                Map<String, Object> globalXai = aiServiceClient.explain(model.getModelArtifactB64(), featureKeys, "GLOBAL", stressedRows);
                XaiExplanation globalExp = XaiExplanation.builder()
                        .run(run)
                        .bank(null)
                        .explanationType("GLOBAL")
                        .contentJson(objectMapper.writeValueAsString(globalXai))
                        .build();
                xaiExplanationRepository.save(globalExp);

                // 2. Local Explanations for top impacted banks
                List<Map<String, Object>> topStressedRows = stressedRows.stream()
                        .sorted((r1, r2) -> {
                            Long id1 = (Long) r1.get("id");
                            Long id2 = (Long) r2.get("id");
                            Double d1 = stressedPreds.getOrDefault(id1, 0.0) - baselinePreds.getOrDefault(id1, 0.0);
                            Double d2 = stressedPreds.getOrDefault(id2, 0.0) - baselinePreds.getOrDefault(id2, 0.0);
                            return Double.compare(Math.abs(d2), Math.abs(d1));
                        })
                        .limit(Math.max(1, maxLocalXaiBanks))
                        .collect(Collectors.toList());

                Map<String, Object> localXai = aiServiceClient.explain(model.getModelArtifactB64(), featureKeys, "LOCAL", topStressedRows);
                List<Map<String, Object>> localExplanations = (List<Map<String, Object>>) (localXai.containsKey("local")
                        ? localXai.get("local")
                        : localXai.get("local_explanations"));

                if (localExplanations != null) {
                    for (Map<String, Object> item : localExplanations) {
                        Long bId = Long.valueOf(item.get("id").toString());
                        Bank bank = bankMap.get(bId);
                        if (bank != null) {
                            XaiExplanation localExp = XaiExplanation.builder()
                                    .run(run)
                                    .bank(bank)
                                    .explanationType("LOCAL")
                                    .contentJson(objectMapper.writeValueAsString(item))
                                    .build();
                            xaiExplanationRepository.save(localExp);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Erreur calcul XAI pour runId={}: {}", runId, e.getMessage());
            }

            run.setStatus(StressRunStatus.DONE);
            run.setFinishedAt(LocalDateTime.now());
            stressRunRepository.save(run);
            log.info("Stress test runId={} terminé avec succès.", runId);

        } catch (Exception e) {
            log.error("Erreur exécution stress test runId={}: {}", runId, e.getMessage(), e);
            run.setStatus(StressRunStatus.FAILED);
            run.setErrorMessage(e.getMessage());
            run.setFinishedAt(LocalDateTime.now());
            stressRunRepository.save(run);
        }
    }

    public List<StressRunDto> listUserRuns(User user) {
        return stressRunRepository.findAllByUserOrderByCreatedAtDesc(user)
                .stream()
                .map(this::toRunDto)
                .collect(Collectors.toList());
    }

    public StressRunDetailDto getRunDetail(Long runId, User user) {
        StressRun run = stressRunRepository.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Run introuvable avec ID: " + runId));

        if (!run.getUser().getId().equals(user.getId()) && !user.getRole().equals(Role.ADMIN)) {
            throw new IllegalArgumentException("Accès non autorisé à ce run de stress testing.");
        }

        List<StressResult> results = stressResultRepository.findByRunOrderByRiskScoreDesc(run);
        StressRunDetailDto detail = toRunDetailDto(run);

        if (results.isEmpty()) {
            return detail;
        }

        // Aggregate KPIs
        List<Double> baselines = new ArrayList<>();
        List<Double> stresseds = new ArrayList<>();
        List<Double> deltas = new ArrayList<>();

        List<Double> convDeltas = new ArrayList<>();
        List<Double> nonConvDeltas = new ArrayList<>();
        List<Double> convBase = new ArrayList<>();
        List<Double> nonConvBase = new ArrayList<>();
        List<Double> convStress = new ArrayList<>();
        List<Double> nonConvStress = new ArrayList<>();

        double maxDelta = -Double.MAX_VALUE;
        String mostImpactedName = "";

        for (StressResult r : results) {
            double b = r.getBaselinePred() != null ? r.getBaselinePred().doubleValue() : 0.0;
            double s = r.getStressedPred() != null ? r.getStressedPred().doubleValue() : 0.0;
            double d = r.getDeltaPred() != null ? r.getDeltaPred().doubleValue() : 0.0;

            baselines.add(b);
            stresseds.add(s);
            deltas.add(d);

            if (d > maxDelta) {
                maxDelta = d;
                mostImpactedName = r.getBank().getName();
            }

            if (r.getBank().getBankType() == BankType.CONVENTIONAL) {
                convDeltas.add(d);
                convBase.add(b);
                convStress.add(s);
            } else {
                nonConvDeltas.add(d);
                nonConvBase.add(b);
                nonConvStress.add(s);
            }
        }

        detail.setTotalBanksCount(results.size());
        detail.setAvgBaseline(roundDouble(baselines.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));
        detail.setAvgStressed(roundDouble(stresseds.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));
        detail.setAvgDelta(roundDouble(deltas.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)));
        detail.setMaxDelta(roundDouble(maxDelta > -Double.MAX_VALUE ? maxDelta : 0.0));
        detail.setMostImpactedBankName(mostImpactedName);

        // Conventional Stats
        detail.setConventionalStats(StressRunDetailDto.BankTypeComparisonDto.builder()
                .type("CONVENTIONAL")
                .count(convDeltas.size())
                .avgBaseline(roundDouble(convBase.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)))
                .avgStressed(roundDouble(convStress.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)))
                .avgDelta(roundDouble(convDeltas.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)))
                .maxDelta(roundDouble(convDeltas.stream().mapToDouble(Double::doubleValue).max().orElse(0.0)))
                .build());

        // Non-Conventional Stats
        detail.setNonConventionalStats(StressRunDetailDto.BankTypeComparisonDto.builder()
                .type("NON_CONVENTIONAL")
                .count(nonConvDeltas.size())
                .avgBaseline(roundDouble(nonConvBase.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)))
                .avgStressed(roundDouble(nonConvStress.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)))
                .avgDelta(roundDouble(nonConvDeltas.stream().mapToDouble(Double::doubleValue).average().orElse(0.0)))
                .maxDelta(roundDouble(nonConvDeltas.stream().mapToDouble(Double::doubleValue).max().orElse(0.0)))
                .build());

        // Top 10 Impacted Banks Preview
        detail.setTopImpactedBanks(results.stream().limit(10).map(this::toResultDto).collect(Collectors.toList()));

        // Global XAI importance preview
        Optional<XaiExplanation> globalExp = xaiExplanationRepository.findByRunAndExplanationType(run, "GLOBAL");
        if (globalExp.isPresent()) {
            try {
                Map<String, Object> expMap = objectMapper.readValue(globalExp.get().getContentJson(), new TypeReference<>() {});
                List<Map<String, Object>> gList = (List<Map<String, Object>>) (expMap.containsKey("global")
                        ? expMap.get("global")
                        : expMap.get("global_importance"));
                detail.setGlobalFeatureImportance(gList);
            } catch (Exception e) {
                log.warn("Erreur lecture explication globale {}: {}", globalExp.get().getId(), e.getMessage());
            }
        }

        return detail;
    }

    public List<StressResultDto> getRunResults(Long runId, User user) {
        StressRun run = stressRunRepository.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Run introuvable avec ID: " + runId));

        if (!run.getUser().getId().equals(user.getId()) && !user.getRole().equals(Role.ADMIN)) {
            throw new IllegalArgumentException("Accès non autorisé à ce run de stress testing.");
        }

        return stressResultRepository.findByRunOrderByRiskScoreDesc(run)
                .stream()
                .map(this::toResultDto)
                .collect(Collectors.toList());
    }

    public XaiExplanationDto getXaiExplanation(Long runId, String type, Long bankId, User user) {
        StressRun run = stressRunRepository.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Run introuvable avec ID: " + runId));

        if (!run.getUser().getId().equals(user.getId()) && !user.getRole().equals(Role.ADMIN)) {
            throw new IllegalArgumentException("Accès non autorisé à ce run de stress testing.");
        }

        String expType = (type != null) ? type.toUpperCase() : "GLOBAL";

        if ("LOCAL".equals(expType)) {
            if (bankId == null) {
                throw new IllegalArgumentException("Le paramètre 'bankId' est obligatoire pour une explication XAI de type LOCAL.");
            }
            Bank bank = bankRepository.findById(bankId)
                    .orElseThrow(() -> new IllegalArgumentException("Banque introuvable avec ID: " + bankId));

            XaiExplanation exp = xaiExplanationRepository.findByRunAndBankAndExplanationType(run, bank, "LOCAL")
                    .orElseThrow(() -> new IllegalArgumentException("Aucune explication XAI locale disponible pour cette banque dans ce run."));

            return toXaiDto(exp);
        } else {
            XaiExplanation exp = xaiExplanationRepository.findByRunAndExplanationType(run, "GLOBAL")
                    .orElseThrow(() -> new IllegalArgumentException("Aucune explication XAI globale disponible pour ce run."));

            return toXaiDto(exp);
        }
    }

    public List<BankDto> listBanks() {
        return bankRepository.findAllWithObservationCount()
                .stream()
                .map(row -> BankDto.builder()
                        .id((Long) row[0])
                        .name((String) row[1])
                        .country((String) row[2])
                        .bankType((BankType) row[3])
                        .observationCount(((Number) row[4]).longValue())
                        .build())
                .collect(Collectors.toList());
    }

    // =========================================================================
    // DTO Mappers
    // =========================================================================

    private StressModelDto toModelDto(StressModel m) {
        List<String> featureKeys = Collections.emptyList();
        Map<String, Object> metrics = Collections.emptyMap();
        try {
            if (m.getFeatureKeysJson() != null) {
                featureKeys = objectMapper.readValue(m.getFeatureKeysJson(), new TypeReference<>() {});
            }
            if (m.getMetricsJson() != null) {
                metrics = objectMapper.readValue(m.getMetricsJson(), new TypeReference<>() {});
            }
        } catch (Exception e) {
            log.warn("Erreur parsing JSON modèle {}: {}", m.getId(), e.getMessage());
        }

        return StressModelDto.builder()
                .id(m.getId())
                .modelUuid(m.getModelUuid())
                .name(m.getName())
                .modelType(m.getModelType())
                .targetKey(m.getTargetKey())
                .featureKeys(featureKeys)
                .metrics(metrics)
                .createdAt(m.getCreatedAt())
                .build();
    }

    private StressScenarioDto toScenarioDto(StressScenario s) {
        Map<String, Double> shocks = Collections.emptyMap();
        try {
            shocks = objectMapper.readValue(s.getShocksJson(), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Erreur parsing JSON scénario {}: {}", s.getId(), e.getMessage());
        }

        return StressScenarioDto.builder()
                .id(s.getId())
                .name(s.getName())
                .description(s.getDescription())
                .shocks(shocks)
                .createdByEmail(s.getCreatedBy() != null ? s.getCreatedBy().getEmail() : null)
                .createdAt(s.getCreatedAt())
                .build();
    }

    private StressRunDto toRunDto(StressRun r) {
        return StressRunDto.builder()
                .id(r.getId())
                .scenarioId(r.getScenario().getId())
                .scenarioName(r.getScenario().getName())
                .modelId(r.getModel() != null ? r.getModel().getId() : null)
                .modelName(r.getModel() != null ? r.getModel().getName() : null)
                .targetKey(r.getModel() != null ? r.getModel().getTargetKey() : null)
                .status(r.getStatus())
                .errorMessage(r.getErrorMessage())
                .startedAt(r.getStartedAt())
                .finishedAt(r.getFinishedAt())
                .createdAt(r.getCreatedAt())
                .build();
    }

    private StressRunDetailDto toRunDetailDto(StressRun r) {
        Map<String, Double> shocks = Collections.emptyMap();
        try {
            shocks = objectMapper.readValue(r.getScenario().getShocksJson(), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Erreur parsing shocks JSON: {}", e.getMessage());
        }

        return StressRunDetailDto.builder()
                .id(r.getId())
                .scenarioId(r.getScenario().getId())
                .scenarioName(r.getScenario().getName())
                .scenarioShocks(shocks)
                .modelId(r.getModel() != null ? r.getModel().getId() : null)
                .modelName(r.getModel() != null ? r.getModel().getName() : null)
                .targetKey(r.getModel() != null ? r.getModel().getTargetKey() : null)
                .status(r.getStatus())
                .errorMessage(r.getErrorMessage())
                .startedAt(r.getStartedAt())
                .finishedAt(r.getFinishedAt())
                .createdAt(r.getCreatedAt())
                .build();
    }

    private StressResultDto toResultDto(StressResult sr) {
        String targetKey = (sr.getRun() != null && sr.getRun().getModel() != null && sr.getRun().getModel().getTargetKey() != null)
                ? sr.getRun().getModel().getTargetKey()
                : "target";
        double bVal = sr.getBaselinePred() != null ? sr.getBaselinePred().doubleValue() : 0.0;
        double sVal = sr.getStressedPred() != null ? sr.getStressedPred().doubleValue() : 0.0;
        double dVal = sr.getDeltaPred() != null ? sr.getDeltaPred().doubleValue() : 0.0;

        Map<String, Object> base = Map.of(targetKey, bVal);
        Map<String, Object> stress = Map.of(targetKey, sVal);
        Map<String, Object> delta = Map.of(targetKey, dVal);

        return StressResultDto.builder()
                .id(sr.getId())
                .bankId(sr.getBank().getId())
                .bankName(sr.getBank().getName())
                .country(sr.getBank().getCountry())
                .bankType(sr.getBank().getBankType())
                .baseline(base)
                .stressed(stress)
                .delta(delta)
                .baselinePred(sr.getBaselinePred())
                .stressedPred(sr.getStressedPred())
                .deltaPred(sr.getDeltaPred())
                .riskScore(sr.getRiskScore())
                .build();
    }

    private XaiExplanationDto toXaiDto(XaiExplanation exp) {
        Map<String, Object> contentMap = Collections.emptyMap();
        try {
            contentMap = objectMapper.readValue(exp.getContentJson(), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Erreur parsing JSON explication XAI: {}", e.getMessage());
        }

        return XaiExplanationDto.builder()
                .id(exp.getId())
                .runId(exp.getRun().getId())
                .bankId(exp.getBank() != null ? exp.getBank().getId() : null)
                .bankName(exp.getBank() != null ? exp.getBank().getName() : null)
                .explanationType(exp.getExplanationType())
                .content(contentMap)
                .build();
    }

    private double roundDouble(double val) {
        return BigDecimal.valueOf(val).setScale(4, RoundingMode.HALF_UP).doubleValue();
    }
}
