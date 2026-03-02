-- HMS Dummy Data Seed (MySQL 8+)
-- Run after sql/schema.sql
-- Optional:
-- USE hms;

SET NAMES utf8mb4;

-- =========================================================
-- Master: Specializations
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

-- =========================================================
-- Master: Roles
-- =========================================================
  INSERT INTO roles (id, role_name, permissions)
  VALUES
    ('11111111-1111-1111-1111-111111111111', 'admin', JSON_OBJECT('all', true)),
    ('22222222-2222-2222-2222-222222222222', 'doctor', JSON_OBJECT('can_view_medical_records', true, 'can_prescribe', true)),
    ('33333333-3333-3333-3333-333333333333', 'patient', JSON_OBJECT('can_view_self_record', true)),
    ('44444444-4444-4444-4444-444444444444', 'pharmacist', JSON_OBJECT('can_dispense', true)),
    ('55555555-5555-5555-5555-555555555555', 'nurse', JSON_OBJECT('can_view_medical_records', true))
ON DUPLICATE KEY UPDATE
  id = VALUES(id),
  role_name = VALUES(role_name),
  permissions = VALUES(permissions);

-- =========================================================
-- Users (password all: "password")
-- bcrypt hash: $2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u
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
-- Patients
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
-- Encounters
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
-- Clinical Vitals
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
-- Clinical Notes
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
-- Clinical Diagnoses
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
-- Inventory Items
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
-- Inventory Batches
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
-- Invoices
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
-- Payments
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
-- Audit Logs
-- =========================================================
INSERT INTO audit_logs (
  actor_user_id, action, object_type, object_id, metadata, created_at
)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'auth.login.success', 'auth', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', JSON_OBJECT('role', 'admin'), DATE_SUB(NOW(), INTERVAL 1 HOUR)),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'encounter.update', 'encounter', 'e3333333-3333-3333-3333-333333333333', JSON_OBJECT('status_from', 'Antre', 'status_to', 'Pemeriksaan'), DATE_SUB(NOW(), INTERVAL 35 MINUTE)),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'inventory.dispense', 'inventory', 'i1111111-1111-1111-1111-111111111111', JSON_OBJECT('qty', 20, 'batch', 'AMX-2401-A'), DATE_SUB(NOW(), INTERVAL 15 MINUTE));
