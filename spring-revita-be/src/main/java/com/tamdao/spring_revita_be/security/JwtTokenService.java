package com.tamdao.spring_revita_be.security;

import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.config.AppSecurityProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class JwtTokenService {

    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;
    private final AppSecurityProperties securityProperties;

    public String issueAccessToken(AuthTokenSubject subject) {
        return issue(subject, securityProperties.getLoginAccessTokenTtl(), "access");
    }

    public String issueRefreshToken(AuthTokenSubject subject) {
        return issue(subject, securityProperties.getLoginRefreshTokenTtl(), "refresh");
    }

    public String issueRefreshedAccessToken(AuthTokenSubject subject) {
        return issue(subject, securityProperties.getRefreshAccessTokenTtl(), "access");
    }

    public String issueRefreshedRefreshToken(AuthTokenSubject subject) {
        return issue(subject, securityProperties.getRefreshRefreshTokenTtl(), "refresh");
    }

    public Jwt decode(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid token");
        }
        try {
            return jwtDecoder.decode(rawToken);
        } catch (JwtException | IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid token", exception);
        }
    }

    public String subject(String rawToken) {
        String subject = decode(rawToken).getSubject();
        if (subject == null || subject.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid token");
        }
        return subject;
    }

    private String issue(AuthTokenSubject subject, java.time.Duration ttl, String tokenType) {
        if (ttl == null || ttl.isNegative() || ttl.isZero()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Token configuration is invalid");
        }

        Instant issuedAt = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .subject(subject.id())
                .issuedAt(issuedAt)
                .expiresAt(issuedAt.plus(ttl))
                .claim("phone", subject.phone())
                .claim("email", subject.email())
                .claim("role", subject.role().name())
                .claim("token_type", tokenType);

        if (securityProperties.getJwtIssuer() != null && !securityProperties.getJwtIssuer().isBlank()) {
            claims.issuer(securityProperties.getJwtIssuer());
        }
        if (!subject.roleDetails().isEmpty()) {
            claims.claim(subject.role().name().toLowerCase(Locale.ROOT), subject.roleDetails());
        }

        return jwtEncoder.encode(JwtEncoderParameters.from(claims.build())).getTokenValue();
    }
}
