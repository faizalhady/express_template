// src/queries/activityLogQueries.ts
import { connectDB, sql } from "@/config/db"
import type {
    ActivityEntityType,
    ActivityLog,
    ISODateTimeString,
} from "@/types/cpsCoreTypes"

/* --------------------------------------------
   Input type for writing logs
---------------------------------------------*/
export interface ActivityLogInput {
    entityType: ActivityEntityType          // "Job" | "Booking" | "Area" | "Vendor" | "Workcell" | "Plant"
    entityId: number                        // PK of the entity
    action: string                          // "Created", "UpdatedStatus", "Cancelled", etc
    oldValue?: unknown                      // any serializable object
    newValue?: unknown                      // any serializable object
    userId?: string | null                  // username / NTID
}

/* --------------------------------------------
   Insert into ops.ActivityLog
   - Uses your existing columns (UserID, Timestamp default GETDATE())
---------------------------------------------*/
export async function insertActivityLog(input: ActivityLogInput): Promise<void> {
    const pool = await connectDB()
    const request = pool.request()

    const oldJson =
        input.oldValue === undefined ? null : JSON.stringify(input.oldValue)
    const newJson =
        input.newValue === undefined ? null : JSON.stringify(input.newValue)

    request.input("EntityType", sql.VarChar, input.entityType)
    request.input("EntityId", sql.Int, input.entityId)
    request.input("Action", sql.VarChar, input.action)
    request.input("OldValue", sql.NVarChar(sql.MAX), oldJson)
    request.input("NewValue", sql.NVarChar(sql.MAX), newJson)
    request.input("UserID", sql.VarChar, input.userId ?? null) // 👈 matches your column name

    await request.query(`
    INSERT INTO ops.ActivityLog (
      EntityType,
      EntityId,
      Action,
      OldValue,
      NewValue,
      UserID
      -- Timestamp uses DEFAULT GETDATE()
    )
    VALUES (
      @EntityType,
      @EntityId,
      @Action,
      @OldValue,
      @NewValue,
      @UserID
    );
  `)
}

/* --------------------------------------------
   Safe helper: do not break main flow
---------------------------------------------*/
export async function safeLogActivity(
    input: ActivityLogInput
): Promise<void> {
    try {
        await insertActivityLog(input)
    } catch (err) {
        console.error("⚠️ Failed to write activity log:", err)
        // Do not throw - logging must not crash main flow
    }
}

/* --------------------------------------------
   Filter for reading logs
---------------------------------------------*/
export interface ActivityLogFilter {
    entityType?: ActivityEntityType
    entityId?: number
    action?: string
    userId?: string
    from?: ISODateTimeString
    to?: ISODateTimeString
}

/* --------------------------------------------
   Read logs with optional filters
---------------------------------------------*/
export async function findActivityLogs(
    filter: ActivityLogFilter = {}
): Promise<ActivityLog[]> {
    const pool = await connectDB()
    const request = pool.request()

    let where = "1 = 1"

    if (filter.entityType) {
        where += " AND EntityType = @EntityType"
        request.input("EntityType", sql.VarChar, filter.entityType)
    }

    if (filter.entityId !== undefined) {
        where += " AND EntityId = @EntityId"
        request.input("EntityId", sql.Int, filter.entityId)
    }

    if (filter.action) {
        where += " AND Action = @Action"
        request.input("Action", sql.VarChar, filter.action)
    }

    if (filter.userId) {
        where += " AND UserID = @UserID"
        request.input("UserID", sql.VarChar, filter.userId)
    }

    if (filter.from) {
        where += " AND Timestamp >= @FromDate"
        request.input("FromDate", sql.DateTime, new Date(filter.from))
    }

    if (filter.to) {
        where += " AND Timestamp < @ToDate"
        request.input("ToDate", sql.DateTime, new Date(filter.to))
    }

    const result = await request.query<ActivityLog>(`
    SELECT
      Activity_Id AS activityId,
      EntityType  AS entityType,
      EntityId    AS entityId,
      Action      AS action,
      OldValue    AS oldValue,
      NewValue    AS newValue,
      UserID      AS userId,      -- 👈 alias DB "UserID" to TS "userId"
      Timestamp   AS timestamp
    FROM ops.ActivityLog
    WHERE ${where}
    ORDER BY Timestamp DESC;
  `)

    return result.recordset
}
