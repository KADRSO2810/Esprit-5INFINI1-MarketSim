package com.marketsimulator.controller;

import com.marketsimulator.domain.LimitOrder;
import com.marketsimulator.dto.MarketOrderRequest;
import com.marketsimulator.dto.OrderFillDto;
import com.marketsimulator.dto.orderbook.OrderBookDto;
import com.marketsimulator.repository.UserRepository;
import com.marketsimulator.service.OrderBookService;
import com.marketsimulator.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@Tag(name = "Orders", description = "Paper trading order execution and order book")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {

    private final OrderService orderService;
    private final OrderBookService orderBookService;
    private final UserRepository userRepository;

    @Operation(summary = "Place an order (MARKET or LIMIT)")
    @PostMapping("/market")
    public ResponseEntity<OrderFillDto> placeOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") Long sessionId,
            @Valid @RequestBody MarketOrderRequest request) {
        Long userId = getUserId(userDetails);

        if ("LIMIT".equalsIgnoreCase(request.getOrderType())) {
            LimitOrder limitOrder = orderBookService.placeLimitOrder(userId, request, sessionId);
            OrderFillDto fill = OrderFillDto.builder()
                    .status("PENDING")
                    .symbol(limitOrder.getSymbol())
                    .side(limitOrder.getSide())
                    .quantity(limitOrder.getQuantity())
                    .price(limitOrder.getLimitPrice())
                    .stopLoss(limitOrder.getStopLoss())
                    .takeProfit(limitOrder.getTakeProfit())
                    .tradeReason("LIMIT_ORDER_PLACED")
                    .build();
            return ResponseEntity.ok(fill);
        }

        OrderFillDto fill = orderService.placeMarketOrder(userId, request, sessionId);
        return ResponseEntity.ok(fill);
    }

    @Operation(summary = "Get Level 2 order book market depth")
    @GetMapping("/orderbook")
    public ResponseEntity<OrderBookDto> getOrderBook(@RequestParam(defaultValue = "AAPL") String symbol) {
        OrderBookDto book = orderBookService.getOrderBook(symbol);
        return ResponseEntity.ok(book);
    }

    @Operation(summary = "Get user pending limit orders")
    @GetMapping("/pending")
    public ResponseEntity<List<LimitOrder>> getPendingOrders(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") Long sessionId) {
        Long userId = getUserId(userDetails);
        List<LimitOrder> orders = orderBookService.getPendingOrders(userId, sessionId);
        return ResponseEntity.ok(orders);
    }

    @Operation(summary = "Cancel a pending limit order")
    @DeleteMapping("/pending/{orderId}")
    public ResponseEntity<Void> cancelLimitOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long orderId) {
        Long userId = getUserId(userDetails);
        boolean cancelled = orderBookService.cancelLimitOrder(userId, orderId);
        if (cancelled) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }

    private Long getUserId(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found: " + userDetails.getUsername()))
                .getId();
    }
}
