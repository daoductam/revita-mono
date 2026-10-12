package com.tamdao.spring_revita_be.auth.api;

import com.tamdao.spring_revita_be.auth.api.dto.AuthResponse;
import com.tamdao.spring_revita_be.auth.api.dto.LoginRequest;
import com.tamdao.spring_revita_be.auth.api.dto.LogoutResponse;
import com.tamdao.spring_revita_be.auth.api.dto.RefreshTokenRequest;
import com.tamdao.spring_revita_be.auth.api.dto.TokenResponse;
import com.tamdao.spring_revita_be.auth.api.dto.UserResponse;
import com.tamdao.spring_revita_be.auth.application.AuthService;
import com.tamdao.spring_revita_be.common.api.ApiPaths;
import com.tamdao.spring_revita_be.common.api.ApiResponse;
import com.tamdao.spring_revita_be.common.api.ApiResponseFactory;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.security.CurrentUserResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.V1 + "/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final CurrentUserResolver currentUserResolver;
    private final ApiResponseFactory responseFactory;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(responseFactory.success(authService.login(request), httpRequest));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<TokenResponse>> refresh(
            @Valid @RequestBody RefreshTokenRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(responseFactory.success(
                authService.refresh(request.refreshToken()),
                httpRequest));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> me(
            Authentication authentication,
            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return ResponseEntity.ok(responseFactory.success(
                authService.getCurrentUser(currentUser),
                httpRequest));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<LogoutResponse>> logout(
            Authentication authentication,
            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return ResponseEntity.ok(responseFactory.success(
                authService.logout(currentUser),
                httpRequest));
    }
}
