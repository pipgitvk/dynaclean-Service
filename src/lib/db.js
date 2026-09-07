// lib/db.js
import mysql from "mysql2/promise";

const g = globalThis;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is missing in environment variables.`);
  }
  return value;
}

let poolCreationLock = null;
let isCreatingPool = false;

function createMysqlPool() {
  const DB_HOST = requiredEnv("DB_HOST");
  const DB_USER = requiredEnv("DB_USER");
  const DB_PASSWORD = process.env.DB_PASSWORD ?? "";
  if (!DB_PASSWORD && process.env.NODE_ENV === "production") {
    console.warn("⚠️ [DB] DB_PASSWORD is empty — is this intentional in production?");
  }
  const DB_NAME = requiredEnv("DB_NAME");

  const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 1),
    queueLimit: 0,
    connectTimeout: 10000,
    dateStrings: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  console.log(`✅ [DB] MySQL pool created — host: ${DB_HOST}, db: ${DB_NAME}`);
  return pool;
}

async function recreatePool() {
  if (isCreatingPool && poolCreationLock) {
    await poolCreationLock;
    return;
  }

  let resolveLock;
  poolCreationLock = new Promise((resolve) => { resolveLock = resolve; });
  isCreatingPool = true;

  try {
    const oldPool = g.__mysqlPool;
    if (oldPool) {
      try {
        await oldPool.end();
      } catch (err) {
        console.error("⚠️ [DB] Error closing old pool:", err.message);
      }
    }
    delete g.__mysqlPool;
    g.__mysqlPool = createMysqlPool();
  } finally {
    isCreatingPool = false;
    resolveLock();
    poolCreationLock = null;
  }
}

function shouldRecreatePool(error) {
  const code = error?.code || "";
  if (
    code === "ER_USER_LIMIT_REACHED" ||
    code === "ER_TOO_MANY_USER_CONNECTIONS" ||
    code === "ER_CON_COUNT_ERROR"
  ) {
    return false;
  }
  return (
    error?.message?.includes("Pool is closed") ||
    code === "POOL_CLOSED" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT"
  );
}

export async function getDbConnection() {
  if (isCreatingPool && poolCreationLock) {
    await poolCreationLock;
  }
  if (!g.__mysqlPool) {
    await recreatePool();
  }
  return g.__mysqlPool;
}

export async function dbQuery(sql, params = [], retry = true) {
  try {
    const db = await getDbConnection();
    const [rows] = await db.query(sql, params);
    return rows;
  } catch (error) {
    if (retry && shouldRecreatePool(error)) {
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
      await recreatePool();
      return withPool(callback, false);
    }
    throw error;
  }
}
