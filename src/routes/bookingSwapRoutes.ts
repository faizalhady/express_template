import {
   handleApproveSwapRequest,
   handleCreateSwapRequest,
   handleGetSwapRequest,
   handleListRequestsForBooking,
   handleListRequestsForUser,
   handleRejectSwapRequest,
   handleSwapHistoryById,
   handleSwapHistoryForBooking,
} from "@/controllers/bookingSwapController"
import { Router } from "express"

const router = Router()

/* ============================================================
   SWAP REQUEST CREATION
   ============================================================ */
router.post("/request", handleCreateSwapRequest)

/* ============================================================
   GET SINGLE REQUEST
   ============================================================ */
router.get("/request/:swapReqId", handleGetSwapRequest)

/* ============================================================
   LIST REQUESTS (BY BOOKING)
   ============================================================ */
router.get("/requests/booking/:bookingId", handleListRequestsForBooking)

/* ============================================================
   LIST REQUESTS (BY USER)
   ============================================================ */
router.get("/requests/user/:userId", handleListRequestsForUser)

/* ============================================================
   APPROVE REQUEST
   ============================================================ */
router.post("/request/approve", handleApproveSwapRequest)

/* ============================================================
   REJECT REQUEST
   ============================================================ */
router.post("/request/reject", handleRejectSwapRequest)

/* ============================================================
   HISTORY (BY BOOKING)
   ============================================================ */
router.get("/history/booking/:bookingId", handleSwapHistoryForBooking)

/* ============================================================
   HISTORY (BY HISTORY ROW ID)
   ============================================================ */
router.get("/history/:swapId", handleSwapHistoryById)

export default router
