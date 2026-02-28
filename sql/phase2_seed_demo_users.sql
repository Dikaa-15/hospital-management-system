-- Seed demo users for AUTH_MODE=db
-- Password for all users: password
-- bcrypt hash: $2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u

INSERT INTO users (id, employee_id, username, email, password_hash, first_name, last_name, role_id, is_active)
VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ADM-0001', 'admin@gmail.com', 'admin@gmail.com', '$2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u', 'Admin', 'HMS', '11111111-1111-1111-1111-111111111111', 1),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'DOC-0001', 'docter@gmail.com', 'docter@gmail.com', '$2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u', 'Doctor', 'HMS', '22222222-2222-2222-2222-222222222222', 1),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'PAT-0001', 'patient@gmail.com', 'patient@gmail.com', '$2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u', 'Patient', 'HMS', '33333333-3333-3333-3333-333333333333', 1),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'PHA-0001', 'pharmacist@gmail.com', 'pharmacist@gmail.com', '$2a$10$bhFupy71jkUV7lUiG4.QheIAckWYzC0kDIa0wke8GuHDbcawa3u2u', 'Pharmacist', 'HMS', '44444444-4444-4444-4444-444444444444', 1)
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  role_id = VALUES(role_id),
  is_active = VALUES(is_active);
