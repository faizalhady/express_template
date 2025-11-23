import type { Booking, BookingStatus, ISODateTimeString } from "@/types/cpsCore"

/* --------------------------------------------
   Request body for POST /api/bookings
---------------------------------------------*/
export interface CreateBookingBody {
    areaId: number
    jobId?: number | null
    startDateTime: ISODateTimeString
    endDateTime: ISODateTimeString
}

/* --------------------------------------------
   Query params for GET /api/bookings
---------------------------------------------*/
export interface ListBookingsQuery {
    areaId?: string
    status?: BookingStatus
    from?: string
    to?: string
}

/* --------------------------------------------
   DTO returned to frontend
   (for now same as Booking, can enrich later)
---------------------------------------------*/
export interface BookingDto {
    bookingId: number
    jobId: number | null
    areaId: number
    startDateTime: ISODateTimeString
    endDateTime: ISODateTimeString
    status: BookingStatus
    createdBy: string | null
    createdAt: ISODateTimeString

    replacedByBookingId: number | null
    createdByUserId: number | null
}

// Booking status

export interface UpdateBookingStatusBody {
    status: BookingStatus
}

/* --------------------------------------------
   Mapper from DB entity -> DTO
---------------------------------------------*/
export function toBookingDto(booking: Booking): BookingDto {
    return {
        bookingId: booking.bookingId,
        jobId: booking.jobId,
        areaId: booking.areaId,
        startDateTime: booking.startDateTime,
        endDateTime: booking.endDateTime,
        status: booking.status,
        createdBy: booking.createdBy,
        createdAt: booking.createdAt,
        replacedByBookingId: booking.replacedByBookingId,
        createdByUserId: booking.createdByUserId,
    }
}
