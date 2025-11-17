// src/queries/jobQueries.ts

import { connectDB, sql } from "@/config/db"
import type {
    CratingJob,
    CratingJobStatus,
    ISODateTimeString,
} from "@/types/cpsCore"

/* --------------------------------------------
   Filter type for listing jobs
---------------------------------------------*/
export interface JobFilter {
    areaId?: number
    workcellId?: number
    vendorId?: number
    status?: CratingJobStatus
    from?: ISODateTimeString
    to?: ISODateTimeString
}

/* --------------------------------------------
   INSERT core.CratingJob and return new row
---------------------------------------------*/
export async function insertJob(
    input: {
        serialNumber: string
        model?: string | null
        workcellId: number
        vendorId?: number | null
        areaId?: number | null
        startTime?: ISODateTimeString | null
        endTime?: ISODateTimeString | null
    },
    createdBy: string
): Promise<CratingJob> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("SerialNumber", sql.VarChar, input.serialNumber)
        .input("Model", sql.VarChar, input.model ?? null)
        .input("Workcell_Id", sql.Int, input.workcellId)
        .input("Vendor_Id", sql.Int, input.vendorId ?? null)
        .input("Area_Id", sql.Int, input.areaId ?? null)
        .input(
            "StartTime",
            sql.DateTime2,
            input.startTime ? new Date(input.startTime) : null
        )
        .input(
            "EndTime",
            sql.DateTime2,
            input.endTime ? new Date(input.endTime) : null
        )
        .input("Status", sql.VarChar, "Booked") // initial status
        .input("CreatedBy", sql.VarChar, createdBy)
        .query<CratingJob>(`
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

    const row = result.recordset[0]
    if (!row) {
        throw new Error("Insert job failed - no row returned")
    }

    return row
}

/* --------------------------------------------
   SELECT one job by id
---------------------------------------------*/
export async function findJobById(jobId: number): Promise<CratingJob | null> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Job_Id", sql.Int, jobId)
        .query<CratingJob>(`
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
      FROM core.CratingJob
      WHERE Job_Id = @Job_Id;
    `)

    const row = result.recordset[0]
    if (!row) return null
    return row
}

/* --------------------------------------------
   SELECT list of jobs with optional filters
---------------------------------------------*/
export async function findJobs(filter: JobFilter = {}): Promise<CratingJob[]> {
    const pool = await connectDB()
    const request = pool.request()

    let where = "1 = 1"

    if (filter.areaId) {
        where += " AND Area_Id = @Area_Id"
        request.input("Area_Id", sql.Int, filter.areaId)
    }

    if (filter.workcellId) {
        where += " AND Workcell_Id = @Workcell_Id"
        request.input("Workcell_Id", sql.Int, filter.workcellId)
    }

    if (filter.vendorId) {
        where += " AND Vendor_Id = @Vendor_Id"
        request.input("Vendor_Id", sql.Int, filter.vendorId)
    }

    if (filter.status) {
        where += " AND Status = @Status"
        request.input("Status", sql.VarChar, filter.status)
    }

    if (filter.from) {
        where += " AND CreatedAt >= @FromDate"
        request.input("FromDate", sql.DateTime2, new Date(filter.from))
    }

    if (filter.to) {
        where += " AND CreatedAt < @ToDate"
        request.input("ToDate", sql.DateTime2, new Date(filter.to))
    }

    const result = await request.query<CratingJob>(`
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
    FROM core.CratingJob
    WHERE ${where}
    ORDER BY CreatedAt DESC;
  `)

    return result.recordset
}

/* --------------------------------------------
   UPDATE job status (and optionally Area_Id)
---------------------------------------------*/
export async function updateJobStatus(
    jobId: number,
    status: CratingJobStatus,
    areaId?: number | null
): Promise<CratingJob | null> {
    const pool = await connectDB()
    const request = pool.request()

    request.input("Job_Id", sql.Int, jobId)
    request.input("Status", sql.VarChar, status)
    request.input("Area_Id", sql.Int, areaId ?? null)

    const result = await request.query<CratingJob>(`
    UPDATE core.CratingJob
    SET
      Status = @Status,
      Area_Id = COALESCE(@Area_Id, Area_Id)
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
  `)

    const row = result.recordset[0]
    if (!row) return null
    return row
}
