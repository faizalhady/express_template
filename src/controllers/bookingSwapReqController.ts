// src/controllers/bookingSwapReqController.ts

import {
    approveSwapRequest,
    createExistingSwapRequest,
    rejectSwapRequest,
} from "@/services/bookingSwapReqService";
import type { BookingSwapType } from "@/types/cpsCore";
import type { Request, Response } from "express";

/**
 * POST /api/booking-swap/requests/existing
 * Body:
 *  - fromBookingId: number
 *  - toBookingId: number
 *  - requestedByUserId: number
 *  - expiresInMinutes?: number
 */
export async function createExistingSwapRequestController(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const {
            fromBookingId,
            toBookingId,
            requestedByUserId,
            expiresInMinutes,
        } = req.body ?? {};

        if (
            typeof fromBookingId !== "number" ||
            typeof toBookingId !== "number" ||
            typeof requestedByUserId !== "number"
        ) {
            res.status(400).json({
                success: false,
                message:
                    "fromBookingId, toBookingId and requestedByUserId are required and must be numbers",
            });
            return;
        }

        const input = {
            fromBookingId,
            toBookingId,
            requestedByUserId,
        } as {
            fromBookingId: number;
            toBookingId: number;
            requestedByUserId: number;
            expiresInMinutes?: number;
        };

        if (typeof expiresInMinutes === "number") {
            input.expiresInMinutes = expiresInMinutes;
        }

        const created = await createExistingSwapRequest(input);

        res.status(201).json({
            success: true,
            message: "Swap request created",
            data: created,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error?.message ?? "Failed to create swap request",
        });
    }
}

/**
 * POST /api/booking-swap/requests/:id/approve
 * Body:
 *  - approverUserId: number
 *  - approverUserName: string
 *  - decisionType: BookingSwapType ("SwapSlots" | "GiveSlot_CancelReceiver" | "GiveSlot_RescheduleReceiver")
 *  - receiverNewSlotAreaId?: number (when GiveSlot_RescheduleReceiver)
 *  - receiverNewSlotStart?: string (ISO)
 *  - receiverNewSlotEnd?: string (ISO)
 *  - reason?: string
 */
export async function approveSwapRequestController(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const requestId = Number(req.params.id);
        if (Number.isNaN(requestId)) {
            res.status(400).json({
                success: false,
                message: "Invalid request id",
            });
            return;
        }

        const {
            approverUserId,
            approverUserName,
            decisionType,
            receiverNewSlotAreaId,
            receiverNewSlotStart,
            receiverNewSlotEnd,
            reason,
        } = req.body ?? {};

        if (typeof approverUserId !== "number" || !approverUserName) {
            res.status(400).json({
                success: false,
                message:
                    "approverUserId (number) and approverUserName (string) are required",
            });
            return;
        }

        if (
            decisionType !== "SwapSlots" &&
            decisionType !== "GiveSlot_CancelReceiver" &&
            decisionType !== "GiveSlot_RescheduleReceiver"
        ) {
            res.status(400).json({
                success: false,
                message:
                    "decisionType must be one of: SwapSlots, GiveSlot_CancelReceiver, GiveSlot_RescheduleReceiver",
            });
            return;
        }

        const input: {
            requestId: number;
            approverUserId: number;
            approverUserName: string;
            decisionType: BookingSwapType;
            receiverNewSlotAreaId?: number;
            receiverNewSlotStart?: string;
            receiverNewSlotEnd?: string;
            reason?: string;
        } = {
            requestId,
            approverUserId,
            approverUserName,
            decisionType,
        };

        if (typeof receiverNewSlotAreaId === "number") {
            input.receiverNewSlotAreaId = receiverNewSlotAreaId;
        }
        if (typeof receiverNewSlotStart === "string") {
            input.receiverNewSlotStart = receiverNewSlotStart;
        }
        if (typeof receiverNewSlotEnd === "string") {
            input.receiverNewSlotEnd = receiverNewSlotEnd;
        }
        if (typeof reason === "string") {
            input.reason = reason;
        }

        const result = await approveSwapRequest(input);

        res.status(200).json({
            success: true,
            message: "Swap request approved",
            data: result,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error?.message ?? "Failed to approve swap request",
        });
    }
}

/**
 * POST /api/booking-swap/requests/:id/reject
 * Body:
 *  - approverUserId: number
 *  - approverUserName: string
 *  - reason?: string
 */
export async function rejectSwapRequestController(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const requestId = Number(req.params.id);
        if (Number.isNaN(requestId)) {
            res.status(400).json({
                success: false,
                message: "Invalid request id",
            });
            return;
        }

        const { approverUserId, approverUserName, reason } = req.body ?? {};

        if (typeof approverUserId !== "number" || !approverUserName) {
            res.status(400).json({
                success: false,
                message:
                    "approverUserId (number) and approverUserName (string) are required",
            });
            return;
        }

        const input: {
            requestId: number;
            approverUserId: number;
            approverUserName: string;
            reason?: string;
        } = {
            requestId,
            approverUserId,
            approverUserName,
        };

        if (typeof reason === "string") {
            input.reason = reason;
        }

        const updated = await rejectSwapRequest(input);

        res.status(200).json({
            success: true,
            message: "Swap request rejected / expired",
            data: updated,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error?.message ?? "Failed to reject swap request",
        });
    }
}
