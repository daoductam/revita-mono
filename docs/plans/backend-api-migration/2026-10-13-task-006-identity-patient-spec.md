# TASK-006 — Identity và Patient P0

Ngày: 2026-10-13  
Trạng thái: `Approved for planning`  
Phạm vi: `spring-revita-be`  
Nguồn tương thích: `revita-be`, route contract matrix, authz matrix và P0 contract pack

## 1. Mục tiêu

Triển khai vertical slice P0 cho identity và patient trên Spring Boot, dùng lại PostgreSQL schema hiện hữu và giữ tương thích với frontend web/desktop đang gọi backend NestJS.

TASK-006 phải cho phép frontend thực hiện được các flow:

1. Đăng nhập bằng email hoặc số điện thoại.
2. Refresh token, lấy user hiện tại và đăng xuất.
3. Đăng ký patient qua OTP.
4. Xem/cập nhật profile người dùng và patient.
5. Tạo, xem và cập nhật patient profile với kiểm tra ownership.

Không thay đổi schema hiện hữu bằng Hibernate auto-DDL. Không làm mất UUID, role, quan hệ hoặc giá trị enum của hệ thống cũ.

## 2. Quyết định kiến trúc

### 2.1. Compatibility-first

- PostgreSQL hiện hữu là source of truth cho `Auth`, `Patient` và `PatientProfile`.
- Spring dùng JPA entity/repository để truy cập dữ liệu hiện hữu.
- Redis dùng cho registration session và OTP, với TTL tương thích legacy.
- JWT dùng cùng secret/issuer/algorithm đã cấu hình cho Spring resource server.
- Response giữ tên field legacy, đặc biệt `accessToken`, `refreshToken` và `user`.
- Mọi endpoint P0 có hai route tương đương:
  - Canonical: `/api/v1/...`
  - Legacy alias: `/api/...`
- Alias không được bỏ qua authentication, role hoặc ownership.
- Lombok được dùng cho entity, DTO và constructor injection ở mức phù hợp.
- Các lỗi nghiệp vụ đi qua `BusinessException`, `ErrorCode` và `GlobalExceptionHandler` hiện có.

### 2.2. Không thuộc phạm vi

Các endpoint sau vẫn để phase tiếp theo hoặc cần contract/provider riêng:

- Google OAuth redirect/callback và `POST /auth/google/token`.
- Upload avatar và file storage.
- `GET /users/doctors/all` dành cho staff.
- Tìm kiếm patient profile, advanced search và independent profile.
- Link/unlink patient profile.
- Xóa patient profile; legacy route matrix hiện không có DELETE tương ứng.
- Admin, receptionist, doctor, cashier và các module nghiệp vụ khác.

## 3. API contract P0

### 3.1. Authentication

| Method | Canonical route | Legacy alias | Auth | Request | Success |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | `/api/auth/login` | Public | `{ identifier, password }` | `{ accessToken, refreshToken, user }` |
| POST | `/api/v1/auth/refresh` | `/api/auth/refresh` | Public | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| GET | `/api/v1/auth/me` | `/api/auth/me` | JWT | Bearer token | User profile hiện tại |
| POST | `/api/v1/auth/logout` | `/api/auth/logout` | JWT | Bearer token | `{ success, message }` |

Quy tắc:

- `identifier` có thể là email hoặc phone.
- Credential sai, access token thiếu/sai/hết hạn và refresh token sai/hết hạn đều trả HTTP 401 qua error envelope chuẩn.
- Login response phải giữ `accessToken` thay vì chỉ trả `token`.
- JWT access token giữ các claim legacy tối thiểu: `sub`, `phone`, `email`, `role`.
- Với patient, claim `patient` gồm tối thiểu `{ id, patientCode }`.
- Các role khác không được suy diễn thành patient nếu không có bản ghi role tương ứng.
- Không trả password, provider token hoặc refresh token lưu trong database trong user DTO.

### 3.2. Registration và OTP

| Method | Canonical route | Legacy alias | Auth | Request | Success |
|---|---|---|---|---|---|
| POST | `/api/v1/register/step1` | `/api/register/step1` | Public | `{ phone? , email? }` | `{ sessionId, message }` |
| POST | `/api/v1/register/verify-otp` | `/api/register/verify-otp` | Public | `{ sessionId, otp }` | `{ sessionId, message }` |
| POST | `/api/v1/register/resend-otp` | `/api/register/resend-otp` | Public | `{ sessionId }` | `{ message }` |
| POST | `/api/v1/register/complete` | `/api/register/complete` | Public | registration completion DTO | HTTP 201, `{ message, userId }` |

Validation và state machine:

- Step 1 yêu cầu ít nhất một trong `phone` hoặc `email`.
- Phone/email đã tồn tại trả conflict.
- OTP là chuỗi đúng 6 ký tự số.
- OTP có TTL 5 phút.
- Registration session sau khi verify có TTL 30 phút.
- Session hợp lệ chuyển `CREATED -> VERIFIED -> COMPLETED`.
- Không được complete nếu session chưa verify hoặc đã hết hạn.
- Resend không được thực hiện sau khi session đã verified.
- Complete tạo `Auth` role `PATIENT` và `Patient` trong cùng transaction.
- Password phải hash bằng BCrypt; không log OTP/password trong production.
- Complete giữ các field legacy: `name`, `dateOfBirth`, `gender`, `address`, `password`, `sessionId`, optional `citizenId`, `avatar`.
- Gender chấp nhận `male`, `female`, `other` theo contract hiện tại.

### 3.3. User và patient

| Method | Canonical route | Legacy alias | Auth | Success |
|---|---|---|---|---|
| GET | `/api/v1/users/doctors` | `/api/users/doctors` | Public | Danh sách doctor public projection |
| PUT | `/api/v1/users/me` | `/api/users/me` | JWT | User hiện tại sau cập nhật |
| PUT | `/api/v1/patients/me` | `/api/patients/me` | PATIENT | Patient hiện tại sau cập nhật |

Quy tắc:

- `/users/me` chỉ cập nhật subject của JWT, không nhận user ID từ client.
- `/patients/me` chỉ cho role `PATIENT`; không cho sửa patient khác bằng cách thay body/path.
- Không expose password hash hoặc internal provider credentials.
- `/users/doctors` chỉ trả public projection cần cho booking; không trả thông tin nhạy cảm.

### 3.4. Patient profile

| Method | Canonical route | Legacy alias | Auth |
|---|---|---|---|
| GET | `/api/v1/patient-profiles` | `/api/patient-profiles` | PATIENT, DOCTOR, ADMIN, RECEPTIONIST |
| GET | `/api/v1/patient-profiles/patient/{patientId}` | `/api/patient-profiles/patient/{patientId}` | PATIENT, DOCTOR, ADMIN, RECEPTIONIST |
| GET | `/api/v1/patient-profiles/{id}` | `/api/patient-profiles/{id}` | PATIENT, DOCTOR, ADMIN, RECEPTIONIST |
| POST | `/api/v1/patient-profiles` | `/api/patient-profiles` | PATIENT, DOCTOR, ADMIN, RECEPTIONIST |
| PATCH | `/api/v1/patient-profiles/{id}` | `/api/patient-profiles/{id}` | PATIENT, DOCTOR, ADMIN, RECEPTIONIST |

DTO create/update phải giữ các field legacy cần thiết:

- `patientId` optional khi tạo profile độc lập trong contract legacy, nhưng P0 chỉ cho patient tự tạo profile gắn với chính mình; flow independent profile để phase sau.
- `name`, `phone`, `dateOfBirth`, `gender`, `address`, `occupation`.
- `emergencyContact`, `healthInsurance`, `relationship`.
- `isPregnant`, `isDisabled`.

Ownership:

- Patient chỉ được đọc/tạo/cập nhật profile có `patientId` thuộc chính patient trong JWT.
- Patient truy cập profile của Patient khác phải nhận 403, kể cả khi biết UUID/profile code.
- Staff role đúng route có thể đọc/cập nhật theo role policy; P0 chưa suy diễn care-context ngoài contract hiện có.
- Không tin `patientId` từ request nếu subject/role không cho phép.
- Resource không tồn tại trả 404; resource tồn tại nhưng không thuộc quyền trả 403 theo policy thống nhất.

## 4. Data model và persistence

Tạo mapping tối thiểu:

- `AuthEntity` → bảng legacy `Auth`/bảng thực tế tương ứng.
- `PatientEntity` → bảng legacy `Patient`.
- `PatientProfileEntity` → bảng legacy `PatientProfile`.

> Tên bảng/column cuối cùng phải xác nhận bằng schema Prisma và database inspection trước migration SQL. Không tự tạo bảng thay thế chỉ vì JPA entity chưa có.

- UUID được giữ nguyên dạng legacy.
- Role lưu dưới dạng string và giữ chính xác các giá trị `DOCTOR`, `PATIENT`, `RECEPTIONIST`, `ADMIN`, `CASHIER`, `TECHNICIAN`.
- `dateOfBirth` và timestamp phải timezone-aware ở boundary.
- JSON `emergencyContact` phải map rõ ràng, không serialize thành chuỗi không tương thích.
- `ddl-auto` production giữ validation/none; Flyway baseline chưa được tự động thay đổi trong TASK-006.

## 5. Security và error contract

- Public routes: auth login/refresh, register routes, doctors public.
- Các route còn lại bắt buộc Bearer JWT.
- Bật method security cho role guard.
- Authorization gồm hai lớp:
  1. Controller/method role check.
  2. Service-level resource ownership check.
- 401 dùng khi thiếu/sai/hết hạn credential.
- 403 dùng khi đã authenticated nhưng sai role hoặc không sở hữu resource.
- 404 dùng khi resource không tồn tại.
- 409 dùng cho duplicate phone/email/citizen ID hoặc conflict nghiệp vụ.
- Mọi lỗi trả `ApiErrorResponse` hiện có, có `code`, `message`, `status`, `path`, `timestamp`, `requestId` theo contract foundation.

## 6. Testing contract

### Authentication

- Login đúng bằng email.
- Login đúng bằng phone.
- Credential sai trả 401 và không rò rỉ lý do chi tiết.
- Refresh token đúng tạo token mới.
- Refresh token sai/hết hạn trả 401.
- `/api/...` và `/api/v1/...` cho cùng response semantics.
- `/auth/me` trả đúng user và role-specific patient data.
- Logout yêu cầu JWT và trả response legacy.

### Registration

- Step 1 với phone.
- Step 1 với email.
- Step 1 thiếu cả hai bị validation error.
- Duplicate phone/email bị 409.
- Verify OTP đúng/sai/hết hạn.
- Resend OTP và TTL session.
- Complete trước verify bị từ chối.
- Complete thành công tạo Auth + Patient atomically.
- Password không xuất hiện trong response/log.

### Authorization/ownership

- Anonymous gọi protected route nhận 401.
- Role không hợp lệ nhận 403.
- Patient A không đọc profile Patient B.
- Patient A không cập nhật profile Patient B.
- Patient chỉ tạo profile cho chính mình.
- Staff route không được bypass ownership policy ngoài quyền đã định nghĩa.

### Client flow

- Web login → lưu access/refresh token → `/me`.
- Web refresh token → token mới → `/me`.
- Web đăng ký → step1 → verify → complete.
- Web patient profile list/create/update.
- Desktop auth smoke test với login, refresh, me, logout và role PATIENT.

## 7. Acceptance criteria

- [ ] Tất cả endpoint P0 trong mục 3 có canonical và legacy alias.
- [ ] Không có endpoint P0 dùng response khác nhau chỉ vì alias.
- [ ] Login/refresh/me/logout tương thích field legacy.
- [ ] Registration OTP có state/TTL đúng contract.
- [ ] Auth + Patient creation dùng transaction.
- [ ] 401/403/404/409 đi qua exception contract chuẩn.
- [ ] Ownership test chứng minh Patient A không đọc/cập nhật Patient B.
- [ ] Test suite Spring pass.
- [ ] Web/desktop auth smoke tests pass hoặc có test evidence tương đương.
- [ ] Không dùng Hibernate auto-create/update để phá schema hiện tại.

## 8. Risks và quyết định để plan xử lý

1. Database runtime/schema thực tế chưa được snapshot trong repo: plan phải có bước kiểm tra mapping trước khi bật integration test PostgreSQL.
2. JWT legacy có thời hạn không đồng nhất giữa login thường và Google login: TASK-006 chỉ chốt login thường; Google để phase sau.
3. Frontend cũ có lúc đọc `token` và lúc đọc `accessToken`: backend giữ `accessToken`; compatibility adapter phía frontend phải tiếp tục normalize như hiện tại.
4. Redis/OTP service ngoài môi trường test: cần fake/in-memory test adapter hoặc Testcontainers, nhưng không được thay đổi production contract.
5. Legacy controller có một số route public/unguarded chưa an toàn: P0 áp dụng authz matrix đã chốt, không sao chép behavior 200-error của `/auth/me` cũ.
