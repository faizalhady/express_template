// src/routes/areaRoute.ts
import { getAreaById, listAreaOverview, listAreas } from "@/controllers/areaController"
import { Router } from "express"

const router = Router()

// GET /api/areas
router.get("/", listAreas)
router.get("/overview", listAreaOverview)
// GET /api/areas/:id
router.get("/:id", getAreaById)

export default router
