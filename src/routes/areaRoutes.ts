// src/routes/areaRoute.ts
import { getAreaById, listAreas } from "@/controllers/areaController"
import { Router } from "express"

const router = Router()

// GET /api/areas
router.get("/", listAreas)

// GET /api/areas/:id
router.get("/:id", getAreaById)

export default router
