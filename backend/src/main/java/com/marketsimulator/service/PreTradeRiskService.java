package com.marketsimulator.service;

import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.Position;
import com.marketsimulator.domain.RiskLimit;
import com.marketsimulator.domain.User;
import com.marketsimulator.dto.*;
import com.marketsimulator.exception.NoRecentPriceException;
import com.marketsimulator.exception.ResourceNotFoundException;
import com.marketsimulator.exception.RiskLimitBreachedException;
import com.marketsimulator.repository.PortfolioRepository;
import com.marketsimulator.repository.PositionRepository;
import com.marketsimulator.repository.RiskLimitRepository;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import com.marketsimulator.util.SectorClassificationUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PreTradeRiskService {

    public static final BigDecimal DEFAULT_MAX_RISK_PER_TRADE_PCT = new BigDecimal("2.00");
    public static final BigDecimal DEFAULT_MAX_ASSET_EXPOSURE_PCT = new BigDecimal("20.00");
    public static final BigDecimal DEFAULT_MAX_SECTOR_EXPOSURE_PCT = new BigDecimal("40.00");
    public static final BigDecimal DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT = new BigDecimal("100.00");

    private final RiskLimitRepository riskLimitRepository;
    private final PortfolioRepository portfolioRepository;
    private final PositionRepository positionRepository;
    private final UserRepository userRepository;
    @Lazy private final MarketDataIngestionService ingestionService;
    @Lazy private final PortfolioService portfolioService;
    @Lazy private final com.marketsimulator.service.multiasset.MultiAssetMarketService multiAssetMarketService;

    // =========================================================================
    // 1. Configuration des Limites de Risque (Consultation / Mise à jour)
    // =========================================================================

    @Transactional(readOnly = true)
    public RiskLimitsDto getRiskLimits(Long userId) {
        return riskLimitRepository.findByUserId(userId)
                .map(this::mapToDto)
                .orElseGet(this::getDefaultRiskLimits);
    }

    @Transactional
    public RiskLimitsDto updateRiskLimits(Long userId, RiskLimitsDto dto) {
        if (dto.getMaxRiskPerTradePct() == null || dto.getMaxRiskPerTradePct().compareTo(new BigDecimal("0.10")) < 0 || dto.getMaxRiskPerTradePct().compareTo(new BigDecimal("20.00")) > 0) {
            throw new IllegalArgumentException("Le risque par transaction doit être compris entre 0.10% et 20.00%");
        }
        if (dto.getMaxAssetExposurePct() == null || dto.getMaxAssetExposurePct().compareTo(new BigDecimal("1.00")) < 0 || dto.getMaxAssetExposurePct().compareTo(new BigDecimal("100.00")) > 0) {
            throw new IllegalArgumentException("L'exposition max par actif doit être comprise entre 1.00% et 100.00%");
        }
        if (dto.getMaxSectorExposurePct() == null || dto.getMaxSectorExposurePct().compareTo(new BigDecimal("1.00")) < 0 || dto.getMaxSectorExposurePct().compareTo(new BigDecimal("100.00")) > 0) {
            throw new IllegalArgumentException("L'exposition max par secteur doit être comprise entre 1.00% et 100.00%");
        }
        if (dto.getMaxPortfolioExposurePct() == null || dto.getMaxPortfolioExposurePct().compareTo(new BigDecimal("10.00")) < 0 || dto.getMaxPortfolioExposurePct().compareTo(new BigDecimal("200.00")) > 0) {
            throw new IllegalArgumentException("L'exposition totale max doit être comprise entre 10.00% et 200.00%");
        }

        RiskLimit limit = riskLimitRepository.findByUserIdWithLock(userId).orElseGet(() -> {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Utilisateur non trouvé: " + userId));
            return RiskLimit.builder().user(user).build();
        });

        limit.setMaxRiskPerTradePct(dto.getMaxRiskPerTradePct().setScale(2, RoundingMode.HALF_UP));
        limit.setMaxAssetExposurePct(dto.getMaxAssetExposurePct().setScale(2, RoundingMode.HALF_UP));
        limit.setMaxSectorExposurePct(dto.getMaxSectorExposurePct().setScale(2, RoundingMode.HALF_UP));
        limit.setMaxPortfolioExposurePct(dto.getMaxPortfolioExposurePct().setScale(2, RoundingMode.HALF_UP));

        RiskLimit saved = riskLimitRepository.save(limit);
        log.info("[RISK LIMITS UPDATED] userId={} Risk/Trade={} AssetExp={} SectorExp={} PortExp={}",
                userId, saved.getMaxRiskPerTradePct(), saved.getMaxAssetExposurePct(),
                saved.getMaxSectorExposurePct(), saved.getMaxPortfolioExposurePct());

        return mapToDto(saved);
    }

    // =========================================================================
    // 2. Calculateur de Dimensionnement de Position (Position Sizing Calculator)
    // =========================================================================

    @Transactional(readOnly = true)
    public PositionSizingResponse calculatePositionSize(Long userId, PositionSizingRequest request) {
        long sId = request.getSessionId() != null ? request.getSessionId() : 0L;
        String symbol = request.getSymbol().trim().toUpperCase(Locale.ROOT);

        BigDecimal price = resolvePrice(symbol, request.getEntryPrice());
        if (price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Prix d'entrée invalide ou indisponible pour " + symbol);
        }

        BigDecimal sl = request.getStopLoss();
        if (sl == null || sl.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Un Stop-Loss strictement positif est obligatoire pour le calcul de dimensionnement");
        }
        if (sl.compareTo(price) == 0) {
            throw new IllegalArgumentException("Le Stop-Loss ne peut pas être exactement égal au cours d'entrée");
        }

        RiskLimitsDto limits = getRiskLimits(userId);
        BigDecimal riskPct = request.getRiskPercentage() != null ? request.getRiskPercentage() : limits.getMaxRiskPerTradePct();

        Portfolio portfolio = portfolioService.ensurePortfolio(userId, sId);
        List<Position> positions = positionRepository.findByPortfolioId(portfolio.getId());

        BigDecimal cash = portfolio.getCashBalance();
        BigDecimal totalPositionMv = BigDecimal.ZERO;
        BigDecimal existingAssetMv = BigDecimal.ZERO;

        for (Position pos : positions) {
            BigDecimal posPrice = resolvePrice(pos.getSymbol(), null);
            BigDecimal mv = pos.getQuantity().multiply(posPrice);
            totalPositionMv = totalPositionMv.add(mv);
            if (pos.getSymbol().equalsIgnoreCase(symbol)) {
                existingAssetMv = mv;
            }
        }

        BigDecimal equity = cash.add(totalPositionMv);
        if (equity.compareTo(BigDecimal.ZERO) <= 0) {
            equity = cash.max(BigDecimal.ZERO);
        }

        // Formules quantitatives
        BigDecimal riskBudget = equity.multiply(riskPct).divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
        BigDecimal riskPerUnit = price.subtract(sl).abs().setScale(6, RoundingMode.HALF_UP);

        BigDecimal maxQtyByRisk = riskPerUnit.compareTo(BigDecimal.ZERO) > 0
                ? riskBudget.divide(riskPerUnit, 6, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal maxQtyByCash = price.compareTo(BigDecimal.ZERO) > 0
                ? cash.divide(price, 6, RoundingMode.HALF_DOWN)
                : BigDecimal.ZERO;

        BigDecimal maxAssetBudget = equity.multiply(limits.getMaxAssetExposurePct()).divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
        BigDecimal remainingAssetBudget = maxAssetBudget.subtract(existingAssetMv).max(BigDecimal.ZERO);
        BigDecimal maxQtyByAsset = price.compareTo(BigDecimal.ZERO) > 0
                ? remainingAssetBudget.divide(price, 6, RoundingMode.HALF_DOWN)
                : BigDecimal.ZERO;

        BigDecimal suggestedQty = maxQtyByRisk.min(maxQtyByCash).min(maxQtyByAsset).max(BigDecimal.ZERO);
        suggestedQty = sanitizeQuantity(symbol, suggestedQty);

        String explanation = String.format(
                "Budget de Risque: $%.2f (%.2f%% d'Equity $%.2f) | Risque Unitaire: $%.4f/action | Max par Risque: %.4f | Max par Liquidités: %.4f | Max par Limite Actif: %.4f",
                riskBudget, riskPct, equity, riskPerUnit, maxQtyByRisk, maxQtyByCash, maxQtyByAsset
        );

        return PositionSizingResponse.builder()
                .symbol(symbol)
                .portfolioEquity(equity.setScale(2, RoundingMode.HALF_UP))
                .riskPercentage(riskPct.setScale(2, RoundingMode.HALF_UP))
                .riskBudget(riskBudget.setScale(2, RoundingMode.HALF_UP))
                .entryPrice(price.setScale(4, RoundingMode.HALF_UP))
                .stopLoss(sl.setScale(4, RoundingMode.HALF_UP))
                .riskPerUnit(riskPerUnit.setScale(4, RoundingMode.HALF_UP))
                .maxQuantityByRisk(maxQtyByRisk.setScale(4, RoundingMode.HALF_UP))
                .maxQuantityByCash(maxQtyByCash.setScale(4, RoundingMode.HALF_UP))
                .maxQuantityByAssetExposure(maxQtyByAsset.setScale(4, RoundingMode.HALF_UP))
                .suggestedQuantity(suggestedQty)
                .formulaExplanation(explanation)
                .build();
    }

    // =========================================================================
    // 3. Moteur d'Analyse et de Décision Pré-Trade (Pre-Trade Risk Engine)
    // =========================================================================

    @Transactional(readOnly = true)
    public PreTradeRiskResponse assessPreTradeRisk(Long userId, PreTradeRiskRequest request) {
        long sId = request.getSessionId() != null ? request.getSessionId() : 0L;
        String symbol = request.getSymbol().trim().toUpperCase(Locale.ROOT);
        String side = request.getSide().trim().toUpperCase(Locale.ROOT);
        BigDecimal quantity = request.getQuantity();

        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("La quantité doit être strictement positive");
        }

        BigDecimal price = resolvePrice(symbol, request.getPrice());
        BigDecimal orderNotional = price.multiply(quantity).setScale(2, RoundingMode.HALF_UP);

        Portfolio portfolio = portfolioService.ensurePortfolio(userId, sId);
        List<Position> positions = positionRepository.findByPortfolioId(portfolio.getId());
        RiskLimitsDto limits = getRiskLimits(userId);

        BigDecimal cash = portfolio.getCashBalance();
        BigDecimal currentPortfolioExposure = BigDecimal.ZERO;
        BigDecimal currentAssetExposure = BigDecimal.ZERO;
        BigDecimal currentSectorExposure = BigDecimal.ZERO;
        String targetSector = SectorClassificationUtil.getSector(symbol);
        Position existingPosition = null;

        for (Position pos : positions) {
            BigDecimal posPrice = resolvePrice(pos.getSymbol(), null);
            BigDecimal mv = pos.getQuantity().multiply(posPrice);
            currentPortfolioExposure = currentPortfolioExposure.add(mv);

            if (pos.getSymbol().equalsIgnoreCase(symbol)) {
                existingPosition = pos;
                currentAssetExposure = currentAssetExposure.add(mv);
            }
            if (SectorClassificationUtil.getSector(pos.getSymbol()).equalsIgnoreCase(targetSector)) {
                currentSectorExposure = currentSectorExposure.add(mv);
            }
        }

        BigDecimal equity = cash.add(currentPortfolioExposure);
        if (equity.compareTo(BigDecimal.ZERO) <= 0) {
            equity = cash.max(BigDecimal.ZERO);
        }

        BigDecimal currentPortfolioExposurePct = toPercentage(currentPortfolioExposure, equity);
        BigDecimal currentAssetExposurePct = toPercentage(currentAssetExposure, equity);
        BigDecimal currentSectorExposurePct = toPercentage(currentSectorExposure, equity);

        // Simulation post-trade
        BigDecimal cashAfter;
        BigDecimal newPortfolioExposure;
        BigDecimal newAssetExposure;
        BigDecimal newSectorExposure;

        if ("BUY".equals(side)) {
            cashAfter = cash.subtract(orderNotional).setScale(2, RoundingMode.HALF_UP);
            newPortfolioExposure = currentPortfolioExposure.add(orderNotional).setScale(2, RoundingMode.HALF_UP);
            newAssetExposure = currentAssetExposure.add(orderNotional).setScale(2, RoundingMode.HALF_UP);
            newSectorExposure = currentSectorExposure.add(orderNotional).setScale(2, RoundingMode.HALF_UP);
        } else { // SELL
            BigDecimal sellQty = quantity.min(existingPosition != null ? existingPosition.getQuantity() : BigDecimal.ZERO);
            BigDecimal soldMv = sellQty.multiply(price).setScale(2, RoundingMode.HALF_UP);
            cashAfter = cash.add(soldMv).setScale(2, RoundingMode.HALF_UP);
            newPortfolioExposure = currentPortfolioExposure.subtract(soldMv).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            newAssetExposure = currentAssetExposure.subtract(soldMv).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            newSectorExposure = currentSectorExposure.subtract(soldMv).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal newPortfolioExposurePct = toPercentage(newPortfolioExposure, equity);
        BigDecimal newAssetExposurePct = toPercentage(newAssetExposure, equity);
        BigDecimal newSectorExposurePct = toPercentage(newSectorExposure, equity);
        BigDecimal positionSizePct = toPercentage(orderNotional, equity);

        // Analyse Stop-Loss / Take-Profit
        BigDecimal sl = request.getStopLoss();
        BigDecimal tp = request.getTakeProfit();
        BigDecimal potentialLoss = null;
        BigDecimal riskPerTradePct = null;
        BigDecimal potentialProfit = null;
        BigDecimal riskRewardRatio = null;

        if ("BUY".equals(side)) {
            if (sl != null && price.compareTo(sl) > 0) {
                potentialLoss = price.subtract(sl).multiply(quantity).setScale(2, RoundingMode.HALF_UP);
                riskPerTradePct = toPercentage(potentialLoss, equity);
            }
            if (tp != null && tp.compareTo(price) > 0) {
                potentialProfit = tp.subtract(price).multiply(quantity).setScale(2, RoundingMode.HALF_UP);
            }
            if (potentialLoss != null && potentialProfit != null && potentialLoss.compareTo(BigDecimal.ZERO) > 0) {
                riskRewardRatio = potentialProfit.divide(potentialLoss, 2, RoundingMode.HALF_UP);
            }
        }

        // Evaluation des règles décisionnelles
        List<String> rejections = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<String> reasons = new ArrayList<>();

        if ("BUY".equals(side)) {
            // Rejets stricts
            if (cashAfter.compareTo(BigDecimal.ZERO) < 0) {
                rejections.add(String.format("Liquidités insuffisantes : requis $%.2f, disponible $%.2f (déficit de $%.2f)",
                        orderNotional, cash, cashAfter.abs()));
            }
            if (newAssetExposurePct.compareTo(limits.getMaxAssetExposurePct()) > 0) {
                rejections.add(String.format("Dépassement de la limite d'exposition par actif sur %s : %.2f%% après transaction (limite maximale autorisée : %.2f%%)",
                        symbol, newAssetExposurePct, limits.getMaxAssetExposurePct()));
            }
            if (newPortfolioExposurePct.compareTo(limits.getMaxPortfolioExposurePct()) > 0) {
                rejections.add(String.format("Dépassement de l'exposition globale du portefeuille : %.2f%% après transaction (limite maximale autorisée : %.2f%%)",
                        newPortfolioExposurePct, limits.getMaxPortfolioExposurePct()));
            }
            if (newSectorExposurePct.compareTo(limits.getMaxSectorExposurePct()) > 0) {
                rejections.add(String.format("Dépassement de la limite sectorielle (%s) : %.2f%% après transaction (limite maximale autorisée : %.2f%%)",
                        targetSector, newSectorExposurePct, limits.getMaxSectorExposurePct()));
            }
            if (riskPerTradePct != null && riskPerTradePct.compareTo(limits.getMaxRiskPerTradePct()) > 0) {
                rejections.add(String.format("Risque par transaction excessif : perte potentielle de %.2f%% de l'equity (limite max configurée : %.2f%%)",
                        riskPerTradePct, limits.getMaxRiskPerTradePct()));
            }

            // Avertissements
            if (sl == null) {
                warnings.add("Aucun Stop-Loss configuré : Risque non borné en cas de retournement violent du marché.");
            }
            if (rejections.isEmpty() && newAssetExposurePct.compareTo(limits.getMaxAssetExposurePct().multiply(new BigDecimal("0.75"))) > 0) {
                warnings.add(String.format("Forte concentration sur l'actif %s : %.2f%% du portefeuille.", symbol, newAssetExposurePct));
            }
            if (rejections.isEmpty() && newPortfolioExposurePct.compareTo(limits.getMaxPortfolioExposurePct().multiply(new BigDecimal("0.85"))) > 0) {
                warnings.add(String.format("Exposition globale élevée : le portefeuille sera investi à %.2f%% de ses fonds propres.", newPortfolioExposurePct));
            }
            if (riskRewardRatio != null && riskRewardRatio.compareTo(BigDecimal.ONE) < 0) {
                warnings.add(String.format("Ratio Risque/Gain asymétrique défavorable : 1:%.2f (< 1:1.00).", riskRewardRatio));
            }
            if (rejections.isEmpty() && cashAfter.compareTo(equity.multiply(new BigDecimal("0.05"))) < 0) {
                warnings.add("Coussin de trésorerie faible : Moins de 5% de liquidités après exécution de l'ordre.");
            }
        } else { // SELL
            if (existingPosition == null || existingPosition.getQuantity().compareTo(quantity) < 0) {
                BigDecimal owned = existingPosition != null ? existingPosition.getQuantity() : BigDecimal.ZERO;
                rejections.add(String.format("Position insuffisante pour vendre : possédé %.6f, demandé %.6f", owned, quantity));
            }
        }

        String decision;
        if (!rejections.isEmpty()) {
            decision = "REJECTED";
            reasons.addAll(rejections);
        } else if (!warnings.isEmpty()) {
            decision = "WARNING";
            reasons.addAll(warnings);
        } else {
            decision = "APPROVED";
            reasons.add("Ordre conforme à toutes les politiques et limites institutionnelles de gestion du risque.");
        }

        // Calcul de l'exposition restante disponible
        BigDecimal maxAssetBudget = equity.multiply(limits.getMaxAssetExposurePct()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal remainingAssetBudget = maxAssetBudget.subtract(currentAssetExposure).max(BigDecimal.ZERO);
        BigDecimal maxPortfolioBudget = equity.multiply(limits.getMaxPortfolioExposurePct()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal remainingPortfolioBudget = maxPortfolioBudget.subtract(currentPortfolioExposure).max(BigDecimal.ZERO);
        BigDecimal remainingExposure = remainingAssetBudget.min(remainingPortfolioBudget).min(cash).max(BigDecimal.ZERO);

        // Quantité maximale suggérée
        BigDecimal suggestedMaxQty;
        if ("BUY".equals(side)) {
            if (sl != null && price.compareTo(sl) > 0) {
                BigDecimal riskBudget = equity.multiply(limits.getMaxRiskPerTradePct()).divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
                BigDecimal riskPerUnit = price.subtract(sl);
                BigDecimal qtyByRisk = riskBudget.divide(riskPerUnit, 6, RoundingMode.HALF_UP);
                BigDecimal qtyByBudget = price.compareTo(BigDecimal.ZERO) > 0 ? remainingExposure.divide(price, 6, RoundingMode.HALF_DOWN) : BigDecimal.ZERO;
                suggestedMaxQty = sanitizeQuantity(symbol, qtyByRisk.min(qtyByBudget).max(BigDecimal.ZERO));
            } else {
                suggestedMaxQty = price.compareTo(BigDecimal.ZERO) > 0
                        ? sanitizeQuantity(symbol, remainingExposure.divide(price, 6, RoundingMode.HALF_DOWN))
                        : BigDecimal.ZERO;
            }
        } else {
            suggestedMaxQty = existingPosition != null ? existingPosition.getQuantity() : BigDecimal.ZERO;
        }

        return PreTradeRiskResponse.builder()
                .decision(decision)
                .orderNotional(orderNotional)
                .currentCash(cash.setScale(2, RoundingMode.HALF_UP))
                .cashAfter(cashAfter.setScale(2, RoundingMode.HALF_UP))
                .portfolioEquity(equity.setScale(2, RoundingMode.HALF_UP))
                .currentPortfolioExposure(currentPortfolioExposure.setScale(2, RoundingMode.HALF_UP))
                .currentPortfolioExposurePct(currentPortfolioExposurePct)
                .newPortfolioExposure(newPortfolioExposure.setScale(2, RoundingMode.HALF_UP))
                .newPortfolioExposurePct(newPortfolioExposurePct)
                .currentAssetExposure(currentAssetExposure.setScale(2, RoundingMode.HALF_UP))
                .currentAssetExposurePct(currentAssetExposurePct)
                .newAssetExposure(newAssetExposure.setScale(2, RoundingMode.HALF_UP))
                .newAssetExposurePct(newAssetExposurePct)
                .sector(targetSector)
                .currentSectorExposurePct(currentSectorExposurePct)
                .newSectorExposurePct(newSectorExposurePct)
                .potentialLoss(potentialLoss)
                .riskPerTradePct(riskPerTradePct)
                .potentialProfit(potentialProfit)
                .riskRewardRatio(riskRewardRatio)
                .positionSizePct(positionSizePct)
                .remainingAvailableExposure(remainingExposure.setScale(2, RoundingMode.HALF_UP))
                .suggestedMaxQuantity(suggestedMaxQty)
                .limits(limits)
                .reasons(reasons)
                .warnings(warnings)
                .rejections(rejections)
                .build();
    }

    // =========================================================================
    // 4. Validation Serveur Autoritatisée Avant Exécution
    // =========================================================================

    public void validateOrderOrThrow(Long userId, MarketOrderRequest request, Long sessionId, BigDecimal executionPrice) {
        PreTradeRiskRequest preTradeReq = PreTradeRiskRequest.builder()
                .symbol(request.getSymbol())
                .side(request.getSide())
                .quantity(request.getQuantity())
                .price(executionPrice)
                .stopLoss(request.getStopLoss())
                .takeProfit(request.getTakeProfit())
                .sessionId(sessionId)
                .build();

        PreTradeRiskResponse response = assessPreTradeRisk(userId, preTradeReq);
        if ("REJECTED".equalsIgnoreCase(response.getDecision())) {
            String combined = String.join(" | ", response.getRejections());
            log.warn("[PRE-TRADE RISK BLOCKED] userId={} symbol={} side={} qty={} -> {}",
                    userId, request.getSymbol(), request.getSide(), request.getQuantity(), combined);
            throw new RiskLimitBreachedException("Ordre refusé par les règles de gestion du risque : " + combined, response.getRejections());
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private BigDecimal resolvePrice(String symbol, BigDecimal overridePrice) {
        if (overridePrice != null && overridePrice.compareTo(BigDecimal.ZERO) > 0) {
            return overridePrice;
        }
        var quote = ingestionService.getLatestQuote(symbol);
        if (quote != null && quote.getPrice() != null && quote.getPrice().compareTo(BigDecimal.ZERO) > 0) {
            return quote.getPrice();
        }
        if (multiAssetMarketService != null) {
            try {
                return multiAssetMarketService.resolveExecutionPrice(symbol, "BUY");
            } catch (Throwable ex) {
                // fall through
            }
        }
        throw new NoRecentPriceException("Aucune cotation temps réel disponible pour: " + symbol);
    }

    private BigDecimal toPercentage(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) <= 0 || numerator == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return numerator.divide(denominator, 6, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal sanitizeQuantity(String symbol, BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        boolean isCrypto = symbol.startsWith("BINANCE:") || symbol.contains("BTC") || symbol.contains("ETH") || symbol.contains("SOL");
        return isCrypto ? qty.setScale(4, RoundingMode.DOWN) : qty.setScale(2, RoundingMode.DOWN);
    }

    private RiskLimitsDto mapToDto(RiskLimit limit) {
        return RiskLimitsDto.builder()
                .maxRiskPerTradePct(limit.getMaxRiskPerTradePct())
                .maxAssetExposurePct(limit.getMaxAssetExposurePct())
                .maxSectorExposurePct(limit.getMaxSectorExposurePct())
                .maxPortfolioExposurePct(limit.getMaxPortfolioExposurePct())
                .build();
    }

    public RiskLimitsDto getDefaultRiskLimits() {
        return RiskLimitsDto.builder()
                .maxRiskPerTradePct(DEFAULT_MAX_RISK_PER_TRADE_PCT)
                .maxAssetExposurePct(DEFAULT_MAX_ASSET_EXPOSURE_PCT)
                .maxSectorExposurePct(DEFAULT_MAX_SECTOR_EXPOSURE_PCT)
                .maxPortfolioExposurePct(DEFAULT_MAX_PORTFOLIO_EXPOSURE_PCT)
                .build();
    }
}
