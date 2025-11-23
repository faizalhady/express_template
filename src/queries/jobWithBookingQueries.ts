// src/queries/jobWithBookingQueries.ts

import { connectDB, sql } from "@/config/db"
import type {
    Booking,
    CratingJob,
    CratingJobStage,
    ISODateTimeString,
} from "@/types/cpsCore"

/**
 * Input for transactional creation of:
 * - core.CratingJob
 * - core.Booking
 * - core.CratingJobStage (initial "Booked")
 */
export interface CreateJobWithBookingInput {
    // Job info
    serialNumber: string
    model?: string | null
    workcellId: number
    vendorId?: number | null

    // Where and when to crate
    areaId: number
    startDateTime: ISODateTimeString
    endDateTime: ISODateTimeString

    // Who created this (from auth)
    createdByUsername: string        // maps to CratingJob.CreatedBy, Booking.CreatedBy
    createdByUserId: number          // maps to Booking.CreatedBy_User_Id (FK to auth.User)
}

/**
 * Result of the transactional insert
 */
export interface JobWithBookingResult {
    job: CratingJob
    booking: Booking
    initialStage: CratingJobStage
}

/**
 * Insert Job + Booking + initial Stage in ONE transaction.
 */
export async function insertJobWithBooking(
    input: CreateJobWithBookingInput
): Promise<JobWithBookingResult> {
    const pool = await connectDB()
    const transaction = new sql.Transaction(pool)

    await transaction.begin()

    try {
        /* ===============================
           1) Insert core.CratingJob
           =============================== */
        const jobRequest = new sql.Request(transaction)

        jobRequest.input("SerialNumber", sql.VarChar, input.serialNumber)
        jobRequest.input("Model", sql.VarChar, input.model ?? null)
        jobRequest.input("Workcell_Id", sql.Int, input.workcellId)
        jobRequest.input("Vendor_Id", sql.Int, input.vendorId ?? null)
        jobRequest.input("Area_Id", sql.Int, input.areaId)
        jobRequest.input("StartTime", sql.DateTime2, new Date(input.startDateTime))
        jobRequest.input("EndTime", sql.DateTime2, new Date(input.endDateTime))
        jobRequest.input("Status", sql.VarChar, "Booked")
        jobRequest.input("CreatedBy", sql.VarChar, input.createdByUsername)

        const jobResult = await jobRequest.query<CratingJob>(`
      INSERT INTO core.CratingJob (
        SerialNumber,
        Model,
        Workcell_Id,
        Vendor_Id,
        Area_Id,
        StartTime,
        EndTime,
        Status,
        CreatedBy
      )
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
      VALUES (
        @SerialNumber,
        @Model,
        @Workcell_Id,
        @Vendor_Id,
        @Area_Id,
        @StartTime,
        @EndTime,
        @Status,
        @CreatedBy
      );
    `)

        const job = jobResult.recordset[0]
        if (!job) {
            throw new Error("Insert job failed - no row returned")
        }

        /* ===============================
           2) Insert core.Booking
           =============================== */
        const bookingRequest = new sql.Request(transaction)

        bookingRequest.input("Area_Id", sql.Int, input.areaId)
        bookingRequest.input("Job_Id", sql.Int, job.jobId)
        bookingRequest.input(
            "StartDateTime",
            sql.DateTime2,
            new Date(input.startDateTime)
        )
        bookingRequest.input(
            "EndDateTime",
            sql.DateTime2,
            new Date(input.endDateTime)
        )
        bookingRequest.input("Status", sql.VarChar, "Pending")
        bookingRequest.input("CreatedBy", sql.VarChar, input.createdByUsername)
        bookingRequest.input("CreatedBy_User_Id", sql.Int, input.createdByUserId)

        const bookingResult = await bookingRequest.query<Booking>(`
      INSERT INTO core.Booking (
        Area_Id,
        Job_Id,
        StartDateTime,
        EndDateTime,
        Status,
        CreatedBy,
        CreatedBy_User_Id
      )
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
      VALUES (
        @Area_Id,
        @Job_Id,
        @StartDateTime,
        @EndDateTime,
        @Status,
        @CreatedBy,
        @CreatedBy_User_Id
      );
    `)

        const booking = bookingResult.recordset[0]
        if (!booking) {
            throw new Error("Insert booking failed - no row returned")
        }

        /* ===============================
           3) Insert core.CratingJobStage
              initial stage = "Booked"
           =============================== */
        const stageRequest = new sql.Request(transaction)

        stageRequest.input("Job_Id", sql.Int, job.jobId)
        stageRequest.input("StageName", sql.VarChar, "Booked")
        // Let StartedAt default via DB or use SYSUTCDATETIME
        stageRequest.input("PIC", sql.VarChar, input.createdByUsername)
        stageRequest.input("Remarks", sql.VarChar, "Job and booking created")

        const stageResult = await stageRequest.query<CratingJobStage>(`
      INSERT INTO core.CratingJobStage (
        Job_Id,
        StageName,
        StartedAt,
        PIC,
        Remarks
      )
      OUTPUT
        INSERTED.Stage_Id   AS stageId,
        INSERTED.Job_Id     AS jobId,
        INSERTED.StageName  AS stageName,
        INSERTED.StartedAt  AS startedAt,
        INSERTED.EndedAt    AS endedAt,
        INSERTED.PIC        AS pic,
        INSERTED.Remarks    AS remarks
      VALUES (
        @Job_Id,
        @StageName,
        SYSUTCDATETIME(),
        @PIC,
        @Remarks
      );
    `)

        const initialStage = stageResult.recordset[0]
        if (!initialStage) {
            throw new Error("Insert initial stage failed - no row returned")
        }

        // All good
        await transaction.commit()

        return { job, booking, initialStage }
    } catch (err) {
        await transaction.rollback()
        throw err
    }
}
