package com.tamdao.spring_revita_be.user.infrastructure;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class DoctorDirectoryRepository {

    private static final String FIND_DOCTORS = """
            select a.id, a.name, a.avatar, d.doctor_code, d.years_experience,
                   d.rating, d.work_history, d.description
              from auths a
              join doctors d on d.auth_id = a.id
              left join specialties s on s.id = d.specialty_id
             where a.role = 'DOCTOR'
               and d.is_active = true
               and (:specialty is null or lower(s.name) like lower(concat('%', :specialty, '%')))
             order by a.name asc
            """;

    @PersistenceContext
    private EntityManager entityManager;

    public List<DoctorSummary> findAll(String specialty) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery(FIND_DOCTORS)
                .setParameter("specialty", blankToNull(specialty))
                .getResultList();

        return rows.stream()
                .map(this::toSummary)
                .toList();
    }

    private DoctorSummary toSummary(Object[] row) {
        return new DoctorSummary(
                (String) row[0],
                (String) row[1],
                (String) row[2],
                (String) row[3],
                ((Number) row[4]).intValue(),
                ((Number) row[5]).doubleValue(),
                (String) row[6],
                (String) row[7]);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
