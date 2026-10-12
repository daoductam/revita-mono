# Revita State and Data Migration Plan — Baseline v0

Spec Source: `docs/plans/backend-api-migration/2026-10-12-spec.md`
Schema Source: `revita-be/prisma/schema.prisma`
Generated: `2026-10-13`
Status: `Mapping completed; Flyway baseline, dry-run and reconciliation required before cutover`

## 1. Database landscape

| Store | Current responsibility | Phase 1 policy |
|---|---|---|
| PostgreSQL via Prisma | Identity, clinic, appointment, queue, clinical, invoice and content relations | Preserve existing IDs and relations; do not let Hibernate auto-create/drop schema |
| MongoDB | Drug catalog/search | Keep as separate catalog adapter; preserve NDC/search behavior |
| Redis | Cache, OTP/session, queue/realtime support | Define key names, TTL and invalidation before dual-running |
| Supabase/storage | File objects and result attachments | Preserve object path and ownership semantics |

The schema contains exactly 45 business models and 9 enums. The target must not silently replace UUID identifiers, relation keys or enum values.

The Prisma schema contains a PostgreSQL `Drug` model while the application also has a Mongo drug-catalog path. These are not assumed to be the same source of truth: the migration must choose one authoritative read path and define synchronization or deprecation for the other.

## 2. Model mapping groups

| Group | Legacy models | Target module | Migration concern |
|---|---|---|---|
| Identity | `Auth`, `Admin`, `Doctor`, `Patient`, `Receptionist`, `Cashier`, `Technician`, `PatientProfile` | `auth`, `user`, `patient` | Preserve UUIDs, role claims and profile relations |
| Clinic/config | `Specialty`, `ClinicRoom`, `Counter`, `Booth`, `Service`, `ServicePromotion`, `ServiceCategory`, `Package`, `PackageItem`, `BoothService`, `ClinicRoomService` | `clinic`, `service` | Preserve unique codes, promotion windows and soft-delete flags |
| Scheduling | `Appointment`, `AppointmentService`, `WorkSession`, `WorkSessionService`, `CounterAssignment` | `appointment`, `worksession`, `queue` | Concurrency and assignment consistency |
| Clinical | `Template`, `MedicalRecord`, `MedicalRecordHistory`, `Prescription`, `PrescriptionService`, `MedicationPrescription`, `MedicationPrescriptionItem`, `Drug`, `Certificate` | `clinical`, `prescription` | JSON fields, arrays, medical ownership and history |
| Billing | `Invoice`, `InvoiceDetail`, `PaymentTransaction` | `payment` | Money precision, webhook idempotency and status mapping |
| Content | `Post`, `PostCategory`, `PostInCategory`, `Series`, `SeriesPost`, `Comment`, `PostLike`, `CommentLike` | `content` | Visibility, category membership, moderation, likes/comments ownership |
| Feedback | `DoctorRating` | `rating` | Eligibility and duplicate-rating rules |

### 2.1. Exact schema inventory

| Type | Values/models |
|---|---|
| Enum `Role` | `DOCTOR`, `PATIENT`, `RECEPTIONIST`, `ADMIN`, `CASHIER`, `TECHNICIAN` |
| Enum `PaymentMethod` | `CASH`, `TRANSFER` |
| Enum `PaymentTransactionStatus` | `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED` |
| Enum `MedicalRecordStatus` | `DRAFT`, `IN_PROGRESS`, `COMPLETED` |
| Enum `MedicationPrescriptionStatus` | `DRAFT`, `SIGNED`, `DISPENSED`, `CANCELLED` |
| Enum `PrescriptionStatus` | `NOT_STARTED`, `PENDING`, `WAITING`, `PREPARING`, `SERVING`, `WAITING_RESULT`, `RETURNING`, `COMPLETED`, `CANCELLED`, `SKIPPED`, `RESCHEDULED` |
| Enum `WorkSessionStatus` | `PENDING`, `APPROVED`, `IN_PROGRESS`, `CANCELED`, `COMPLETED` |
| Enum `CertificateType` | `LICENSE`, `DEGREE`, `TRAINING`, `OTHER` |
| Enum `ContentStatus` | `DRAFT`, `PUBLISHED`, `UNPUBLISHED` |

`Appointment.status` and `Invoice.paymentStatus` are strings, not Prisma enums. Spring must preserve their observed values during phase 1 and must not silently impose a narrower enum without a compatibility decision.

## 3. Identifier and type policy

- Preserve legacy UUID strings as primary/foreign keys in phase 1.
- Do not migrate money from `Float` to `NUMERIC` in-place without a shadow comparison and client-response compatibility test. `NUMERIC` is preferred for new financial storage, but conversion is a separate approved change.
- Map Prisma `Json` to PostgreSQL JSONB or an equivalent explicitly documented type.
- Map Prisma string arrays such as results/issued prescription IDs with an explicit compatibility representation; do not assume a JPA collection mapping is wire-compatible.
- Store enum values as strings and preserve exact legacy spelling/casing.
- Keep timestamps in an explicit timezone-aware representation and document conversion at the API boundary.

## 4. Status values and transitions

### Appointment

The schema stores this as `String` with documented values `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`. The service code must be treated as the authority for allowed transitions; the target must not allow arbitrary string updates.

| From | Event | To | Actor / rule |
|---|---|---|---|
| `PENDING` | confirm | `CONFIRMED` | authorized booking/admin operation |
| `CONFIRMED` | complete/check-in flow | `COMPLETED` | operational flow and appointment conditions |
| `PENDING`/`CONFIRMED` | cancel | `CANCELLED` | actor and cancellation window must be checked |

### Medical record

`DRAFT → IN_PROGRESS → COMPLETED`. Only authorized doctor/admin/service flow can advance the record; patient access is read-only where the route permits.

### Prescription / prescription service

The enum values are `NOT_STARTED`, `PENDING`, `WAITING`, `PREPARING`, `SERVING`, `WAITING_RESULT`, `RETURNING`, `COMPLETED`, `CANCELLED`, `SKIPPED`, `RESCHEDULED`.

The target must define valid transitions for call, prepare, start, complete, skip, rollback and reschedule. Direct client-supplied status mutation is not sufficient authorization.

### Medication prescription

`DRAFT → SIGNED → DISPENSED`; cancellation must be explicit and actor-checked. Feedback/respond operations must not mutate the clinical status accidentally.

### Work session

`PENDING → APPROVED → IN_PROGRESS → COMPLETED`; `CANCELED` is a terminal cancellation path. Doctor/technician assignment and time overlap must be checked transactionally.

### Payment transaction

The enum values are `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`. PayOS webhook signature, provider transaction ID and order code must be used for idempotent reconciliation.

### Transition gate table

| Aggregate | Allowed actor | Required precondition | Conflict behavior | Idempotency key |
|---|---|---|---|---|
| Appointment booking | PATIENT/RECEPTIONIST/approved staff | slot exists, no overlapping active appointment, patient profile accessible | `409 appointment_slot_conflict` | client booking key or stable slot+patient request key |
| Queue promotion | RECEPTIONIST/scoped desktop credential | counter active, candidate ticket eligible, transaction lock acquired | one winner; loser gets `409` or documented idempotent result | counter + active-ticket operation key |
| Service status | assigned DOCTOR/TECHNICIAN/RECEPTIONIST | current status allows requested transition | `409 invalid_state_transition` | prescription service + transition request key |
| Payment confirm | CASHIER | invoice unpaid and transaction valid | `409 payment_already_final` | invoice code + transaction/provider ID |
| PayOS webhook | provider signature | signature valid and event not processed | duplicate is `200`/no-op; invalid signature is rejected internally | provider event/order code |

## 5. Migration execution strategy

1. Inventory schema and row counts in a non-production copy.
2. Verify every target field/relation mapping before code migration.
3. Start with read-only target adapters where possible.
4. Run backfill into a staging target while preserving legacy IDs.
5. Reconcile counts, nulls, unique keys, foreign keys, enum values and financial totals.
6. Run contract and flow tests against the migrated copy.
7. Use controlled routing; keep NestJS available for rollback.
8. Enable writes only after duplicate side-effect and reconciliation gates pass.

### 5.1. Migration tool decision

Use **Flyway** for Spring-owned schema evolution. Keep the existing Prisma migration history as the legacy source of truth for the current database baseline; do not replay it blindly against a populated production database.

The repository currently contains 13 Prisma migration directories. Their order and SQL checksum must be inventoried into the baseline review before the first Flyway migration is approved.

Phase 1 rules:

- JPA/Hibernate schema generation is validation-only; never `create`, `create-drop` or destructive auto-update in production.
- Establish a reviewed Flyway baseline marker for the already-existing PostgreSQL schema.
- Add only forward, backward-compatible Flyway migrations after the baseline.
- Any rename/drop/type conversion requires expand → backfill → dual-read/compatibility window → contract verification → contract cleanup.
- The baseline marker and first forward migration must be tested against a restored backup, not only an empty database.

## 6. Consistency and idempotency rules

- Appointment creation must have a duplicate-booking key or equivalent conflict check.
- Queue assignment must lock/atomically claim a ticket so concurrent callers cannot serve it twice.
- PayOS webhook processing must be idempotent by provider transaction/order identity.
- Cache/Redis invalidation must be defined for OTP, session, queue and realtime events.
- Any dual-read/dual-write period must have a reconciliation report; silent divergence is a cutover blocker.

## 7. Migration safety gates

- No `ddl-auto=create` or destructive schema startup behavior in production.
- Backup and restore test completed before data migration.
- Flyway/Liquibase decision recorded before introducing target schema changes.
- Dry-run completed on a data copy.
- Reconciliation has zero unexplained orphan or duplicate relations.
- Rollback path is tested and does not duplicate queue/payment side effects.
