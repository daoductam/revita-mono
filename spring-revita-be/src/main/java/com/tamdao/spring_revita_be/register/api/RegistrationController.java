package com.tamdao.spring_revita_be.register.api;

import com.tamdao.spring_revita_be.common.api.ApiPaths;
import com.tamdao.spring_revita_be.register.api.dto.CompleteRegistrationRequest;
import com.tamdao.spring_revita_be.register.api.dto.MessageResponse;
import com.tamdao.spring_revita_be.register.api.dto.RegisterStep1Request;
import com.tamdao.spring_revita_be.register.api.dto.RegistrationCompleteResponse;
import com.tamdao.spring_revita_be.register.api.dto.RegistrationSessionResponse;
import com.tamdao.spring_revita_be.register.api.dto.ResendOtpRequest;
import com.tamdao.spring_revita_be.register.api.dto.VerifyOtpRequest;
import com.tamdao.spring_revita_be.register.application.RegistrationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({ApiPaths.V1 + "/register", ApiPaths.LEGACY + "/register"})
@RequiredArgsConstructor
public class RegistrationController {

    private final RegistrationService registrationService;

    @PostMapping("/step1")
    public RegistrationSessionResponse step1(@Valid @RequestBody RegisterStep1Request request) {
        return registrationService.start(request);
    }

    @PostMapping("/verify-otp")
    public RegistrationSessionResponse verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        return registrationService.verifyOtp(request);
    }

    @PostMapping("/resend-otp")
    public MessageResponse resendOtp(@Valid @RequestBody ResendOtpRequest request) {
        return registrationService.resendOtp(request.sessionId());
    }

    @PostMapping("/complete")
    @ResponseStatus(HttpStatus.CREATED)
    public RegistrationCompleteResponse complete(@Valid @RequestBody CompleteRegistrationRequest request) {
        return registrationService.complete(request);
    }
}
