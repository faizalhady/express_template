// src/queries/areaOverviewQueries.ts
import { connectDB, sql } from "@/config/db"
import type { AreaOverviewDto } from "@/types/areaOverviewTypes"
import type {
  AreaStatus,
  AreaType,
  BookingStatus,
  CratingJobStatus,
} from "@/types/cpsCoreTypes"

export interface AreaOverviewFilter {
  plantId?: number
}

/**
 * Returns one row per area, enriched with:
 * - current job (if any, non-final status)
 * - next upcoming booking (if any, future + pending/confirmed)
 */
export async function findAreaOverview(
  filter: AreaOverviewFilter = {}
): Promise<AreaOverviewDto[]> {
  const pool = await connectDB()
  const request = pool.request()

  if (filter.plantId !== undefined) {
    request.input("Plant_Id", sql.Int, filter.plantId)
  }

  const wherePlant =
    filter.plantId !== undefined ? "WHERE a.Plant_Id = @Plant_Id" : ""

  const result = await request.query<{
    // area
    areaId: number
    plantId: number
    areaName: string
    areaStatus: AreaStatus
    areaType: AreaType
    updatedAt: Date

    // current job
    currentJobId: number | null
    currentJobSerialNumber: string | null
    currentJobModel: string | null
    currentJobStatus: CratingJobStatus | null
    currentJobWorkcellName: string | null
    currentJobVendorName: string | null
    currentJobStartTime: Date | null
    currentJobEndTime: Date | null

    // next booking
    nextBookingId: number | null
    nextBookingStartDateTime: Date | null
    nextBookingEndDateTime: Date | null
    nextBookingStatus: BookingStatus | null
  }>(`
    SELECT
      -- Area
      a.Area_Id    AS areaId,
      a.Plant_Id   AS plantId,
      a.AreaName   AS areaName,
      a.Status     AS areaStatus,
      a.AreaType   AS areaType,
      a.UpdatedAt  AS updatedAt,

      -- Current job (if any)
      cj.Job_Id        AS currentJobId,
      cj.SerialNumber  AS currentJobSerialNumber,
      cj.Model         AS currentJobModel,
      cj.Status        AS currentJobStatus,
      cj.WorkcellName  AS currentJobWorkcellName,
      cj.VendorName    AS currentJobVendorName,
      cj.StartTime     AS currentJobStartTime,
      cj.EndTime       AS currentJobEndTime,

      -- Next upcoming booking (if any)
      nb.Booking_Id        AS nextBookingId,
      nb.StartDateTime     AS nextBookingStartDateTime,
      nb.EndDateTime       AS nextBookingEndDateTime,
      nb.Status            AS nextBookingStatus
    FROM ref.Area a
    OUTER APPLY (
      SELECT TOP (1)
        j.Job_Id,
        j.SerialNumber,
        j.Model,
        j.Status,
        j.StartTime,
        j.EndTime,
        w.WorkcellName,
        v.VendorName
      FROM core.CratingJob j
      LEFT JOIN ref.Workcell w ON w.Workcell_Id = j.Workcell_Id
      LEFT JOIN ref.Vendor   v ON v.Vendor_Id   = j.Vendor_Id
      WHERE j.Area_Id = a.Area_Id
        AND j.Status NOT IN ('Cancelled', 'Collected', 'Expired')
      ORDER BY
        j.StartTime DESC,
        j.Job_Id DESC
    ) cj
    OUTER APPLY (
      SELECT TOP (1)
        b.Booking_Id,
        b.StartDateTime,
        b.EndDateTime,
        b.Status
      FROM core.Booking b
      WHERE b.Area_Id = a.Area_Id
        AND b.StartDateTime >= SYSUTCDATETIME()
        AND b.Status IN ('Pending', 'Confirmed')
      ORDER BY
        b.StartDateTime ASC,
        b.Booking_Id ASC
    ) nb
    ${wherePlant}
    ORDER BY a.AreaName ASC;
  `)

  return result.recordset.map((row) => ({
    areaId: row.areaId,
    plantId: row.plantId,
    areaName: row.areaName,
    areaStatus: row.areaStatus,
    areaType: row.areaType,
    updatedAt: row.updatedAt.toISOString(),

    currentJob: row.currentJobId
      ? {
        jobId: row.currentJobId,
        serialNumber: row.currentJobSerialNumber!,
        model: row.currentJobModel,
        status: row.currentJobStatus!,
        workcellName: row.currentJobWorkcellName,
        vendorName: row.currentJobVendorName,
        startTime: row.currentJobStartTime
          ? row.currentJobStartTime.toISOString()
          : null,
        endTime: row.currentJobEndTime
          ? row.currentJobEndTime.toISOString()
          : null,
      }
      : null,

    nextBooking: row.nextBookingId
      ? {
        bookingId: row.nextBookingId,
        startDateTime: row.nextBookingStartDateTime!.toISOString(),
        endDateTime: row.nextBookingEndDateTime!.toISOString(),
        status: row.nextBookingStatus!,
      }
      : null,
  }))
}
