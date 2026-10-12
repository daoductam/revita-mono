package com.tamdao.spring_revita_be.user.application;

import com.tamdao.spring_revita_be.auth.api.dto.UserResponse;
import com.tamdao.spring_revita_be.auth.application.AuthService;
import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.auth.infrastructure.AuthRepository;
import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.user.api.dto.DoctorSummaryResponse;
import com.tamdao.spring_revita_be.user.api.dto.UpdateUserRequest;
import com.tamdao.spring_revita_be.user.infrastructure.DoctorDirectoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final AuthRepository authRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final DoctorDirectoryRepository doctorDirectoryRepository;

    @Transactional
    public UserResponse updateMe(CurrentUser currentUser, UpdateUserRequest request) {
        AuthEntity auth = authRepository.findById(currentUser.userId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));

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
        if (request.email() != null) auth.setEmail(email);
        if (request.phone() != null) auth.setPhone(phone);
        if (request.password() != null) auth.setPassword(passwordEncoder.encode(request.password()));

        try {
            authRepository.saveAndFlush(auth);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ErrorCode.CONFLICT, "User update conflicts with existing data", exception);
        }
        return authService.getCurrentUser(currentUser);
    }

    @Transactional(readOnly = true)
    public List<DoctorSummaryResponse> findDoctors(String specialty) {
        return doctorDirectoryRepository.findAll(specialty).stream()
                .map(doctor -> new DoctorSummaryResponse(
                        doctor.id(),
                        doctor.name(),
                        doctor.avatar(),
                        doctor.doctorCode(),
                        doctor.yearsExperience(),
                        doctor.rating(),
                        doctor.workHistory(),
                        doctor.description()))
                .toList();
    }

    private String blankToNull(String value) {
        return normalize(value);
    }

    private String normalize(String value) {
        String normalized = value == null ? null : value.trim();
        return normalized == null || normalized.isBlank() ? null : normalized;
    }
}
