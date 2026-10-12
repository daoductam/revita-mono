package com.tamdao.spring_revita_be.patientprofile.api;

import com.tamdao.spring_revita_be.common.api.ApiPaths;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.patientprofile.api.dto.CreatePatientProfileRequest;
import com.tamdao.spring_revita_be.patientprofile.api.dto.PatientProfileResponse;
import com.tamdao.spring_revita_be.patientprofile.api.dto.UpdatePatientProfileRequest;
import com.tamdao.spring_revita_be.patientprofile.application.PatientProfileService;
import com.tamdao.spring_revita_be.security.CurrentUserResolver;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
@RequestMapping({ApiPaths.V1 + "/patient-profiles", ApiPaths.LEGACY + "/patient-profiles"})
@PreAuthorize("hasAnyRole('PATIENT', 'DOCTOR', 'ADMIN', 'RECEPTIONIST')")
@RequiredArgsConstructor
public class PatientProfileController {

    private final PatientProfileService profileService;
    private final CurrentUserResolver currentUserResolver;

    @GetMapping
    public List<PatientProfileResponse> findAll(Authentication authentication) {
        return profileService.findAll(currentUserResolver.resolve(authentication));
    }

    @GetMapping("/patient/{patientId}")
    public List<PatientProfileResponse> findByPatient(
            @PathVariable String patientId,
            Authentication authentication) {
        return profileService.findByPatient(patientId, currentUserResolver.resolve(authentication));
    }

    @GetMapping("/{id}")
    public PatientProfileResponse findOne(
            @PathVariable String id,
            Authentication authentication) {
        return profileService.findOne(id, currentUserResolver.resolve(authentication));
    }

    @PostMapping
    public PatientProfileResponse create(
            @Valid @RequestBody CreatePatientProfileRequest request,
            Authentication authentication) {
        return profileService.create(request, currentUserResolver.resolve(authentication));
    }

    @PatchMapping("/{id}")
    public PatientProfileResponse update(
            @PathVariable String id,
            @Valid @RequestBody UpdatePatientProfileRequest request,
            Authentication authentication) {
        return profileService.update(id, request, currentUserResolver.resolve(authentication));
    }
}
