package com.tamdao.spring_revita_be.patientprofile.application;

import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.patient.infrastructure.PatientRepository;
import com.tamdao.spring_revita_be.patientprofile.api.dto.CreatePatientProfileRequest;
import com.tamdao.spring_revita_be.patientprofile.api.dto.PatientProfileResponse;
import com.tamdao.spring_revita_be.patientprofile.api.dto.UpdatePatientProfileRequest;
import com.tamdao.spring_revita_be.patientprofile.domain.PatientProfileEntity;
import com.tamdao.spring_revita_be.patientprofile.infrastructure.PatientProfileRepository;
import com.tamdao.spring_revita_be.register.application.LegacyCodeGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PatientProfileService {

    private static final int MAX_PROFILES_PER_LIST = 1000;

    private final PatientProfileRepository profileRepository;
    private final PatientRepository patientRepository;
    private final PatientProfileAccessPolicy accessPolicy;
    private final LegacyCodeGenerator codeGenerator;

    @Transactional(readOnly = true)
    public List<PatientProfileResponse> findAll(CurrentUser user) {
        Pageable boundedPage = boundedPage();
        if (user.isPatient()) {
            requirePatientId(user);
            return profileRepository.findAllByPatientIdOrderByCreatedAtDesc(user.patientId(), boundedPage).stream()
                    .map(this::toResponse)
                    .toList();
        }
        return profileRepository.findAllByOrderByCreatedAtDesc(boundedPage).stream()
                .filter(profile -> {
                    accessPolicy.requireCanRead(user, profile);
                    return true;
                })
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PatientProfileResponse> findByPatient(String patientId, CurrentUser user) {
        if (user.isPatient() && !patientId.equals(user.patientId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "You can only view your own profiles");
        }
        if (!patientRepository.existsById(patientId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Patient not found");
        }
        return profileRepository.findAllByPatientIdOrderByCreatedAtDesc(patientId, boundedPage()).stream()
                .peek(profile -> accessPolicy.requireCanRead(user, profile))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PatientProfileResponse findOne(String id, CurrentUser user) {
        PatientProfileEntity profile = profileRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Patient profile not found"));
        accessPolicy.requireCanRead(user, profile);
        return toResponse(profile);
    }

    @Transactional
    public PatientProfileResponse create(CreatePatientProfileRequest request, CurrentUser user) {
        String patientId = accessPolicy.resolveCreatePatientId(user, request.patientId());
        PatientProfileEntity profile = PatientProfileEntity.builder()
                .id(java.util.UUID.randomUUID().toString())
                .profileCode(codeGenerator.generateProfileCode(request.name(), request.gender()))
                .patientId(patientId)
                .name(request.name().trim())
                .phone(blankToNull(request.phone()))
                .dateOfBirth(request.dateOfBirth().atStartOfDay(ZoneOffset.UTC).toInstant())
                .gender(request.gender().trim())
                .address(blankToNull(request.address()))
                .occupation(blankToNull(request.occupation()))
                .emergencyContact(request.emergencyContact())
                .healthInsurance(blankToNull(request.healthInsurance()))
                .relationship(blankToNull(request.relationship()))
                .pregnant(user.isPatient() ? false : Boolean.TRUE.equals(request.isPregnant()))
                .disabled(user.isPatient() ? false : Boolean.TRUE.equals(request.isDisabled()))
                .build();
        return toResponse(profileRepository.save(profile));
    }

    @Transactional
    public PatientProfileResponse update(String id, UpdatePatientProfileRequest request, CurrentUser user) {
        PatientProfileEntity profile = profileRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Patient profile not found"));
        accessPolicy.requireCanUpdate(user, profile);

        if (request.name() != null) profile.setName(request.name().trim());
        if (request.phone() != null) profile.setPhone(blankToNull(request.phone()));
        if (request.dateOfBirth() != null) {
            profile.setDateOfBirth(request.dateOfBirth().atStartOfDay(ZoneOffset.UTC).toInstant());
        }
        if (request.gender() != null) profile.setGender(request.gender().trim());
        if (request.address() != null) profile.setAddress(blankToNull(request.address()));
        if (request.occupation() != null) profile.setOccupation(blankToNull(request.occupation()));
        if (request.emergencyContact() != null) profile.setEmergencyContact(request.emergencyContact());
        if (request.healthInsurance() != null) profile.setHealthInsurance(blankToNull(request.healthInsurance()));
        if (request.relationship() != null) profile.setRelationship(blankToNull(request.relationship()));
        if (!user.isPatient()) {
            if (request.isPregnant() != null) profile.setPregnant(request.isPregnant());
            if (request.isDisabled() != null) profile.setDisabled(request.isDisabled());
        }
        return toResponse(profileRepository.save(profile));
    }

    private void requirePatientId(CurrentUser user) {
        if (user.patientId() == null || user.patientId().isBlank()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Patient information is unavailable");
        }
    }

    private PatientProfileResponse toResponse(PatientProfileEntity profile) {
        return new PatientProfileResponse(
                profile.getId(),
                profile.getProfileCode(),
                profile.getPatientId(),
                profile.getName(),
                profile.getPhone(),
                profile.getDateOfBirth(),
                profile.getGender(),
                profile.getAddress(),
                profile.getOccupation(),
                profile.getEmergencyContact(),
                profile.getHealthInsurance(),
                profile.getRelationship(),
                profile.getActive(),
                profile.getPregnant(),
                profile.getDisabled(),
                profile.getCreatedAt(),
                profile.getUpdatedAt());
    }

    private String blankToNull(String value) {
        String normalized = value == null ? null : value.trim();
        return normalized == null || normalized.isBlank() ? null : normalized;
    }

    private Pageable boundedPage() {
        return PageRequest.of(0, MAX_PROFILES_PER_LIST);
    }
}
