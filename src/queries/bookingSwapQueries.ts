// src/queries/bookingSwapQueries.ts

import { connectDB, sql } from "@/config/db"
import type { BookingSwap, ISODateTimeString } from "@/types/cpsCore"

/**
 * Type of swap:
 * - "SwapSlots"
 * - "GiveSlot_CancelReceiver"
 * - "GiveSlot_RescheduleReceiver"
 *
 * (Make sure this matches BookingSwapType in cpsCore.ts)
 */
export type BookingSwapType =
    | "SwapSlots"
    | "GiveSlot_CancelReceiver"
    | "GiveSlot_RescheduleReceiver"

/**
 * Input for inserting into core.BookingSwap
 * Mirrors the table columns.
 */
export interface BookingSwapInsertInput {
    fromBookingId: number
    toBookingId: number
    swapType: BookingSwapType

    fromOldAreaId: number
    fromOldStart: ISODateTimeString
    fromOldEnd: ISODateTimeString

    fromNewAreaId: number
    fromNewStart: ISODateTimeString
    fromNewEnd: ISODateTimeString

    toOldAreaId: number | null
    toOldStart: ISODateTimeString | null
    toOldEnd: ISODateTimeString | null

    toNewAreaId: number
    toNewStart: ISODateTimeString
    toNewEnd: ISODateTimeString

    reason: string | null
    performedBy: string | null
}

/**
 * Insert one row into core.BookingSwap.
 *
 * - If tx is provided, it uses that transaction.
 * - If tx is not provided, it opens its own connection.
 */
export async function insertBookingSwap(
    input: BookingSwapInsertInput,
    tx?: sql.Transaction
): Promise<BookingSwap> {
    const pool = await connectDB()
    const request = tx ? new sql.Request(tx) : pool.request()

    request.input("From_Booking_Id", sql.Int, input.fromBookingId)
    request.input("To_Booking_Id", sql.Int, input.toBookingId)
    request.input("SwapType", sql.VarChar, input.swapType)

    request.input("From_OldArea_Id", sql.Int, input.fromOldAreaId)
    request.input("From_OldStart", sql.DateTime2, new Date(input.fromOldStart))
    request.input("From_OldEnd", sql.DateTime2, new Date(input.fromOldEnd))

    request.input("From_NewArea_Id", sql.Int, input.fromNewAreaId)
    request.input("From_NewStart", sql.DateTime2, new Date(input.fromNewStart))
    request.input("From_NewEnd", sql.DateTime2, new Date(input.fromNewEnd))

    request.input("To_OldArea_Id", sql.Int, input.toOldAreaId)
    request.input(
        "To_OldStart",
        sql.DateTime2,
        input.toOldStart ? new Date(input.toOldStart) : null
    )
    request.input(
        "To_OldEnd",
        sql.DateTime2,
        input.toOldEnd ? new Date(input.toOldEnd) : null
    )

    request.input("To_NewArea_Id", sql.Int, input.toNewAreaId)
    request.input("To_NewStart", sql.DateTime2, new Date(input.toNewStart))
    request.input("To_NewEnd", sql.DateTime2, new Date(input.toNewEnd))

    request.input("Reason", sql.VarChar, input.reason)
    request.input("PerformedBy", sql.VarChar, input.performedBy)

    const result = await request.query<BookingSwap>(`
    INSERT INTO core.BookingSwap (
      From_Booking_Id,
      To_Booking_Id,
      SwapType,
      From_OldArea_Id,
      From_OldStart,
      From_OldEnd,
      From_NewArea_Id,
      From_NewStart,
      From_NewEnd,
      To_OldArea_Id,
      To_OldStart,
      To_OldEnd,
      To_NewArea_Id,
      To_NewStart,
      To_NewEnd,
      Reason,
      PerformedBy
    )
    OUTPUT
      INSERTED.BookingSwap_Id    AS bookingSwapId,
      INSERTED.From_Booking_Id   AS fromBookingId,
      INSERTED.To_Booking_Id     AS toBookingId,
      INSERTED.SwapType          AS swapType,
      INSERTED.From_OldArea_Id   AS fromOldAreaId,
      INSERTED.From_OldStart     AS fromOldStart,
      INSERTED.From_OldEnd       AS fromOldEnd,
      INSERTED.From_NewArea_Id   AS fromNewAreaId,
      INSERTED.From_NewStart     AS fromNewStart,
      INSERTED.From_NewEnd       AS fromNewEnd,
      INSERTED.To_OldArea_Id     AS toOldAreaId,
      INSERTED.To_OldStart       AS toOldStart,
      INSERTED.To_OldEnd         AS toOldEnd,
      INSERTED.To_NewArea_Id     AS toNewAreaId,
      INSERTED.To_NewStart       AS toNewStart,
      INSERTED.To_NewEnd         AS toNewEnd,
      INSERTED.Reason            AS reason,
      INSERTED.PerformedBy       AS performedBy,
      INSERTED.PerformedAt       AS performedAt
    VALUES (
      @From_Booking_Id,
      @To_Booking_Id,
      @SwapType,
      @From_OldArea_Id,
      @From_OldStart,
      @From_OldEnd,
      @From_NewArea_Id,
      @From_NewStart,
      @From_NewEnd,
      @To_OldArea_Id,
      @To_OldStart,
      @To_OldEnd,
      @To_NewArea_Id,
      @To_NewStart,
      @To_NewEnd,
      @Reason,
      @PerformedBy
    );
  `)

    const row = result.recordset[0]
    if (!row) {
        throw new Error("Insert BookingSwap failed - no row returned")
    }

    return row
}
