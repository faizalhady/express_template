// src/types/areaOverview.ts
import type {
    BookingStatus,
    CratingAreaStatus,
    CratingJobStatus,
    ISODateTimeString,
} from "@/types/cpsCore"

/**
 * One item = one crating area tile on your dashboard
 */
export interface AreaOverviewDto {
    // ----- Area basics -----
    areaId: number
    plantId: number
    areaName: string
    areaStatus: CratingAreaStatus
    updatedAt: ISODateTimeString

    // ----- Current job in that area (if any) -----
    currentJob: {
        jobId: number
        serialNumber: string
        model: string | null
        status: CratingJobStatus
        workcellName: string | null
        vendorName: string | null
        startTime: ISODateTimeString | null
        endTime: ISODateTimeString | null
    } | null

    // ----- Next upcoming booking in that area (if any) -----
    nextBooking: {
        bookingId: number
        startDateTime: ISODateTimeString
        endDateTime: ISODateTimeString
        status: BookingStatus
    } | null
}
