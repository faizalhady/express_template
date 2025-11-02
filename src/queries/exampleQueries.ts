import { sql, connectDB } from "@/config/db"
import { type ExampleItem } from "@/models/ExampleItem"

export async function getExampleItems(
  limit?: number,
  search?: string
): Promise<ExampleItem[]> {
  try {
    const pool = await connectDB()
    const request = pool.request()

    // Always declare parameters
    request.input("limit", sql.Int, limit ?? null)
    request.input("search", sql.VarChar, search ? `%${search}%` : null)

    const topClause = limit ? "TOP (@limit)" : ""

    const query = `
      SELECT ${topClause} id, title, body, createdAt
      FROM ExampleItems
      WHERE (@search IS NULL OR title LIKE @search)
      ORDER BY createdAt DESC
    `

    const result = await request.query(query)
    return result.recordset
  } catch (err) {
    console.error("❌ SQL Error in getExampleItems:", err)
    throw err
  }
}


export async function createExampleItem(
  title: string,
  body: string
): Promise<ExampleItem> {
  try {
    const pool = await connectDB()
    const result = await pool
      .request()
      .input("title", sql.VarChar, title)
      .input("body", sql.VarChar, body)
      .query(`
        INSERT INTO ExampleItems (title, body, createdAt)
        OUTPUT inserted.*
        VALUES (@title, @body, GETDATE())
      `)
    return result.recordset[0]
  } catch (err) {
    console.error("❌ SQL Error in createExampleItem:", err)
    throw err
  }
}

export async function updateExampleItem(
  id: number,
  title?: string,
  body?: string
): Promise<ExampleItem> {
  try {
    const pool = await connectDB()
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("title", sql.VarChar, title ?? null)
      .input("body", sql.VarChar, body ?? null)
      .query(`
        UPDATE ExampleItems
        SET
          title = COALESCE(@title, title),
          body = COALESCE(@body, body)
        OUTPUT inserted.*
        WHERE id = @id
      `)
    return result.recordset[0]
  } catch (err) {
    console.error("❌ SQL Error in updateExampleItem:", err)
    throw err
  }
}

export async function deleteExampleItem(id: number): Promise<string> {
  try {
    const pool = await connectDB()
    await pool.request().input("id", sql.Int, id).query(`
      DELETE FROM ExampleItems WHERE id = @id
    `)
    return `Item ${id} deleted`
  } catch (err) {
    console.error("❌ SQL Error in deleteExampleItem:", err)
    throw err
  }
}
