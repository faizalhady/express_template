// src/controllers/jobBookingController.ts

import { safeLogActivity } from "@/queries/activityLogQueries"
import { insertJobWithBooking } from "@/queries/jobWithBookingQueries"
import { toBookingDto } from "@/types/bookingsTypes"
import type { ISODateTimeString } from "@/types/cpsCoreTypes"
import { toCratingJobDto } from "@/types/jobTypes"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"

/**
 * Body for POST /api/jobs-with-booking
 * Workcell user creates:
 * - what to crate (job)
 * - where/when to crate (booking)
 */
export interface CreateJobWithBookingBody {
    // Job info
    serialNumber: string
    model?: string | null

    workcellId: number
    vendorId?: number | null

    // Booking info
    areaId: number
    startDateTime: ISODateTimeString
    endDateTime: ISODateTimeString
}

/* --------------------------------------------
   POST /api/jobs-with-booking
   FULL transactional version:
   - Create CratingJob
   - Create Booking
   - Create CratingJobStage (Booked)
---------------------------------------------*/
export async function createJobWithBooking(
    req: Request<unknown, unknown, CreateJobWithBookingBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const {
            serialNumber,
            model,
            workcellId,
            vendorId,
            areaId,
            startDateTime,
            endDateTime,
        } = req.body

        // Basic validation
        if (!serialNumber || !workcellId || !areaId || !startDateTime || !endDateTime) {
            res.status(400)
            return res.json({
                success: false,
                message:
                    "serialNumber, workcellId, areaId, startDateTime, endDateTime are required",
            })
        }

        const start = new Date(startDateTime)
        const end = new Date(endDateTime)

        if (Number.isNaN(start.getTime())) {
            return res.status(400).json({ success: false, message: "Invalid startDateTime" })
        }
        if (Number.isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: "Invalid endDateTime" })
        }
        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: "startDateTime must be before endDateTime",
            })
        }

        // TEMP — Later from auth middleware
        const createdByUsername = "system"
        const createdByUserId = 1

        // 1) Transactional insert (Job + Booking + Stage)
        const { job, booking, initialStage } = await insertJobWithBooking({
            serialNumber,
            model: model ?? null,
            workcellId,
            vendorId: vendorId ?? null,
            areaId,
            startDateTime,
            endDateTime,
            createdByUsername,
            createdByUserId,
        })

        // 2) Activity logs (non-blocking)
        safeLogActivity({
            entityType: "Job",
            entityId: job.jobId,
            action: "CreatedWithBooking",
            oldValue: null,
            newValue: job,
            userId: createdByUsername,
        }).catch(() => { })

        safeLogActivity({
            entityType: "Booking",
            entityId: booking.bookingId,
            action: "CreatedForJob",
            oldValue: null,
            newValue: booking,
            userId: createdByUsername,
        }).catch(() => { })

        // 3) Format response
        return sendSuccess(
            res,
            {
                job: toCratingJobDto(job),
                booking: toBookingDto(booking),
                initialStage,
            },
            "Job, booking, and initial stage created successfully"
        )
    } catch (err) {
        next(err)
    }
}
