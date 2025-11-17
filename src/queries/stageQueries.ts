// src/queries/stageQueries.ts

import { connectDB, sql } from "@/config/db"
import type {
    CratingJobStage,
    CratingJobStageName,
    ISODateTimeString,
} from "@/types/cpsCore"

/* --------------------------------------------
   Filter for listing stages of a job
---------------------------------------------*/
export interface StageFilter {
    from?: ISODateTimeString
    to?: ISODateTimeString
    stageName?: CratingJobStageName
}

/* --------------------------------------------
   INSERT core.CratingJobStage and return new row
   If startedAt not provided -> default to now (UTC)
---------------------------------------------*/
export async function insertJobStage(
    jobId: number,
    input: {
        stageName: CratingJobStageName
        startedAt?: ISODateTimeString | null
        endedAt?: ISODateTimeString | null
        pic?: string | null
        remarks?: string | null
    }
): Promise<CratingJobStage> {
    const pool = await connectDB()
    const request = pool.request()

    request.input("Job_Id", sql.Int, jobId)
    request.input("StageName", sql.VarChar, input.stageName)
    request.input(
        "StartedAt",
        sql.DateTime2,
        input.startedAt ? new Date(input.startedAt) : null
    )
    request.input(
        "EndedAt",
        sql.DateTime2,
        input.endedAt ? new Date(input.endedAt) : null
    )
    request.input("PIC", sql.VarChar, input.pic ?? null)
    request.input("Remarks", sql.VarChar, input.remarks ?? null)

    const result = await request.query<CratingJobStage>(`
    INSERT INTO core.CratingJobStage (
      Job_Id,
      StageName,
      StartedAt,
      EndedAt,
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
      COALESCE(@StartedAt, SYSUTCDATETIME()), -- default to now if null
      @EndedAt,
      @PIC,
      @Remarks
    );
  `)

    const row = result.recordset[0]
    if (!row) {
        throw new Error("Insert job stage failed - no row returned")
    }

    return row
}

/* --------------------------------------------
   SELECT stages for a job, optional filters
---------------------------------------------*/
export async function findStagesByJob(
    jobId: number,
    filter: StageFilter = {}
): Promise<CratingJobStage[]> {
    const pool = await connectDB()
    const request = pool.request()

    let where = "Job_Id = @Job_Id"
    request.input("Job_Id", sql.Int, jobId)

    if (filter.stageName) {
        where += " AND StageName = @StageName"
        request.input("StageName", sql.VarChar, filter.stageName)
    }

    if (filter.from) {
        where += " AND StartedAt >= @FromDate"
        request.input("FromDate", sql.DateTime2, new Date(filter.from))
    }

    if (filter.to) {
        where += " AND StartedAt < @ToDate"
        request.input("ToDate", sql.DateTime2, new Date(filter.to))
    }

    const result = await request.query<CratingJobStage>(`
    SELECT
      Stage_Id   AS stageId,
      Job_Id     AS jobId,
      StageName  AS stageName,
      StartedAt  AS startedAt,
      EndedAt    AS endedAt,
      PIC        AS pic,
      Remarks    AS remarks
    FROM core.CratingJobStage
    WHERE ${where}
    ORDER BY StartedAt ASC;
  `)

    return result.recordset
}
