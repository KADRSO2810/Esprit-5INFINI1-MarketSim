package com.marketsimulator.exception;

import lombok.Getter;

import java.util.Collections;
import java.util.List;

@Getter
public class RiskLimitBreachedException extends RuntimeException {

    private final List<String> rejections;

    public RiskLimitBreachedException(String message) {
        super(message);
        this.rejections = Collections.singletonList(message);
    }

    public RiskLimitBreachedException(String message, List<String> rejections) {
        super(message);
        this.rejections = (rejections != null && !rejections.isEmpty()) ? rejections : Collections.singletonList(message);
    }
}
