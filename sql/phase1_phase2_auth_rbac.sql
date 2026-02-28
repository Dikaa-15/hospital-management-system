-- Phase 1 + 2 bootstrap schema (MySQL)
CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) PRIMARY KEY,
  role_name VARCHAR(50) UNIQUE NOT NULL,
  permissions JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NULL,
  role_id CHAR(36) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_user_id CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  object_type VARCHAR(50) NULL,
  object_id VARCHAR(100) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor (actor_user_id),
  INDEX idx_audit_created (created_at)
);

-- Seed roles
INSERT IGNORE INTO roles (id, role_name, permissions) VALUES
('11111111-1111-1111-1111-111111111111', 'admin', JSON_OBJECT('all', true)),
('22222222-2222-2222-2222-222222222222', 'doctor', JSON_OBJECT('can_prescribe', true, 'can_view_medical_records', true)),
('33333333-3333-3333-3333-333333333333', 'patient', JSON_OBJECT('can_view_self_record', true)),
('44444444-4444-4444-4444-444444444444', 'pharmacist', JSON_OBJECT('can_dispense', true));

-- NOTE:
-- User seed sengaja tidak disertakan karena password harus hash bcrypt.
-- Untuk dev cepat gunakan AUTH_MODE=demo di .env.
