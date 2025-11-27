// src/queries/bookingSwapQueries.ts

import { connectDB, sql } from "@/config/db"
import type {
    Booking,
    BookingSwap,
    BookingSwapReq,
    BookingSwapReqStatus,
    BookingSwapType,
    ISODateTimeString,
} from "@/types/cpsCoreTypes"

/* ============================================================
   BOOKING CORE OPERATIONS (ALL SWAP SCENARIOS USE THESE)
   ============================================================ */

/**
 * Get a booking by ID.
 */
export async function getBookingById(
    bookingId: number
): Promise<Booking | null> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Booking_Id", sql.Int, bookingId)
        .query<Booking>(`
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

/**
 * Update booking area + slot time.
 */
export async function updateBookingSlot(
    bookingId: number,
    newAreaId: number,
    newStart: ISODateTimeString,
    newEnd: ISODateTimeString,
    trx?: sql.Transaction
): Promise<void> {
    const req = trx ? new sql.Request(trx) : (await connectDB()).request()

    req.input("Booking_Id", sql.Int, bookingId)
    req.input("Area_Id", sql.Int, newAreaId)
    req.input("StartDateTime", sql.DateTime2, new Date(newStart))
    req.input("EndDateTime", sql.DateTime2, new Date(newEnd))

    await req.query(`
    UPDATE core.Booking
    SET
      Area_Id       = @Area_Id,
      StartDateTime = @StartDateTime,
      EndDateTime   = @EndDateTime
    WHERE Booking_Id = @Booking_Id;
  `)
}

/**
 * Cancel booking (Status = 'Cancelled').
 */
export async function cancelBooking(
    bookingId: number,
    trx?: sql.Transaction
): Promise<void> {
    const req = trx ? new sql.Request(trx) : (await connectDB()).request()

    req.input("Booking_Id", sql.Int, bookingId)

    await req.query(`
    UPDATE core.Booking
    SET Status = 'Cancelled'
    WHERE Booking_Id = @Booking_Id;
  `)
}

/**
 * Mark a booking as replaced by another booking.
 */
export async function markBookingReplaced(
    replacedId: number,
    newId: number,
    trx?: sql.Transaction
): Promise<void> {
    const req = trx ? new sql.Request(trx) : (await connectDB()).request()

    req.input("Old_Id", sql.Int, replacedId)
    req.input("New_Id", sql.Int, newId)

    await req.query(`
    UPDATE core.Booking
    SET
      ReplacedBy_Booking_Id = @New_Id,
      Status                = 'Cancelled'
    WHERE Booking_Id = @Old_Id;
  `)
}

/* ============================================================
   BOOKING SWAP REQUEST (core.BookingSwapReq)
   ============================================================ */

/**
 * Create a new swap request.
 *
 * Notes:
 * - DB truth:
 *   - From_Booking_Id        (nullable, but we require it for Type A)
 *   - To_Booking_Id          (NOT NULL)
 *   - RequestedBy_User_Id    (NOT NULL)
 *   - RequestedAt            (default SYSUTCDATETIME())
 *   - ExpiresAt              (NOT NULL, we set to now + 60 minutes by default)
 *   - Status                 (default 'Pending')
 *   - Decision* / Receiver*  initially NULL
 *
 * - We DO NOT persist swapType or requesterRemarks here because DB
 *   does not have dedicated columns for them.
 */
export async function insertSwapRequest(
    input: {
        fromBookingId: number
        toBookingId: number
        requestedByUserId: number
        // optional override; if not passed, default 60 minutes from now
        expiresInMinutes?: number
        // optional pre-filled receiver new slot (for GiveSlot_RescheduleReceiver flows)
        receiverNewAreaId?: number | null
        receiverNewStart?: ISODateTimeString | null
        receiverNewEnd?: ISODateTimeString | null
    },
    trx?: sql.Transaction
): Promise<BookingSwapReq | null> {
    const req = trx ? new sql.Request(trx) : (await connectDB()).request()

    const expiresMinutes = input.expiresInMinutes ?? 60

    req.input("From_Booking_Id", sql.Int, input.fromBookingId)
    req.input("To_Booking_Id", sql.Int, input.toBookingId)
    req.input("RequestedBy_User_Id", sql.Int, input.requestedByUserId)
    req.input("ExpiresInMinutes", sql.Int, expiresMinutes)
    req.input("ReceiverNewArea_Id", sql.Int, input.receiverNewAreaId ?? null)
    req.input(
        "ReceiverNewStart",
        sql.DateTime2,
        input.receiverNewStart ? new Date(input.receiverNewStart) : null
    )
    req.input(
        "ReceiverNewEnd",
        sql.DateTime2,
        input.receiverNewEnd ? new Date(input.receiverNewEnd) : null
    )

    const result = await req.query<BookingSwapReq>(`
    INSERT INTO core.BookingSwapReq (
      From_Booking_Id,
      To_Booking_Id,
      RequestedBy_User_Id,
      RequestedAt,
      ExpiresAt,
      Status,
      DecisionBy_User_Id,
      DecisionAt,
      DecisionReason,
      Linked_BookingSwap_Id,
      DecisionType,
      ReceiverNewArea_Id,
      ReceiverNewStart,
      ReceiverNewEnd
    )
    OUTPUT
      INSERTED.BookingSwapReq_Id     AS bookingSwapReqId,
      INSERTED.From_Booking_Id       AS fromBookingId,
      INSERTED.To_Booking_Id         AS toBookingId,
      INSERTED.RequestedBy_User_Id   AS requestedByUserId,
      INSERTED.RequestedAt           AS requestedAt,
      INSERTED.ExpiresAt             AS expiresAt,
      INSERTED.Status                AS status,
      INSERTED.DecisionBy_User_Id    AS decisionByUserId,
      INSERTED.DecisionAt            AS decisionAt,
      INSERTED.DecisionReason        AS decisionReason,
      INSERTED.Linked_BookingSwap_Id AS linkedBookingSwapId,
      INSERTED.DecisionType          AS decisionType,
      INSERTED.ReceiverNewArea_Id    AS receiverNewAreaId,
      INSERTED.ReceiverNewStart      AS receiverNewStart,
      INSERTED.ReceiverNewEnd        AS receiverNewEnd
    VALUES (
      @From_Booking_Id,
      @To_Booking_Id,
      @RequestedBy_User_Id,
      SYSUTCDATETIME(),
      DATEADD(MINUTE, @ExpiresInMinutes, SYSUTCDATETIME()),
      'Pending',
      NULL,   -- DecisionBy_User_Id
      NULL,   -- DecisionAt
      NULL,   -- DecisionReason
      NULL,   -- Linked_BookingSwap_Id
      NULL,   -- DecisionType
      @ReceiverNewArea_Id,
      @ReceiverNewStart,
      @ReceiverNewEnd
    );
  `)

    return result.recordset[0] ?? null
}

/**
 * Get swap request by ID.
 */
export async function getSwapRequestById(
    swapReqId: number
): Promise<BookingSwapReq | null> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("BookingSwapReq_Id", sql.Int, swapReqId)
        .query<BookingSwapReq>(`
      SELECT
        BookingSwapReq_Id         AS bookingSwapReqId,
        From_Booking_Id           AS fromBookingId,
        To_Booking_Id             AS toBookingId,
        RequestedBy_User_Id       AS requestedByUserId,
        RequestedAt               AS requestedAt,
        ExpiresAt                 AS expiresAt,
        Status                    AS status,
        DecisionBy_User_Id        AS decisionByUserId,
        DecisionAt                AS decisionAt,
        DecisionReason            AS decisionReason,
        Linked_BookingSwap_Id     AS linkedBookingSwapId,
        DecisionType              AS decisionType,
        ReceiverNewArea_Id        AS receiverNewAreaId,
        ReceiverNewStart          AS receiverNewStart,
        ReceiverNewEnd            AS receiverNewEnd
      FROM core.BookingSwapReq
      WHERE BookingSwapReq_Id = @BookingSwapReq_Id;
    `)

    return result.recordset[0] ?? null
}

/**
 * Generic "decision" update for a swap request.
 *
 * This is a simpler helper compared to the more advanced
 * transaction-aware `markSwapReqStatus` you have in the service.
 *
 * It maps to:
 *  - Status
 *  - DecisionBy_User_Id
 *  - DecisionReason
 *  - DecisionAt
 */
export async function updateSwapRequestDecision(
    swapReqId: number,
    status: BookingSwapReqStatus,
    decisionByUserId: number,
    decisionReason?: string | null,
    trx?: sql.Transaction
): Promise<void> {
    const req = trx ? new sql.Request(trx) : (await connectDB()).request()

    req.input("BookingSwapReq_Id", sql.Int, swapReqId)
    req.input("Status", sql.VarChar, status)
    req.input("DecisionBy_User_Id", sql.Int, decisionByUserId)
    req.input("DecisionReason", sql.NVarChar(400), decisionReason ?? null)

    await req.query(`
    UPDATE core.BookingSwapReq
    SET
      Status             = @Status,
      DecisionBy_User_Id = @DecisionBy_User_Id,
      DecisionReason     = @DecisionReason,
      DecisionAt         = SYSUTCDATETIME()
    WHERE BookingSwapReq_Id = @BookingSwapReq_Id;
  `)
}

/**
 * Expire a request (auto-expiry / manual expiry).
 * Sets:
 *  - Status = 'Expired'
 *  - DecisionAt = now
 */
export async function expireSwapRequest(
    swapReqId: number,
    trx?: sql.Transaction
): Promise<void> {
    const req = trx ? new sql.Request(trx) : (await connectDB()).request()

    req.input("BookingSwapReq_Id", sql.Int, swapReqId)

    await req.query(`
    UPDATE core.BookingSwapReq
    SET
      Status     = 'Expired',
      DecisionAt = SYSUTCDATETIME()
    WHERE BookingSwapReq_Id = @BookingSwapReq_Id;
  `)
}

/**
 * List all requests involving a specific booking (as from or to).
 */
export async function listRequestsForBooking(
    bookingId: number
): Promise<BookingSwapReq[]> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Booking_Id", sql.Int, bookingId)
        .query<BookingSwapReq>(`
      SELECT
        BookingSwapReq_Id         AS bookingSwapReqId,
        From_Booking_Id           AS fromBookingId,
        To_Booking_Id             AS toBookingId,
        RequestedBy_User_Id       AS requestedByUserId,
        RequestedAt               AS requestedAt,
        ExpiresAt                 AS expiresAt,
        Status                    AS status,
        DecisionBy_User_Id        AS decisionByUserId,
        DecisionAt                AS decisionAt,
        DecisionReason            AS decisionReason,
        Linked_BookingSwap_Id     AS linkedBookingSwapId,
        DecisionType              AS decisionType,
        ReceiverNewArea_Id        AS receiverNewAreaId,
        ReceiverNewStart          AS receiverNewStart,
        ReceiverNewEnd            AS receiverNewEnd
      FROM core.BookingSwapReq
      WHERE From_Booking_Id = @Booking_Id
         OR To_Booking_Id   = @Booking_Id
      ORDER BY RequestedAt DESC;
    `)

    return result.recordset
}

/**
 * List all requests by a specific user (as requester or decider).
 */
export async function listRequestsForUser(
    userId: number
): Promise<BookingSwapReq[]> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("User_Id", sql.Int, userId)
        .query<BookingSwapReq>(`
      SELECT
        BookingSwapReq_Id         AS bookingSwapReqId,
        From_Booking_Id           AS fromBookingId,
        To_Booking_Id             AS toBookingId,
        RequestedBy_User_Id       AS requestedByUserId,
        RequestedAt               AS requestedAt,
        ExpiresAt                 AS expiresAt,
        Status                    AS status,
        DecisionBy_User_Id        AS decisionByUserId,
        DecisionAt                AS decisionAt,
        DecisionReason            AS decisionReason,
        Linked_BookingSwap_Id     AS linkedBookingSwapId,
        DecisionType              AS decisionType,
        ReceiverNewArea_Id        AS receiverNewAreaId,
        ReceiverNewStart          AS receiverNewStart,
        ReceiverNewEnd            AS receiverNewEnd
      FROM core.BookingSwapReq
      WHERE RequestedBy_User_Id = @User_Id
         OR DecisionBy_User_Id  = @User_Id
      ORDER BY RequestedAt DESC;
    `)

    return result.recordset
}

/**
 * Helper: ensure no active pending request exists for a booking.
 */
export async function ensureNoActivePendingReq(
    bookingId: number
): Promise<boolean> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Booking_Id", sql.Int, bookingId)
        .query<{ cnt: number }>(`
      SELECT COUNT(*) AS cnt
      FROM core.BookingSwapReq
      WHERE Status = 'Pending'
        AND (From_Booking_Id = @Booking_Id
         OR  To_Booking_Id   = @Booking_Id);
    `)

    return result.recordset[0]?.cnt === 0
}

/* ============================================================
   SWAP HISTORY (core.BookingSwap)
   ============================================================ */

/**
 * Insert a swap history record.
 *
 * DB columns:
 *  - BookingSwap_Id (identity)
 *  - From_Booking_Id, To_Booking_Id, SwapType
 *  - From_OldArea_Id / From_OldStart / From_OldEnd
 *  - From_NewArea_Id / From_NewStart / From_NewEnd
 *  - To_OldArea_Id / To_OldStart / To_OldEnd
 *  - To_NewArea_Id / To_NewStart / To_NewEnd
 *  - Reason, PerformedBy, PerformedAt
 */
export async function insertSwapHistory(
    input: {
        // For linking back in service (NOT stored in this table)
        swapReqId: number

        fromBookingId: number | null
        toBookingId: number

        swapType: BookingSwapType

        // Snapshot BEFORE
        oldFromAreaId: number | null
        oldFromStart: ISODateTimeString | null
        oldFromEnd: ISODateTimeString | null

        oldToAreaId: number | null
        oldToStart: ISODateTimeString | null
        oldToEnd: ISODateTimeString | null

        // Snapshot AFTER
        newFromAreaId: number | null
        newFromStart: ISODateTimeString | null
        newFromEnd: ISODateTimeString | null

        newToAreaId: number | null
        newToStart: ISODateTimeString | null
        newToEnd: ISODateTimeString | null

        // Optional metadata
        reason?: string | null
        performedBy?: string | null
    },
    trx?: sql.Transaction
): Promise<BookingSwap | null> {
    const req = trx ? new sql.Request(trx) : (await connectDB()).request()

    // core IDs / type
    req.input("From_Booking_Id", sql.Int, input.fromBookingId ?? null)
    req.input("To_Booking_Id", sql.Int, input.toBookingId)
    req.input("SwapType", sql.VarChar, input.swapType)

    // BEFORE - From
    req.input("From_OldArea_Id", sql.Int, input.oldFromAreaId ?? null)
    req.input(
        "From_OldStart",
        sql.DateTime,
        input.oldFromStart ? new Date(input.oldFromStart) : null
    )
    req.input(
        "From_OldEnd",
        sql.DateTime,
        input.oldFromEnd ? new Date(input.oldFromEnd) : null
    )

    // BEFORE - To
    req.input("To_OldArea_Id", sql.Int, input.oldToAreaId ?? null)
    req.input(
        "To_OldStart",
        sql.DateTime,
        input.oldToStart ? new Date(input.oldToStart) : null
    )
    req.input(
        "To_OldEnd",
        sql.DateTime,
        input.oldToEnd ? new Date(input.oldToEnd) : null
    )

    // AFTER - From
    req.input("From_NewArea_Id", sql.Int, input.newFromAreaId ?? null)
    req.input(
        "From_NewStart",
        sql.DateTime,
        input.newFromStart ? new Date(input.newFromStart) : null
    )
    req.input(
        "From_NewEnd",
        sql.DateTime,
        input.newFromEnd ? new Date(input.newFromEnd) : null
    )

    // AFTER - To
    req.input("To_NewArea_Id", sql.Int, input.newToAreaId ?? null)
    req.input(
        "To_NewStart",
        sql.DateTime,
        input.newToStart ? new Date(input.newToStart) : null
    )
    req.input(
        "To_NewEnd",
        sql.DateTime,
        input.newToEnd ? new Date(input.newToEnd) : null
    )

    // Metadata
    req.input("Reason", sql.VarChar(500), input.reason ?? null)
    req.input("PerformedBy", sql.VarChar(100), input.performedBy ?? null)

    const result = await req.query<BookingSwap>(`
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
      INSERTED.BookingSwap_Id   AS bookingSwapId,
      INSERTED.From_Booking_Id  AS fromBookingId,
      INSERTED.To_Booking_Id    AS toBookingId,
      INSERTED.SwapType         AS swapType,

      INSERTED.From_OldArea_Id  AS fromOldAreaId,
      INSERTED.From_OldStart    AS fromOldStart,
      INSERTED.From_OldEnd      AS fromOldEnd,

      INSERTED.From_NewArea_Id  AS fromNewAreaId,
      INSERTED.From_NewStart    AS fromNewStart,
      INSERTED.From_NewEnd      AS fromNewEnd,

      INSERTED.To_OldArea_Id    AS toOldAreaId,
      INSERTED.To_OldStart      AS toOldStart,
      INSERTED.To_OldEnd        AS toOldEnd,

      INSERTED.To_NewArea_Id    AS toNewAreaId,
      INSERTED.To_NewStart      AS toNewStart,
      INSERTED.To_NewEnd        AS toNewEnd,

      INSERTED.Reason           AS reason,
      INSERTED.PerformedBy      AS performedBy,
      INSERTED.PerformedAt      AS performedAt
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

    return result.recordset[0] ?? null
}

/**
 * Get a specific swap history row.
 */
export async function getSwapHistoryById(
    swapId: number
): Promise<BookingSwap | null> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("BookingSwap_Id", sql.Int, swapId)
        .query<BookingSwap>(`
      SELECT
        BookingSwap_Id      AS bookingSwapId,
        From_Booking_Id     AS fromBookingId,
        To_Booking_Id       AS toBookingId,
        SwapType            AS swapType,

        From_OldArea_Id     AS fromOldAreaId,
        From_OldStart       AS fromOldStart,
        From_OldEnd         AS fromOldEnd,

        From_NewArea_Id     AS fromNewAreaId,
        From_NewStart       AS fromNewStart,
        From_NewEnd         AS fromNewEnd,

        To_OldArea_Id       AS toOldAreaId,
        To_OldStart         AS toOldStart,
        To_OldEnd           AS toOldEnd,

        To_NewArea_Id       AS toNewAreaId,
        To_NewStart         AS toNewStart,
        To_NewEnd           AS toNewEnd,

        Reason              AS reason,
        PerformedBy         AS performedBy,
        PerformedAt         AS performedAt
      FROM core.BookingSwap
      WHERE BookingSwap_Id = @BookingSwap_Id;
    `)

    return result.recordset[0] ?? null
}

/**
 * List swap history rows where booking appears as From or To.
 */
export async function listSwapHistoryForBooking(
    bookingId: number
): Promise<BookingSwap[]> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Booking_Id", sql.Int, bookingId)
        .query<BookingSwap>(`
      SELECT
        BookingSwap_Id      AS bookingSwapId,
        From_Booking_Id     AS fromBookingId,
        To_Booking_Id       AS toBookingId,
        SwapType            AS swapType,

        From_OldArea_Id     AS fromOldAreaId,
        From_OldStart       AS fromOldStart,
        From_OldEnd         AS fromOldEnd,

        From_NewArea_Id     AS fromNewAreaId,
        From_NewStart       AS fromNewStart,
        From_NewEnd         AS fromNewEnd,

        To_OldArea_Id       AS toOldAreaId,
        To_OldStart         AS toOldStart,
        To_OldEnd           AS toOldEnd,

        To_NewArea_Id       AS toNewAreaId,
        To_NewStart         AS toNewStart,
        To_NewEnd           AS toNewEnd,

        Reason              AS reason,
        PerformedBy         AS performedBy,
        PerformedAt         AS performedAt
      FROM core.BookingSwap
      WHERE From_Booking_Id = @Booking_Id
         OR To_Booking_Id   = @Booking_Id
      ORDER BY PerformedAt DESC;
    `)

    return result.recordset
}
