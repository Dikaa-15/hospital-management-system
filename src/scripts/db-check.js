require('dotenv').config();

const mysql = require('mysql2/promise');
const { getDbConfig } = require('../config/database');

(async () => {
  const config = getDbConfig();
  const safeConfig = {
    ...config,
    password: config.password ? '***' : ''
  };

  try {
    const conn = await mysql.createConnection(config);
    const [rows] = await conn.query('SELECT 1 AS ok');
    await conn.end();
    console.log('[db-check] OK', rows[0], safeConfig);
    process.exit(0);
  } catch (error) {
    console.error('[db-check] FAILED', {
      code: error.code,
      errno: error.errno,
      message: error.message,
      address: error.address,
      port: error.port,
      config: safeConfig
    });
    process.exit(1);
  }
})();
