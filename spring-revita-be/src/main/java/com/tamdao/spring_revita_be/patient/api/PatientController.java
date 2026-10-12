package com.tamdao.spring_revita_be.patient.api;

import com.tamdao.spring_revita_be.common.api.ApiPaths;
import com.tamdao.spring_revita_be.common.api.ApiResponse;
import com.tamdao.spring_revita_be.common.api.ApiResponseFactory;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.patient.api.dto.PatientResponse;
import com.tamdao.spring_revita_be.patient.api.dto.UpdatePatientRequest;
import com.tamdao.spring_revita_be.patient.application.PatientService;
import com.tamdao.spring_revita_be.security.CurrentUserResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.V1 + "/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService patientService;
    private final CurrentUserResolver currentUserResolver;
    private final ApiResponseFactory responseFactory;

    @PutMapping("/me")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<ApiResponse<PatientResponse>> updateMe(
            Authentication authentication,
            @Valid @RequestBody UpdatePatientRequest request,
            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return ResponseEntity.ok(responseFactory.success(
                patientService.updateMe(currentUser, request),
                httpRequest));
    }
}
