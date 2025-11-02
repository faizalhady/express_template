import { Router } from "express"
import { getHealthStatus } from "@/controllers/healthController"

const router = Router()

// ✅ GET /health
router.get("/", getHealthStatus)

export default router
