package com.marketsimulator.controller;

import com.marketsimulator.dto.MarketOrderRequest;
import com.marketsimulator.dto.OrderFillDto;
import com.marketsimulator.repository.UserRepository;
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

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@Tag(name = "Orders", description = "Paper trading order execution")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {

    private final OrderService orderService;
    private final UserRepository userRepository;

    @Operation(summary = "Place a market order (BUY or SELL) at last known real price")
    @PostMapping("/market")
    public ResponseEntity<OrderFillDto> placeMarketOrder(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody MarketOrderRequest request) {
        Long userId = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new RuntimeException("User not found"))
                .getId();
        OrderFillDto fill = orderService.placeMarketOrder(userId, request);
        return ResponseEntity.ok(fill);
    }
}
