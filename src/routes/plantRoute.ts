// src/routes/plantRoute.ts
import { getPlantById, listPlants } from "@/controllers/plantController"
import { Router } from "express"

const router = Router()

router.get("/", listPlants)
router.get("/:id", getPlantById)

export default router
