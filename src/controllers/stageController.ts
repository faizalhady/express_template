// src/controllers/stageController.ts
import { safeLogActivity } from "@/queries/activityLogQueries"
import {
    findStagesByJob,
    insertJobStage,
    type StageFilter,
} from "@/queries/stageQueries"
import type { CratingJobStageName } from "@/types/cpsCore"
import {
    type CreateJobStageBody,
    type ListJobStagesQuery,
    toCratingJobStageDto,
} from "@/types/stage"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"

/* --------------------------------------------
   POST /api/jobs/:id/stages
   Append a new stage to a job timeline
---------------------------------------------*/
export async function createJobStage(
    req: Request<{ id: string }, unknown, CreateJobStageBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const jobId = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(jobId)) {
            res.status(400)
            return res.json({
                success: false,
                message: "Invalid job id",
            })
        }

        const { stageName, startedAt, endedAt, pic, remarks } = req.body

        if (!stageName) {
            res.status(400)
            return res.json({
                success: false,
                message: "stageName is required",
            })
        }

        // Build input respecting exactOptionalPropertyTypes
        const stageInput: {
            stageName: CratingJobStageName
            startedAt?: string | null
            endedAt?: string | null
            pic?: string | null
            remarks?: string | null
        } = {
            stageName,
            ...(startedAt !== undefined ? { startedAt } : {}),
            ...(endedAt !== undefined ? { endedAt } : {}),
            ...(pic !== undefined ? { pic } : {}),
            ...(remarks !== undefined ? { remarks } : {}),
        }

        const stage = await insertJobStage(jobId, stageInput)

        // 🔹 Activity log: StageAdded:<StageName>
        const userId = pic ?? "system" // later this will be from auth
        await safeLogActivity({
            entityType: "Job",
            entityId: stage.jobId,
            action: `StageAdded:${stage.stageName}`,
            oldValue: null,
            newValue: stage,
            userId,
        })

        const dto = toCratingJobStageDto(stage)
        return sendSuccess(res, dto, "Job stage created successfully")
    } catch (err) {
        next(err)
    }
}


/* --------------------------------------------
   GET /api/jobs/:id/stages
   List stages for a job
---------------------------------------------*/
export async function listJobStages(
    req: Request<{ id: string }, unknown, unknown, ListJobStagesQuery>,
    res: Response,
    next: NextFunction
) {
    try {
        const jobId = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(jobId)) {
            res.status(400)
            return res.json({
                success: false,
                message: "Invalid job id",
            })
        }

        const { from, to, stageName } = req.query

        const filter: StageFilter = {}

        if (from) filter.from = from
        if (to) filter.to = to
        if (stageName) filter.stageName = stageName as CratingJobStageName

        const stages = await findStagesByJob(jobId, filter)
        const dtos = stages.map(toCratingJobStageDto)

        return sendSuccess(res, dtos, "Job stages fetched successfully")
    } catch (err) {
        next(err)
    }
}
