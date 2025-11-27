// src/queries/areaQueries.ts
import { connectDB, sql } from "@/config/db"
import type {
    Area,
    AreaStatus,
    AreaType,
} from "@/types/cpsCoreTypes"

export interface AreaFilter {
    plantId?: number
    status?: AreaStatus
    areaType?: AreaType
}

/* --------------------------------------------
   SELECT one area by id
---------------------------------------------*/
export async function findAreaById(
    areaId: number
): Promise<Area | null> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Area_Id", sql.Int, areaId)
        .query<Area>(`
      SELECT
        Area_Id    AS areaId,
        Plant_Id   AS plantId,
        AreaName   AS areaName,
        Status     AS status,
        AreaType   AS areaType,
        UpdatedAt  AS updatedAt
      FROM ref.Area
      WHERE Area_Id = @Area_Id;
    `)

    const row = result.recordset[0]
    if (!row) return null
    return row
}

/* --------------------------------------------
   SELECT list of areas with optional filters
---------------------------------------------*/
export async function findAreas(
    filter: AreaFilter = {}
): Promise<Area[]> {
    const pool = await connectDB()
    const request = pool.request()

    let where = "1 = 1"

    if (filter.plantId) {
        where += " AND Plant_Id = @Plant_Id"
        request.input("Plant_Id", sql.Int, filter.plantId)
    }

    if (filter.status) {
        where += " AND Status = @Status"
        request.input("Status", sql.VarChar, filter.status)
    }

    if (filter.areaType) {
        where += " AND AreaType = @AreaType"
        request.input("AreaType", sql.VarChar, filter.areaType)
    }

    const result = await request.query<Area>(`
    SELECT
      Area_Id    AS areaId,
      Plant_Id   AS plantId,
      AreaName   AS areaName,
      Status     AS status,
      AreaType   AS areaType,
      UpdatedAt  AS updatedAt
    FROM ref.Area
    WHERE ${where}
    ORDER BY AreaName ASC;
  `)

    return result.recordset
}
