// src/services/bookingSwapService.ts

import { connectDB, sql } from "@/config/db";
import { safeLogActivity } from "@/queries/activityLogQueries";
import { insertSwapHistory } from "@/queries/bookingSwapQueries";
import type {
    Booking,
    BookingSwap,
    BookingSwapReq,
    BookingSwapReqStatus,
    BookingSwapType,
    CratingJob,
    ISODateTimeString,
} from "@/types/cpsCoreTypes";

/* =========================================================
   SERVICE DTOs
   ========================================================= */

export interface ApproveSwapPayload {
    swapReqId: number;
    approverUserId: number;
    approverUsername?: string | null;

    // Final decision type chosen by receiver
    decisionType: BookingSwapType;

    // Only used for GiveSlot_RescheduleReceiver
    receiverNewAreaId?: number | null;
    receiverNewStart?: ISODateTimeString | null;
    receiverNewEnd?: ISODateTimeString | null;

    // Optional free-text reason
    decisionReason?: string | null;
}

export interface RejectSwapPayload {
    swapReqId: number;
    approverUserId: number;
    approverUsername?: string | null;
    decisionReason?: string | null;
}

export interface SwapDecisionResult {
    swapReq: BookingSwapReq;
    swapHistory: BookingSwap | null;
    fromBooking: Booking | null;
    toBooking: Booking | null;
    fromJob: CratingJob | null;
    toJob: CratingJob | null;
}

/* =========================================================
   INTERNAL HELPERS (transaction-aware)
   ========================================================= */

/**
 * Load swap request row with row lock (FOR UPDATE).
 * Uses current DB schema:
 *  - BookingSwapReq_Id
 *  - From_Booking_Id
 *  - To_Booking_Id
 *  - RequestedBy_User_Id
 *  - RequestedAt
 *  - ExpiresAt
 *  - Status
 *  - DecisionBy_User_Id
 *  - DecisionAt
 *  - DecisionReason
 *  - Linked_BookingSwap_Id
 *  - DecisionType
 *  - ReceiverNewArea_Id / Start / End
 */
async function loadSwapReqForUpdate(
    trx: sql.Transaction,
    swapReqId: number
): Promise<BookingSwapReq | null> {
    const req = new sql.Request(trx);
    req.input("BookingSwapReq_Id", sql.Int, swapReqId);

    const result = await req.query<BookingSwapReq>(`
    SELECT
      BookingSwapReq_Id     AS bookingSwapReqId,
      From_Booking_Id       AS fromBookingId,
      To_Booking_Id         AS toBookingId,
      RequestedBy_User_Id   AS requestedByUserId,
      RequestedAt           AS requestedAt,
      ExpiresAt             AS expiresAt,
      Status                AS status,
      DecisionBy_User_Id    AS decisionByUserId,
      DecisionAt            AS decisionAt,
      DecisionReason        AS decisionReason,
      Linked_BookingSwap_Id AS linkedBookingSwapId,
      DecisionType          AS decisionType,
      ReceiverNewArea_Id    AS receiverNewAreaId,
      ReceiverNewStart      AS receiverNewStart,
      ReceiverNewEnd        AS receiverNewEnd
    FROM core.BookingSwapReq WITH (UPDLOCK, ROWLOCK)
    WHERE BookingSwapReq_Id = @BookingSwapReq_Id;
  `);

    return result.recordset[0] ?? null;
}

async function loadBookingForUpdate(
    trx: sql.Transaction,
    bookingId: number
): Promise<Booking | null> {
    const req = new sql.Request(trx);
    req.input("Booking_Id", sql.Int, bookingId);

    const result = await req.query<Booking>(`
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
    FROM core.Booking WITH (UPDLOCK, ROWLOCK)
    WHERE Booking_Id = @Booking_Id;
  `);

    return result.recordset[0] ?? null;
}

async function loadJobForUpdate(
    trx: sql.Transaction,
    jobId: number
): Promise<CratingJob | null> {
    const req = new sql.Request(trx);
    req.input("Job_Id", sql.Int, jobId);

    const result = await req.query<CratingJob>(`
    SELECT
      Job_Id       AS jobId,
      SerialNumber AS serialNumber,
      Model        AS model,
      Workcell_Id  AS workcellId,
      Vendor_Id    AS vendorId,
      Area_Id      AS areaId,
      Status       AS status,
      StartTime    AS startTime,
      EndTime      AS endTime,
      CreatedBy    AS createdBy,
      CreatedAt    AS createdAt
    FROM core.CratingJob WITH (UPDLOCK, ROWLOCK)
    WHERE Job_Id = @Job_Id;
  `);

    return result.recordset[0] ?? null;
}

async function updateBookingDateArea(
    trx: sql.Transaction,
    bookingId: number,
    newAreaId: number,
    newStart: ISODateTimeString,
    newEnd: ISODateTimeString
): Promise<Booking | null> {
    const req = new sql.Request(trx);
    req.input("Booking_Id", sql.Int, bookingId);
    req.input("Area_Id", sql.Int, newAreaId);
    req.input("StartDateTime", sql.DateTime2, new Date(newStart));
    req.input("EndDateTime", sql.DateTime2, new Date(newEnd));

    const result = await req.query<Booking>(`
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
  `);

    return result.recordset[0] ?? null;
}

async function cancelBookingInternal(
    trx: sql.Transaction,
    bookingId: number
): Promise<Booking | null> {
    const req = new sql.Request(trx);
    req.input("Booking_Id", sql.Int, bookingId);
    req.input("Status", sql.VarChar, "Cancelled");

    const result = await req.query<Booking>(`
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
  `);

    return result.recordset[0] ?? null;
}

async function updateJobAreaTime(
    trx: sql.Transaction,
    jobId: number,
    areaId: number,
    start: ISODateTimeString,
    end: ISODateTimeString
): Promise<CratingJob | null> {
    const req = new sql.Request(trx);
    req.input("Job_Id", sql.Int, jobId);
    req.input("Area_Id", sql.Int, areaId);
    req.input("StartTime", sql.DateTime2, new Date(start));
    req.input("EndTime", sql.DateTime2, new Date(end));

    const result = await req.query<CratingJob>(`
    UPDATE core.CratingJob
    SET
      Area_Id   = @Area_Id,
      StartTime = @StartTime,
      EndTime   = @EndTime
    OUTPUT
      INSERTED.Job_Id       AS jobId,
      INSERTED.SerialNumber AS serialNumber,
      INSERTED.Model        AS model,
      INSERTED.Workcell_Id  AS workcellId,
      INSERTED.Vendor_Id    AS vendorId,
      INSERTED.Area_Id      AS areaId,
      INSERTED.Status       AS status,
      INSERTED.StartTime    AS startTime,
      INSERTED.EndTime      AS endTime,
      INSERTED.CreatedBy    AS createdBy,
      INSERTED.CreatedAt    AS createdAt
    WHERE Job_Id = @Job_Id;
  `);

    return result.recordset[0] ?? null;
}

/**
 * Update BookingSwapReq status + decision fields.
 * Uses current DB columns:
 *  - Status
 *  - DecisionType
 *  - DecisionBy_User_Id
 *  - DecisionAt
 *  - DecisionReason
 *  - Linked_BookingSwap_Id
 */
async function markSwapReqStatus(
    trx: sql.Transaction,
    swapReqId: number,
    status: BookingSwapReqStatus,
    decisionType: BookingSwapType | null,
    approverUserId: number | null,
    decisionReason: string | null,
    linkedSwapId: number | null
): Promise<BookingSwapReq> {
    const req = new sql.Request(trx);
    req.input("BookingSwapReq_Id", sql.Int, swapReqId);
    req.input("Status", sql.VarChar, status);
    req.input("DecisionType", sql.VarChar, decisionType);
    req.input("DecisionBy_User_Id", sql.Int, approverUserId);
    req.input("DecisionReason", sql.NVarChar(400), decisionReason);
    req.input("Linked_BookingSwap_Id", sql.Int, linkedSwapId);

    const result = await req.query<BookingSwapReq>(`
    UPDATE core.BookingSwapReq
    SET
      Status                = @Status,
      DecisionType          = @DecisionType,
      DecisionBy_User_Id    = @DecisionBy_User_Id,
      DecisionAt            = SYSUTCDATETIME(),
      DecisionReason        = @DecisionReason,
      Linked_BookingSwap_Id = @Linked_BookingSwap_Id
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
    WHERE BookingSwapReq_Id = @BookingSwapReq_Id;
  `);

    const row = result.recordset[0];
    if (!row) {
        throw new Error("Failed to update BookingSwapReq status");
    }
    return row;
}

/* =========================================================
   PUBLIC SERVICE: APPROVE
   ========================================================= */

export async function approveSwapRequest(
    payload: ApproveSwapPayload
): Promise<SwapDecisionResult> {
    const pool = await connectDB();
    const trx = new sql.Transaction(pool);
    await trx.begin();

    let swapReq: BookingSwapReq | null = null;
    let fromBooking: Booking | null = null;
    let toBooking: Booking | null = null;
    let fromJob: CratingJob | null = null;
    let toJob: CratingJob | null = null;
    let swapHistory: BookingSwap | null = null;

    try {
        // 1) Lock and load swap request
        swapReq = await loadSwapReqForUpdate(trx, payload.swapReqId);
        if (!swapReq) {
            throw new Error("Swap request not found");
        }

        if (swapReq.status !== "Pending") {
            throw new Error(`Cannot approve swap in status ${swapReq.status}`);
        }

        // Check expiry
        const now = new Date();
        const expiresAt = swapReq.expiresAt
            ? new Date(swapReq.expiresAt as unknown as string)
            : null;
        if (expiresAt && expiresAt < now) {
            throw new Error("Swap request already expired");
        }

        const finalType = payload.decisionType;
        const fromBookingId = swapReq.fromBookingId;
        const toBookingId = swapReq.toBookingId;

        if (!toBookingId) {
            throw new Error("Swap request is missing To_Booking_Id");
        }
        if (!fromBookingId) {
            throw new Error("From_Booking_Id is required for current scenarios");
        }

        // 2) Load bookings with locks
        fromBooking = await loadBookingForUpdate(trx, fromBookingId);
        toBooking = await loadBookingForUpdate(trx, toBookingId);

        if (!fromBooking || !toBooking) {
            throw new Error("Booking not found for swap");
        }

        // Load jobs (if any)
        if (fromBooking.jobId) {
            fromJob = await loadJobForUpdate(trx, fromBooking.jobId);
        }
        if (toBooking.jobId) {
            toJob = await loadJobForUpdate(trx, toBooking.jobId);
        }

        // Snapshot BEFORE
        const oldFromAreaId = fromBooking.areaId;
        const oldFromStart = fromBooking.startDateTime;
        const oldFromEnd = fromBooking.endDateTime;

        const oldToAreaId = toBooking.areaId;
        const oldToStart = toBooking.startDateTime;
        const oldToEnd = toBooking.endDateTime;

        // AFTER snapshots (init with old)
        let newFromAreaId = oldFromAreaId;
        let newFromStart = oldFromStart;
        let newFromEnd = oldFromEnd;

        let newToAreaId: number | null = oldToAreaId;
        let newToStart: ISODateTimeString | null = oldToStart;
        let newToEnd: ISODateTimeString | null = oldToEnd;

        /* -----------------------------------------
           CASE 1 - SwapSlots
           ----------------------------------------- */
        if (finalType === "SwapSlots") {
            // swap the slots
            newFromAreaId = oldToAreaId;
            newFromStart = oldToStart;
            newFromEnd = oldToEnd;

            newToAreaId = oldFromAreaId;
            newToStart = oldFromStart;
            newToEnd = oldFromEnd;

            fromBooking = await updateBookingDateArea(
                trx,
                fromBooking.bookingId,
                newFromAreaId,
                newFromStart,
                newFromEnd
            );

            toBooking = await updateBookingDateArea(
                trx,
                toBooking.bookingId,
                newToAreaId,
                newToStart,
                newToEnd
            );

            if (fromBooking?.jobId && fromJob) {
                fromJob = await updateJobAreaTime(
                    trx,
                    fromJob.jobId,
                    newFromAreaId,
                    newFromStart,
                    newFromEnd
                );
            }

            if (toBooking?.jobId && toJob && newToAreaId && newToStart && newToEnd) {
                toJob = await updateJobAreaTime(
                    trx,
                    toJob.jobId,
                    newToAreaId,
                    newToStart,
                    newToEnd
                );
            }
        }

        /* -----------------------------------------
           CASE 2 - GiveSlot_CancelReceiver
           ----------------------------------------- */
        else if (finalType === "GiveSlot_CancelReceiver") {
            // From gets To's original slot
            newFromAreaId = oldToAreaId;
            newFromStart = oldToStart;
            newFromEnd = oldToEnd;

            // To booking is cancelled (we keep old slot as snapshot)
            newToAreaId = oldToAreaId;
            newToStart = oldToStart;
            newToEnd = oldToEnd;

            fromBooking = await updateBookingDateArea(
                trx,
                fromBooking.bookingId,
                newFromAreaId,
                newFromStart,
                newFromEnd
            );

            toBooking = await cancelBookingInternal(trx, toBooking.bookingId);

            if (fromBooking?.jobId && fromJob) {
                fromJob = await updateJobAreaTime(
                    trx,
                    fromJob.jobId,
                    newFromAreaId,
                    newFromStart,
                    newFromEnd
                );
            }
            // To job remains as is, by design
        }

        /* -----------------------------------------
           CASE 3 - GiveSlot_RescheduleReceiver
           ----------------------------------------- */
        else if (finalType === "GiveSlot_RescheduleReceiver") {
            const receiverNewAreaId =
                payload.receiverNewAreaId ?? swapReq.receiverNewAreaId;

            const receiverNewStart =
                payload.receiverNewStart ?? swapReq.receiverNewStart;

            const receiverNewEnd =
                payload.receiverNewEnd ?? swapReq.receiverNewEnd;

            if (
                receiverNewAreaId == null ||
                !receiverNewStart ||
                !receiverNewEnd
            ) {
                throw new Error(
                    "Receiver new slot (area/start/end) is required for GiveSlot_RescheduleReceiver"
                );
            }

            // From takes To's original slot
            newFromAreaId = oldToAreaId;
            newFromStart = oldToStart;
            newFromEnd = oldToEnd;

            // To gets new rescheduled slot
            newToAreaId = receiverNewAreaId;
            newToStart = receiverNewStart;
            newToEnd = receiverNewEnd;

            fromBooking = await updateBookingDateArea(
                trx,
                fromBooking.bookingId,
                newFromAreaId,
                newFromStart,
                newFromEnd
            );

            toBooking = await updateBookingDateArea(
                trx,
                toBooking.bookingId,
                newToAreaId,
                newToStart,
                newToEnd
            );

            if (fromBooking?.jobId && fromJob) {
                fromJob = await updateJobAreaTime(
                    trx,
                    fromJob.jobId,
                    newFromAreaId,
                    newFromStart,
                    newFromEnd
                );
            }

            if (toBooking?.jobId && toJob && newToAreaId && newToStart && newToEnd) {
                toJob = await updateJobAreaTime(
                    trx,
                    toJob.jobId,
                    newToAreaId,
                    newToStart,
                    newToEnd
                );
            }
        } else {
            throw new Error(`Unsupported decision type: ${finalType}`);
        }

        if (!fromBooking || !toBooking) {
            throw new Error("Bookings were not updated correctly");
        }

        // 3) Insert swap history into core.BookingSwap (via queries helper)
        swapHistory =
            (await insertSwapHistory(
                {
                    swapReqId: swapReq.bookingSwapReqId,
                    fromBookingId: fromBooking.bookingId,
                    toBookingId: toBooking.bookingId,
                    swapType: finalType,
                    // BEFORE
                    oldFromAreaId,
                    oldFromStart,
                    oldFromEnd,
                    oldToAreaId,
                    oldToStart,
                    oldToEnd,
                    // AFTER
                    newFromAreaId,
                    newFromStart,
                    newFromEnd,
                    newToAreaId,
                    newToStart,
                    newToEnd,
                },
                trx
            )) ?? null;

        const linkedSwapId = swapHistory
            ? // depending on how BookingSwap is shaped in queries,
            // we use bookingSwapId as the canonical PK
            (swapHistory as any).bookingSwapId ?? swapHistory.bookingSwapId
            : null;

        // 4) Mark request as Approved with decision & link
        const updatedReq = await markSwapReqStatus(
            trx,
            swapReq.bookingSwapReqId,
            "Approved",
            finalType,
            payload.approverUserId,
            payload.decisionReason ?? null,
            linkedSwapId
        );

        await trx.commit();

        // 5) Activity logs (post-commit, do not affect transaction)
        await safeLogActivity({
            entityType: "Booking",
            entityId: fromBooking.bookingId,
            action: "SwapApproved",
            oldValue: {
                areaId: oldFromAreaId,
                startDateTime: oldFromStart,
                endDateTime: oldFromEnd,
            },
            newValue: {
                areaId: newFromAreaId,
                startDateTime: newFromStart,
                endDateTime: newFromEnd,
            },
            userId: payload.approverUsername ?? null,
        });

        await safeLogActivity({
            entityType: "Booking",
            entityId: toBooking.bookingId,
            action: "SwapApproved",
            oldValue: {
                areaId: oldToAreaId,
                startDateTime: oldToStart,
                endDateTime: oldToEnd,
            },
            newValue: {
                areaId: newToAreaId,
                startDateTime: newToStart,
                endDateTime: newToEnd,
            },
            userId: payload.approverUsername ?? null,
        });

        if (fromJob) {
            await safeLogActivity({
                entityType: "Job",
                entityId: fromJob.jobId,
                action: "JobMovedBySwap",
                oldValue: {
                    areaId: oldFromAreaId,
                    startTime: oldFromStart,
                    endTime: oldFromEnd,
                },
                newValue: {
                    areaId: newFromAreaId,
                    startTime: newFromStart,
                    endTime: newFromEnd,
                },
                userId: payload.approverUsername ?? null,
            });
        }

        if (toJob && newToAreaId && newToStart && newToEnd) {
            await safeLogActivity({
                entityType: "Job",
                entityId: toJob.jobId,
                action: "JobMovedBySwap",
                oldValue: {
                    areaId: oldToAreaId,
                    startTime: oldToStart,
                    endTime: oldToEnd,
                },
                newValue: {
                    areaId: newToAreaId,
                    startTime: newToStart,
                    endTime: newToEnd,
                },
                userId: payload.approverUsername ?? null,
            });
        }

        return {
            swapReq: updatedReq,
            swapHistory,
            fromBooking,
            toBooking,
            fromJob,
            toJob,
        };
    } catch (err) {
        await trx.rollback();
        throw err;
    }
}

/* =========================================================
   PUBLIC SERVICE: REJECT
   ========================================================= */

export async function rejectSwapRequest(
    payload: RejectSwapPayload
): Promise<SwapDecisionResult> {
    const pool = await connectDB();
    const trx = new sql.Transaction(pool);
    await trx.begin();

    let swapReq: BookingSwapReq | null = null;

    try {
        swapReq = await loadSwapReqForUpdate(trx, payload.swapReqId);
        if (!swapReq) {
            throw new Error("Swap request not found");
        }

        if (swapReq.status !== "Pending") {
            throw new Error(`Cannot reject swap in status ${swapReq.status}`);
        }

        const updatedReq = await markSwapReqStatus(
            trx,
            swapReq.bookingSwapReqId,
            "Rejected",
            null,
            payload.approverUserId,
            payload.decisionReason ?? null,
            null
        );

        await trx.commit();

        await safeLogActivity({
            entityType: "Booking",
            entityId: updatedReq.toBookingId ?? 0,
            action: "SwapRejected",
            oldValue: null,
            newValue: {
                swapReqId: updatedReq.bookingSwapReqId,
                decisionReason: updatedReq.decisionReason,
            },
            userId: payload.approverUsername ?? null,
        });

        return {
            swapReq: updatedReq,
            swapHistory: null,
            fromBooking: null,
            toBooking: null,
            fromJob: null,
            toJob: null,
        };
    } catch (err) {
        await trx.rollback();
        throw err;
    }
}
