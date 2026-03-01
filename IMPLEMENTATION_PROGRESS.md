# HMS Server Implementation Progress

## Scope
- Phase 1: Project setup (Node.js + EJS + Tailwind + SweetAlert + MySQL baseline)
- Phase 2: Authentication & RBAC

## Current Status
- [x] Folder bootstrap in `hospital-management-system-server/`
- [x] Node project initialized (`package.json`, scripts, dependencies)
- [x] Environment template (`.env.example`)
- [x] Express app setup with EJS and session middleware
- [x] Auth module created (`login`, `logout`)
- [x] RBAC middleware prepared (`requireAuth`, `allowRoles`)
- [x] Role-based dashboard routing (`admin`, `doctor`, `patient`, `pharmacist`)
- [x] EJS views for login + role dashboards
- [x] Imported existing UI templates from `hospital-management-system-template/templates` to `src/views/pages`
- [x] Added template renderer route: `/templates/*` -> `src/views/pages/**`
- [x] Login page now uses template `pages/auth/sign-in.ejs` (server-auth wired)
- [x] `/dashboard` now renders role landing page directly (clean URL) with `baseHref` so relative template links stay consistent
- [x] Protected dashboard template routes with auth + role checks
- [x] Added CSRF protection middleware and wired `_csrf` token in login/logout forms
- [x] Added session config module with secure cookie defaults + optional MySQL session store (`SESSION_STORE=mysql`)
- [x] Added audit logging (`auth.login.*`, `auth.logout`, generic mutation tracking)
- [x] Added SQL seed for DB auth demo users (`sql/phase2_seed_demo_users.sql`)
- [x] SQL bootstrap schema for `roles`, `users`, `audit_logs`

## Auth Mode
- `AUTH_MODE=demo` (default)
- `SESSION_STORE=memory` (default, fallback safe mode)
- Demo accounts:
  - `admin@gmail.com` / `password` -> role `admin`
  - `docter@gmail.com` / `password` -> role `doctor`
  - `patient@gmail.com` / `password` -> role `patient`
  - `pharmacist@gmail.com` / `password` -> role `pharmacist`

## Files Added
- `package.json`
- `.env.example`
- `src/server.js`
- `src/app.js`
- `src/config/database.js`
- `src/middlewares/auth.js`
- `src/middlewares/rbac.js`
- `src/modules/auth/auth.controller.js`
- `src/modules/auth/auth.service.js`
- `src/modules/auth/auth.routes.js`
- `src/routes/index.js`
- `src/views/auth/login.ejs`
- `src/views/dashboards/admin.ejs`
- `src/views/dashboards/doctor.ejs`
- `src/views/dashboards/patient.ejs`
- `src/views/dashboards/pharmacist.ejs`
- `src/views/dashboards/default.ejs`
- `src/views/partials/forbidden.ejs`
- `src/views/pages/**` (copied from template project)
- `sql/phase1_phase2_auth_rbac.sql`
- `sql/phase2_seed_demo_users.sql`
- `sql/schema.sql` (PostgreSQL enterprise schema from brief "Structure Table")
- `sql/seed_dummy_data.sql` (dummy data for all core tables)
- `src/config/session.js`
- `src/middlewares/csrf.js`
- `src/middlewares/audit.js`
- `src/modules/audit/audit.service.js`

## Notes
- `express-mysql-session` sudah ditambahkan di `package.json`, tetapi instalasi paket belum bisa dijalankan di environment ini karena akses internet ke npm registry terblokir.
- `sql/schema.sql` sudah disesuaikan ulang ke format MySQL 8+ agar langsung kompatibel saat dieksekusi dari DBeaver/MySQL connection.
- FK seed fix: role IDs dibuat deterministik di `sql/schema.sql` + `sql/seed_dummy_data.sql` agar `users.role_id` tidak gagal.
- Route `/` sekarang menampilkan landing page template (`pages/landing-page`) dan tidak redirect ke login.
- Link landing page sudah disesuaikan ke route server (contoh: `Login` -> `/login`, bukan `auth/sign-in.html`).
- URL clean untuk pricing sudah aktif: `/pricing` (beserta update link navigasi landing/pricing).
- Audit logging warning diperbaiki: fallback error message + throttle log agar tidak spam saat DB down.
- DB diagnostics improvement:
  - `npm run db:check` untuk validasi koneksi database dari environment aktif
  - dukungan `DB_SOCKET_PATH` + `DB_PREFER_IPV4=true` untuk kasus `localhost`/IPv6/socket mismatch
- CRUD awal User Management (Admin) sudah diimplementasikan:
  - List + search/filter
  - Create user
  - Update user (quick edit)
  - Activate/Deactivate user
  - Route: `/templates/dashboard-admin/user-management.html` + POST endpoints `/admin/users/*`
- CRUD awal Patient Directory (Admin) sudah diimplementasikan:
  - List + search/filter (query, insurance, status)
  - Create patient
  - Update patient (quick edit)
  - Active/Discharged toggle via soft delete (`deleted_at`)
  - Route: `/templates/dashboard-admin/patient-directory.html` + POST endpoints `/admin/patients/*`
- CRUD awal Inventory & Pharmacy sudah diimplementasikan:
  - Inventory summary cards (total items, low stock, expiring soon)
  - List + search/filter (query, category, stock status)
  - Create item
  - Update item (quick edit)
  - Activate/Deactivate item
  - Batch tracking list + add batch
  - Route: `/templates/dashboard-admin/inventory-management.html` + POST endpoints `/admin/inventory/*`
- CRUD awal Financial & Billing sudah diimplementasikan:
  - Financial summary cards (revenue, pending claims, outstanding bills, savings)
  - Invoice list + filter (range, status, search)
  - Invoice detail panel (gross/discount/net/paid/outstanding)
  - Post payment dan auto-update invoice status
  - Manual invoice status update
  - Insurance claim queue preview
  - Route: `/templates/dashboard-admin/financial-management.html` + POST endpoints `/admin/finance/*`
- Modul awal Schedule & Wards sudah diimplementasikan:
  - Doctor shifts (list per week + create + delete)
  - Ward room occupancy (list + create/update room data)
  - Transfer queue (create + status update)
  - Auto-bootstrap tables: `doctor_shifts`, `ward_rooms`, `transfer_queue`
  - Route: `/templates/dashboard-admin/schedule-ward-management.html` + POST endpoints `/admin/schedule/*`, `/admin/wards/*`, `/admin/transfers/*`

## Next Recommended Steps
1. Jalankan bootstrap SQL: `sql/phase1_phase2_auth_rbac.sql` lalu `sql/phase2_seed_demo_users.sql`.
2. Ubah `.env` ke `AUTH_MODE=db` dan (opsional) `SESSION_STORE=mysql`.
3. Install dependency baru `express-mysql-session` saat koneksi npm tersedia.
4. Lanjut Phase 3 (Patients + Encounters) + rate limiting.
