package com.tamdao.spring_revita_be.patientprofile.infrastructure;

import com.tamdao.spring_revita_be.patientprofile.domain.PatientProfileEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PatientProfileRepository extends JpaRepository<PatientProfileEntity, String> {

    List<PatientProfileEntity> findAllByPatientIdOrderByCreatedAtDesc(String patientId, Pageable pageable);

    List<PatientProfileEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
