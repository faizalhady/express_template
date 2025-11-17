// src/queries/vendorQueries.ts
import { connectDB, sql } from "@/config/db"
import type { Vendor } from "@/types/cpsCore"

export interface VendorFilter {
    isActive?: boolean
    search?: string
}

export async function findVendors(filter: VendorFilter = {}): Promise<Vendor[]> {
    const pool = await connectDB()
    const request = pool.request()

    let where = "1 = 1"

    if (filter.isActive !== undefined) {
        where += " AND IsActive = @IsActive"
        request.input("IsActive", sql.Bit, filter.isActive ? 1 : 0)
    }

    if (filter.search) {
        where += " AND VendorName LIKE @Search"
        request.input("Search", sql.VarChar, `%${filter.search}%`)
    }

    const result = await request.query<Vendor>(`
    SELECT
      Vendor_Id    AS vendorId,
      VendorName   AS vendorName,
      ContactName  AS contactName,
      ContactPhone AS contactPhone,
      IsActive     AS isActive,
      CreatedAt    AS createdAt
    FROM ref.Vendor
    WHERE ${where}
    ORDER BY VendorName ASC;
  `)

    return result.recordset
}

export async function findVendorById(vendorId: number): Promise<Vendor | null> {
    const pool = await connectDB()

    const result = await pool
        .request()
        .input("Vendor_Id", sql.Int, vendorId)
        .query<Vendor>(`
      SELECT
        Vendor_Id    AS vendorId,
        VendorName   AS vendorName,
        ContactName  AS contactName,
        ContactPhone AS contactPhone,
        IsActive     AS isActive,
        CreatedAt    AS createdAt
      FROM ref.Vendor
      WHERE Vendor_Id = @Vendor_Id;
    `)

    const row = result.recordset[0]
    if (!row) return null
    return row
}
