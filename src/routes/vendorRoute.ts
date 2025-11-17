// src/routes/vendorRoute.ts
import { getVendorById, listVendors } from "@/controllers/vendorController"
import { Router } from "express"

const router = Router()

router.get("/", listVendors)
router.get("/:id", getVendorById)

export default router
