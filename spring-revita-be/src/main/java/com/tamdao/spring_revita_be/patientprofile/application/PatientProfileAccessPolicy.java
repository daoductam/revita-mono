package com.tamdao.spring_revita_be.patientprofile.application;

import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import com.tamdao.spring_revita_be.patient.infrastructure.PatientRepository;
import com.tamdao.spring_revita_be.patientprofile.domain.PatientProfileEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PatientProfileAccessPolicy {

    private final PatientRepository patientRepository;

    public void requireCanRead(CurrentUser user, PatientProfileEntity profile) {
        requireStaffOrPatient(user);
        if (user.isPatient() && !samePatient(user, profile)) {
            throw forbidden("You cannot access another patient's profile");
        }
    }

    public void requireCanUpdate(CurrentUser user, PatientProfileEntity profile) {
        requireStaffOrPatient(user);
        if (user.isPatient() && !samePatient(user, profile)) {
            throw forbidden("You cannot update another patient's profile");
        }
    }

    public String resolveCreatePatientId(CurrentUser user, String requestedPatientId) {
        if (user.isPatient()) {
            if (user.patientId() == null || requestedPatientId == null
                    || !user.patientId().equals(requestedPatientId)) {
                throw forbidden("Patients can create profiles only for themselves");
            }
            return user.patientId();
        }
        if (requestedPatientId == null || requestedPatientId.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "patientId is required for this endpoint");
        }
        if (!patientRepository.existsById(requestedPatientId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Patient not found");
        }
        return requestedPatientId;
    }

    private void requireStaffOrPatient(CurrentUser user) {
        if (user.role() != Role.PATIENT
                && user.role() != Role.DOCTOR
                && user.role() != Role.ADMIN
                && user.role() != Role.RECEPTIONIST) {
            throw forbidden("Role cannot access patient profiles");
        }
    }

    private boolean samePatient(CurrentUser user, PatientProfileEntity profile) {
        return user.patientId() != null
                && user.patientId().equals(profile.getPatientId());
    }

    private BusinessException forbidden(String message) {
        return new BusinessException(ErrorCode.FORBIDDEN, message);
    }
}
