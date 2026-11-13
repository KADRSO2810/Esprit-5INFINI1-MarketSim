package com.marketsimulator.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Préfixe pour la diffusion des messages vers les abonnés (ex: /topic/quotes)
        config.enableSimpleBroker("/topic");
        // Préfixe pour les messages entrants adressés aux @MessageMapping de l'application
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint standard STOMP WebSocket
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");

        // Fallback SockJS si un navigateur ne supporte pas WebSocket natif
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
