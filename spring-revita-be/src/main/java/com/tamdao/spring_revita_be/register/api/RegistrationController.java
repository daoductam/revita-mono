package com.tamdao.spring_revita_be.register.api;

import com.tamdao.spring_revita_be.common.api.ApiPaths;
import com.tamdao.spring_revita_be.common.api.ApiResponse;
import com.tamdao.spring_revita_be.common.api.ApiResponseFactory;
import com.tamdao.spring_revita_be.register.api.dto.CompleteRegistrationRequest;
import com.tamdao.spring_revita_be.register.api.dto.MessageResponse;
import com.tamdao.spring_revita_be.register.api.dto.RegisterStep1Request;
import com.tamdao.spring_revita_be.register.api.dto.RegistrationCompleteResponse;
import com.tamdao.spring_revita_be.register.api.dto.RegistrationSessionResponse;
import com.tamdao.spring_revita_be.register.api.dto.ResendOtpRequest;
import com.tamdao.spring_revita_be.register.api.dto.VerifyOtpRequest;
import com.tamdao.spring_revita_be.register.application.RegistrationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.V1 + "/register")
@RequiredArgsConstructor
public class RegistrationController {

    private final RegistrationService registrationService;
    private final ApiResponseFactory responseFactory;

    @PostMapping("/step1")
    public ResponseEntity<ApiResponse<RegistrationSessionResponse>> step1(
            @Valid @RequestBody RegisterStep1Request request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(responseFactory.success(
                registrationService.start(request),
                httpRequest));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<RegistrationSessionResponse>> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(responseFactory.success(
                registrationService.verifyOtp(request),
                httpRequest));
    }

    @PostMapping("/resend-otp")
    public ResponseEntity<ApiResponse<MessageResponse>> resendOtp(
            @Valid @RequestBody ResendOtpRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(responseFactory.success(
                registrationService.resendOtp(request.sessionId()),
                httpRequest));
    }

    @PostMapping("/complete")
    public ResponseEntity<ApiResponse<RegistrationCompleteResponse>> complete(
            @Valid @RequestBody CompleteRegistrationRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(responseFactory.success(
                        registrationService.complete(request),
                        httpRequest));
    }
}
