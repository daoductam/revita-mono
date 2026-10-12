package com.tamdao.spring_revita_be.patient.infrastructure;

import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PatientRepository extends JpaRepository<PatientEntity, String> {

    Optional<PatientEntity> findByAuthId(String authId);
}
