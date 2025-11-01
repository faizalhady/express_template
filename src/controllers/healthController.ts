import type { Request, Response } from "express"
import { connectDB } from "@/config/db.js"

/**
 * Controller: GET /health
 * Checks if the server and database are alive.
 */
export async function getHealthStatus(_req: Request, res: Response) {
  try {
    const pool = await connectDB()
    const isConnected = pool.connected

    res.json({
      ok: true,
      db: isConnected,
    })
  } catch (err) {
    console.error("❌ Health check failed:", err)
    res.status(500).json({
      ok: false,
      db: false,
    })
  }
}
