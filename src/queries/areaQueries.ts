// src/queries/areaQueries.ts
import { connectDB, sql } from "@/config/db"
import type {
    CratingArea,
    CratingAreaStatus
} from "@/types/cpsCore"

export interface AreaFilter {
    plantId?: number
    status?: CratingAreaStatus
}

/* --------------------------------------------
   SELECT one area by id
---------------------------------------------*/
export async function findAreaById(
    areaId: number
): Promise<CratingArea | null> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Area_Id", sql.Int, areaId)
        .query<CratingArea>(`
      SELECT
        Area_Id   AS areaId,
        Plant_Id  AS plantId,
        AreaName  AS areaName,
        Status    AS status,
        UpdatedAt AS updatedAt
      FROM ref.CratingArea
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
): Promise<CratingArea[]> {
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

    const result = await request.query<CratingArea>(`
    SELECT
      Area_Id   AS areaId,
      Plant_Id  AS plantId,
      AreaName  AS areaName,
      Status    AS status,
      UpdatedAt AS updatedAt
    FROM ref.CratingArea
    WHERE ${where}
    ORDER BY AreaName ASC;
  `)

    return result.recordset
}
