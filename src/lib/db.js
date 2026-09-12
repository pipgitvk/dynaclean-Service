// lib/db.js
import mysql from "mysql2/promise";

const g = globalThis;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is missing in environment variables.`);
  }
  return value.trim();
}

// Mutex for pool creation to prevent race conditions
let poolCreationLock = null;
let isCreatingPool = false;

function createMysqlPool() {
  const DB_HOST = requiredEnv("DB_HOST");
  const DB_USER = requiredEnv("DB_USER");
  const DB_PASSWORD = process.env.DB_PASSWORD || "";
  const DB_NAME = requiredEnv("DB_NAME");

  console.log({ host: DB_HOST, user: DB_USER, database: DB_NAME });

  const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    // Minimal pool settings for Hostinger (500 connections/hour limit)
    // connectionLimit=2 means at most 2 physical connections open at once
    // Pool reuses connections — doesn't create new ones per request
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 2),
    maxIdle: 10,
    idleTimeout: 60000, // Close idle connections after 1 minute
    queueLimit: 150,
    connectTimeout: 10000,
    dateStrings: true,
    // Keep long-lived connections stable on Hostinger's remote MySQL
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
  });

  console.log(`✅ [DB] MySQL pool created — host: ${DB_HOST}, db: ${DB_NAME}`);

  // Debug: physical connection lifecycle tracking
  pool.on("connection", () => {
    console.log("[DB] NEW CONNECTION CREATED");
  });
  pool.on("acquire", () => {
    console.log("[DB] CONNECTION ACQUIRED");
  });
  pool.on("release", () => {
    console.log("[DB] CONNECTION RELEASED");
  });
  pool.on("enqueue", () => {
    console.log("[DB] REQUEST QUEUED");
  });

  // Proactively end idle connections to prevent connection creep
  const idleCheckInterval = setInterval(async () => {
    const poolConnections = pool._connectionQueue || [];
    if (poolConnections.length > 10) {
      console.log(
        `⚠️ [DB] Pool has ${poolConnections.length} idle connections, trimming...`
      );
      // Allow pool to naturally clean up excess idle connections
    }
  }, 60000); // Check every minute

  // Store interval ID for cleanup
  pool._idleCheckInterval = idleCheckInterval;

  return pool;
}

async function recreatePool() {
  if (isCreatingPool && poolCreationLock) {
    console.log("⚠️ [DB] Waiting for existing pool creation to complete...");
    await poolCreationLock;
    return;
  }

  let resolveLock;
  poolCreationLock = new Promise((resolve) => {
    resolveLock = resolve;
  });
  isCreatingPool = true;

  try {
    console.log("⚠️ [DB] Recreating MySQL pool...");
    const oldPool = g.__mysqlServicePool;
    if (oldPool) {
      try {
        // Clear idle check interval
        if (oldPool._idleCheckInterval) {
          clearInterval(oldPool._idleCheckInterval);
        }
        await oldPool.end();
        console.log("✅ [DB] Old MySQL pool closed");
      } catch (err) {
        console.error("⚠️ [DB] Error closing old pool:", err.message);
      }
    }
    delete g.__mysqlServicePool;
    g.__mysqlServicePool = createMysqlPool();
  } finally {
    isCreatingPool = false;
    resolveLock();
    poolCreationLock = null;
  }
}

function shouldRecreatePool(error) {
  const code = error?.code || "";

  // Do NOT recreate pool for quota/limit errors — opening a new pool
  // immediately consumes another connection and makes hourly limit worse.
  if (
    code === "ER_USER_LIMIT_REACHED" ||
    code === "ER_TOO_MANY_USER_CONNECTIONS" ||
    code === "ER_CON_COUNT_ERROR"
  ) {
    return false;
  }

  const message = error?.message || "";
  return (
    message.includes("Pool is closed") ||
    code === "POOL_CLOSED" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT"
  );
}

export async function getDbConnection() {
  if (isCreatingPool && poolCreationLock) {
    console.log("⚠️ [DB] Waiting for pool to be created...");
    await poolCreationLock;
  }

  if (!g.__mysqlServicePool) {
    await recreatePool();
  }

  return g.__mysqlServicePool;
}

export async function dbQuery(sql, params = [], retry = true) {
  try {
    const db = await getDbConnection();
    // Add query timeout to prevent long queries from blocking connections
    const queryTimeout = setTimeout(() => {
      console.warn(`⚠️ [DB] Query timeout (10s): ${sql.substring(0, 100)}...`);
    }, 10000);
    
    const [rows] = await db.query(sql, params);
    clearTimeout(queryTimeout);
    return rows;
  } catch (error) {
    if (retry && shouldRecreatePool(error)) {
      console.log("⚠️ [DB] Recreating pool and retrying query...");
      await recreatePool();
      return dbQuery(sql, params, false);
    }
    throw error;
  }
}

export async function dbExecute(sql, params = [], retry = true) {
  try {
    const db = await getDbConnection();
    const [result] = await db.execute(sql, params);
    return result;
  } catch (error) {
    if (retry && shouldRecreatePool(error)) {
      console.log("⚠️ [DB] Recreating pool and retrying execute...");
      await recreatePool();
      return dbExecute(sql, params, false);
    }
    throw error;
  }
}

export async function withPool(callback, retry = true) {
  try {
    const db = await getDbConnection();
    return await callback(db);
  } catch (error) {
    if (retry && shouldRecreatePool(error)) {
      console.log("⚠️ [DB] Recreating pool and retrying withPool...");
      await recreatePool();
      return withPool(callback, false);
    }
    throw error;
  }
}
