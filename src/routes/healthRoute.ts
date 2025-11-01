import { Router } from "express"
import { getHealthStatus } from "@/controllers/healthController.js"

const router = Router()

// ✅ GET /health
router.get("/", getHealthStatus)

export default router
