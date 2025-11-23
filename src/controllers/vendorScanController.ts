// src/controllers/vendorScanController.ts
import { safeLogActivity } from "@/queries/activityLogQueries"
import { completeCratingJob, findJobById, startCratingJob } from "@/queries/jobQueries"
import { insertJobStage } from "@/queries/stageQueries"
import type { CratingJobStageName } from "@/types/cpsCore"
import { toCratingJobDto } from "@/types/job"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"

/* --------------------------------------------
   Request bodies
---------------------------------------------*/
interface VendorScanStartBody {
    jobId: number
    areaId?: number
    pic?: string
}

interface VendorScanFinishBody {
    jobId: number
    pic?: string
}

/* --------------------------------------------
   POST /api/vendors/scan/start
   Vendor scans to start crating
---------------------------------------------*/
export async function vendorScanStart(
    req: Request<unknown, unknown, VendorScanStartBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const { jobId, areaId, pic } = req.body

        if (!jobId) {
            res.status(400)
            return res.json({
                success: false,
                message: "jobId is required",
            })
        }

        const existing = await findJobById(jobId)
        if (!existing) {
            res.status(404)
            return res.json({
                success: false,
                message: "Job not found",
            })
        }

        // Basic guard: avoid starting already finished/cancelled jobs
        if (["Cancelled", "Collected", "Expired", "CratingComplete"].includes(existing.status)) {
            res.status(400)
            return res.json({
                success: false,
                message: `Cannot start crating for job in status '${existing.status}'`,
            })
        }

        // Update job -> Crating, set StartTime
        const updated = await startCratingJob(jobId, areaId ?? existing.areaId)
        if (!updated) {
            res.status(500)
            return res.json({
                success: false,
                message: "Failed to update job status to Crating",
            })
        }

        // Add stage: Crating
        const stageName: CratingJobStageName = "Crating"
        await insertJobStage(jobId, {
            stageName,
            pic: pic ?? "vendor-scan",
            remarks: "Crating started by vendor scan",
        })

        // Activity log
        await safeLogActivity({
            entityType: "Job",
            entityId: updated.jobId,
            action: "VendorScanStart",
            oldValue: { status: existing.status },
            newValue: { status: updated.status, startTime: updated.startTime },
            userId: pic ?? updated.createdBy ?? "system",
        })

        const dto = toCratingJobDto(updated)
        return sendSuccess(res, dto, "Crating started successfully")
    } catch (err) {
        next(err)
    }
}

/* --------------------------------------------
   POST /api/vendors/scan/finish
   Vendor scans to finish crating
---------------------------------------------*/
export async function vendorScanFinish(
    req: Request<unknown, unknown, VendorScanFinishBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const { jobId, pic } = req.body

        if (!jobId) {
            res.status(400)
            return res.json({
                success: false,
                message: "jobId is required",
            })
        }

        const existing = await findJobById(jobId)
        if (!existing) {
            res.status(404)
            return res.json({
                success: false,
                message: "Job not found",
            })
        }

        // Guard: only allow finish if currently Crating (or maybe Calling/Confirmed)
        if (!["Crating", "Calling", "Confirmed"].includes(existing.status)) {
            res.status(400)
            return res.json({
                success: false,
                message: `Cannot finish crating for job in status '${existing.status}'`,
            })
        }

        const updated = await completeCratingJob(jobId)
        if (!updated) {
            res.status(500)
            return res.json({
                success: false,
                message: "Failed to update job status to CratingComplete",
            })
        }

        // Add stage: CratingComplete
        const stageName: CratingJobStageName = "CratingComplete"
        await insertJobStage(jobId, {
            stageName,
            pic: pic ?? "vendor-scan",
            remarks: "Crating finished by vendor scan",
        })

        // Activity log
        await safeLogActivity({
            entityType: "Job",
            entityId: updated.jobId,
            action: "VendorScanFinish",
            oldValue: { status: existing.status },
            newValue: { status: updated.status, endTime: updated.endTime },
            userId: pic ?? updated.createdBy ?? "system",
        })

        const dto = toCratingJobDto(updated)
        return sendSuccess(res, dto, "Crating finished successfully")
    } catch (err) {
        next(err)
    }
}
