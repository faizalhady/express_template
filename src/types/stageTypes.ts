// src/types/stage.ts
import type {
    CratingJobStage,
    CratingJobStageName,
    ISODateTimeString,
} from "@/types/cpsCoreTypes"

/* --------------------------------------------
   Query params for GET /api/jobs/:id/stages
---------------------------------------------*/
export interface ListJobStagesQuery {
    from?: string
    to?: string
    stageName?: CratingJobStageName
}

/* --------------------------------------------
   Request body for POST /api/jobs/:id/stages
   (append a new stage to a job's timeline)
---------------------------------------------*/
export interface CreateJobStageBody {
    stageName: CratingJobStageName

    // Optional timestamps - if omitted,
    // backend can default startedAt = now
    startedAt?: ISODateTimeString | null
    endedAt?: ISODateTimeString | null

    // Person-in-charge and notes
    pic?: string | null
    remarks?: string | null
}

/* --------------------------------------------
   DTO returned to frontend for each stage
---------------------------------------------*/
export interface CratingJobStageDto {
    stageId: number
    jobId: number
    stageName: CratingJobStageName
    startedAt: ISODateTimeString
    endedAt: ISODateTimeString | null
    pic: string | null
    remarks: string | null
}

/* --------------------------------------------
   Mapper from DB entity -> DTO
---------------------------------------------*/
export function toCratingJobStageDto(
    stage: CratingJobStage
): CratingJobStageDto {
    return {
        stageId: stage.stageId,
        jobId: stage.jobId,
        stageName: stage.stageName,
        startedAt: stage.startedAt,
        endedAt: stage.endedAt,
        pic: stage.pic,
        remarks: stage.remarks,
    }
}
