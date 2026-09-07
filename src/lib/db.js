

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

    // Keep this low — shared hosting limits total connections/hour.
    // 5 connections reused across all concurrent requests is sufficient
    // for a typical CRM workload; raise only if you observe queue timeouts.
    connectionLimit: 5,

    // Release idle connections back to MySQL after 60 s of inactivity
    // so they don't count toward max_connections_per_hour across restarts.
    idleTimeout: 60000,

    // How long a request waits in queue for a free connection (10 s)
    queueLimit: 0,
    connectTimeout: 10000,

    /**
     * Return DATE/DATETIME as strings (e.g. "2026-04-24 17:37:00") instead of JS Date.
     * Otherwise JSON serializes Date as ISO UTC ("...Z") and IST wall-clock in MySQL is misread in the browser.
     */
    dateStrings: true,
  });

  console.log("✅ [DB] Connection pool created (limit: 5)");
  return newPool;
}

export async function getDbConnection() {
  if (pool) return pool;

  // Serialize concurrent first-calls so only one pool is ever created
  if (!poolPromise) {
    poolPromise = createPool().then((p) => {
      pool = p;
      poolPromise = null;
      return p;
    }).catch((err) => {
      poolPromise = null; // allow retry on next request
      throw err;
    });
  }

  return poolPromise;
}
