// src/queries/bookingQueries.ts

import { connectDB, sql } from "@/config/db"
import type { Booking, BookingStatus, ISODateTimeString } from "@/types/cpsCore"

export interface BookingFilter {
    areaId?: number
    status?: BookingStatus
    from?: ISODateTimeString
    to?: ISODateTimeString
}

/* --------------------------------------------
   INSERT core.Booking and return the new row
---------------------------------------------*/
export async function insertBooking(
    input: {
        areaId: number
        jobId?: number | null
        startDateTime: ISODateTimeString
        endDateTime: ISODateTimeString
    },
    createdBy: string
): Promise<Booking> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Area_Id", sql.Int, input.areaId)
        .input("Job_Id", sql.Int, input.jobId ?? null)
        .input("StartDateTime", sql.DateTime2, new Date(input.startDateTime))
        .input("EndDateTime", sql.DateTime2, new Date(input.endDateTime))
        .input("Status", sql.VarChar, "Pending") // must match BookingStatus + DB constraint
        .input("CreatedBy", sql.VarChar, createdBy)
        .query<Booking>(`
      INSERT INTO core.Booking (
        Area_Id,
        Job_Id,
        StartDateTime,
        EndDateTime,
        Status,
        CreatedBy
      )
      OUTPUT
        INSERTED.Booking_Id    AS bookingId,
        INSERTED.Job_Id        AS jobId,
        INSERTED.Area_Id       AS areaId,
        INSERTED.StartDateTime AS startDateTime,
        INSERTED.EndDateTime   AS endDateTime,
        INSERTED.Status        AS status,
        INSERTED.CreatedBy     AS createdBy,
        INSERTED.CreatedAt     AS createdAt
      VALUES (
        @Area_Id,
        @Job_Id,
        @StartDateTime,
        @EndDateTime,
        @Status,
        @CreatedBy
      );
    `)

    const row = result.recordset[0]

    if (!row) {
        throw new Error("Insert booking failed - no row returned")
    }

    return row
}

/* --------------------------------------------
   SELECT one booking by id
---------------------------------------------*/
export async function findBookingById(
    bookingId: number
): Promise<Booking | null> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Booking_Id", sql.Int, bookingId)
        .query<Booking>(`
      SELECT
        Booking_Id    AS bookingId,
        Job_Id        AS jobId,
        Area_Id       AS areaId,
        StartDateTime AS startDateTime,
        EndDateTime   AS endDateTime,
        Status        AS status,
        CreatedBy     AS createdBy,
        CreatedAt     AS createdAt
      FROM core.Booking
      WHERE Booking_Id = @Booking_Id;
    `)

    const row = result.recordset[0]

    if (!row) return null
    return row
}

/* --------------------------------------------
   SELECT list of bookings with optional filters
---------------------------------------------*/
export async function findBookings(
    filter: BookingFilter = {}
): Promise<Booking[]> {
    const pool = await connectDB()
    const request = pool.request()

    let where = "1 = 1"

    if (filter.areaId) {
        where += " AND Area_Id = @Area_Id"
        request.input("Area_Id", sql.Int, filter.areaId)
    }

    if (filter.status) {
        where += " AND Status = @Status"
        request.input("Status", sql.VarChar, filter.status)
    }

    if (filter.from) {
        where += " AND StartDateTime >= @FromDate"
        request.input("FromDate", sql.DateTime2, new Date(filter.from))
    }

    if (filter.to) {
        where += " AND StartDateTime < @ToDate"
        request.input("ToDate", sql.DateTime2, new Date(filter.to))
    }

    const result = await request.query<Booking>(`
    SELECT
      Booking_Id    AS bookingId,
      Job_Id        AS jobId,
      Area_Id       AS areaId,
      StartDateTime AS startDateTime,
      EndDateTime   AS endDateTime,
      Status        AS status,
      CreatedBy     AS createdBy,
      CreatedAt     AS createdAt
    FROM core.Booking
    WHERE ${where}
    ORDER BY StartDateTime DESC;
  `)

    return result.recordset
}
