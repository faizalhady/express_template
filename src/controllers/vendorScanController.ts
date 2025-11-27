// src/controllers/vendorScanController.ts
import { changeJobStatus } from "@/services/jobStatusService"
import { toCratingJobDto } from "@/types/jobTypes"
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

        const userId = pic ?? "vendor-scan"

        const { job, stageId } = await changeJobStatus(jobId, "Crating", {
            userId,
            areaId: areaId ?? null,
            source: "VendorScanStart",
            remarks: "Crating started by vendor scan",
        })

        const dto = toCratingJobDto(job)
        return sendSuccess(
            res,
            { job: dto, stageId },
            "Crating started successfully"
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

        const userId = pic ?? "vendor-scan"

        const { job, stageId } = await changeJobStatus(jobId, "CratingComplete", {
            userId,
            source: "VendorScanFinish",
            remarks: "Crating finished by vendor scan",
        })

        const dto = toCratingJobDto(job)
        return sendSuccess(
            res,
            { job: dto, stageId },
            "Crating finished successfully"
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
