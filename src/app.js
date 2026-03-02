const path = require('path');
const express = require('express');
const { createSessionMiddleware } = require('./config/session');
const { auditMutations } = require('./middlewares/audit');
const { csrfProtection } = require('./middlewares/csrf');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); // Wajib di Railway agar cookie terbaca
app.use(createSessionMiddleware());
app.use(csrfProtection);
app.use(auditMutations);

app.use(require('./routes'));

module.exports = app;
