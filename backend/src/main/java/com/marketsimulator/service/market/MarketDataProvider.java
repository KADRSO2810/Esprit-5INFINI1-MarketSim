package com.marketsimulator.service.market;

import com.marketsimulator.dto.MarketQuoteDto;

import java.util.function.Consumer;

public interface MarketDataProvider {

    void connect();

    void disconnect();

    void subscribe(String symbol);

    void unsubscribe(String symbol);

    boolean isConnected();

    void setQuoteListener(Consumer<MarketQuoteDto> listener);
}
