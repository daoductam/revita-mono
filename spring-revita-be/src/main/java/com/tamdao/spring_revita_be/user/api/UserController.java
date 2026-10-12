package com.tamdao.spring_revita_be.user.api;

import com.tamdao.spring_revita_be.auth.api.dto.UserResponse;
import com.tamdao.spring_revita_be.common.api.ApiPaths;
import com.tamdao.spring_revita_be.common.api.ApiResponse;
import com.tamdao.spring_revita_be.common.api.ApiResponseFactory;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.security.CurrentUserResolver;
import com.tamdao.spring_revita_be.user.api.dto.DoctorSummaryResponse;
import com.tamdao.spring_revita_be.user.api.dto.UpdateUserRequest;
import com.tamdao.spring_revita_be.user.application.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping(ApiPaths.V1 + "/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final CurrentUserResolver currentUserResolver;
    private final ApiResponseFactory responseFactory;

    @GetMapping("/doctors")
    public ResponseEntity<ApiResponse<List<DoctorSummaryResponse>>> doctors(
            @RequestParam(required = false) String specialty,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(responseFactory.success(
                userService.findDoctors(specialty),
                httpRequest));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateMe(
            Authentication authentication,
            @Valid @RequestBody UpdateUserRequest request,
            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return ResponseEntity.ok(responseFactory.success(
                userService.updateMe(currentUser, request),
                httpRequest));
    }
}
