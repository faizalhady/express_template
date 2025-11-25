// src/services/bookingSwapService.ts

import { connectDB, sql } from "@/config/db"
import { safeLogActivity } from "@/queries/activityLogQueries"
import { insertBookingSwap } from "@/queries/bookingSwapQueries"
import type {
    Booking,
    BookingStatus,
    BookingSwap,
    BookingSwapType,
    ISODateTimeString,
} from "@/types/cpsCore"

/**
 * For the swap decision:
 * - fromBookingId = requester booking (the one who asks to swap)
 * - toBookingId   = receiver booking (the target slot he wants)
 */
// src/services/bookingSwapService.ts

export interface BookingSwapApproveInput {
    fromBookingId: number
    toBookingId: number

    decisionType: BookingSwapType

    // Only required for "GiveSlot_RescheduleReceiver"
    receiverNewAreaId?: number | undefined
    receiverNewStart?: ISODateTimeString | undefined
    receiverNewEnd?: ISODateTimeString | undefined

    reason?: string
    performedBy: string // NTID / username of the receiver who approves
}


export interface BookingSwapResult {
    swap: BookingSwap
    fromBooking: Booking
    toBooking: Booking
}

/* --------------------------------------------
   Helpers - status / time checks
---------------------------------------------*/

const terminalBookingStatuses: BookingStatus[] = [
    "Cancelled",
    "Expired",
    "Completed",
]

function ensureBookingNotTerminal(b: Booking, label: string) {
    if (terminalBookingStatuses.includes(b.status)) {
        throw new Error(
            `${label} booking is already in terminal status '${b.status}'`
        )
    }
}

/**
 * Check 4-hour rule:
 * - Only allow swap if "target" booking start >= now + 4 hours
 */
function ensureFourHourRule(target: Booking) {
    const now = new Date()
    const start = new Date(target.startDateTime)

    const diffMs = start.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 4) {
        throw new Error(
            "Swap not allowed. Target booking starts in less than 4 hours."
        )
    }
}

/* --------------------------------------------
   Internal: load bookings inside a transaction
---------------------------------------------*/

async function loadBookingByIdTx(
    tx: sql.Transaction,
    bookingId: number
): Promise<Booking | null> {
    const request = new sql.Request(tx)
    request.input("Booking_Id", sql.Int, bookingId)

    const result = await request.query<Booking>(`
    SELECT
      Booking_Id            AS bookingId,
      Job_Id                AS jobId,
      Area_Id               AS areaId,
      StartDateTime         AS startDateTime,
      EndDateTime           AS endDateTime,
      Status                AS status,
      CreatedBy             AS createdBy,
      CreatedAt             AS createdAt,
      ReplacedBy_Booking_Id AS replacedByBookingId,
      CreatedBy_User_Id     AS createdByUserId
    FROM core.Booking
    WHERE Booking_Id = @Booking_Id;
  `)

    return result.recordset[0] ?? null
}

/* --------------------------------------------
   Internal: update only slot (area + time)
---------------------------------------------*/

async function updateBookingSlotTx(
    tx: sql.Transaction,
    bookingId: number,
    areaId: number,
    startDateTime: ISODateTimeString,
    endDateTime: ISODateTimeString
): Promise<Booking> {
    const request = new sql.Request(tx)

    request.input("Booking_Id", sql.Int, bookingId)
    request.input("Area_Id", sql.Int, areaId)
    request.input("StartDateTime", sql.DateTime2, new Date(startDateTime))
    request.input("EndDateTime", sql.DateTime2, new Date(endDateTime))

    const result = await request.query<Booking>(`
    UPDATE core.Booking
    SET
      Area_Id       = @Area_Id,
      StartDateTime = @StartDateTime,
      EndDateTime   = @EndDateTime
    OUTPUT
      INSERTED.Booking_Id            AS bookingId,
      INSERTED.Job_Id                AS jobId,
      INSERTED.Area_Id               AS areaId,
      INSERTED.StartDateTime         AS startDateTime,
      INSERTED.EndDateTime           AS endDateTime,
      INSERTED.Status                AS status,
      INSERTED.CreatedBy             AS createdBy,
      INSERTED.CreatedAt             AS createdAt,
      INSERTED.ReplacedBy_Booking_Id AS replacedByBookingId,
      INSERTED.CreatedBy_User_Id     AS createdByUserId
    WHERE Booking_Id = @Booking_Id;
  `)

    const row = result.recordset[0]
    if (!row) {
        throw new Error("Update booking slot failed - no row returned")
    }

    return row
}

/* --------------------------------------------
   Internal: update status only
   (used for GiveSlot_CancelReceiver)
---------------------------------------------*/

async function updateBookingStatusTx(
    tx: sql.Transaction,
    bookingId: number,
    newStatus: BookingStatus
): Promise<Booking> {
    const request = new sql.Request(tx)

    request.input("Booking_Id", sql.Int, bookingId)
    request.input("Status", sql.VarChar, newStatus)

    const result = await request.query<Booking>(`
    UPDATE core.Booking
    SET Status = @Status
    OUTPUT
      INSERTED.Booking_Id            AS bookingId,
      INSERTED.Job_Id                AS jobId,
      INSERTED.Area_Id               AS areaId,
      INSERTED.StartDateTime         AS startDateTime,
      INSERTED.EndDateTime           AS endDateTime,
      INSERTED.Status                AS status,
      INSERTED.CreatedBy             AS createdBy,
      INSERTED.CreatedAt             AS createdAt,
      INSERTED.ReplacedBy_Booking_Id AS replacedByBookingId,
      INSERTED.CreatedBy_User_Id     AS createdByUserId
    WHERE Booking_Id = @Booking_Id;
  `)

    const row = result.recordset[0]
    if (!row) {
        throw new Error("Update booking status failed - no row returned")
    }

    return row
}

/* --------------------------------------------
   Main service: perform swap in one transaction
---------------------------------------------*/

export async function performBookingSwap(
    input: BookingSwapApproveInput
): Promise<BookingSwapResult> {
    const pool = await connectDB()
    const tx = new sql.Transaction(pool)
    await tx.begin()

    // Snapshot for activity logs
    let fromBefore: Booking | null = null
    let toBefore: Booking | null = null
    let fromAfter: Booking | null = null
    let toAfter: Booking | null = null
    let swapRow: BookingSwap | null = null

    try {
        const { fromBookingId, toBookingId, decisionType } = input

        if (fromBookingId === toBookingId) {
            throw new Error("fromBookingId and toBookingId cannot be the same")
        }

        // 1) Load both bookings with the transaction
        const fromBooking = await loadBookingByIdTx(tx, fromBookingId)
        const toBooking = await loadBookingByIdTx(tx, toBookingId)

        if (!fromBooking) {
            throw new Error("From booking not found")
        }
        if (!toBooking) {
            throw new Error("To booking not found")
        }

        fromBefore = { ...fromBooking }
        toBefore = { ...toBooking }

        // 2) Basic validations: not terminal, 4-hour rule on target/receiver booking
        ensureBookingNotTerminal(fromBooking, "Requester (from)")
        ensureBookingNotTerminal(toBooking, "Receiver (to)")

        // 4-hour rule: based on the slot that requester wants (toBooking)
        ensureFourHourRule(toBooking)

        // 3) Branch by decisionType
        if (decisionType === "SwapSlots") {
            // Scenario 2: both swap slots (no status change)
            const fromOldAreaId = fromBooking.areaId
            const fromOldStart = fromBooking.startDateTime
            const fromOldEnd = fromBooking.endDateTime

            const toOldAreaId = toBooking.areaId
            const toOldStart = toBooking.startDateTime
            const toOldEnd = toBooking.endDateTime

            // Update slots
            const updatedFrom = await updateBookingSlotTx(
                tx,
                fromBooking.bookingId,
                toOldAreaId,
                toOldStart,
                toOldEnd
            )

            const updatedTo = await updateBookingSlotTx(
                tx,
                toBooking.bookingId,
                fromOldAreaId,
                fromOldStart,
                fromOldEnd
            )

            fromAfter = updatedFrom
            toAfter = updatedTo

            // Insert BookingSwap row inside same transaction
            swapRow = await insertBookingSwap(
                {
                    fromBookingId: fromBooking.bookingId,
                    toBookingId: toBooking.bookingId,
                    swapType: "SwapSlots",

                    fromOldAreaId,
                    fromOldStart,
                    fromOldEnd,

                    fromNewAreaId: updatedFrom.areaId,
                    fromNewStart: updatedFrom.startDateTime,
                    fromNewEnd: updatedFrom.endDateTime,

                    toOldAreaId,
                    toOldStart,
                    toOldEnd,

                    toNewAreaId: updatedTo.areaId,
                    toNewStart: updatedTo.startDateTime,
                    toNewEnd: updatedTo.endDateTime,

                    reason: input.reason ?? null,
                    performedBy: input.performedBy,
                },
                tx
            )
        } else if (decisionType === "GiveSlot_CancelReceiver") {
            // Scenario 1:
            // - fromBooking takes toBooking's slot
            // - toBooking is cancelled (keeps same slot, but status=Cancelled)

            const fromOldAreaId = fromBooking.areaId
            const fromOldStart = fromBooking.startDateTime
            const fromOldEnd = fromBooking.endDateTime

            const toOldAreaId = toBooking.areaId
            const toOldStart = toBooking.startDateTime
            const toOldEnd = toBooking.endDateTime

            // 1) Move requester to receiver's slot
            const updatedFrom = await updateBookingSlotTx(
                tx,
                fromBooking.bookingId,
                toOldAreaId,
                toOldStart,
                toOldEnd
            )

            // 2) Cancel receiver booking
            if (!["Pending", "Confirmed"].includes(toBooking.status)) {
                throw new Error(
                    `Receiver booking cannot be cancelled from status '${toBooking.status}'`
                )
            }

            const updatedTo = await updateBookingStatusTx(
                tx,
                toBooking.bookingId,
                "Cancelled"
            )

            fromAfter = updatedFrom
            toAfter = updatedTo

            // For swap log:
            // - To slot time/area did not change, only status changed
            swapRow = await insertBookingSwap(
                {
                    fromBookingId: fromBooking.bookingId,
                    toBookingId: toBooking.bookingId,
                    swapType: "GiveSlot_CancelReceiver",

                    fromOldAreaId,
                    fromOldStart,
                    fromOldEnd,

                    fromNewAreaId: updatedFrom.areaId,
                    fromNewStart: updatedFrom.startDateTime,
                    fromNewEnd: updatedFrom.endDateTime,

                    toOldAreaId,
                    toOldStart,
                    toOldEnd,

                    toNewAreaId: updatedTo.areaId,
                    toNewStart: updatedTo.startDateTime,
                    toNewEnd: updatedTo.endDateTime,

                    reason: input.reason ?? null,
                    performedBy: input.performedBy,
                },
                tx
            )
        } else if (decisionType === "GiveSlot_RescheduleReceiver") {
            // Scenario 3:
            // - fromBooking takes toBooking's old slot
            // - toBooking moves to a NEW slot (selected by receiver)

            const fromOldAreaId = fromBooking.areaId
            const fromOldStart = fromBooking.startDateTime
            const fromOldEnd = fromBooking.endDateTime

            const toOldAreaId = toBooking.areaId
            const toOldStart = toBooking.startDateTime
            const toOldEnd = toBooking.endDateTime

            const receiverNewAreaId =
                input.receiverNewAreaId ?? toOldAreaId
            const receiverNewStart =
                input.receiverNewStart ?? toOldStart
            const receiverNewEnd =
                input.receiverNewEnd ?? toOldEnd

            const newStartDate = new Date(receiverNewStart)
            const newEndDate = new Date(receiverNewEnd)
            if (Number.isNaN(newStartDate.getTime()) || Number.isNaN(newEndDate.getTime())) {
                throw new Error("Receiver new start/end datetime is invalid")
            }
            if (newStartDate >= newEndDate) {
                throw new Error("receiverNewStart must be before receiverNewEnd")
            }

            // 1) Move requester to receiver's current slot
            const updatedFrom = await updateBookingSlotTx(
                tx,
                fromBooking.bookingId,
                toOldAreaId,
                toOldStart,
                toOldEnd
            )

            // 2) Move receiver to new slot
            const updatedTo = await updateBookingSlotTx(
                tx,
                toBooking.bookingId,
                receiverNewAreaId,
                receiverNewStart,
                receiverNewEnd
            )

            fromAfter = updatedFrom
            toAfter = updatedTo

            swapRow = await insertBookingSwap(
                {
                    fromBookingId: fromBooking.bookingId,
                    toBookingId: toBooking.bookingId,
                    swapType: "GiveSlot_RescheduleReceiver",

                    fromOldAreaId,
                    fromOldStart,
                    fromOldEnd,

                    fromNewAreaId: updatedFrom.areaId,
                    fromNewStart: updatedFrom.startDateTime,
                    fromNewEnd: updatedFrom.endDateTime,

                    toOldAreaId,
                    toOldStart,
                    toOldEnd,

                    toNewAreaId: updatedTo.areaId,
                    toNewStart: updatedTo.startDateTime,
                    toNewEnd: updatedTo.endDateTime,

                    reason: input.reason ?? null,
                    performedBy: input.performedBy,
                },
                tx
            )
        } else {
            throw new Error(`Unsupported decisionType '${decisionType}'`)
        }

        await tx.commit()

        // Activity logs (non-blocking, after commit)
        if (fromBefore && fromAfter) {
            safeLogActivity({
                entityType: "Booking",
                entityId: fromAfter.bookingId,
                action: "Swapped",
                oldValue: {
                    status: fromBefore.status,
                    areaId: fromBefore.areaId,
                    startDateTime: fromBefore.startDateTime,
                    endDateTime: fromBefore.endDateTime,
                    withBookingId: toBefore?.bookingId,
                },
                newValue: {
                    status: fromAfter.status,
                    areaId: fromAfter.areaId,
                    startDateTime: fromAfter.startDateTime,
                    endDateTime: fromAfter.endDateTime,
                    swapType: input.decisionType,
                },
                userId: input.performedBy,
            }).catch(() => { })
        }

        if (toBefore && toAfter) {
            safeLogActivity({
                entityType: "Booking",
                entityId: toAfter.bookingId,
                action: "Swapped",
                oldValue: {
                    status: toBefore.status,
                    areaId: toBefore.areaId,
                    startDateTime: toBefore.startDateTime,
                    endDateTime: toBefore.endDateTime,
                    withBookingId: fromBefore?.bookingId,
                },
                newValue: {
                    status: toAfter.status,
                    areaId: toAfter.areaId,
                    startDateTime: toAfter.startDateTime,
                    endDateTime: toAfter.endDateTime,
                    swapType: input.decisionType,
                },
                userId: input.performedBy,
            }).catch(() => { })
        }

        if (!swapRow || !fromAfter || !toAfter) {
            throw new Error("Swap completed but result objects are missing")
        }

        return {
            swap: swapRow,
            fromBooking: fromAfter,
            toBooking: toAfter,
        }
    } catch (err) {
        await tx.rollback()
        throw err
    }
}
