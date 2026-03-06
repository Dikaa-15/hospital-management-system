const mysql = require('mysql2/promise');

let mysqlPool;
let postgresPool;
let activePool;

function getDatabaseMode() {
  const hasPostgresEnv = Boolean(
    process.env.SUPABASE_DB_URL ||
      process.env.SUPABASE_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.SUPABASE_DB_HOST
  );
  const hasSupabaseApiEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

  const explicit = (process.env.DB_MODE || '').toLowerCase();
  if (explicit === 'mysql' || explicit === 'supabase' || explicit === 'postgres') return explicit;

  const authMode = (process.env.AUTH_MODE || '').toLowerCase();
  if (authMode === 'supabase' || authMode === 'postgres') return 'supabase';
  if (authMode === 'db' || authMode === 'mysql') return 'mysql';

  // Auto-detect Supabase/Postgres in production-like envs even when AUTH_MODE is missing.
  if (hasPostgresEnv || hasSupabaseApiEnv) return 'supabase';
  return 'mysql';
}

function getMysqlConfig() {
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

function getPostgresConfig() {
  const connectionString =
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL ||
    process.env.RAILWAY_DATABASE_URL ||
    process.env.PGDATABASE_URL ||
    process.env.DATABASE_URL ||
    '';

  if (connectionString) {
    return {
      connectionString,
      max: Number(process.env.DB_CONNECTION_LIMIT || 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
      ssl: process.env.DB_SSL_DISABLE === 'true' ? false : { rejectUnauthorized: false }
    };
  }

  const host = process.env.SUPABASE_DB_HOST || process.env.PGHOST || '';
  const port = Number(process.env.SUPABASE_DB_PORT || process.env.PGPORT || 5432);
  const user = process.env.SUPABASE_DB_USER || process.env.PGUSER || '';
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.PGPASSWORD || '';
  const database = process.env.SUPABASE_DB_NAME || process.env.PGDATABASE || '';

  if (!host || !user || !password || !database) {
    const hasSupabaseApiOnly = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
    throw new Error(
      hasSupabaseApiOnly
        ? "Supabase DB mode needs Postgres credentials (DATABASE_URL/SUPABASE_DB_URL or SUPABASE_DB_*/PG*). SUPABASE_URL + SUPABASE_ANON_KEY alone is only for Supabase HTTP API."
        : "Supabase DB mode requires DATABASE_URL/SUPABASE_DB_URL or full SUPABASE_DB_*/PG* credentials. Refusing fallback to local MySQL."
    );
  }

  return {
    host,
    port,
    user,
    password,
    database,
    max: Number(process.env.DB_CONNECTION_LIMIT || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
    ssl: process.env.DB_SSL_DISABLE === 'true' ? false : { rejectUnauthorized: false }
  };
}

function normalizeSqlForPostgres(sql) {
  let next = String(sql || '');
  next = next.replace(/`/g, '"');
  next = next.replace(/\bCURDATE\(\)/gi, 'CURRENT_DATE');
  next = next.replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');
  next = next.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');
  next = next.replace(/\bQUARTER\s*\(([^)]+)\)/gi, 'EXTRACT(QUARTER FROM ($1))');
  next = next.replace(/\bYEAR\s*\(([^)]+)\)/gi, 'EXTRACT(YEAR FROM ($1))');
  next = next.replace(/\bMONTH\s*\(([^)]+)\)/gi, 'EXTRACT(MONTH FROM ($1))');
  next = next.replace(
    /\bTIMESTAMPDIFF\s*\(\s*YEAR\s*,\s*([^,]+)\s*,\s*([^)]+)\)/gi,
    "EXTRACT(YEAR FROM AGE($2, $1))"
  );
  next = next.replace(
    /\bTIMESTAMPDIFF\s*\(\s*MINUTE\s*,\s*([^,]+)\s*,\s*([^)]+)\)/gi,
    'EXTRACT(EPOCH FROM ($2 - $1)) / 60'
  );
  next = next.replace(
    /\bDATE_SUB\s*\(\s*CURRENT_DATE\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
    "CURRENT_DATE - INTERVAL '$1 DAY'"
  );
  next = next.replace(
    /\bDATE_SUB\s*\(\s*CURRENT_DATE\s*,\s*INTERVAL\s+(\d+)\s+MONTH\s*\)/gi,
    "CURRENT_DATE - INTERVAL '$1 MONTH'"
  );
  next = next.replace(
    /\bDATE_ADD\s*\(\s*CURRENT_DATE\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
    "CURRENT_DATE + INTERVAL '$1 DAY'"
  );
  next = next.replace(/DATE_FORMAT\s*\(\s*([^)]+)\s*,\s*'%Y-%m-%d'\s*\)/gi, "TO_CHAR($1, 'YYYY-MM-DD')");
  next = next.replace(/DATE_FORMAT\s*\(\s*([^)]+)\s*,\s*'%Y-%m'\s*\)/gi, "TO_CHAR($1, 'YYYY-MM')");
  next = next.replace(/DATE_FORMAT\s*\(\s*([^)]+)\s*,\s*'%b'\s*\)/gi, "TO_CHAR($1, 'Mon')");
  next = next.replace(/DATE_FORMAT\s*\(\s*([^)]+)\s*,\s*'%H:%i'\s*\)/gi, "TO_CHAR($1, 'HH24:MI')");
  next = next.replace(
    /SUBSTRING_INDEX\s*\(\s*GROUP_CONCAT\s*\(\s*([a-zA-Z0-9_\.]+)\s+ORDER BY\s+([a-zA-Z0-9_\.]+)\s+DESC\s*\)\s*,\s*','\s*,\s*1\s*\)/gi,
    '(ARRAY_AGG($1 ORDER BY $2 DESC))[1]'
  );
  next = next.replace(/UNIQUE KEY\s+([a-zA-Z0-9_]+)\s*\(/gi, 'CONSTRAINT $1 UNIQUE (');
  next = next.replace(/\)\s*ENGINE\s*=\s*InnoDB/gi, ')');
  next = next.replace(/ON UPDATE CURRENT_TIMESTAMP/gi, '');
  return next;
}

function convertPlaceholders(sql, values) {
  let idx = 0;
  const converted = sql.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
  return { sql: converted, values: values || [] };
}

function createPostgresAdapter(pool) {
  function toMysqlLikeResponse(result) {
    const command = String(result?.command || '').toUpperCase();
    const returnsRows = command === 'SELECT' || command === 'WITH' || command === 'SHOW';
    if (returnsRows) {
      return [result.rows || [], result.fields || []];
    }

    return [
      {
        affectedRows: Number(result?.rowCount || 0),
        rowCount: Number(result?.rowCount || 0),
        command
      },
      result.fields || []
    ];
  }

  return {
    async execute(sql, values) {
      const normalized = normalizeSqlForPostgres(sql);
      const converted = convertPlaceholders(normalized, values);
      const result = await pool.query(converted.sql, converted.values);
      return toMysqlLikeResponse(result);
    },
    async query(sql, values) {
      return this.execute(sql, values);
    },
    async getConnection() {
      const client = await pool.connect();
      return {
        async beginTransaction() {
          await client.query('BEGIN');
        },
        async commit() {
          await client.query('COMMIT');
        },
        async rollback() {
          await client.query('ROLLBACK');
        },
        async execute(sql, values) {
          const normalized = normalizeSqlForPostgres(sql);
          const converted = convertPlaceholders(normalized, values);
          const result = await client.query(converted.sql, converted.values);
          return toMysqlLikeResponse(result);
        },
        async query(sql, values) {
          return this.execute(sql, values);
        },
        release() {
          client.release();
        }
      };
    }
  };
}

function getMysqlPool() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool(getMysqlConfig());
  }
  return mysqlPool;
}

function getPostgresPool() {
  if (!postgresPool) {
    let Pool;
    try {
      // Lazy require so mysql mode does not need pg dependency at runtime.
      // eslint-disable-next-line global-require
      ({ Pool } = require('pg'));
    } catch (error) {
      throw new Error("Missing dependency 'pg'. Install with: npm install pg");
    }
    const rawPool = new Pool(getPostgresConfig());
    postgresPool = createPostgresAdapter(rawPool);
  }
  return postgresPool;
}

function getPool() {
  const mode = getDatabaseMode();
  if (!activePool) {
    activePool = mode === 'supabase' || mode === 'postgres' ? getPostgresPool() : getMysqlPool();
  }
  return activePool;
}

function getDbConfig() {
  const mode = getDatabaseMode();
  return mode === 'supabase' || mode === 'postgres' ? getPostgresConfig() : getMysqlConfig();
}

module.exports = { getPool, getDbConfig, getDatabaseMode };
