package com.tamdao.spring_revita_be.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.time.Duration;

@ConfigurationProperties(prefix = "app.security")
public class AppSecurityProperties {

    private String jwtSecret;
    private String jwtIssuer = "revita";
    private Duration loginAccessTokenTtl = Duration.ofDays(15);
    private Duration loginRefreshTokenTtl = Duration.ofDays(30);
    private Duration refreshAccessTokenTtl = Duration.ofMinutes(15);
    private Duration refreshRefreshTokenTtl = Duration.ofDays(7);
    private List<String> publicPaths = new ArrayList<>();

    public String getJwtSecret() {
        return jwtSecret;
    }

    public void setJwtSecret(String jwtSecret) {
        this.jwtSecret = jwtSecret;
    }

    public String getJwtIssuer() {
        return jwtIssuer;
    }

    public void setJwtIssuer(String jwtIssuer) {
        this.jwtIssuer = jwtIssuer;
    }

    public Duration getLoginAccessTokenTtl() {
        return loginAccessTokenTtl;
    }

    public void setLoginAccessTokenTtl(Duration loginAccessTokenTtl) {
        this.loginAccessTokenTtl = loginAccessTokenTtl;
    }

    public Duration getLoginRefreshTokenTtl() {
        return loginRefreshTokenTtl;
    }

    public void setLoginRefreshTokenTtl(Duration loginRefreshTokenTtl) {
        this.loginRefreshTokenTtl = loginRefreshTokenTtl;
    }

    public Duration getRefreshAccessTokenTtl() {
        return refreshAccessTokenTtl;
    }

    public void setRefreshAccessTokenTtl(Duration refreshAccessTokenTtl) {
        this.refreshAccessTokenTtl = refreshAccessTokenTtl;
    }

    public Duration getRefreshRefreshTokenTtl() {
        return refreshRefreshTokenTtl;
    }

    public void setRefreshRefreshTokenTtl(Duration refreshRefreshTokenTtl) {
        this.refreshRefreshTokenTtl = refreshRefreshTokenTtl;
    }

    public List<String> getPublicPaths() {
        return publicPaths;
    }

    public void setPublicPaths(List<String> publicPaths) {
        this.publicPaths = publicPaths == null ? new ArrayList<>() : new ArrayList<>(publicPaths);
    }

    public String requireJwtSecret() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException("app.security.jwt-secret must be configured");
        }
        if (jwtSecret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("app.security.jwt-secret must be at least 32 bytes");
        }
        return jwtSecret;
    }
}
