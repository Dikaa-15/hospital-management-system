const {
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
} = require('./schedule.service');

async function renderScheduleWard(req, res) {
  const week = (req.query.week || '').trim();

  try {
    const [doctors, shiftData, rooms, wardStats, transfers] = await Promise.all([
      listDoctors(),
      listShifts(week),
      listRooms(),
      getWardStats(),
      listTransferQueue()
    ]);

    const occupancyPct = wardStats.total_beds
      ? ((wardStats.occupied_beds / wardStats.total_beds) * 100).toFixed(1)
      : '0.0';

    return res.render('pages/dashboard-admin/schedule-ward-management', {
      title: 'Schedule & Ward Management',
      user: req.session.user,
      doctors,
      shifts: shiftData.rows,
      weekRange: shiftData.range,
      rooms,
      wardStats: { ...wardStats, occupancyPct },
      transfers,
      flash: req.query.flash || '',
      error: req.query.error || ''
    });
  } catch (error) {
    return res.status(500).render('pages/dashboard-admin/schedule-ward-management', {
      title: 'Schedule & Ward Management',
      user: req.session.user,
      doctors: [],
      shifts: [],
      weekRange: { start: '', end: '' },
      rooms: [],
      wardStats: { total_rooms: 0, total_beds: 0, occupied_beds: 0, available_rooms: 0, cleaning_rooms: 0, occupancyPct: '0.0' },
      transfers: [],
      flash: '',
      error: `Failed to load schedule/ward: ${error.message}`
    });
  }
}

async function handleCreateShift(req, res) {
  const doctorId = (req.body.doctor_id || '').trim();
  const shiftDate = (req.body.shift_date || '').trim();
  const shiftType = (req.body.shift_type || '').trim();

  if (!doctorId || !shiftDate || !shiftType) {
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?error=Doctor%2C%20date%2C%20and%20shift%20are%20required');
  }

  try {
    await createShift({
      doctorId,
      shiftDate,
      shiftType,
      department: (req.body.department || '').trim(),
      notes: (req.body.notes || '').trim()
    });
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?flash=Shift%20created');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/schedule-ward-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

async function handleDeleteShift(req, res) {
  try {
    await deleteShift(req.params.id);
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?flash=Shift%20deleted');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/schedule-ward-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

async function handleCreateRoom(req, res) {
  const roomCode = (req.body.room_code || '').trim();
  const roomClass = (req.body.room_class || '').trim();
  const status = (req.body.status || 'Available').trim();
  if (!roomCode || !roomClass) {
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?error=Room%20code%20and%20class%20are%20required');
  }

  try {
    await createRoom({
      roomCode,
      roomClass,
      floorNo: req.body.floor_no,
      capacity: req.body.capacity,
      occupiedCount: req.body.occupied_count,
      status,
      patientName: (req.body.patient_name || '').trim(),
      picDoctorId: (req.body.pic_doctor_id || '').trim()
    });
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?flash=Room%20created');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/schedule-ward-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

async function handleRoomStatus(req, res) {
  try {
    await updateRoomStatus(req.params.id, {
      status: (req.body.status || 'Available').trim(),
      occupiedCount: req.body.occupied_count,
      patientName: (req.body.patient_name || '').trim(),
      picDoctorId: (req.body.pic_doctor_id || '').trim()
    });
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?flash=Room%20updated');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/schedule-ward-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

async function handleCreateTransfer(req, res) {
  const patientName = (req.body.patient_name || '').trim();
  const fromUnit = (req.body.from_unit || '').trim();
  if (!patientName || !fromUnit) {
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?error=Patient%20name%20and%20origin%20unit%20are%20required');
  }

  try {
    await createTransfer({
      patientId: (req.body.patient_id || '').trim(),
      patientName,
      fromUnit,
      targetRoomId: (req.body.target_room_id || '').trim(),
      notes: (req.body.notes || '').trim()
    });
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?flash=Transfer%20request%20created');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/schedule-ward-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

async function handleTransferStatus(req, res) {
  const status = (req.body.status || '').trim();
  const allowed = new Set(['Pending', 'Approved', 'Moved', 'Cancelled']);
  if (!allowed.has(status)) {
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?error=Invalid%20transfer%20status');
  }

  try {
    await updateTransferStatus(req.params.id, status);
    return res.redirect('/templates/dashboard-admin/schedule-ward-management.html?flash=Transfer%20status%20updated');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/schedule-ward-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

module.exports = {
  renderScheduleWard,
  handleCreateShift,
  handleDeleteShift,
  handleCreateRoom,
  handleRoomStatus,
  handleCreateTransfer,
  handleTransferStatus
};
