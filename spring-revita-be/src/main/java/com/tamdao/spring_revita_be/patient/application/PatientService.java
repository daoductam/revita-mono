package com.tamdao.spring_revita_be.patient.application;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.auth.infrastructure.AuthRepository;
import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.patient.api.dto.PatientResponse;
import com.tamdao.spring_revita_be.patient.api.dto.UpdatePatientRequest;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import com.tamdao.spring_revita_be.patient.infrastructure.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;

@Service
@RequiredArgsConstructor
public class PatientService {

    private final AuthRepository authRepository;
    private final PatientRepository patientRepository;

    @Transactional
    public PatientResponse updateMe(CurrentUser currentUser, UpdatePatientRequest request) {
        if (!currentUser.isPatient()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only patients can update this resource");
        }
        AuthEntity auth = authRepository.findById(currentUser.userId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
        PatientEntity patient = patientRepository.findByAuthId(currentUser.userId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Patient not found"));

        String email = normalize(request.email());
        String phone = normalize(request.phone());
        String citizenId = normalize(request.citizenId());

        if (request.email() != null && email != null && !email.equals(normalize(auth.getEmail()))
                && authRepository.existsByEmail(email)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Email is already registered");
        }
        if (request.phone() != null && phone != null && !phone.equals(normalize(auth.getPhone()))
                && authRepository.existsByPhone(phone)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Phone is already registered");
        }
        if (request.citizenId() != null && citizenId != null && !citizenId.equals(normalize(auth.getCitizenId()))
                && authRepository.existsByCitizenId(citizenId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Citizen ID is already registered");
        }

        if (request.name() != null) auth.setName(request.name().trim());
        if (request.dateOfBirth() != null) {
            auth.setDateOfBirth(request.dateOfBirth().atStartOfDay(ZoneOffset.UTC).toInstant());
        }
        if (request.gender() != null) auth.setGender(request.gender().trim());
        if (request.address() != null) auth.setAddress(request.address().trim());
        if (request.citizenId() != null) auth.setCitizenId(citizenId);
        if (request.avatar() != null) auth.setAvatar(blankToNull(request.avatar()));
        if (request.phone() != null) auth.setPhone(phone);
        if (request.email() != null) auth.setEmail(email);

        try {
            authRepository.saveAndFlush(auth);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ErrorCode.CONFLICT, "Patient update conflicts with existing data", exception);
        }
        return new PatientResponse(patient.getId(), patient.getPatientCode(), patient.getLoyaltyPoints());
    }

    private String blankToNull(String value) {
        return normalize(value);
    }

    private String normalize(String value) {
        String normalized = value == null ? null : value.trim();
        return normalized == null || normalized.isBlank() ? null : normalized;
    }
}
