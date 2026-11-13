package com.marketsimulator;

import com.marketsimulator.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;

class MarketSimulatorApplicationTests {

    private final String secret = "4c69b2d887e5f1a92e10c73294c6b840e34b9d09a25ef14c995f3b728d1c92ea";
    private final JwtTokenProvider tokenProvider = new JwtTokenProvider(secret, 3600000);
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Test
    void testJwtTokenGenerationAndValidation() {
        String email = "trader@market.local";
        String role = "USER";

        String token = tokenProvider.generateToken(email, role);
        assertNotNull(token);
        assertTrue(tokenProvider.validateToken(token));
        assertEquals(email, tokenProvider.getEmailFromToken(token));
    }

    @Test
    void testPasswordHashing() {
        String rawPassword = "SecurePassword123!";
        String encoded = passwordEncoder.encode(rawPassword);

        assertNotNull(encoded);
        assertNotEquals(rawPassword, encoded);
        assertTrue(passwordEncoder.matches(rawPassword, encoded));
    }

    @Test
    void testMarketQuoteDtoCreation() {
        com.marketsimulator.dto.MarketQuoteDto quote = com.marketsimulator.dto.MarketQuoteDto.builder()
                .symbol("AAPL")
                .price(java.math.BigDecimal.valueOf(193.42))
                .ts(java.time.Instant.now())
                .source("FINNHUB")
                .build();

        assertNotNull(quote);
        assertEquals("AAPL", quote.getSymbol());
        assertEquals("FINNHUB", quote.getSource());
        assertEquals(java.math.BigDecimal.valueOf(193.42), quote.getPrice());
    }
}
