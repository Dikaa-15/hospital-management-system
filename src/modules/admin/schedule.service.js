const crypto = require('crypto');
const { getPool } = require('../../config/database');

let bootstrapped = false;

async function ensureTables() {
  if (bootstrapped) return;
  const pool = getPool();

  await pool.execute(`
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
    ) ENGINE=InnoDB
  `);

  await pool.execute(`
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
    ) ENGINE=InnoDB
  `);

  await pool.execute(`
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
    ) ENGINE=InnoDB
  `);

  bootstrapped = true;
}

async function listDoctors() {
  await ensureTables();
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT u.id, CONCAT_WS(' ', u.title_prefix, u.first_name, u.last_name, u.title_suffix) AS doctor_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.role_name = 'doctor' AND u.is_active = 1
     ORDER BY doctor_name ASC`
  );
  return rows;
}

function getWeekRange(anchorDate) {
  const base = anchorDate ? new Date(anchorDate) : new Date();
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const toStr = (d) => d.toISOString().slice(0, 10);
  return { start: toStr(monday), end: toStr(sunday) };
}

async function listShifts(weekDate) {
  await ensureTables();
  const pool = getPool();
  const range = getWeekRange(weekDate);

  const [rows] = await pool.execute(
    `SELECT ds.id, ds.doctor_id, ds.shift_date, ds.shift_type, ds.department, ds.notes,
            CONCAT_WS(' ', u.title_prefix, u.first_name, u.last_name, u.title_suffix) AS doctor_name
     FROM doctor_shifts ds
     JOIN users u ON u.id = ds.doctor_id
     WHERE ds.shift_date BETWEEN ? AND ?
     ORDER BY ds.shift_date ASC, ds.shift_type ASC`,
    [range.start, range.end]
  );

  return { rows, range };
}

async function createShift(payload) {
  await ensureTables();
  const pool = getPool();
  const id = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO doctor_shifts (id, doctor_id, shift_date, shift_type, department, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, payload.doctorId, payload.shiftDate, payload.shiftType, payload.department || null, payload.notes || null]
  );
}

async function deleteShift(id) {
  await ensureTables();
  const pool = getPool();
  await pool.execute('DELETE FROM doctor_shifts WHERE id = ?', [id]);
}

async function listRooms() {
  await ensureTables();
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT wr.id, wr.room_code, wr.room_class, wr.floor_no, wr.capacity, wr.occupied_count, wr.status,
            wr.patient_name, wr.pic_doctor_id,
            CONCAT_WS(' ', u.title_prefix, u.first_name, u.last_name, u.title_suffix) AS pic_doctor_name
     FROM ward_rooms wr
     LEFT JOIN users u ON u.id = wr.pic_doctor_id
     ORDER BY wr.floor_no ASC, wr.room_code ASC`
  );
  return rows;
}

async function createRoom(payload) {
  await ensureTables();
  const pool = getPool();
  const id = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO ward_rooms (id, room_code, room_class, floor_no, capacity, occupied_count, status, pic_doctor_id, patient_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.roomCode,
      payload.roomClass,
      Number(payload.floorNo || 1),
      Number(payload.capacity || 1),
      Number(payload.occupiedCount || 0),
      payload.status,
      payload.picDoctorId || null,
      payload.patientName || null
    ]
  );
}

async function updateRoomStatus(id, payload) {
  await ensureTables();
  const pool = getPool();
  await pool.execute(
    `UPDATE ward_rooms
     SET status = ?, occupied_count = ?, patient_name = ?, pic_doctor_id = ?
     WHERE id = ?`,
    [payload.status, Number(payload.occupiedCount || 0), payload.patientName || null, payload.picDoctorId || null, id]
  );
}

async function getWardStats() {
  await ensureTables();
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      COUNT(*) AS total_rooms,
      COALESCE(SUM(capacity), 0) AS total_beds,
      COALESCE(SUM(occupied_count), 0) AS occupied_beds,
      SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) AS available_rooms,
      SUM(CASE WHEN status = 'Cleaning' THEN 1 ELSE 0 END) AS cleaning_rooms
     FROM ward_rooms`
  );
  return rows[0] || { total_rooms: 0, total_beds: 0, occupied_beds: 0, available_rooms: 0, cleaning_rooms: 0 };
}

async function listTransferQueue() {
  await ensureTables();
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT tq.id, tq.patient_id, tq.patient_name, tq.from_unit, tq.target_room_id, tq.status, tq.notes,
            wr.room_code
     FROM transfer_queue tq
     LEFT JOIN ward_rooms wr ON wr.id = tq.target_room_id
     ORDER BY tq.created_at DESC
     LIMIT 50`
  );
  return rows;
}

async function createTransfer(payload) {
  await ensureTables();
  const pool = getPool();
  const id = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO transfer_queue (id, patient_id, patient_name, from_unit, target_room_id, status, notes)
     VALUES (?, ?, ?, ?, ?, 'Pending', ?)`,
    [id, payload.patientId || null, payload.patientName, payload.fromUnit, payload.targetRoomId || null, payload.notes || null]
  );
}

async function updateTransferStatus(id, status) {
  await ensureTables();
  const pool = getPool();
  await pool.execute('UPDATE transfer_queue SET status = ? WHERE id = ?', [status, id]);
}

module.exports = {
  listDoctors,
  listShifts,
  createShift,
  deleteShift,
  listRooms,
  createRoom,
  updateRoomStatus,
  getWardStats,
  listTransferQueue,
  createTransfer,
  updateTransferStatus
};
