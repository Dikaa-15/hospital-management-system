const mysql = require('mysql2/promise');

let pool;

function getDbConfig() {
  const rawHost = process.env.DB_HOST || '127.0.0.1';
  const preferIpv4 = (process.env.DB_PREFER_IPV4 || 'true').toLowerCase() === 'true';
  const host = preferIpv4 && rawHost === 'localhost' ? '127.0.0.1' : rawHost;

  const config = {
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hms',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000)
  };

  if (process.env.DB_SOCKET_PATH) {
    config.socketPath = process.env.DB_SOCKET_PATH;
    delete config.host;
    delete config.port;
  }

  return config;
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDbConfig());
  }
  return pool;
}

module.exports = { getPool, getDbConfig };
