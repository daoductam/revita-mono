package com.tamdao.spring_revita_be.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.List;

@ConfigurationProperties(prefix = "app.cors")
public class AppCorsProperties {

    private String allowedOrigins = "";

    public String getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(String allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    public List<String> allowedOriginList() {
        if (allowedOrigins == null || allowedOrigins.isBlank()) {
            throw new IllegalStateException("app.cors.allowed-origins must contain an explicit allowlist");
        }
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toList();
        if (origins.isEmpty() || origins.stream().anyMatch("*"::equals)) {
            throw new IllegalStateException("app.cors.allowed-origins must not be empty or wildcard");
        }
        return origins;
    }
}
