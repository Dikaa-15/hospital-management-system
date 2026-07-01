-- HMS Full Schema + Seed Data (MySQL 8+, localhost)
-- Consolidated from: schema.sql, phase1_phase2_auth_rbac.sql,
-- phase2_seed_demo_users.sql, seed_dummy_data.sql, and the inline
-- CREATE TABLE statements in schedule.service.js / dashboard.service.js.
--
-- Usage:
--   mysql -u root -p hms < sql/schema.sql

-- Optional: pilih database aktif
-- CREATE DATABASE IF NOT EXISTS hms;
-- USE hms;

SET NAMES utf8mb4;

-- =========================================================
-- 1) Users & Authorization (RBAC)
-- =========================================================
CREATE TABLE IF NOT EXISTS master_specializations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  spec_name VARCHAR(100) UNIQUE NOT NULL,
  spec_code VARCHAR(10) UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  role_name VARCHAR(50) UNIQUE NOT NULL,
  permissions JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50),
  title_prefix VARCHAR(20),
  title_suffix VARCHAR(20),
  role_id CHAR(36),
  specialization_id CHAR(36),
  email VARCHAR(100) UNIQUE,
  phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_users_specialization FOREIGN KEY (specialization_id) REFERENCES master_specializations(id)
) ENGINE=InnoDB;

-- =========================================================
-- 2) Patient & Registration
-- =========================================================
CREATE TABLE IF NOT EXISTS patients (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  medical_record_number VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  gender VARCHAR(20),
  date_of_birth DATE NOT NULL,
  phone_number VARCHAR(20),
  email VARCHAR(150) UNIQUE,
  address TEXT,
  emergency_name VARCHAR(200),
  emergency_phone VARCHAR(20),
  insurance_provider VARCHAR(100),
  insurance_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT chk_patients_gender CHECK (gender IN ('Male', 'Female', 'Other') OR gender IS NULL)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS encounters (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id CHAR(36) NOT NULL,
  doctor_id CHAR(36) NOT NULL,
  visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  admission_type VARCHAR(20),
  payment_type VARCHAR(20),
  status VARCHAR(20) DEFAULT 'Antre',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_encounters_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_encounters_doctor FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT chk_encounters_admission CHECK (admission_type IN ('Rawat Jalan', 'Rawat Inap', 'IGD') OR admission_type IS NULL),
  CONSTRAINT chk_encounters_payment CHECK (payment_type IN ('Mandiri', 'BPJS', 'Asuransi Swasta') OR payment_type IS NULL),
  CONSTRAINT chk_encounters_status CHECK (status IN ('Antre', 'Pemeriksaan', 'Farmasi', 'Selesai', 'Dibatalkan'))
) ENGINE=InnoDB;

-- =========================================================
-- 3) Clinical & Medical Services (EMR)
-- =========================================================
CREATE TABLE IF NOT EXISTS clinical_vitals (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  encounter_id CHAR(36) NOT NULL,
  systolic_bp INT,
  diastolic_bp INT,
  heart_rate INT,
  temp_celcius DECIMAL(4,2),
  spo2 INT,
  weight_kg DECIMAL(5,2),
  height_cm DECIMAL(5,2),
  bmi DECIMAL(6,2) GENERATED ALWAYS AS (
    weight_kg / NULLIF((height_cm / 100 * height_cm / 100), 0)
  ) STORED,
  recorded_by CHAR(36),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinical_vitals_encounter FOREIGN KEY (encounter_id) REFERENCES encounters(id),
  CONSTRAINT fk_clinical_vitals_user FOREIGN KEY (recorded_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinical_notes (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  encounter_id CHAR(36) UNIQUE NOT NULL,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  is_finalized BOOLEAN DEFAULT FALSE,
  finalized_at TIMESTAMP NULL,
  attending_physician_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinical_notes_encounter FOREIGN KEY (encounter_id) REFERENCES encounters(id),
  CONSTRAINT fk_clinical_notes_physician FOREIGN KEY (attending_physician_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinical_diagnoses (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  encounter_id CHAR(36),
  icd10_code VARCHAR(10) NOT NULL,
  priority VARCHAR(20) DEFAULT 'Secondary',
  status VARCHAR(20) DEFAULT 'Confirmed',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clinical_diagnoses_encounter FOREIGN KEY (encounter_id) REFERENCES encounters(id),
  CONSTRAINT chk_clinical_diagnoses_priority CHECK (priority IN ('Primary', 'Secondary')),
  CONSTRAINT chk_clinical_diagnoses_status CHECK (status IN ('Suspected', 'Confirmed', 'Refuted'))
) ENGINE=InnoDB;

-- =========================================================
-- 4) Inventory & Pharmacy
-- =========================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  item_code VARCHAR(50) UNIQUE NOT NULL,
  item_name VARCHAR(150) NOT NULL,
  category_id CHAR(36),
  base_unit VARCHAR(20) NOT NULL,
  min_stock INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_batches (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  item_id CHAR(36),
  location_id CHAR(36),
  batch_number VARCHAR(50) NOT NULL,
  expiry_date DATE NOT NULL,
  current_qty DECIMAL(12,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_batches_item FOREIGN KEY (item_id) REFERENCES inventory_items(id)
) ENGINE=InnoDB;

-- =========================================================
-- 5) Finance & Billing
-- =========================================================
CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  encounter_id CHAR(36) NOT NULL,
  invoice_no VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_encounter FOREIGN KEY (encounter_id) REFERENCES encounters(id),
  CONSTRAINT chk_invoices_status CHECK (status IN ('Draft', 'Unpaid', 'Paid', 'Cancelled'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_id CHAR(36),
  payment_method VARCHAR(50),
  amount_paid DECIMAL(15,2) NOT NULL,
  recorded_by CHAR(36),
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_payments_user FOREIGN KEY (recorded_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- =========================================================
-- 6) Scheduling & Ward Management
-- (mirrors the runtime "CREATE TABLE IF NOT EXISTS" bootstrap in
-- schedule.service.js / doctor/dashboard.service.js)
-- =========================================================
CREATE TABLE IF NOT EXISTS doctor_shifts (
  id CHAR(36) PRIMARY KEY,
  doctor_id CHAR(36) NOT NULL,
  shift_date DATE NOT NULL,
  shift_type VARCHAR(20) NOT NULL,
  department VARCHAR(100) NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_doctor_shifts_doctor FOREIGN KEY (doctor_id) REFERENCES users(id),
  CONSTRAINT chk_doctor_shifts_type CHECK (shift_type IN ('Morning', 'Afternoon', 'Night')),
  UNIQUE KEY uq_doctor_shift_date_type (doctor_id, shift_date, shift_type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ward_rooms (
  id CHAR(36) PRIMARY KEY,
  room_code VARCHAR(50) UNIQUE NOT NULL,
  room_class VARCHAR(30) NOT NULL,
  floor_no INT DEFAULT 1,
  capacity INT DEFAULT 1,
  occupied_count INT DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Available',
  pic_doctor_id CHAR(36) NULL,
  patient_name VARCHAR(150) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ward_rooms_pic_doctor FOREIGN KEY (pic_doctor_id) REFERENCES users(id),
  CONSTRAINT chk_ward_status CHECK (status IN ('Available', 'Occupied', 'Cleaning'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transfer_queue (
  id CHAR(36) PRIMARY KEY,
  patient_id CHAR(36) NULL,
  patient_name VARCHAR(150) NOT NULL,
  from_unit VARCHAR(50) NOT NULL,
  target_room_id CHAR(36) NULL,
  status VARCHAR(30) DEFAULT 'Pending',
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_transfer_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_transfer_target_room FOREIGN KEY (target_room_id) REFERENCES ward_rooms(id),
  CONSTRAINT chk_transfer_status CHECK (status IN ('Pending', 'Approved', 'Moved', 'Cancelled'))
) ENGINE=InnoDB;

-- =========================================================
-- 7) Audit Trail
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id CHAR(36),
  action VARCHAR(100) NOT NULL,
  object_type VARCHAR(50),
  object_id VARCHAR(100),
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- =========================================================
-- Recommended Indexes
-- =========================================================
CREATE INDEX idx_patients_mrn ON patients (medical_record_number);
CREATE INDEX idx_patients_full_name ON patients (first_name, last_name);
CREATE INDEX idx_encounters_patient_id ON encounters (patient_id);
CREATE INDEX idx_encounters_doctor_id ON encounters (doctor_id);
CREATE INDEX idx_encounters_visit_date ON encounters (visit_date);
CREATE INDEX idx_clinical_vitals_encounter_id ON clinical_vitals (encounter_id);
CREATE INDEX idx_clinical_diagnoses_encounter_id ON clinical_diagnoses (encounter_id);
CREATE INDEX idx_inventory_batches_item_id ON inventory_batches (item_id);
CREATE INDEX idx_inventory_batches_expiry_date ON inventory_batches (expiry_date);
CREATE INDEX idx_invoices_encounter_id ON invoices (encounter_id);
CREATE INDEX idx_invoices_status ON invoices (status);
CREATE INDEX idx_payments_invoice_id ON payments (invoice_id);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

-- =========================================================
-- Seed: Master data
-- =========================================================
INSERT INTO master_specializations (id, spec_name, spec_code, is_active)
VALUES
  ('s1111111-1111-1111-1111-111111111111', 'Spesialis Penyakit Dalam', 'SP.PD', 1),
  ('s2222222-2222-2222-2222-222222222222', 'Spesialis Anak', 'SP.A', 1),
  ('s3333333-3333-3333-3333-333333333333', 'Spesialis Radiologi', 'SP.Rad', 1),
  ('s4444444-4444-4444-4444-444444444444', 'Dokter Umum', 'DGU', 1)
ON DUPLICATE KEY UPDATE
  spec_name = VALUES(spec_name),
  spec_code = VALUES(spec_code),
  is_active = VALUES(is_active);

INSERT INTO roles (id, role_name, permissions)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin', JSON_OBJECT('all', true)),
  ('22222222-2222-2222-2222-222222222222', 'doctor', JSON_OBJECT('can_view_medical_records', true, 'can_prescribe', true)),
  ('33333333-3333-3333-3333-333333333333', 'patient', JSON_OBJECT('can_view_self_record', true)),
  ('44444444-4444-4444-4444-444444444444', 'pharmacist', JSON_OBJECT('can_dispense', true)),
  ('55555555-5555-5555-5555-555555555555', 'nurse', JSON_OBJECT('can_view_medical_records', true))
ON DUPLICATE KEY UPDATE
  role_name = VALUES(role_name),
  permissions = VALUES(permissions);

-- =========================================================
-- Seed: Users (dummy data — password for all: "password")
-- bcrypt hash: $2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u
-- Matches the demo accounts used when AUTH_MODE=demo, so login
-- works the same whether AUTH_MODE=demo or AUTH_MODE=db.
-- =========================================================
INSERT INTO users (
  id, employee_id, username, password_hash, first_name, last_name, title_prefix, title_suffix,
  role_id, specialization_id, email, phone_number, is_active
)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ADM-0001', 'admin@gmail.com', '$2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u', 'Admin', 'HMS', NULL, NULL, '11111111-1111-1111-1111-111111111111', NULL, 'admin@gmail.com', '081200000001', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'DOC-0001', 'docter@gmail.com', '$2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u', 'Rebecca', 'Chen', 'dr.', 'Sp.PD', '22222222-2222-2222-2222-222222222222', 's1111111-1111-1111-1111-111111111111', 'docter@gmail.com', '081200000002', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'PAT-0001', 'patient@gmail.com', '$2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u', 'John', 'Doe', NULL, NULL, '33333333-3333-3333-3333-333333333333', NULL, 'patient@gmail.com', '081200000003', 1),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'PHA-0001', 'pharmacist@gmail.com', '$2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u', 'Nadia', 'Rahman', NULL, NULL, '44444444-4444-4444-4444-444444444444', NULL, 'pharmacist@gmail.com', '081200000004', 1),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'NUR-0001', 'nurse1', '$2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u', 'Siti', 'Aminah', NULL, NULL, '55555555-5555-5555-5555-555555555555', NULL, 'nurse1@hospital.local', '081200000005', 1)
ON DUPLICATE KEY UPDATE
  employee_id = VALUES(employee_id),
  username = VALUES(username),
  password_hash = VALUES(password_hash),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  role_id = VALUES(role_id),
  specialization_id = VALUES(specialization_id),
  email = VALUES(email),
  phone_number = VALUES(phone_number),
  is_active = VALUES(is_active);

-- =========================================================
-- Seed: Patients (dummy data)
-- =========================================================
INSERT INTO patients (
  id, medical_record_number, first_name, last_name, gender, date_of_birth, phone_number, email,
  address, emergency_name, emergency_phone, insurance_provider, insurance_number
)
VALUES
  ('p1111111-1111-1111-1111-111111111111', 'MRN-000001', 'John', 'Doe', 'Male', '1980-06-10', '081300000001', 'john.doe@example.com', 'Jl. Sudirman No. 10', 'Jane Doe', '081311111111', 'BPJS', 'BPJS-000001'),
  ('p2222222-2222-2222-2222-222222222222', 'MRN-000002', 'Sarah', 'Wijaya', 'Female', '1992-02-18', '081300000002', 'sarah.w@example.com', 'Jl. Melati No. 22', 'Budi Wijaya', '081322222222', 'Prudential', 'PRU-000002'),
  ('p3333333-3333-3333-3333-333333333333', 'MRN-000003', 'Ahmad', 'Fauzi', 'Male', '1975-11-03', '081300000003', 'ahmad.f@example.com', 'Jl. Kenanga No. 5', 'Rina Fauzi', '081333333333', 'Mandiri', 'SELF-000003'),
  ('p4444444-4444-4444-4444-444444444444', 'MRN-000004', 'Maya', 'Putri', 'Female', '1988-09-25', '081300000004', 'maya.p@example.com', 'Jl. Mawar No. 17', 'Dimas Putra', '081344444444', 'BPJS', 'BPJS-000004')
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  gender = VALUES(gender),
  date_of_birth = VALUES(date_of_birth),
  phone_number = VALUES(phone_number),
  email = VALUES(email),
  address = VALUES(address),
  emergency_name = VALUES(emergency_name),
  emergency_phone = VALUES(emergency_phone),
  insurance_provider = VALUES(insurance_provider),
  insurance_number = VALUES(insurance_number);

-- =========================================================
-- Seed: Encounters
-- =========================================================
INSERT INTO encounters (
  id, patient_id, doctor_id, visit_date, admission_type, payment_type, status
)
VALUES
  ('e1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', DATE_SUB(NOW(), INTERVAL 3 DAY), 'Rawat Jalan', 'BPJS', 'Selesai'),
  ('e2222222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', DATE_SUB(NOW(), INTERVAL 2 DAY), 'IGD', 'Asuransi Swasta', 'Farmasi'),
  ('e3333333-3333-3333-3333-333333333333', 'p3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', DATE_SUB(NOW(), INTERVAL 1 DAY), 'Rawat Inap', 'Mandiri', 'Pemeriksaan'),
  ('e4444444-4444-4444-4444-444444444444', 'p4444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW(), 'Rawat Jalan', 'BPJS', 'Antre')
ON DUPLICATE KEY UPDATE
  patient_id = VALUES(patient_id),
  doctor_id = VALUES(doctor_id),
  visit_date = VALUES(visit_date),
  admission_type = VALUES(admission_type),
  payment_type = VALUES(payment_type),
  status = VALUES(status);

-- =========================================================
-- Seed: Clinical Vitals
-- =========================================================
INSERT INTO clinical_vitals (
  id, encounter_id, systolic_bp, diastolic_bp, heart_rate, temp_celcius, spo2, weight_kg, height_cm, recorded_by
)
VALUES
  ('v1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 120, 80, 76, 36.80, 98, 72.50, 175.00, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  ('v2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 130, 85, 88, 37.20, 97, 58.00, 160.00, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  ('v3333333-3333-3333-3333-333333333333', 'e3333333-3333-3333-3333-333333333333', 145, 92, 90, 37.90, 95, 82.00, 170.00, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
ON DUPLICATE KEY UPDATE
  systolic_bp = VALUES(systolic_bp),
  diastolic_bp = VALUES(diastolic_bp),
  heart_rate = VALUES(heart_rate),
  temp_celcius = VALUES(temp_celcius),
  spo2 = VALUES(spo2),
  weight_kg = VALUES(weight_kg),
  height_cm = VALUES(height_cm),
  recorded_by = VALUES(recorded_by);

-- =========================================================
-- Seed: Clinical Notes
-- =========================================================
INSERT INTO clinical_notes (
  id, encounter_id, subjective, objective, assessment, plan, is_finalized, finalized_at, attending_physician_id
)
VALUES
  ('n1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'Batuk pilek 3 hari', 'Suhu normal, tenggorokan kemerahan', 'Common Cold', 'Istirahat, cairan cukup, obat simptomatik', 1, DATE_SUB(NOW(), INTERVAL 3 DAY), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('n2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 'Nyeri dada ringan', 'EKG awal normal, observasi IGD', 'Chest Pain Observation', 'Lab troponin, observasi 6 jam', 1, DATE_SUB(NOW(), INTERVAL 2 DAY), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('n3333333-3333-3333-3333-333333333333', 'e3333333-3333-3333-3333-333333333333', 'Kontrol pasca operasi', 'Luka operasi baik', 'Post-Op Check-up', 'Lanjut antibiotik 5 hari', 0, NULL, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON DUPLICATE KEY UPDATE
  subjective = VALUES(subjective),
  objective = VALUES(objective),
  assessment = VALUES(assessment),
  plan = VALUES(plan),
  is_finalized = VALUES(is_finalized),
  finalized_at = VALUES(finalized_at),
  attending_physician_id = VALUES(attending_physician_id);

-- =========================================================
-- Seed: Clinical Diagnoses
-- =========================================================
INSERT INTO clinical_diagnoses (
  id, encounter_id, icd10_code, priority, status
)
VALUES
  ('d1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'J00', 'Primary', 'Confirmed'),
  ('d2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 'R07.4', 'Primary', 'Confirmed'),
  ('d3333333-3333-3333-3333-333333333333', 'e3333333-3333-3333-3333-333333333333', 'Z09', 'Secondary', 'Suspected')
ON DUPLICATE KEY UPDATE
  icd10_code = VALUES(icd10_code),
  priority = VALUES(priority),
  status = VALUES(status);

-- =========================================================
-- Seed: Inventory Items
-- =========================================================
INSERT INTO inventory_items (
  id, item_code, item_name, category_id, base_unit, min_stock, is_active
)
VALUES
  ('i1111111-1111-1111-1111-111111111111', 'OBT-AMOX-500', 'Amoxicillin 500mg', 'cat-antibiotic', 'Tablet', 200, 1),
  ('i2222222-2222-2222-2222-222222222222', 'OBT-PARA-500', 'Paracetamol 500mg', 'cat-analgesic', 'Tablet', 300, 1),
  ('i3333333-3333-3333-3333-333333333333', 'ALK-SYR-5ML', 'Syringe 5ml', 'cat-consumable', 'Pcs', 500, 1),
  ('i4444444-4444-4444-4444-444444444444', 'ALK-PPE-MASK', 'Medical Mask', 'cat-ppe', 'Box', 50, 1)
ON DUPLICATE KEY UPDATE
  item_name = VALUES(item_name),
  category_id = VALUES(category_id),
  base_unit = VALUES(base_unit),
  min_stock = VALUES(min_stock),
  is_active = VALUES(is_active);

-- =========================================================
-- Seed: Inventory Batches
-- =========================================================
INSERT INTO inventory_batches (
  id, item_id, location_id, batch_number, expiry_date, current_qty
)
VALUES
  ('b1111111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111', 'LOC-PHARM-01', 'AMX-2401-A', DATE_ADD(CURDATE(), INTERVAL 240 DAY), 850),
  ('b2222222-2222-2222-2222-222222222222', 'i2222222-2222-2222-2222-222222222222', 'LOC-PHARM-01', 'PAR-2402-B', DATE_ADD(CURDATE(), INTERVAL 120 DAY), 120),
  ('b3333333-3333-3333-3333-333333333333', 'i3333333-3333-3333-3333-333333333333', 'LOC-WARE-02', 'SYR-2401-C', DATE_ADD(CURDATE(), INTERVAL 365 DAY), 1200),
  ('b4444444-4444-4444-4444-444444444444', 'i4444444-4444-4444-4444-444444444444', 'LOC-WARE-02', 'MSK-2401-A', DATE_ADD(CURDATE(), INTERVAL 540 DAY), 65)
ON DUPLICATE KEY UPDATE
  item_id = VALUES(item_id),
  location_id = VALUES(location_id),
  batch_number = VALUES(batch_number),
  expiry_date = VALUES(expiry_date),
  current_qty = VALUES(current_qty);

-- =========================================================
-- Seed: Invoices
-- =========================================================
INSERT INTO invoices (
  id, encounter_id, invoice_no, total_amount, discount_amount, net_amount, status
)
VALUES
  ('inv11111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'INV-202602-0001', 350000.00, 50000.00, 300000.00, 'Paid'),
  ('inv22222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 'INV-202602-0002', 1250000.00, 150000.00, 1100000.00, 'Unpaid'),
  ('inv33333-3333-3333-3333-333333333333', 'e3333333-3333-3333-3333-333333333333', 'INV-202602-0003', 2750000.00, 0.00, 2750000.00, 'Draft'),
  ('inv44444-4444-4444-4444-444444444444', 'e4444444-4444-4444-4444-444444444444', 'INV-202602-0004', 450000.00, 0.00, 450000.00, 'Unpaid')
ON DUPLICATE KEY UPDATE
  encounter_id = VALUES(encounter_id),
  total_amount = VALUES(total_amount),
  discount_amount = VALUES(discount_amount),
  net_amount = VALUES(net_amount),
  status = VALUES(status);

-- =========================================================
-- Seed: Payments
-- =========================================================
INSERT INTO payments (
  id, invoice_id, payment_method, amount_paid, recorded_by, payment_date
)
VALUES
  ('pay11111-1111-1111-1111-111111111111', 'inv11111-1111-1111-1111-111111111111', 'QRIS', 300000.00, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  ('pay22222-2222-2222-2222-222222222222', 'inv22222-2222-2222-2222-222222222222', 'Insurance', 250000.00, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE
  invoice_id = VALUES(invoice_id),
  payment_method = VALUES(payment_method),
  amount_paid = VALUES(amount_paid),
  recorded_by = VALUES(recorded_by),
  payment_date = VALUES(payment_date);

-- =========================================================
-- Seed: Audit Logs
-- =========================================================
INSERT INTO audit_logs (
  actor_user_id, action, object_type, object_id, metadata, created_at
)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'auth.login.success', 'auth', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', JSON_OBJECT('role', 'admin'), DATE_SUB(NOW(), INTERVAL 1 HOUR)),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'encounter.update', 'encounter', 'e3333333-3333-3333-3333-333333333333', JSON_OBJECT('status_from', 'Antre', 'status_to', 'Pemeriksaan'), DATE_SUB(NOW(), INTERVAL 35 MINUTE)),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'inventory.dispense', 'inventory', 'i1111111-1111-1111-1111-111111111111', JSON_OBJECT('qty', 20, 'batch', 'AMX-2401-A'), DATE_SUB(NOW(), INTERVAL 15 MINUTE));
