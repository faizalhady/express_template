// src/queries/bookingSwapReqQueries.ts

import { connectDB, sql } from "@/config/db";
import type {
    BookingSwapReq,
    BookingSwapReqStatus,
    BookingSwapType,
    ISODateTimeString,
} from "@/types/cpsCore";

/**
 * Insert a new BookingSwapReq row.
 *
 * Notes:
 * - Status is always "Pending" on creation.
 * - RequestedAt uses SYSUTCDATETIME() in SQL.
 * - ExpiresAt is passed from service (4-hour rule / 1-hour rule etc).
 * - For now, RequestedType is defaulted to "SwapSlots" as a neutral value.
 */
export async function insertBookingSwapReq(params: {
    fromBookingId: number | null;
    toBookingId: number;
    requestedByUserId: number;
    expiresAt: ISODateTimeString;
}): Promise<BookingSwapReq> {
    const { fromBookingId, toBookingId, requestedByUserId, expiresAt } = params;

    const pool = await connectDB();

    const result = await pool
        .request()
        .input("FromBookingId", sql.Int, fromBookingId)
        .input("ToBookingId", sql.Int, toBookingId)
        .input("RequestedType", sql.NVarChar(50), "SwapSlots" as BookingSwapType)
        .input("RequestedByUserId", sql.Int, requestedByUserId)
        .input("ExpiresAt", sql.DateTime2, expiresAt)
        .query<BookingSwapReq>(/* sql */ `
            INSERT INTO core.BookingSwapReq (
                From_Booking_Id,
                To_Booking_Id,
                RequestedType,
                RequestedBy_User_Id,
                RequestedAt,
                ExpiresAt,
                Status
            )
            OUTPUT
                INSERTED.BookingSwapReq_Id          AS bookingSwapReqId,
                INSERTED.From_Booking_Id            AS fromBookingId,
                INSERTED.To_Booking_Id              AS toBookingId,
                INSERTED.RequestedType              AS requestedType,
                INSERTED.RequestedBy_User_Id        AS requestedByUserId,
                INSERTED.RequestedAt                AS requestedAt,
                INSERTED.ExpiresAt                  AS expiresAt,
                INSERTED.Status                     AS status,
                INSERTED.DecisionBy_User_Id         AS decisionByUserId,
                INSERTED.DecisionAt                 AS decisionAt,
                INSERTED.DecisionReason             AS decisionReason,
                INSERTED.Receiver_NewSlot_AreaId    AS receiverNewSlotAreaId,
                INSERTED.Receiver_NewSlot_Start     AS receiverNewSlotStart,
                INSERTED.Receiver_NewSlot_End       AS receiverNewSlotEnd,
                INSERTED.Linked_BookingSwap_Id      AS linkedBookingSwapId
            VALUES (
                @FromBookingId,
                @ToBookingId,
                @RequestedType,
                @RequestedByUserId,
                SYSUTCDATETIME(),  -- RequestedAt
                @ExpiresAt,
                N'Pending'
            );
        `);

    const row = result.recordset[0];

    if (!row) {
        throw new Error("Failed to insert BookingSwapReq");
    }

    return row;
}

/**
 * Fetch a BookingSwapReq by primary key.
 */
export async function getBookingSwapReqById(
    bookingSwapReqId: number
): Promise<BookingSwapReq | null> {
    const pool = await connectDB();

    const result = await pool
        .request()
        .input("BookingSwapReqId", sql.Int, bookingSwapReqId)
        .query<BookingSwapReq>(/* sql */ `
            SELECT
                BookingSwapReq_Id          AS bookingSwapReqId,
                From_Booking_Id            AS fromBookingId,
                To_Booking_Id              AS toBookingId,
                RequestedType              AS requestedType,
                RequestedBy_User_Id        AS requestedByUserId,
                RequestedAt                AS requestedAt,
                ExpiresAt                  AS expiresAt,
                Status                     AS status,
                DecisionBy_User_Id         AS decisionByUserId,
                DecisionAt                 AS decisionAt,
                DecisionReason             AS decisionReason,
                Receiver_NewSlot_AreaId    AS receiverNewSlotAreaId,
                Receiver_NewSlot_Start     AS receiverNewSlotStart,
                Receiver_NewSlot_End       AS receiverNewSlotEnd,
                Linked_BookingSwap_Id      AS linkedBookingSwapId
            FROM core.BookingSwapReq
            WHERE BookingSwapReq_Id = @BookingSwapReqId;
        `);

    return result.recordset[0] ?? null;
}

/**
 * Update status and (optionally) decision info for a BookingSwapReq.
 *
 * Used for:
 * - Approve (sets status = Approved, decisionBy, decisionAt, reason,
 *   receiverNewSlot*, linkedBookingSwapId)
 * - Reject / Expire (can also be used if you want; but see helper below)
 */
export async function updateBookingSwapReqStatusAndDecision(params: {
    bookingSwapReqId: number;
    status: BookingSwapReqStatus;
    decidedByUserId?: number | null;
    decisionReason?: string | null;
    receiverNewSlotAreaId?: number | null;
    receiverNewSlotStart?: ISODateTimeString | null;
    receiverNewSlotEnd?: ISODateTimeString | null;
    linkedBookingSwapId?: number | null;
}): Promise<BookingSwapReq | null> {
    const {
        bookingSwapReqId,
        status,
        decidedByUserId = null,
        decisionReason = null,
        receiverNewSlotAreaId = null,
        receiverNewSlotStart = null,
        receiverNewSlotEnd = null,
        linkedBookingSwapId = null,
    } = params;

    const pool = await connectDB();

    const result = await pool
        .request()
        .input("BookingSwapReqId", sql.Int, bookingSwapReqId)
        .input("Status", sql.NVarChar(20), status)
        .input("DecidedByUserId", sql.Int, decidedByUserId)
        .input("DecisionReason", sql.NVarChar(sql.MAX), decisionReason)
        .input("ReceiverNewSlotAreaId", sql.Int, receiverNewSlotAreaId)
        .input("ReceiverNewSlotStart", sql.DateTime2, receiverNewSlotStart)
        .input("ReceiverNewSlotEnd", sql.DateTime2, receiverNewSlotEnd)
        .input("LinkedBookingSwapId", sql.Int, linkedBookingSwapId)
        .query<BookingSwapReq>(/* sql */ `
            UPDATE core.BookingSwapReq
            SET
                Status                  = @Status,
                DecisionBy_User_Id      = @DecidedByUserId,
                DecisionAt              = SYSUTCDATETIME(),
                DecisionReason          = @DecisionReason,
                Receiver_NewSlot_AreaId = @ReceiverNewSlotAreaId,
                Receiver_NewSlot_Start  = @ReceiverNewSlotStart,
                Receiver_NewSlot_End    = @ReceiverNewSlotEnd,
                Linked_BookingSwap_Id   = @LinkedBookingSwapId
            OUTPUT
                INSERTED.BookingSwapReq_Id          AS bookingSwapReqId,
                INSERTED.From_Booking_Id            AS fromBookingId,
                INSERTED.To_Booking_Id              AS toBookingId,
                INSERTED.RequestedType              AS requestedType,
                INSERTED.RequestedBy_User_Id        AS requestedByUserId,
                INSERTED.RequestedAt                AS requestedAt,
                INSERTED.ExpiresAt                  AS expiresAt,
                INSERTED.Status                     AS status,
                INSERTED.DecisionBy_User_Id         AS decisionByUserId,
                INSERTED.DecisionAt                 AS decisionAt,
                INSERTED.DecisionReason             AS decisionReason,
                INSERTED.Receiver_NewSlot_AreaId    AS receiverNewSlotAreaId,
                INSERTED.Receiver_NewSlot_Start     AS receiverNewSlotStart,
                INSERTED.Receiver_NewSlot_End       AS receiverNewSlotEnd,
                INSERTED.Linked_BookingSwap_Id      AS linkedBookingSwapId
            WHERE BookingSwapReq_Id = @BookingSwapReqId;
        `);

    return result.recordset[0] ?? null;
}

/**
 * Simple helper for status + decision fields only.
 * Used by Reject / Expire flows when you do not care about receiverNew slot.
 */
export async function updateBookingSwapReqStatus(params: {
    bookingSwapReqId: number;
    status: BookingSwapReqStatus;
    decidedByUserId?: number | null;
    decisionReason?: string | null;
}): Promise<BookingSwapReq | null> {
    const {
        bookingSwapReqId,
        status,
        decidedByUserId = null,
        decisionReason = null,
    } = params;

    const pool = await connectDB();

    const result = await pool
        .request()
        .input("BookingSwapReqId", sql.Int, bookingSwapReqId)
        .input("Status", sql.NVarChar(20), status)
        .input("DecidedByUserId", sql.Int, decidedByUserId)
        .input("DecisionReason", sql.NVarChar(sql.MAX), decisionReason)
        .query<BookingSwapReq>(/* sql */ `
            UPDATE core.BookingSwapReq
            SET
                Status             = @Status,
                DecisionBy_User_Id = @DecidedByUserId,
                DecisionAt         = SYSUTCDATETIME(),
                DecisionReason     = @DecisionReason
            OUTPUT
                INSERTED.BookingSwapReq_Id          AS bookingSwapReqId,
                INSERTED.From_Booking_Id            AS fromBookingId,
                INSERTED.To_Booking_Id              AS toBookingId,
                INSERTED.RequestedType              AS requestedType,
                INSERTED.RequestedBy_User_Id        AS requestedByUserId,
                INSERTED.RequestedAt                AS requestedAt,
                INSERTED.ExpiresAt                  AS expiresAt,
                INSERTED.Status                     AS status,
                INSERTED.DecisionBy_User_Id         AS decisionByUserId,
                INSERTED.DecisionAt                 AS decisionAt,
                INSERTED.DecisionReason             AS decisionReason,
                INSERTED.Receiver_NewSlot_AreaId    AS receiverNewSlotAreaId,
                INSERTED.Receiver_NewSlot_Start     AS receiverNewSlotStart,
                INSERTED.Receiver_NewSlot_End       AS receiverNewSlotEnd,
                INSERTED.Linked_BookingSwap_Id      AS linkedBookingSwapId
            WHERE BookingSwapReq_Id = @BookingSwapReqId;
        `);

    return result.recordset[0] ?? null;
}
