package com.tamdao.spring_revita_be.patientprofile.api;

import com.tamdao.spring_revita_be.common.api.ApiPaths;
import com.tamdao.spring_revita_be.common.api.ApiResponse;
import com.tamdao.spring_revita_be.common.api.ApiResponseFactory;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.patientprofile.api.dto.CreatePatientProfileRequest;
import com.tamdao.spring_revita_be.patientprofile.api.dto.PatientProfileResponse;
import com.tamdao.spring_revita_be.patientprofile.api.dto.UpdatePatientProfileRequest;
import com.tamdao.spring_revita_be.patientprofile.application.PatientProfileService;
import com.tamdao.spring_revita_be.security.CurrentUserResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping(ApiPaths.V1 + "/patient-profiles")
@PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN', 'RECEPTIONIST')")
@RequiredArgsConstructor
public class PatientProfileController {

    private final PatientProfileService profileService;
    private final CurrentUserResolver currentUserResolver;
    private final ApiResponseFactory responseFactory;

    @GetMapping
    public ResponseEntity<ApiResponse<List<PatientProfileResponse>>> findAll(
            Authentication authentication,
            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return ResponseEntity.ok(responseFactory.success(
                profileService.findAll(currentUser),
                httpRequest));
    }

    @GetMapping("/patient/{patientId}")
    public ResponseEntity<ApiResponse<List<PatientProfileResponse>>> findByPatient(
            @PathVariable String patientId,
            Authentication authentication,
            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return ResponseEntity.ok(responseFactory.success(
                profileService.findByPatient(patientId, currentUser),
                httpRequest));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PatientProfileResponse>> findOne(
            @PathVariable String id,
            Authentication authentication,
            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return ResponseEntity.ok(responseFactory.success(
                profileService.findOne(id, currentUser),
                httpRequest));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PatientProfileResponse>> create(
            @Valid @RequestBody CreatePatientProfileRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return ResponseEntity.ok(responseFactory.success(
                profileService.create(request, currentUser),
                httpRequest));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<PatientProfileResponse>> update(
            @PathVariable String id,
            @Valid @RequestBody UpdatePatientProfileRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserResolver.resolve(authentication);
        return ResponseEntity.ok(responseFactory.success(
                profileService.update(id, request, currentUser),
                httpRequest));
    }
}
