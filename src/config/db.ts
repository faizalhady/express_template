import sql from "mssql"
import dotenv from "dotenv"
dotenv.config()

// ✅ Detect authentication type
const isTrusted = process.env.SQL_TRUSTED_CONNECTION === "true"

// ✅ Build config dynamically
const dbConfig: sql.config = {
  user: process.env.SQL_USER!,
  password: process.env.SQL_PASSWORD!,
  server: process.env.SQL_SERVER!,
  port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT) : 1433,
  database: process.env.SQL_DATABASE!,
  options: {
    trustServerCertificate: true,
  },

  ...(isTrusted
    ? {
      // 🔒 Windows Authentication
      authentication: {
        type: "ntlm",
        options: {
          domain: process.env.SQL_DOMAIN || "", // optional
          userName: process.env.SQL_USER || "",
          password: process.env.SQL_PASSWORD || "",
        },
      },
    }
    : {
      // 🔐 SQL Authentication
      user: process.env.SQL_USER!,
      password: process.env.SQL_PASSWORD!,
    }),
}

// Global pool reference
let pool: sql.ConnectionPool | null = null
let isConnecting = false

export async function connectDB(): Promise<sql.ConnectionPool> {
  try {
    if (pool && pool.connected) return pool
    if (isConnecting) {
      await wait(500)
      return connectDB()
    }

    isConnecting = true
    pool = await sql.connect(dbConfig)
    console.log(`✅ Connected to SQL Server ${dbConfig.database} at ${dbConfig.server}`)

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
    setTimeout(reconnectPool, 5000)
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export { sql, dbConfig }
