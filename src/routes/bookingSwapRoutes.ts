import { approveBookingSwap } from "@/controllers/bookingSwapController"
import { Router } from "express"

const router = Router()

router.post("/approve", approveBookingSwap)

export default router
