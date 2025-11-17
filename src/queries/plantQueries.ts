// src/queries/plantQueries.ts
import { connectDB, sql } from "@/config/db"
import type { Plant } from "@/types/cpsCore"

export async function findPlants(): Promise<Plant[]> {
    const pool = await connectDB()

    const result = await pool.request().query<Plant>(`
    SELECT
      Plant_Id   AS plantId,
      PlantName  AS plantName,
      Location   AS location,
      CreatedAt  AS createdAt
    FROM ref.Plant
    ORDER BY PlantName ASC;
  `)

    return result.recordset
}

export async function findPlantById(plantId: number): Promise<Plant | null> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Plant_Id", sql.Int, plantId)
        .query<Plant>(`
      SELECT
        Plant_Id   AS plantId,
        PlantName  AS plantName,
        Location   AS location,
        CreatedAt  AS createdAt
      FROM ref.Plant
      WHERE Plant_Id = @Plant_Id;
    `)

    const row = result.recordset[0]
    if (!row) return null
    return row
}
