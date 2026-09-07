// lib/db.js
import mysql from "mysql2/promise";
import dns from "dns/promises";

let resolvedIp = null;
let pool = null;
let poolPromise = null; // guards against concurrent init creating two pools

// Resolve DB host to IPv4 (once per runtime)
async function resolveDbHost() {
  if (resolvedIp) return resolvedIp;

  const host = process.env.DB_HOST;
  if (!host) throw new Error("DB_HOST is missing in environment variables.");

  try {
    const { address } = await dns.lookup(host, { family: 4 });
    resolvedIp = address;
    console.log(`✅ [DB] Resolved ${host} to IPv4: ${resolvedIp}`);
    return resolvedIp;
  } catch (err) {
    console.error("❌ [DB] Failed to resolve DB_HOST:", err);
    throw new Error("DNS resolution failed for DB_HOST");
  }
}

async function createPool() {
  const host = await resolveDbHost();

  const newPool = mysql.createPool({
    host,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,

    // Keep pool small on shared hosting to stay within max_connections_per_hour.
    // max_connections_per_hour counts NEW connections opened per hour — not
    // concurrent ones. So the goal is to open connections ONCE and keep them
    // alive as long as possible, never destroying and re-creating them.
    connectionLimit: 5,

    // Keep idle connections alive in the pool instead of destroying them.
    // Destroying + re-creating connections wastes the hourly quota.
    maxIdle: 5,

    // Do NOT set idleTimeout — it destroys idle connections and forces new ones
    // to be opened on the next request, burning max_connections_per_hour quota.

    // Queue up to 100 requests waiting for a free connection slot.
    queueLimit: 100,

    connectTimeout: 10000,

    // Send keep-alive packets so the MySQL server doesn't close idle connections
    // due to wait_timeout — keeps existing connections alive without re-connecting.
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,

    /**
     * Return DATE/DATETIME as strings (e.g. "2026-04-24 17:37:00") instead of JS Date.
     * Otherwise JSON serializes Date as ISO UTC ("...Z") and IST wall-clock in MySQL is misread in the browser.
     */
    dateStrings: true,
  });

  // Debug: physical connection lifecycle tracking
  newPool.on("connection", () => {
    console.log("[DB] NEW CONNECTION CREATED");
  });
  newPool.on("acquire", () => {
    console.log("[DB] CONNECTION ACQUIRED");
  });
  newPool.on("release", () => {
    console.log("[DB] CONNECTION RELEASED");
  });
  newPool.on("enqueue", () => {
    console.log("[DB] REQUEST QUEUED");
  });

  console.log("✅ [DB] Connection pool created (limit: 5, keepAlive: on)");
  return newPool;
}

export async function getDbConnection() {
  if (pool) return pool;

  // Serialize concurrent first-calls so only one pool is ever created
  if (!poolPromise) {
    poolPromise = createPool()
      .then((p) => {
        pool = p;
        poolPromise = null;
        return p;
      })
      .catch((err) => {
        poolPromise = null; // allow retry on next request
        throw err;
      });
  }

  return poolPromise;
}
