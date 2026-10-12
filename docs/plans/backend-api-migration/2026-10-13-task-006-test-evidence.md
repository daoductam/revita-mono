# TASK-006 Test Evidence

Date: 2026-10-13  
Status: `PASS`

## Command

```text
cd spring-revita-be
.\mvnw.cmd -q test
```

Result: 46 tests passed, 0 failures, 0 errors, 0 skipped.

## Suite summary

| Suite | Tests | Result |
|---|---:|---|
| `ExceptionContractTests` | 11 | PASS |
| `SpringRevitaBeApplicationTests` | 7 | PASS |
| `Task006AliasTests` | 3 | PASS |
| `Task006AuthContractTests` | 7 | PASS |
| `Task006OwnershipTests` | 4 | PASS |
| `Task006PersistenceTests` | 3 | PASS |
| `Task006RegistrationContractTests` | 7 | PASS |
| `Task006UserPatientContractTests` | 4 | PASS |
| **Total** | **46** | **PASS** |

## Verified contracts

- Raw success payloads remain compatible with the legacy response shape; no `data` wrapper is introduced.
- `ApiErrorResponse` is returned for validation, authentication, authorization, not-found and conflict cases.
- JWT claim compatibility covers `sub`, `phone`, `email`, `role`, `token_type`, and patient details.
- Login, refresh, me and logout contracts are covered.
- Registration covers step 1, OTP verification, resend, completion, duplicate identity and rollback-safe failure behavior.
- Patient A cannot read or update Patient B's profile, including path/body substitution attempts.
- Doctor, patient and user self-service routes are covered.
- Canonical `/api/v1` and legacy `/api` aliases are exercised for equivalent status and field semantics.
- Legacy table mappings and JSON `emergency_contact` persistence are verified on the H2 PostgreSQL-compatible test schema.
- Patient-profile list queries are bounded at 1,000 records while preserving the legacy raw-array response shape.
- Production OTP delivery fails with `service_unavailable` until a real provider adapter is configured; it no longer reports a false OTP success.
- Sensitive fields are excluded from response assertions.

## Environment limitations

- Tests use H2 and the test profile's in-memory registration session store; PostgreSQL and Redis runtime smoke tests remain pending.
- OTP delivery is represented by `TestOtpSender`; real email/SMS provider integration is not part of TASK-006 P0. The production fallback is fail-fast (`503 service_unavailable`), not a silent no-op.
- Web and desktop client flows are represented by MockMvc contract tests, not browser/desktop end-to-end runs.
- Concurrent registration completion and production database row-level reconciliation require staging verification.
