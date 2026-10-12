package com.tamdao.spring_revita_be.auth.api;

import com.tamdao.spring_revita_be.auth.api.dto.AuthResponse;
import com.tamdao.spring_revita_be.auth.api.dto.LoginRequest;
import com.tamdao.spring_revita_be.auth.api.dto.LogoutResponse;
import com.tamdao.spring_revita_be.auth.api.dto.RefreshTokenRequest;
import com.tamdao.spring_revita_be.auth.api.dto.TokenResponse;
import com.tamdao.spring_revita_be.auth.api.dto.UserResponse;
import com.tamdao.spring_revita_be.auth.application.AuthService;
import com.tamdao.spring_revita_be.common.api.ApiPaths;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.security.CurrentUserResolver;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({ApiPaths.V1 + "/auth", ApiPaths.LEGACY + "/auth"})
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final CurrentUserResolver currentUserResolver;

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return authService.refresh(request.refreshToken());
    }

    @GetMapping("/me")
    public UserResponse me(Authentication authentication) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return authService.getCurrentUser(currentUser);
    }

    @PostMapping("/logout")
    public LogoutResponse logout(Authentication authentication) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return authService.logout(currentUser);
    }
}
