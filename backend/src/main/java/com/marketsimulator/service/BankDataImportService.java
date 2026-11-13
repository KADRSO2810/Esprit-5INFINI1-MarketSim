package com.marketsimulator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketsimulator.domain.Bank;
import com.marketsimulator.domain.BankObservation;
import com.marketsimulator.domain.BankType;
import com.marketsimulator.dto.BankImportStats;
import com.marketsimulator.repository.BankObservationRepository;
import com.marketsimulator.repository.BankRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class BankDataImportService {

    private final BankRepository bankRepository;
    private final BankObservationRepository bankObservationRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public BankImportStats importCsv(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Le fichier CSV fourni est vide ou absent.");
        }

        BankImportStats stats = BankImportStats.builder().build();
        List<String> errors = new ArrayList<>();
        stats.setErrors(errors);

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.trim().isEmpty()) {
                throw new IllegalArgumentException("Le fichier CSV ne contient aucune ligne d'en-tête.");
            }

            // Clean BOM and split headers
            headerLine = headerLine.replace("\uFEFF", "").trim();
            String separator = headerLine.contains(";") ? ";" : ",";
            String[] rawHeaders = headerLine.split(separator);

            Map<String, Integer> colIndex = new HashMap<>();
            for (int i = 0; i < rawHeaders.length; i++) {
                colIndex.put(rawHeaders[i].trim().toLowerCase(), i);
            }

            // Check mandatory metadata columns
            if (!colIndex.containsKey("bank_name") || !colIndex.containsKey("bank_type") || !colIndex.containsKey("period_date")) {
                throw new IllegalArgumentException("Colonnes obligatoires manquantes dans l'en-tête CSV: 'bank_name', 'bank_type', 'period_date'.");
            }

            int nameIdx = colIndex.get("bank_name");
            int typeIdx = colIndex.get("bank_type");
            int dateIdx = colIndex.get("period_date");
            Integer countryIdx = colIndex.get("country");

            // Identify numerical feature and target candidate columns
            List<String> featureColNames = new ArrayList<>();
            List<String> targetColNames = new ArrayList<>();

            for (String col : colIndex.keySet()) {
                if (col.equals("bank_name") || col.equals("bank_type") || col.equals("period_date") || col.equals("country")) {
                    continue;
                }
                featureColNames.add(col);
                if (col.contains("loss") || col.contains("target") || col.contains("next") || col.equals("npl_ratio") || col.equals("cet1_ratio")) {
                    targetColNames.add(col);
                }
            }

            stats.setDetectedFeatures(featureColNames);
            stats.setDetectedTargets(targetColNames);

            String line;
            int lineNumber = 1;
            int total = 0;
            int imported = 0;
            int newBanks = 0;
            int updatedBanks = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.trim().isEmpty()) continue;
                total++;

                String[] values = line.split(separator, -1);
                if (values.length <= Math.max(nameIdx, Math.max(typeIdx, dateIdx))) {
                    errors.add("Ligne " + lineNumber + ": colonnes manquantes.");
                    continue;
                }

                String bankName = values[nameIdx].trim();
                String bankTypeRaw = values[typeIdx].trim().toUpperCase();
                String dateRaw = values[dateIdx].trim();
                String country = (countryIdx != null && countryIdx < values.length) ? values[countryIdx].trim() : "Unknown";

                if (bankName.isEmpty()) {
                    errors.add("Ligne " + lineNumber + ": 'bank_name' vide.");
                    continue;
                }

                BankType bankType;
                try {
                    bankType = BankType.valueOf(bankTypeRaw);
                } catch (IllegalArgumentException e) {
                    errors.add("Ligne " + lineNumber + ": 'bank_type' invalide (" + bankTypeRaw + "). Valeurs acceptées: CONVENTIONAL, NON_CONVENTIONAL.");
                    continue;
                }

                LocalDate periodDate;
                try {
                    periodDate = LocalDate.parse(dateRaw);
                } catch (DateTimeParseException e) {
                    errors.add("Ligne " + lineNumber + ": format de date invalide (" + dateRaw + "). Format attendu: YYYY-MM-DD.");
                    continue;
                }

                // Parse features map
                Map<String, Double> featuresMap = new LinkedHashMap<>();
                Map<String, Double> targetsMap = new LinkedHashMap<>();
                boolean parseError = false;

                for (String featCol : featureColNames) {
                    int cIdx = colIndex.get(featCol);
                    if (cIdx < values.length && !values[cIdx].trim().isEmpty()) {
                        try {
                            String numStr = values[cIdx].trim().replace(",", ".");
                            double numVal = Double.parseDouble(numStr);
                            featuresMap.put(featCol, numVal);
                            if (targetColNames.contains(featCol)) {
                                targetsMap.put(featCol, numVal);
                            }
                        } catch (NumberFormatException e) {
                            errors.add("Ligne " + lineNumber + ": valeur numérique invalide pour '" + featCol + "' (" + values[cIdx] + ").");
                            parseError = true;
                            break;
                        }
                    }
                }

                if (parseError) continue;

                // Find or create Bank
                Optional<Bank> bankOpt = bankRepository.findByNameIgnoreCase(bankName);
                Bank bank;
                if (bankOpt.isPresent()) {
                    bank = bankOpt.get();
                    if (!bank.getBankType().equals(bankType) || (country != null && !country.equals(bank.getCountry()))) {
                        bank.setBankType(bankType);
                        if (country != null && !country.isEmpty()) bank.setCountry(country);
                        bank = bankRepository.save(bank);
                        updatedBanks++;
                    }
                } else {
                    bank = Bank.builder()
                            .name(bankName)
                            .country(country)
                            .bankType(bankType)
                            .build();
                    bank = bankRepository.save(bank);
                    newBanks++;
                }

                // Find or update BankObservation
                Optional<BankObservation> obsOpt = bankObservationRepository.findByBankAndPeriodDate(bank, periodDate);
                final Bank finalBank = bank;
                BankObservation obs = obsOpt.orElseGet(() -> BankObservation.builder()
                        .bank(finalBank)
                        .periodDate(periodDate)
                        .build());

                try {
                    obs.setFeaturesJson(objectMapper.writeValueAsString(featuresMap));
                    obs.setTargetJson(objectMapper.writeValueAsString(targetsMap));
                    bankObservationRepository.save(obs);
                    imported++;
                } catch (Exception e) {
                    errors.add("Ligne " + lineNumber + ": erreur sérialisation JSON: " + e.getMessage());
                }
            }

            stats.setTotalRows(total);
            stats.setImportedRows(imported);
            stats.setNewBanksCount(newBanks);
            stats.setUpdatedBanksCount(updatedBanks);
            stats.setErrorCount(errors.size());

            log.info("Import terminé: {} lignes importées sur {}, {} nouvelles banques, {} erreurs",
                    imported, total, newBanks, errors.size());

            return stats;

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Erreur critique lors de l'import CSV : {}", e.getMessage(), e);
            throw new RuntimeException("Échec de traitement du fichier CSV : " + e.getMessage(), e);
        }
    }
}
