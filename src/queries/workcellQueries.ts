// src/queries/workcellQueries.ts
import { connectDB, sql } from "@/config/db"
import type { Workcell } from "@/types/cpsCoreTypes"

export interface WorkcellFilter {
  isActive?: boolean
  search?: string
}

export async function findWorkcells(
  filter: WorkcellFilter = {}
): Promise<Workcell[]> {
  const pool = await connectDB()
  const request = pool.request()

  let where = "1 = 1"

  if (filter.isActive !== undefined) {
    where += " AND IsActive = @IsActive"
    request.input("IsActive", sql.Bit, filter.isActive ? 1 : 0)
  }

  if (filter.search) {
    where += " AND WorkcellName LIKE @Search"
    request.input("Search", sql.VarChar, `%${filter.search}%`)
  }

  const result = await request.query<Workcell>(`
    SELECT
      Workcell_Id   AS workcellId,
      WorkcellName  AS workcellName,
      Division      AS division,
      IsActive      AS isActive,
      CreatedAt     AS createdAt
    FROM ref.Workcell
    WHERE ${where}
    ORDER BY WorkcellName ASC;
  `)

  return result.recordset
}

export async function findWorkcellById(
  workcellId: number
): Promise<Workcell | null> {
  const pool = await connectDB()

  const result = await pool
    .request()
    .input("Workcell_Id", sql.Int, workcellId)
    .query<Workcell>(`
      SELECT
        Workcell_Id   AS workcellId,
        WorkcellName  AS workcellName,
        Division      AS division,
        IsActive      AS isActive,
        CreatedAt     AS createdAt
      FROM ref.Workcell
      WHERE Workcell_Id = @Workcell_Id;
    `)

  const row = result.recordset[0]
  if (!row) return null
  return row
}
