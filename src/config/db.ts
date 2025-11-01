import sql from "mssql"
import dotenv from "dotenv"
dotenv.config()

export async function connectDB() {
  const config: sql.config = {
    user: process.env.SQL_USER!,
    password: process.env.SQL_PASSWORD!,
    server: process.env.SQL_SERVER!,
    database: process.env.SQL_DATABASE!,
    options: { trustServerCertificate: true },
  }
  try {
    await sql.connect(config)
    console.log("✅ Connected to SQL Server")
  } catch (err) {
    console.error("❌ Database connection failed:", err)
  }
}
