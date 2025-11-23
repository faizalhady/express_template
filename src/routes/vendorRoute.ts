// src/routes/vendorRoute.ts
import { getVendorById, listVendors } from "@/controllers/vendorController"
import { vendorScanFinish, vendorScanStart } from "@/controllers/vendorScanController"
import { Router } from "express"

const router = Router()

router.get("/", listVendors)
router.get("/:id", getVendorById)

router.post("/scan/start", vendorScanStart)
router.post("/scan/finish", vendorScanFinish)

export default router
