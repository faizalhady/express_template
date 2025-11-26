// src/services/bookingSwapReqService.ts

import { safeLogActivity } from "@/queries/activityLogQueries";
import { findBookingById } from "@/queries/bookingQueries";
import {
    getBookingSwapReqById,
    insertBookingSwapReq,
    updateBookingSwapReqStatus,
    updateBookingSwapReqStatusAndDecision,
} from "@/queries/bookingSwapReqQueries";
import { performBookingSwap } from "@/services/bookingSwapService";
import type {
    Booking,
    BookingStatus,
    BookingSwap,
    BookingSwapReq,
    BookingSwapReqStatus,
    BookingSwapType,
    ISODateTimeString,
} from "@/types/cpsCore";

/* --------------------------------------------
   Shared helpers
---------------------------------------------*/

const terminalBookingStatuses: BookingStatus[] = [
    "Cancelled",
    "Expired",
    "Completed",
];

function ensureBookingNotTerminal(b: Booking, label: string) {
    if (terminalBookingStatuses.includes(b.status)) {
        throw new Error(
            `${label} booking is already in terminal status '${b.status}'`
        );
    }
}

function ensureDifferentBookings(fromId: number, toId: number) {
    if (fromId === toId) {
        throw new Error("fromBookingId and toBookingId cannot be the same");
    }
}

function computeExpiry(minutes: number): ISODateTimeString {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now.toISOString();
}

/**
 * Simple utility for checking expiry. Does not change DB.
 */
function isExpired(expiresAt: ISODateTimeString | Date): boolean {
    const now = new Date();
    const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    return exp.getTime() <= now.getTime();
}

/* --------------------------------------------
   1) CREATE SWAP REQUEST (existing booking)
   - Scenario 2 from our discussion
   - Request is neutral; receiver decides action later
---------------------------------------------*/

export interface CreateExistingSwapRequestInput {
    fromBookingId: number;       // requester existing booking
    toBookingId: number;         // target booking they want
    requestedByUserId: number;   // FK to auth.User
    expiresInMinutes?: number;   // default 60
}

/**
 * Create a swap request where BOTH bookings already exist.
 *
 * Request is "neutral": it only means
 *   "I want your slot, please decide what to do"
 *
 * - Validates:
 *   - both bookings exist
 *   - both are not in terminal status
 *   - from != to
 * - Writes ONE row into core.BookingSwapReq
 */
export async function createExistingSwapRequest(
    input: CreateExistingSwapRequestInput
): Promise<BookingSwapReq> {
    const {
        fromBookingId,
        toBookingId,
        requestedByUserId,
        expiresInMinutes = 60,
    } = input;

    ensureDifferentBookings(fromBookingId, toBookingId);

    // 1) Load both bookings
    const fromBooking = await findBookingById(fromBookingId);
    const toBooking = await findBookingById(toBookingId);

    if (!fromBooking) {
        throw new Error("From booking not found");
    }
    if (!toBooking) {
        throw new Error("To booking not found");
    }

    // 2) Cannot swap if either already terminal
    ensureBookingNotTerminal(fromBooking, "Requester (from)");
    ensureBookingNotTerminal(toBooking, "Receiver (to)");

    // TODO (Phase B / extra rules):
    // - same day / area constraints
    // - 4-hour rule
    // - non-overlap with other bookings, etc.

    const expiresAt = computeExpiry(expiresInMinutes);

    // 3) Insert the request row (neutral)
    const createdReq = await insertBookingSwapReq({
        fromBookingId,
        toBookingId,
        requestedByUserId,
        expiresAt,
    });

    // 4) Optional: small activity log for requester
    await safeLogActivity({
        entityType: "Booking",
        entityId: fromBooking.bookingId,
        action: "SwapRequested",
        oldValue: {
            areaId: fromBooking.areaId,
            startDateTime: fromBooking.startDateTime,
            endDateTime: fromBooking.endDateTime,
            targetBookingId: toBooking.bookingId,
        },
        newValue: {
            bookingSwapReqId: createdReq.bookingSwapReqId,
            expiresAt: createdReq.expiresAt,
        },
        userId: String(requestedByUserId),
    });

    return createdReq;
}

/* --------------------------------------------
   2) APPROVE SWAP REQUEST (receiver chooses type)
   - Uses performBookingSwap()
---------------------------------------------*/

export interface ApproveSwapRequestInput {
    requestId: number;
    approverUserId: number;      // FK to auth.User
    approverUserName: string;    // NTID / username for ActivityLog

    decisionType: BookingSwapType; // "SwapSlots" | "GiveSlot_CancelReceiver" | "GiveSlot_RescheduleReceiver"

    // Only required when decisionType = "GiveSlot_RescheduleReceiver"
    receiverNewSlotAreaId?: number;
    receiverNewSlotStart?: ISODateTimeString;
    receiverNewSlotEnd?: ISODateTimeString;

    reason?: string;             // optional notes from receiver
}

export interface ApproveSwapRequestResult {
    swapReq: BookingSwapReq;
    swap: BookingSwap;
    fromBooking: Booking;
    toBooking: Booking;
}

/**
 * Receiver approves a pending swap request.
 *
 * Flow:
 *   1) Load and validate request
 *   2) Check not expired, status = Pending
 *   3) Ensure it is an "existing booking" scenario (fromBookingId not null)
 *   4) Receiver chooses decisionType and (optionally) new slot
 *   5) Call performBookingSwap()
 *   6) Update BookingSwapReq with status, decision info, receiver new slot, linked swap
 */
export async function approveSwapRequest(
    input: ApproveSwapRequestInput
): Promise<ApproveSwapRequestResult> {
    const {
        requestId,
        approverUserId,
        approverUserName,
        decisionType,
        receiverNewSlotAreaId,
        receiverNewSlotStart,
        receiverNewSlotEnd,
        reason,
    } = input;

    const req = await getBookingSwapReqById(requestId);
    if (!req) {
        throw new Error("Swap request not found");
    }

    if (req.status !== "Pending") {
        throw new Error(`Swap request is already ${req.status}`);
    }

    if (isExpired(req.expiresAt)) {
        // Mark as expired before returning
        await updateBookingSwapReqStatus({
            bookingSwapReqId: req.bookingSwapReqId,
            status: "Expired",
            decidedByUserId: approverUserId,
            decisionReason: "Auto expired at approval time",
        });
        throw new Error("Swap request has expired");
    }

    if (req.fromBookingId == null) {
        // Scenario 1 (new booking) is not wired yet
        throw new Error(
            "Swap request without existing fromBookingId is not supported yet. This is the 'new booking' scenario."
        );
    }

    // Sanity: both bookings still exist and not terminal
    const fromBooking = await findBookingById(req.fromBookingId);
    const toBooking = await findBookingById(req.toBookingId);

    if (!fromBooking) {
        throw new Error("From booking not found at approval time");
    }
    if (!toBooking) {
        throw new Error("To booking not found at approval time");
    }

    ensureBookingNotTerminal(fromBooking, "Requester (from)");
    ensureBookingNotTerminal(toBooking, "Receiver (to)");

    // For reschedule scenario, ensure we have new slot data
    if (decisionType === "GiveSlot_RescheduleReceiver") {
        if (
            receiverNewSlotAreaId == null ||
            !receiverNewSlotStart ||
            !receiverNewSlotEnd
        ) {
            throw new Error(
                "receiverNewSlotAreaId, receiverNewSlotStart, receiverNewSlotEnd are required for GiveSlot_RescheduleReceiver"
            );
        }

        const start = new Date(receiverNewSlotStart);
        const end = new Date(receiverNewSlotEnd);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new Error("Receiver new slot start/end datetime is invalid");
        }
        if (start >= end) {
            throw new Error("receiverNewSlotStart must be before receiverNewSlotEnd");
        }
    }

    // 1) Execute the actual swap on core.Booking + core.BookingSwap
    const swapResult = await performBookingSwap({
        fromBookingId: fromBooking.bookingId,
        toBookingId: toBooking.bookingId,
        decisionType,
        receiverNewAreaId: receiverNewSlotAreaId,
        receiverNewStart: receiverNewSlotStart,
        receiverNewEnd: receiverNewSlotEnd,
        // ensure we always pass a string, never undefined
        reason: reason ?? "",
        performedBy: approverUserName,
    });

    // 2) Mark request as Approved and store decision data + link to BookingSwap
    const updatedReq = await updateBookingSwapReqStatusAndDecision({
        bookingSwapReqId: req.bookingSwapReqId,
        status: "Approved",
        decidedByUserId: approverUserId,
        decisionReason: reason ?? null,
        receiverNewSlotAreaId: receiverNewSlotAreaId ?? null,
        receiverNewSlotStart: receiverNewSlotStart ?? null,
        receiverNewSlotEnd: receiverNewSlotEnd ?? null,
        linkedBookingSwapId: swapResult.swap.bookingSwapId,
    });

    if (!updatedReq) {
        throw new Error("Failed to update swap request as Approved");
    }

    // 3) Optional log focusing on the request object itself
    await safeLogActivity({
        entityType: "Booking",
        entityId: toBooking.bookingId,
        action: "SwapRequestApproved",
        oldValue: {
            bookingSwapReqId: req.bookingSwapReqId,
            status: req.status,
        },
        newValue: {
            bookingSwapReqId: updatedReq.bookingSwapReqId,
            status: updatedReq.status,
            decisionType,
        },
        userId: approverUserName,
    });

    return {
        swapReq: updatedReq,
        swap: swapResult.swap,
        fromBooking: swapResult.fromBooking,
        toBooking: swapResult.toBooking,
    };
}

/* --------------------------------------------
   3) REJECT SWAP REQUEST
   - No change to Booking or BookingSwap
---------------------------------------------*/

export interface RejectSwapRequestInput {
    requestId: number;
    approverUserId: number;
    approverUserName: string;
    reason?: string;
}

/**
 * Receiver rejects a pending swap request.
 *
 * - If expired, mark as Expired.
 * - Otherwise, mark as Rejected.
 * - Does not touch core.Booking or core.BookingSwap.
 */
export async function rejectSwapRequest(
    input: RejectSwapRequestInput
): Promise<BookingSwapReq> {
    const { requestId, approverUserId, approverUserName, reason } = input;

    const req = await getBookingSwapReqById(requestId);
    if (!req) {
        throw new Error("Swap request not found");
    }

    if (req.status !== "Pending") {
        throw new Error(`Swap request is already ${req.status}`);
    }

    let newStatus: BookingSwapReqStatus = "Rejected";
    let decisionReason = reason ?? null;

    if (isExpired(req.expiresAt)) {
        newStatus = "Expired";
        if (!decisionReason) {
            decisionReason = "Auto expired at rejection time";
        }
    }

    const updatedReq = await updateBookingSwapReqStatus({
        bookingSwapReqId: req.bookingSwapReqId,
        status: newStatus,
        decidedByUserId: approverUserId,
        decisionReason,
    });

    if (!updatedReq) {
        throw new Error("Failed to update swap request status");
    }

    await safeLogActivity({
        entityType: "Booking",
        entityId: req.toBookingId,
        action: "SwapRequestRejected",
        oldValue: {
            bookingSwapReqId: req.bookingSwapReqId,
            status: req.status,
        },
        newValue: {
            bookingSwapReqId: updatedReq.bookingSwapReqId,
            status: updatedReq.status,
            decisionReason,
        },
        userId: approverUserName,
    });

    return updatedReq;
}

/* --------------------------------------------
   4) EXPIRE SWAP REQUEST (for cron / background job)
---------------------------------------------*/

/**
 * Mark a single request as Expired if:
 *  - status is still Pending
 *  - ExpiresAt is in the past
 *
 * Returns:
 *  - updated row if changed
 *  - null if no change (already non pending or not expired yet)
 */
export async function expireSwapRequestIfNeeded(
    requestId: number
): Promise<BookingSwapReq | null> {
    const req = await getBookingSwapReqById(requestId);
    if (!req) return null;

    if (req.status !== "Pending") return null;
    if (!isExpired(req.expiresAt)) return null;

    const updated = await updateBookingSwapReqStatus({
        bookingSwapReqId: req.bookingSwapReqId,
        status: "Expired",
        decisionReason: "Auto expired by background job",
    });

    return updated;
}
