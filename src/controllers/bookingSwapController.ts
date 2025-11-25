// src/controllers/bookingSwapController.ts

import { performBookingSwap } from "@/services/bookingSwapService"
import type { BookingSwapType } from "@/types/cpsCore"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"

interface ApproveSwapBody {
    fromBookingId: number
    toBookingId: number
    decisionType: BookingSwapType

    // Only used for "GiveSlot_RescheduleReceiver"
    receiverNewAreaId?: number
    receiverNewStart?: string
    receiverNewEnd?: string

    reason?: string
}

/**
 * POST /api/bookings/swaps/approve
 * The receiver of a swap request calls this to decide:
 * - SwapSlots
 * - GiveSlot_CancelReceiver
 * - GiveSlot_RescheduleReceiver
 */
export async function approveBookingSwap(
    req: Request<unknown, unknown, ApproveSwapBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const {
            fromBookingId,
            toBookingId,
            decisionType,
            receiverNewAreaId,
            receiverNewStart,
            receiverNewEnd,
            reason,
        } = req.body

        // Basic validation
        if (!fromBookingId || !toBookingId) {
            return res.status(400).json({
                success: false,
                message: "fromBookingId and toBookingId are required",
            })
        }

        if (fromBookingId === toBookingId) {
            return res.status(400).json({
                success: false,
                message: "fromBookingId and toBookingId cannot be the same",
            })
        }

        // If receiver chooses to reschedule themselves, the new slot is required
        if (decisionType === "GiveSlot_RescheduleReceiver") {
            if (
                receiverNewAreaId == null ||
                !receiverNewStart ||
                !receiverNewEnd
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "receiverNewAreaId, receiverNewStart, receiverNewEnd are required for GiveSlot_RescheduleReceiver",
                })
            }
        }

        // In real app this will come from auth
        const performedBy = "swap-receiver"

        // Build the input object in a way that works with exactOptionalPropertyTypes
        const swapInput = {
            fromBookingId,
            toBookingId,
            decisionType,
            ...(reason !== undefined ? { reason } : {}),
            performedBy,
            // Do NOT blindly set receiverNew* here, we only attach them below
        } as const

        // Now build a mutable object typed as BookingSwapApproveInput
        const finalInput: Parameters<typeof performBookingSwap>[0] = {
            ...swapInput,
        }

        if (decisionType === "GiveSlot_RescheduleReceiver") {
            // At this point we already validated these are defined
            finalInput.receiverNewAreaId = receiverNewAreaId!
            finalInput.receiverNewStart = receiverNewStart!
            finalInput.receiverNewEnd = receiverNewEnd!
        }

        const result = await performBookingSwap(finalInput)

        return sendSuccess(
            res,
            {
                swap: result.swap,
                fromBooking: result.fromBooking,
                toBooking: result.toBooking,
            },
            "Booking swap processed successfully"
        )
    } catch (err) {
        if (err instanceof Error) {
            return res.status(400).json({
                success: false,
                message: err.message,
            })
        }
        next(err)
    }
}
