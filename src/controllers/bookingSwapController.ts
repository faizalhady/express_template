import { sendSuccess } from "@/utils/responseHandler"
import type { Request, Response } from "express"

import {
    getSwapHistoryById,
    getSwapRequestById,
    insertSwapRequest,
    listRequestsForBooking,
    listRequestsForUser,
    listSwapHistoryForBooking,
} from "@/queries/bookingSwapQueries"

import {
    approveSwapRequest,
    rejectSwapRequest,
} from "@/services/bookingSwapService"

import type {
    ApproveSwapRequestInput,
    CreateSwapRequestInput,
    RejectSwapRequestInput,
} from "@/types/bookingSwapTypes"

/* =====================================================================
   CREATE SWAP REQUEST
   ===================================================================== */
export async function handleCreateSwapRequest(req: Request, res: Response) {
    try {
        const body = req.body as CreateSwapRequestInput

        if (
            body.fromBookingId === undefined ||
            body.toBookingId === undefined ||
            body.requestedByUserId === undefined
        ) {
            return res.status(400).json({
                error: "fromBookingId, toBookingId and requestedByUserId are required",
            })
        }

        // expiresInMinutes is optional so do not validate as required
        const result = await insertSwapRequest(body)

        return sendSuccess(res, result, "Swap request created")
    } catch (err: any) {
        return res.status(500).json({
            error: err.message ?? "Failed to create swap request",
        })
    }
}

/* =====================================================================
   GET SWAP REQUEST BY ID
   ===================================================================== */
export async function handleGetSwapRequest(req: Request, res: Response) {
    try {
        const swapReqId = Number(req.params.swapReqId)
        if (!swapReqId) {
            return res.status(400).json({ error: "Invalid swapReqId" })
        }

        const result = await getSwapRequestById(swapReqId)
        return sendSuccess(res, result)
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
}

/* =====================================================================
   LIST REQUESTS FOR BOOKING
   ===================================================================== */
export async function handleListRequestsForBooking(req: Request, res: Response) {
    try {
        const bookingId = Number(req.params.bookingId)
        if (!bookingId) {
            return res.status(400).json({ error: "Invalid bookingId" })
        }

        const rows = await listRequestsForBooking(bookingId)
        return sendSuccess(res, rows)
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
}

/* =====================================================================
   LIST REQUESTS FOR USER
   ===================================================================== */
export async function handleListRequestsForUser(req: Request, res: Response) {
    try {
        const userId = Number(req.params.userId)
        if (!userId) {
            return res.status(400).json({ error: "Invalid userId" })
        }

        const rows = await listRequestsForUser(userId)
        return sendSuccess(res, rows)
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
}

/* =====================================================================
   APPROVE SWAP REQUEST
   ===================================================================== */
export async function handleApproveSwapRequest(req: Request, res: Response) {
    try {
        const body = req.body as ApproveSwapRequestInput

        if (
            body.swapReqId === undefined ||
            body.approverUserId === undefined ||
            !body.decisionType
        ) {
            return res.status(400).json({
                error: "swapReqId, approverUserId and decisionType are required",
            })
        }

        if (body.swapReqId <= 0) {
            return res.status(400).json({ error: "Invalid swapReqId" })
        }

        const result = await approveSwapRequest({
            ...body // nothing extra, no username until auth exists
        })

        return sendSuccess(res, result, "Swap request approved")
    } catch (err: any) {
        return res.status(500).json({
            error: err.message ?? "Failed to approve swap request",
        })
    }
}

/* =====================================================================
   REJECT SWAP REQUEST
   ===================================================================== */
export async function handleRejectSwapRequest(req: Request, res: Response) {
    try {
        const body = req.body as RejectSwapRequestInput

        if (
            body.swapReqId === undefined ||
            body.approverUserId === undefined
        ) {
            return res.status(400).json({
                error: "swapReqId and approverUserId are required",
            })
        }

        if (body.swapReqId <= 0) {
            return res.status(400).json({ error: "Invalid swapReqId" })
        }

        const result = await rejectSwapRequest({
            ...body
        })

        return sendSuccess(res, result, "Swap request rejected")
    } catch (err: any) {
        return res.status(500).json({
            error: err.message ?? "Failed to reject swap request",
        })
    }
}

/* =====================================================================
   HISTORY: BY BOOKING
   ===================================================================== */
export async function handleSwapHistoryForBooking(req: Request, res: Response) {
    try {
        const bookingId = Number(req.params.bookingId)
        if (!bookingId) {
            return res.status(400).json({ error: "Invalid bookingId" })
        }

        const rows = await listSwapHistoryForBooking(bookingId)
        return sendSuccess(res, rows)
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
}

/* =====================================================================
   HISTORY: BY SWAP ID
   ===================================================================== */
export async function handleSwapHistoryById(req: Request, res: Response) {
    try {
        const swapId = Number(req.params.swapId)
        if (!swapId) {
            return res.status(400).json({ error: "Invalid swapId" })
        }

        const row = await getSwapHistoryById(swapId)
        return sendSuccess(res, row)
    } catch (err: any) {
        return res.status(500).json({ error: err.message })
    }
}
