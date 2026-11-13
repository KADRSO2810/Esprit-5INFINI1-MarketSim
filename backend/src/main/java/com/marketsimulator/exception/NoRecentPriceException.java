package com.marketsimulator.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.CONFLICT)
public class NoRecentPriceException extends RuntimeException {
    public NoRecentPriceException(String message) {
        super(message);
    }
}
