-- HMS Enterprise Schema (MySQL 8+)
-- Source: "Hospital Management System.txt" -> Arsitektur Database / Structure Table

-- Optional: pilih database aktif
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
  CONSTRAINT chk_encounters_status CHECK (status IN ('Antre', 'Pemeriksaan', 'Farmasi', 'Selesai'))
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
-- 6) Audit Trail
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

-- Optional starter roles
INSERT IGNORE INTO roles (id, role_name, permissions)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin', JSON_OBJECT('all', true)),
  ('22222222-2222-2222-2222-222222222222', 'doctor', JSON_OBJECT('can_view_medical_records', true, 'can_prescribe', true)),
  ('33333333-3333-3333-3333-333333333333', 'patient', JSON_OBJECT('can_view_self_record', true)),
  ('44444444-4444-4444-4444-444444444444', 'pharmacist', JSON_OBJECT('can_dispense', true));
