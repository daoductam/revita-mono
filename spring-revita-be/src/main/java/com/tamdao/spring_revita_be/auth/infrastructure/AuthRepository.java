package com.tamdao.spring_revita_be.auth.infrastructure;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuthRepository extends JpaRepository<AuthEntity, String> {

    Optional<AuthEntity> findFirstByPhoneOrEmail(String phone, String email);

    boolean existsByPhone(String phone);

    boolean existsByEmail(String email);

    boolean existsByCitizenId(String citizenId);
}
