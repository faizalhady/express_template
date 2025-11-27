import { safeLogActivity } from "@/queries/activityLogQueries"
import type { BookingFilter } from "@/queries/bookingQueries"
import {
    findBookingById,
    findBookings,
    insertBooking,
} from "@/queries/bookingQueries"
import { changeBookingStatus } from "@/services/bookingStatusService"
import {
    type CreateBookingBody,
    type ListBookingsQuery,
    type UpdateBookingStatusBody,
    toBookingDto,
} from "@/types/bookingsTypes"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"


/* --------------------------------------------
   POST /api/bookings
---------------------------------------------*/
export async function createBooking(
    req: Request<unknown, unknown, CreateBookingBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const { areaId, jobId, startDateTime, endDateTime } = req.body

        if (!areaId || !startDateTime || !endDateTime) {
            res.status(400)
            return res.json({
                success: false,
                message: "areaId, startDateTime and endDateTime are required",
            })
        }

        if (new Date(startDateTime) >= new Date(endDateTime)) {
            res.status(400)
            return res.json({
                success: false,
                message: "startDateTime must be before endDateTime",
            })
        }

        const createdBy = "system"

        // ✅ Build input without jobId when it's undefined
        const bookingInput: {
            areaId: number
            jobId?: number | null
            startDateTime: string
            endDateTime: string
        } = {
            areaId,
            startDateTime,
            endDateTime,
            ...(jobId !== undefined ? { jobId } : {}),
        }

        const booking = await insertBooking(bookingInput, createdBy)

        // 🔹 Activity log: Booking.Created
        await safeLogActivity({
            entityType: "Booking",
            entityId: booking.bookingId,
            action: "Created",
            oldValue: null,
            newValue: booking,
            userId: createdBy,
        })

        const dto = toBookingDto(booking)
        return sendSuccess(res, dto, "Booking created successfully")
    } catch (err) {
        next(err)
    }
}


/* --------------------------------------------
   GET /api/bookings/:id
---------------------------------------------*/
export async function getBookingById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
            res.status(400)
            return res.json({
                success: false,
                message: "Invalid booking id",
            })
        }

        const booking = await findBookingById(id)
        if (!booking) {
            res.status(404)
            return res.json({
                success: false,
                message: "Booking not found",
            })
        }

        const dto = toBookingDto(booking)
        return sendSuccess(res, dto, "Booking fetched successfully")
    } catch (err) {
        next(err)
    }
}

/* --------------------------------------------
   GET /api/bookings
   Optional filters: areaId, status, from, to
---------------------------------------------*/
export async function listBookings(
    req: Request<unknown, unknown, unknown, ListBookingsQuery>,
    res: Response,
    next: NextFunction
) {
    try {
        const { areaId, status, from, to } = req.query

        const filter: BookingFilter = {}

        if (areaId) {
            const parsed = Number.parseInt(areaId, 10)
            if (!Number.isNaN(parsed)) {
                filter.areaId = parsed
            }
        }

        if (status) {
            filter.status = status
        }

        if (from) filter.from = from
        if (to) filter.to = to

        const bookings = await findBookings(filter)
        const dtos = bookings.map(toBookingDto)

        return sendSuccess(res, dtos, "Bookings fetched successfully")
    } catch (err) {
        next(err)
    }
}


/* --------------------------------------------
   PATCH /api/bookings/:id/status
   Central booking status update
---------------------------------------------*/
export async function patchBookingStatus(
    req: Request<{ id: string }, unknown, UpdateBookingStatusBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
            res.status(400)
            return res.json({
                success: false,
                message: "Invalid booking id",
            })
        }

        const { status } = req.body
        if (!status) {
            res.status(400)
            return res.json({
                success: false,
                message: "status is required",
            })
        }

        const userId = "system" // later from auth

        const booking = await changeBookingStatus(id, status, {
            userId,
            source: "ManualStatusUpdate",
        })

        const dto = toBookingDto(booking)
        return sendSuccess(
            res,
            dto,
            "Booking status updated successfully"
        )
    } catch (err) {
        if (err instanceof Error) {
            return res.status(400).json({
                success: false,
                message: err.message,
            })
        }
        next(err)
    }
}
