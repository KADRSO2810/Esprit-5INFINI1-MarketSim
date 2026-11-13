package com.marketsimulator.service;

import com.marketsimulator.domain.Portfolio;
import com.marketsimulator.domain.Position;
import com.marketsimulator.dto.OrderFillDto;
import com.marketsimulator.dto.PositionDto;
import com.marketsimulator.dto.SlTpTriggerEvent;
import com.marketsimulator.exception.InsufficientPositionException;
import com.marketsimulator.repository.PortfolioRepository;
import com.marketsimulator.repository.PositionRepository;
import com.marketsimulator.service.market.MarketDataIngestionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

@Slf4j
@Service
public class StopLossTakeProfitService {

    private final PositionRepository positionRepository;
    private final PortfolioRepository portfolioRepository;
    private final MarketDataIngestionService ingestionService;
    private final SimpMessagingTemplate messagingTemplate;
    private final OrderService orderService;
    private final PortfolioService portfolioService;
    private final TransactionTemplate transactionTemplate;

    public StopLossTakeProfitService(
            PositionRepository positionRepository,
            PortfolioRepository portfolioRepository,
            @Lazy MarketDataIngestionService ingestionService,
            SimpMessagingTemplate messagingTemplate,
            @Lazy OrderService orderService,
            @Lazy PortfolioService portfolioService) {
        this(positionRepository, portfolioRepository, ingestionService, messagingTemplate, orderService, portfolioService, null);
    }

    @Autowired
    public StopLossTakeProfitService(
            PositionRepository positionRepository,
            PortfolioRepository portfolioRepository,
            @Lazy MarketDataIngestionService ingestionService,
            SimpMessagingTemplate messagingTemplate,
            @Lazy OrderService orderService,
            @Lazy PortfolioService portfolioService,
            @Autowired(required = false) PlatformTransactionManager transactionManager) {
        this.positionRepository = positionRepository;
        this.portfolioRepository = portfolioRepository;
        this.ingestionService = ingestionService;
        this.messagingTemplate = messagingTemplate;
        this.orderService = orderService;
        this.portfolioService = portfolioService;
        if (transactionManager != null) {
            TransactionTemplate tt = new TransactionTemplate(transactionManager);
            tt.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            this.transactionTemplate = tt;
        } else {
            this.transactionTemplate = null;
        }
    }

    // =========================================================================
    // 1. Mise à jour / Configuration de SL & TP sur une position existante
    // =========================================================================

    @Transactional
    public PositionDto updateSlTp(Long userId, String symbol, BigDecimal stopLoss, BigDecimal takeProfit, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        String normalizedSymbol = symbol.trim().toUpperCase();

        Portfolio portfolio = (sId == 0L ? portfolioRepository.findByUserIdWithLock(userId) : portfolioRepository.findByUserIdAndSessionIdWithLock(userId, sId))
                .orElseThrow(() -> new RuntimeException("Portefeuille introuvable pour l'utilisateur: " + userId));

        Position position = positionRepository
                .findByPortfolioIdAndSymbolWithLock(portfolio.getId(), normalizedSymbol)
                .orElseThrow(() -> new InsufficientPositionException("Aucune position ouverte trouvée pour le symbole: " + normalizedSymbol));

        if (position.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new InsufficientPositionException("La position pour " + normalizedSymbol + " est déjà clôturée.");
        }

        // Résolution du prix de référence actuel
        var quote = ingestionService.getLatestQuote(normalizedSymbol);
        BigDecimal currentPrice = (quote != null) ? quote.getPrice() : position.getAvgPrice();

        // Validation du Stop-Loss pour position LONG
        if (stopLoss != null) {
            if (stopLoss.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Le Stop-Loss doit être strictement positif.");
            }
            if (stopLoss.compareTo(currentPrice) >= 0) {
                throw new IllegalArgumentException(
                        String.format("Le Stop-Loss ($%.4f) doit être strictement inférieur au cours actuel ($%.4f).", stopLoss, currentPrice));
            }
        }

        // Validation du Take-Profit pour position LONG
        if (takeProfit != null) {
            if (takeProfit.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Le Take-Profit doit être strictement positif.");
            }
            if (takeProfit.compareTo(currentPrice) <= 0) {
                throw new IllegalArgumentException(
                        String.format("Le Take-Profit ($%.4f) doit être strictement supérieur au cours actuel ($%.4f).", takeProfit, currentPrice));
            }
        }

        if (stopLoss != null && takeProfit != null && stopLoss.compareTo(takeProfit) >= 0) {
            throw new IllegalArgumentException("Le Stop-Loss doit être strictement inférieur au Take-Profit.");
        }

        position.setStopLoss(stopLoss != null ? stopLoss.setScale(6, RoundingMode.HALF_UP) : null);
        position.setTakeProfit(takeProfit != null ? takeProfit.setScale(6, RoundingMode.HALF_UP) : null);
        positionRepository.save(position);

        log.info("[SL/TP CONFIG] userId={} symbol={} SL={} TP={} (currentPrice={})",
                userId, normalizedSymbol, stopLoss, takeProfit, currentPrice);

        return mapToDto(position, currentPrice);
    }

    // =========================================================================
    // 2. Suppression de SL & TP sur une position existante
    // =========================================================================

    @Transactional
    public PositionDto removeSlTp(Long userId, String symbol, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        String normalizedSymbol = symbol.trim().toUpperCase();

        Portfolio portfolio = (sId == 0L ? portfolioRepository.findByUserIdWithLock(userId) : portfolioRepository.findByUserIdAndSessionIdWithLock(userId, sId))
                .orElseThrow(() -> new RuntimeException("Portefeuille introuvable pour l'utilisateur: " + userId));

        Position position = positionRepository
                .findByPortfolioIdAndSymbolWithLock(portfolio.getId(), normalizedSymbol)
                .orElseThrow(() -> new InsufficientPositionException("Aucune position ouverte trouvée pour le symbole: " + normalizedSymbol));

        position.setStopLoss(null);
        position.setTakeProfit(null);
        positionRepository.save(position);

        log.info("[SL/TP REMOVED] userId={} symbol={}", userId, normalizedSymbol);

        var quote = ingestionService.getLatestQuote(normalizedSymbol);
        BigDecimal currentPrice = (quote != null) ? quote.getPrice() : position.getAvgPrice();
        return mapToDto(position, currentPrice);
    }

    // =========================================================================
    // 3. Évaluation en continu lors de l'arrivée d'une cotation de marché
    // =========================================================================

    public void evaluateQuote(String symbol, BigDecimal marketPrice, Instant timestamp) {
        if (symbol == null || marketPrice == null || marketPrice.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }

        String normalizedSymbol = symbol.trim().toUpperCase();
        List<Position> candidates = positionRepository.findActiveWithSlTpBySymbol(normalizedSymbol);
        if (candidates.isEmpty()) {
            return;
        }

        for (Position candidate : candidates) {
            try {
                processCandidateTrigger(candidate.getId(), normalizedSymbol, marketPrice, timestamp);
            } catch (Exception ex) {
                log.error("[SL/TP EVAL ERROR] Position id={} symbol={}: {}",
                        candidate.getId(), normalizedSymbol, ex.getMessage(), ex);
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processCandidateTrigger(Long positionId, String symbol, BigDecimal marketPrice, Instant timestamp) {
        SlTpTriggerEvent event;
        if (transactionTemplate != null) {
            event = transactionTemplate.execute(status -> doProcessCandidateTrigger(positionId, symbol, marketPrice, timestamp));
        } else {
            event = doProcessCandidateTrigger(positionId, symbol, marketPrice, timestamp);
        }

        // Diffusion temps réel via WebSocket STOMP après confirmation et commit de la transaction
        if (event != null) {
            try {
                messagingTemplate.convertAndSend("/topic/sl-tp-triggers", event);
                log.info("[STOMP BROADCAST] /topic/sl-tp-triggers : {}", event);
            } catch (Exception ex) {
                log.error("[STOMP ERROR] Échec de diffusion du trigger SL/TP : {}", ex.getMessage());
            }
        }
    }

    private SlTpTriggerEvent doProcessCandidateTrigger(Long positionId, String symbol, BigDecimal marketPrice, Instant timestamp) {
        var posOpt = positionRepository.findByIdWithLock(positionId);
        if (posOpt.isEmpty()) {
            return null; // Position déjà clôturée ou supprimée
        }

        Position position = posOpt.get();
        if (position.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        BigDecimal sl = position.getStopLoss();
        BigDecimal tp = position.getTakeProfit();
        String triggerType = null;
        BigDecimal triggerPrice = null;

        // Condition Stop-Loss : cours actuel <= seuil SL
        if (sl != null && marketPrice.compareTo(sl) <= 0) {
            triggerType = "STOP_LOSS";
            triggerPrice = sl;
        }
        // Condition Take-Profit : cours actuel >= seuil TP
        else if (tp != null && marketPrice.compareTo(tp) >= 0) {
            triggerType = "TAKE_PROFIT";
            triggerPrice = tp;
        }

        if (triggerType == null) {
            return null; // Aucun seuil franchi
        }

        Long userId = position.getPortfolio().getUser().getId();
        Long sessionId = position.getPortfolio().getSessionId();
        BigDecimal quantity = position.getQuantity();

        // Exécution de l'ordre simulé de fermeture au prix réel du marché
        OrderFillDto fill = orderService.executeSlTpOrder(
                userId,
                symbol,
                quantity,
                marketPrice,
                triggerType,
                sessionId
        );

        String message = "STOP_LOSS".equals(triggerType)
                ? String.format("Protection Stop-Loss déclenchée : Vente de %s %s @ $%.4f", quantity, symbol, marketPrice)
                : String.format("Objectif Take-Profit atteint : Vente de %s %s @ $%.4f (+PnL: $%.2f)", quantity, symbol, marketPrice, fill.getRealizedPnl());

        return SlTpTriggerEvent.builder()
                .userId(userId)
                .sessionId(sessionId)
                .symbol(symbol)
                .triggerType(triggerType)
                .triggerPrice(triggerPrice)
                .executionPrice(marketPrice)
                .quantity(quantity)
                .realizedPnl(fill.getRealizedPnl())
                .cashAfter(fill.getCashAfter())
                .message(message)
                .timestamp(timestamp != null ? timestamp : Instant.now())
                .build();
    }

    // =========================================================================
    // Helper : Mapping Position -> PositionDto
    // =========================================================================

    private PositionDto mapToDto(Position pos, BigDecimal lastPrice) {
        BigDecimal mv = lastPrice.multiply(pos.getQuantity());
        BigDecimal cost = pos.getAvgPrice().multiply(pos.getQuantity());
        BigDecimal pnl = mv.subtract(cost);
        BigDecimal pnlPct = cost.compareTo(BigDecimal.ZERO) != 0
                ? pnl.divide(cost, 6, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100))
                : BigDecimal.ZERO;

        BigDecimal sl = pos.getStopLoss();
        BigDecimal tp = pos.getTakeProfit();
        BigDecimal potentialLoss = null;
        BigDecimal potentialProfit = null;
        BigDecimal riskReward = null;
        BigDecimal slDistPct = null;
        BigDecimal tpDistPct = null;

        if (sl != null) {
            potentialLoss = pos.getAvgPrice().subtract(sl).multiply(pos.getQuantity()).setScale(2, RoundingMode.HALF_UP);
            if (lastPrice.compareTo(BigDecimal.ZERO) > 0) {
                slDistPct = lastPrice.subtract(sl).divide(lastPrice, 6, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
            }
        }

        if (tp != null) {
            potentialProfit = tp.subtract(pos.getAvgPrice()).multiply(pos.getQuantity()).setScale(2, RoundingMode.HALF_UP);
            if (lastPrice.compareTo(BigDecimal.ZERO) > 0) {
                tpDistPct = tp.subtract(lastPrice).divide(lastPrice, 6, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100)).setScale(2, RoundingMode.HALF_UP);
            }
        }

        if (potentialLoss != null && potentialProfit != null && potentialLoss.compareTo(BigDecimal.ZERO) > 0) {
            riskReward = potentialProfit.divide(potentialLoss, 2, RoundingMode.HALF_UP);
        }

        String status = "NONE";
        if (sl != null && tp != null) {
            status = "ACTIVE";
        } else if (sl != null) {
            status = "SL_ONLY";
        } else if (tp != null) {
            status = "TP_ONLY";
        }

        return PositionDto.builder()
                .symbol(pos.getSymbol())
                .quantity(pos.getQuantity())
                .avgPrice(pos.getAvgPrice().setScale(6, RoundingMode.HALF_UP))
                .lastPrice(lastPrice.setScale(6, RoundingMode.HALF_UP))
                .marketValue(mv.setScale(2, RoundingMode.HALF_UP))
                .unrealizedPnl(pnl.setScale(2, RoundingMode.HALF_UP))
                .unrealizedPnlPercent(pnlPct.setScale(2, RoundingMode.HALF_UP))
                .stopLoss(sl != null ? sl.setScale(6, RoundingMode.HALF_UP) : null)
                .takeProfit(tp != null ? tp.setScale(6, RoundingMode.HALF_UP) : null)
                .potentialLoss(potentialLoss)
                .potentialProfit(potentialProfit)
                .riskRewardRatio(riskReward)
                .slDistancePercent(slDistPct)
                .tpDistancePercent(tpDistPct)
                .slTpStatus(status)
                .build();
    }
}
