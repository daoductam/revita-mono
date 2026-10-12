package com.tamdao.spring_revita_be.security;

import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class CurrentUserResolver {

    public CurrentUser resolve(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)
                || !authentication.isAuthenticated()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Authentication is required");
        }

        var jwt = jwtAuthentication.getToken();
        String userId = jwt.getSubject();
        String roleValue = jwt.getClaimAsString("role");
        if (userId == null || userId.isBlank() || roleValue == null || roleValue.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid authentication");
        }

        Role role;
        try {
            role = Role.valueOf(roleValue.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid authentication", exception);
        }

        String patientId = null;
        String patientCode = null;
        Object rawPatient = jwt.getClaims().get("patient");
        if (rawPatient instanceof Map<?, ?> patient) {
            patientId = stringValue(patient.get("id"));
            patientCode = stringValue(patient.get("patientCode"));
        }

        return new CurrentUser(userId, role, patientId, patientCode, jwt.getClaims());
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }
}
