import {
    createBooking,
    getBookingById,
    listBookings,
    patchBookingStatus,
} from "@/controllers/bookingController"
import { Router } from "express"

const router = Router()

// POST /api/bookings
router.post("/", createBooking)

// GET /api/bookings/:id
router.get("/:id", getBookingById)

// GET /api/bookings
router.get("/", listBookings)
router.patch("/:id/status", patchBookingStatus)

export default router
