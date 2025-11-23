// src/routes/jobBookingRoute.ts
import { createJobWithBooking } from "@/controllers/jobBookingController"
import { Router } from "express"

const router = Router()

// POST /api/jobs-with-booking
router.post("/", createJobWithBooking)

export default router
