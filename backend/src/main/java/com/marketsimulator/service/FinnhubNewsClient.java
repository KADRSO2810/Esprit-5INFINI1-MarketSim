package com.marketsimulator.service;

import com.marketsimulator.dto.FinnhubNewsItemDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class FinnhubNewsClient {

    private final RestTemplate restTemplate;

    @Value("${app.finnhub.api-key:db6bck9r01qmd5lj8b6gdb6bck9r01qmd5lj8b70}")
    private String apiKey;

    private static final String FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * Appelle l'endpoint Finnhub Company News :
     * GET https://finnhub.io/api/v1/company-news?symbol=SYM&from=YYYY-MM-DD&to=YYYY-MM-DD&token=...
     */
    public List<FinnhubNewsItemDto> fetchCompanyNews(String symbol, LocalDate from, LocalDate to) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[FINNHUB NEWS] Clé API Finnhub non renseignée, fetch annulé.");
            return Collections.emptyList();
        }

        String cleanSymbol = symbol.trim().toUpperCase();
        // Pour les paires crypto (ex: BINANCE:BTCUSDT), Finnhub company-news attend un ticker action ou simple
        if (cleanSymbol.contains(":")) {
            cleanSymbol = cleanSymbol.substring(cleanSymbol.indexOf(":") + 1);
        }

        String url = UriComponentsBuilder.fromHttpUrl(FINNHUB_BASE_URL + "/company-news")
                .queryParam("symbol", cleanSymbol)
                .queryParam("from", from.format(DATE_FORMATTER))
                .queryParam("to", to.format(DATE_FORMATTER))
                .queryParam("token", apiKey)
                .toUriString();

        try {
            log.info("[FINNHUB NEWS] Fetching company news pour {} du {} au {}", cleanSymbol, from, to);
            ResponseEntity<List<FinnhubNewsItemDto>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<>() {}
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                log.info("[FINNHUB NEWS] {} articles récupérés pour {}", response.getBody().size(), cleanSymbol);
                return response.getBody();
            }
            return Collections.emptyList();
        } catch (Exception ex) {
            log.error("[FINNHUB NEWS ERROR] Échec de la récupération des actualités pour {} : {}",
                    cleanSymbol, ex.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Optionnel : Actualités générales de marché
     * GET https://finnhub.io/api/v1/news?category=general&token=...
     */
    public List<FinnhubNewsItemDto> fetchGeneralNews() {
        if (apiKey == null || apiKey.isBlank()) {
            return Collections.emptyList();
        }

        String url = UriComponentsBuilder.fromHttpUrl(FINNHUB_BASE_URL + "/news")
                .queryParam("category", "general")
                .queryParam("token", apiKey)
                .toUriString();

        try {
            ResponseEntity<List<FinnhubNewsItemDto>> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<>() {}
            );
            return response.getBody() != null ? response.getBody() : Collections.emptyList();
        } catch (Exception ex) {
            log.error("[FINNHUB NEWS GENERAL ERROR] {}", ex.getMessage());
            return Collections.emptyList();
        }
    }
}
