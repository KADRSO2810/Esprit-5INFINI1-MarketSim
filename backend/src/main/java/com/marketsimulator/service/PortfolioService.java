package com.marketsimulator.service;

import com.marketsimulator.domain.*;
import com.marketsimulator.dto.PositionDto;
import com.marketsimulator.dto.PortfolioSummaryDto;
import com.marketsimulator.dto.TradeDto;
import com.marketsimulator.repository.*;
import com.marketsimulator.service.market.MarketDataIngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PortfolioService {

    private final PortfolioRepository portfolioRepository;
    private final PositionRepository positionRepository;
    private final TradeRepository tradeRepository;
    private final UserRepository userRepository;
    private final MarketDataIngestionService ingestionService;
    @Lazy private final com.marketsimulator.service.multiasset.MultiAssetMarketService multiAssetMarketService;

    @Value("${app.trading.initial-cash:100000}")
    private BigDecimal initialCash;

    // ── Ensure portfolio exists (auto-create) ─────────────────────────────────

    @Transactional
    public Portfolio ensurePortfolio(Long userId) {
        return ensurePortfolio(userId, 0L);
    }

    @Transactional
    public Portfolio ensurePortfolio(Long userId, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        return portfolioRepository.findByUserIdAndSessionId(userId, sId).orElseGet(() -> {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("User not found: " + userId));
            Portfolio portfolio = Portfolio.builder()
                    .user(user)
                    .sessionId(sId)
                    .cashBalance(initialCash)
                    .build();
            return portfolioRepository.save(portfolio);
        });
    }

    @Transactional
    public PortfolioSummaryDto injectCash(Long userId, Long sessionId, BigDecimal amount, String reason) {
        long sId = (sessionId != null) ? sessionId : 0L;
        Portfolio portfolio = ensurePortfolio(userId, sId);
        if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
            portfolio.setCashBalance(portfolio.getCashBalance().add(amount));
            portfolioRepository.save(portfolio);
        }
        return getSummary(userId, sId);
    }

    // ── Portfolio summary ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PortfolioSummaryDto getSummary(Long userId) {
        return getSummary(userId, 0L);
    }

    @Transactional(readOnly = true)
    public PortfolioSummaryDto getSummary(Long userId, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        Portfolio portfolio = ensurePortfolio(userId, sId);
        List<Position> positions = positionRepository.findByPortfolioId(portfolio.getId());

        BigDecimal cash = portfolio.getCashBalance();
        BigDecimal unrealizedPnl = BigDecimal.ZERO;
        BigDecimal totalMarketValue = BigDecimal.ZERO;

        for (Position pos : positions) {
            BigDecimal lastPrice = resolvePriceForPortfolio(sId, pos.getSymbol());
            if (lastPrice != null) {
                BigDecimal mv = lastPrice.multiply(pos.getQuantity());
                totalMarketValue = totalMarketValue.add(mv);
                BigDecimal cost = pos.getAvgPrice().multiply(pos.getQuantity());
                unrealizedPnl = unrealizedPnl.add(mv.subtract(cost));
            } else {
                BigDecimal mv = pos.getAvgPrice().multiply(pos.getQuantity());
                totalMarketValue = totalMarketValue.add(mv);
            }
        }

        BigDecimal equity = cash.add(totalMarketValue);
        BigDecimal realizedPnl = tradeRepository.sumRealizedPnlByPortfolioId(portfolio.getId());

        return PortfolioSummaryDto.builder()
                .cash(cash.setScale(2, RoundingMode.HALF_UP))
                .equity(equity.setScale(2, RoundingMode.HALF_UP))
                .unrealizedPnl(unrealizedPnl.setScale(2, RoundingMode.HALF_UP))
                .realizedPnl(realizedPnl != null ? realizedPnl.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO)
                .positionsCount(positions.size())
                .updatedAt(Instant.now())
                .build();
    }

    // ── Positions ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PositionDto> listPositions(Long userId) {
        return listPositions(userId, 0L);
    }

    @Transactional(readOnly = true)
    public List<PositionDto> listPositions(Long userId, Long sessionId) {
        long sId = (sessionId != null) ? sessionId : 0L;
        Portfolio portfolio = ensurePortfolio(userId, sId);
        return positionRepository.findByPortfolioId(portfolio.getId()).stream()
                .map(pos -> {
                    BigDecimal resolvedPrice = resolvePriceForPortfolio(sId, pos.getSymbol());
                    BigDecimal lastPrice = (resolvedPrice != null) ? resolvedPrice : pos.getAvgPrice();
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
                })
                .collect(Collectors.toList());
    }

    // ── Trade history ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TradeDto> listTrades(Long userId, int limit) {
        return listTrades(userId, 0L, limit);
    }

    @Transactional(readOnly = true)
    public List<TradeDto> listTrades(Long userId, Long sessionId, int limit) {
        long sId = (sessionId != null) ? sessionId : 0L;
        Portfolio portfolio = ensurePortfolio(userId, sId);
        return tradeRepository.findByPortfolioIdOrderByTsDesc(
                portfolio.getId(),
                PageRequest.of(0, Math.min(limit, 500))
        ).stream()
                .map(t -> TradeDto.builder()
                        .id(t.getId())
                        .symbol(t.getSymbol())
                        .side(t.getSide())
                        .quantity(t.getQuantity())
                        .price(t.getPrice())
                        .fee(t.getFee())
                        .realizedPnl(t.getRealizedPnl())
                        .tradeReason(t.getTradeReason())
                        .ts(t.getTs())
                        .build())
                .collect(Collectors.toList());
    }

    /** Used by RiskService to snapshot all portfolios periodically. */
    public Map<Long, Portfolio> getAllPortfolioIds() {
        return portfolioRepository.findAll().stream()
                .collect(Collectors.toMap(Portfolio::getId, p -> p));
    }

    private BigDecimal resolvePriceForPortfolio(long sessionId, String symbol) {
        var quote = ingestionService.getLatestQuote(symbol);
        if (quote != null) {
            return quote.getPrice();
        }
        if (multiAssetMarketService != null) {
            try {
                return multiAssetMarketService.resolveExecutionPrice(symbol, "SELL");
            } catch (Exception ex) {
                // Ignore fallback to cost basis
            }
        }
        return null;
    }
}
