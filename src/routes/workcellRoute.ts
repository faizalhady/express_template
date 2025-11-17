// src/routes/workcellRoute.ts
import {
    getWorkcellById,
    listWorkcells,
} from "@/controllers/workcellController"
import { Router } from "express"

const router = Router()

router.get("/", listWorkcells)
router.get("/:id", getWorkcellById)

export default router
