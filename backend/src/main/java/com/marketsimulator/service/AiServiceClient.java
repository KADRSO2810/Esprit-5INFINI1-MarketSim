package com.marketsimulator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
@Slf4j
public class AiServiceClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String aiServiceUrl;

    public AiServiceClient(
            RestTemplate restTemplate,
            ObjectMapper objectMapper,
            @Value("${app.ai-service.url:http://localhost:8090}") String aiServiceUrl
    ) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.aiServiceUrl = aiServiceUrl.replaceAll("/+$", "");
    }

    public boolean isAvailable() {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(aiServiceUrl + "/health", String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.debug("AI service healthcheck failed: {}", e.getMessage());
            return false;
        }
    }

    public Map<String, Object> trainModel(
            String modelType,
            String targetKey,
            List<String> featureKeys,
            List<Map<String, Object>> dataset
    ) {
        String url = aiServiceUrl + "/train";
        Map<String, Object> body = new HashMap<>();
        body.put("modelType", modelType != null ? modelType : "RANDOM_FOREST");
        body.put("model_type", modelType != null ? modelType : "RANDOM_FOREST");
        body.put("targetKey", targetKey);
        body.put("target_key", targetKey);
        body.put("featureKeys", featureKeys);
        body.put("feature_keys", featureKeys);
        body.put("rows", dataset);
        body.put("dataset", dataset);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new IllegalStateException("Le service AI a retourné une erreur HTTP " + response.getStatusCode());
            }
            return objectMapper.readValue(response.getBody(), new TypeReference<>() {});
        } catch (ResourceAccessException e) {
            log.error("Impossible de contacter le service AI sur {} : {}", url, e.getMessage());
            throw new IllegalStateException("Le service AI (FastAPI sur " + aiServiceUrl + ") n'est pas joignable. Veuillez démarrer le service AI.", e);
        } catch (Exception e) {
            log.error("Erreur lors de l'entraînement du modèle via AI service : {}", e.getMessage());
            throw new RuntimeException("Erreur service AI : " + e.getMessage(), e);
        }
    }

    public Map<Long, Double> predict(String modelArtifactB64, List<String> featureKeys, List<Map<String, Object>> rows) {
        String url = aiServiceUrl + "/predict";
        Map<String, Object> body = new HashMap<>();
        body.put("modelArtifactB64", modelArtifactB64);
        body.put("model_artifact_b64", modelArtifactB64);
        body.put("model_id", modelArtifactB64);
        body.put("featureKeys", featureKeys);
        body.put("feature_keys", featureKeys);
        body.put("rows", rows);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new IllegalStateException("Erreur prédiction AI: " + response.getStatusCode());
            }

            Map<String, Object> resMap = objectMapper.readValue(response.getBody(), new TypeReference<>() {});
            List<Map<String, Object>> predictions = (List<Map<String, Object>>) resMap.get("predictions");
            Map<Long, Double> result = new LinkedHashMap<>();
            if (predictions != null) {
                for (Map<String, Object> p : predictions) {
                    Long id = Long.valueOf(p.get("id").toString());
                    Number valNum = (Number) (p.containsKey("y") ? p.get("y") : p.get("predicted_value"));
                    Double val = valNum != null ? valNum.doubleValue() : 0.0;
                    result.put(id, val);
                }
            }
            return result;
        } catch (Exception e) {
            log.error("Erreur prédiction AI : {}", e.getMessage());
            throw new RuntimeException("Échec de prédiction AI : " + e.getMessage(), e);
        }
    }

    public Map<Long, Double> predict(String modelArtifactB64, List<Map<String, Object>> rows) {
        List<String> featureKeys = new ArrayList<>();
        if (!rows.isEmpty() && rows.get(0).get("features") instanceof Map) {
            Map<String, Object> feats = (Map<String, Object>) rows.get(0).get("features");
            featureKeys.addAll(feats.keySet());
        }
        return predict(modelArtifactB64, featureKeys, rows);
    }

    public Map<String, Object> explain(String modelArtifactB64, List<String> featureKeys, String mode, List<Map<String, Object>> rows) {
        String url = aiServiceUrl + "/explain";
        Map<String, Object> body = new HashMap<>();
        body.put("modelArtifactB64", modelArtifactB64);
        body.put("model_artifact_b64", modelArtifactB64);
        body.put("model_id", modelArtifactB64);
        body.put("featureKeys", featureKeys);
        body.put("feature_keys", featureKeys);
        body.put("mode", mode);
        body.put("rows", rows);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new IllegalStateException("Erreur XAI explanation: " + response.getStatusCode());
            }
            return objectMapper.readValue(response.getBody(), new TypeReference<>() {});
        } catch (Exception e) {
            log.error("Erreur XAI explanation : {}", e.getMessage());
            throw new RuntimeException("Échec de l'explication XAI : " + e.getMessage(), e);
        }
    }

    public Map<String, Object> explain(String modelArtifactB64, String mode, List<Map<String, Object>> rows) {
        List<String> featureKeys = new ArrayList<>();
        if (!rows.isEmpty() && rows.get(0).get("features") instanceof Map) {
            Map<String, Object> feats = (Map<String, Object>) rows.get(0).get("features");
            featureKeys.addAll(feats.keySet());
        }
        return explain(modelArtifactB64, featureKeys, mode, rows);
    }

    /**
     * Analyse le sentiment d'une liste de textes via le service IA (FastAPI).
     * POST /sentiment/analyze
     */
    public com.marketsimulator.dto.SentimentAnalyzeResponse analyzeSentiment(com.marketsimulator.dto.SentimentAnalyzeRequest request) {
        String url = aiServiceUrl + "/sentiment/analyze";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<com.marketsimulator.dto.SentimentAnalyzeRequest> entity = new HttpEntity<>(request, headers);

        try {
            ResponseEntity<com.marketsimulator.dto.SentimentAnalyzeResponse> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    com.marketsimulator.dto.SentimentAnalyzeResponse.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }
            throw new IllegalStateException("Le service IA sentiment a retourné HTTP " + response.getStatusCode());
        } catch (ResourceAccessException e) {
            log.error("Service IA indisponible pour l'analyse de sentiment ({}) : {}", url, e.getMessage());
            throw new IllegalStateException("Le service IA sentiment (FastAPI sur " + aiServiceUrl + ") n'est pas joignable. Veuillez démarrer l'IA service.", e);
        } catch (Exception e) {
            log.error("Erreur lors de l'analyse de sentiment : {}", e.getMessage());
            throw new RuntimeException("Échec de l'analyse de sentiment IA : " + e.getMessage(), e);
        }
    }
}
