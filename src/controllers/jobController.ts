// src/controllers/jobController.ts
import { safeLogActivity } from "@/queries/activityLogQueries"
import {
    findJobById,
    findJobs,
    insertJob,
    type JobFilter
} from "@/queries/jobQueries"
import { changeJobStatus } from "@/services/jobStatusService"
import type { CratingJobStatus } from "@/types/cpsCore"
import {
    toCratingJobDto,
    type CreateJobBody,
    type ListJobsQuery,
    type UpdateJobStatusBody,
} from "@/types/job"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"

/* --------------------------------------------
   POST /api/jobs
---------------------------------------------*/
export async function createJob(
    req: Request<unknown, unknown, CreateJobBody>,
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
            startTime,
            endTime,
        } = req.body

        if (!serialNumber || !workcellId) {
            res.status(400)
            return res.json({
                success: false,
                message: "serialNumber and workcellId are required",
            })
        }

        if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
            res.status(400)
            return res.json({
                success: false,
                message: "startTime must be before endTime",
            })
        }

        const createdBy = "system"

        const jobInput: {
            serialNumber: string
            model?: string | null
            workcellId: number
            vendorId?: number | null
            areaId?: number | null
            startTime?: string | null
            endTime?: string | null
        } = {
            serialNumber,
            workcellId,
            ...(model !== undefined ? { model } : {}),
            ...(vendorId !== undefined ? { vendorId } : {}),
            ...(areaId !== undefined ? { areaId } : {}),
            ...(startTime !== undefined ? { startTime } : {}),
            ...(endTime !== undefined ? { endTime } : {}),
        }

        const job = await insertJob(jobInput, createdBy)

        await safeLogActivity({
            entityType: "Job",
            entityId: job.jobId,
            action: "Created",
            oldValue: null,
            newValue: job,
            userId: createdBy,
        })

        const dto = toCratingJobDto(job)
        return sendSuccess(res, dto, "Job created successfully")
    } catch (err) {
        next(err)
    }
}

/* --------------------------------------------
   GET /api/jobs/:id
---------------------------------------------*/
export async function getJobById(
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
                message: "Invalid job id",
            })
        }

        const job = await findJobById(id)
        if (!job) {
            res.status(404)
            return res.json({
                success: false,
                message: "Job not found",
            })
        }

        const dto = toCratingJobDto(job)
        return sendSuccess(res, dto, "Job fetched successfully")
    } catch (err) {
        next(err)
    }
}

/* --------------------------------------------
   GET /api/jobs
---------------------------------------------*/
export async function listJobs(
    req: Request<unknown, unknown, unknown, ListJobsQuery>,
    res: Response,
    next: NextFunction
) {
    try {
        const { areaId, workcellId, vendorId, status, from, to } = req.query

        const filter: JobFilter = {}

        if (areaId) {
            const parsed = Number.parseInt(areaId, 10)
            if (!Number.isNaN(parsed)) filter.areaId = parsed
        }

        if (workcellId) {
            const parsed = Number.parseInt(workcellId, 10)
            if (!Number.isNaN(parsed)) filter.workcellId = parsed
        }

        if (vendorId) {
            const parsed = Number.parseInt(vendorId, 10)
            if (!Number.isNaN(parsed)) filter.vendorId = parsed
        }

        if (status) {
            filter.status = status as CratingJobStatus
        }

        if (from) filter.from = from
        if (to) filter.to = to

        const jobs = await findJobs(filter)
        const dtos = jobs.map(toCratingJobDto)

        return sendSuccess(res, dtos, "Jobs fetched successfully")
    } catch (err) {
        next(err)
    }
}

/* --------------------------------------------
   PATCH /api/jobs/:id/status
---------------------------------------------*/
export async function patchJobStatus(
    req: Request<{ id: string }, unknown, UpdateJobStatusBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
            res.status(400)
            return res.json({
                success: false,
                message: "Invalid job id",
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

        const { job, stageId } = await changeJobStatus(id, status, {
            userId,
            source: "ManualStatusUpdate",
        })

        const dto = toCratingJobDto(job)
        return sendSuccess(
            res,
            {
                job: dto,
                stageId,
            },
            "Job status updated successfully"
        )
    } catch (err) {
        if (err instanceof Error) {
            // includes invalid transition, job not found, etc.
            return res.status(400).json({
                success: false,
                message: err.message,
            })
        }
        next(err)
    }
}
