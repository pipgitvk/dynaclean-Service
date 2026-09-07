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
    // Keep pool small — Hostinger limits 500 connections/hour.
    // connectionLimit=5 means at most 5 physical connections open at once,
    // reused across all requests, not opened fresh per request.
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
    maxIdle: 5,
    queueLimit: 100,
    connectTimeout: 10000,
    dateStrings: true,
    // Keep long-lived connections stable on Hostinger's remote MySQL.
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
    const [rows] = await db.query(sql, params);
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
