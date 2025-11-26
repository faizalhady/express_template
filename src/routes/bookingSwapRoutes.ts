// src/routes/bookingSwapRoutes.ts

import { approveBookingSwap } from "@/controllers/bookingSwapController"; // legacy direct swap (optional)
import {
    approveSwapRequestController,
    createExistingSwapRequestController,
    rejectSwapRequestController,
} from "@/controllers/bookingSwapReqController";
import { Router } from "express";

const router = Router();

// Legacy direct approve (no request object)
// You can remove this once the UI fully uses requests.
router.post("/approve", approveBookingSwap);

// New flow: swap requests + receiver decision
router.post("/requests/existing", createExistingSwapRequestController);
router.post("/requests/:id/approve", approveSwapRequestController);
router.post("/requests/:id/reject", rejectSwapRequestController);

export default router;
