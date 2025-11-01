import { sql, connectDB } from "@/config/db.js"
import { type ExampleItem } from "@/models/ExampleItem.js"

export async function getExampleItems(
  limit?: number,
  search?: string
): Promise<ExampleItem[]> {
  const pool = await connectDB() // ✅ reuse shared pool
  const request = pool.request()

  if (limit) request.input("limit", sql.Int, limit)
  if (search) request.input("search", sql.VarChar, `%${search}%`)

  const query = `
    SELECT TOP (@limit) id, title, body, createdAt
    FROM ExampleItems
    WHERE (@search IS NULL OR title LIKE @search)
    ORDER BY createdAt DESC
  `
  const result = await request.query(query)
  return result.recordset
}

export async function createExampleItem(
  title: string,
  body: string
): Promise<ExampleItem> {
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
}

export async function updateExampleItem(
  id: number,
  title?: string,
  body?: string
): Promise<ExampleItem> {
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
}

export async function deleteExampleItem(id: number): Promise<string> {
  const pool = await connectDB()
  await pool.request().input("id", sql.Int, id).query(`
    DELETE FROM ExampleItems WHERE id = @id
  `)
  return `Item ${id} deleted`
}
