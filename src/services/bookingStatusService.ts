// src/services/bookingStatusService.ts

import { safeLogActivity } from "@/queries/activityLogQueries"
import { findBookingById, updateBookingStatus } from "@/queries/bookingQueries"
import type { Booking, BookingStatus } from "@/types/cpsCoreTypes"

export interface ChangeBookingStatusOptions {
    userId: string
    source?: string      // e.g. "ManualStatusUpdate", "EmailConfirmation"
    remarks?: string
}

/**
 * Allowed transitions for Booking.Status
 */
const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
    Pending: ["Confirmed", "Cancelled", "Expired"],
    Confirmed: ["Cancelled", "Expired", "Completed"],
    Cancelled: [],   // terminal
    Expired: [],     // terminal
    Completed: [],   // terminal
}

function ensureAllowedBookingTransition(
    oldStatus: BookingStatus,
    newStatus: BookingStatus
) {
    if (oldStatus === newStatus) return

    const allowed = allowedTransitions[oldStatus] ?? []
    if (!allowed.includes(newStatus)) {
        throw new Error(
            `Booking status change from '${oldStatus}' to '${newStatus}' is not allowed`
        )
    }
}

/**
 * Central status change helper for Booking.
 * - Validates transition
 * - Updates Booking.Status
 * - Writes ActivityLog
 */
export async function changeBookingStatus(
    bookingId: number,
    newStatus: BookingStatus,
    options: ChangeBookingStatusOptions
): Promise<Booking> {
    const existing = await findBookingById(bookingId)
    if (!existing) {
        throw new Error("Booking not found")
    }

    ensureAllowedBookingTransition(existing.status, newStatus)

    const updated = await updateBookingStatus(bookingId, newStatus)
    if (!updated) {
        throw new Error("Failed to update booking status")
    }

    const remarks =
        options.remarks ??
        `Booking status changed from ${existing.status} to ${newStatus}${options.source ? ` (source: ${options.source})` : ""
        }`

    // Activity log
    await safeLogActivity({
        entityType: "Booking",
        entityId: updated.bookingId,
        action: "UpdatedStatus",
        oldValue: { status: existing.status },
        newValue: { status: updated.status, remarks },
        userId: options.userId,
    })

    return updated
}
