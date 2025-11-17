import {
    createBooking,
    getBookingById,
    listBookings,
} from "@/controllers/bookingCoontroller"
import { Router } from "express"

const router = Router()

// POST /api/bookings
router.post("/", createBooking)

// GET /api/bookings/:id
router.get("/:id", getBookingById)

// GET /api/bookings
router.get("/", listBookings)

export default router
