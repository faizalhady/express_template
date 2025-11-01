import sql from "mssql"
import dotenv from "dotenv"
dotenv.config()

// ✅ Centralized SQL config
const dbConfig: sql.config = {
  user: process.env.SQL_USER!,
  password: process.env.SQL_PASSWORD!,
  server: process.env.SQL_SERVER!,
  database: process.env.SQL_DATABASE!,
  options: { trustServerCertificate: true },
}

// Global pool reference
let pool: sql.ConnectionPool | null = null

// Flag to prevent reconnect loops
let isConnecting = false

/* -------------------------------------------------
   Create / Reuse / Reconnect SQL Pool
--------------------------------------------------- */
export async function connectDB(): Promise<sql.ConnectionPool> {
  try {
    // Reuse existing valid connection
    if (pool && pool.connected) return pool

    // Avoid race condition when multiple calls try to reconnect
    if (isConnecting) {
      await wait(500)
      return connectDB()
    }

    isConnecting = true
    pool = await sql.connect(dbConfig)
    console.log("✅ Connected to SQL Server")

    // Listen for pool errors (e.g. timeouts, disconnections)
    pool.on("error", async (err) => {
      console.error("⚠️ SQL Pool Error:", err)
      await reconnectPool()
    })

    isConnecting = false
    return pool
  } catch (err) {
    console.error("❌ Database connection failed:", err)
    isConnecting = false
    throw err
  }
}

/* -------------------------------------------------
   Helper: Reconnect Logic
--------------------------------------------------- */
async function reconnectPool(): Promise<void> {
  console.log("♻️ Attempting SQL reconnect...")
  try {
    if (pool) {
      await pool.close().catch(() => null)
      pool = null
    }
    await connectDB()
    console.log("✅ SQL pool reconnected successfully")
  } catch (err) {
    console.error("❌ SQL reconnect failed:", err)
    // Try again in 5 seconds
    setTimeout(reconnectPool, 5000)
  }
}

/* -------------------------------------------------
   Utility: Wait helper
--------------------------------------------------- */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/* -------------------------------------------------
   Exports
--------------------------------------------------- */
export { sql, dbConfig }
