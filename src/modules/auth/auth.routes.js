const express = require('express');
const { requireGuest, requireAuth } = require('../../middlewares/auth');
const { renderLogin, login, logout } = require('./auth.controller');

const router = express.Router();

router.get('/login', requireGuest, renderLogin);
router.post('/login', requireGuest, login);
router.post('/logout', requireAuth, logout);

module.exports = router;
