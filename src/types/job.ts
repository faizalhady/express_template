// src/types/job.ts
import type {
    CratingJob,
    CratingJobStatus,
    ISODateTimeString,
} from "@/types/cpsCore"

/* --------------------------------------------
   Query params for GET /api/jobs
---------------------------------------------*/
export interface ListJobsQuery {
    areaId?: string
    workcellId?: string
    vendorId?: string
    status?: CratingJobStatus
    from?: string
    to?: string
}

/* --------------------------------------------
   Request body for POST /api/jobs
---------------------------------------------*/
export interface CreateJobBody {
    serialNumber: string
    model?: string | null

    workcellId: number
    vendorId?: number | null
    areaId?: number | null

    // Optional: if you want to set a planned start/end
    startTime?: ISODateTimeString | null
    endTime?: ISODateTimeString | null
}

/* --------------------------------------------
   Request body for updating job status
   (e.g. PATCH /api/jobs/:id/status)
---------------------------------------------*/
export interface UpdateJobStatusBody {
    status: CratingJobStatus
}

/* --------------------------------------------
  DTO returned to frontend for each Job
---------------------------------------------*/
export interface CratingJobDto {
    jobId: number
    serialNumber: string
    model: string | null

    workcellId: number
    vendorId: number | null
    areaId: number | null

    status: CratingJobStatus
    startTime: ISODateTimeString | null
    endTime: ISODateTimeString | null

    createdBy: string | null
    createdAt: ISODateTimeString
}

/* --------------------------------------------
   Mapper from DB entity -> DTO
---------------------------------------------*/
export function toCratingJobDto(job: CratingJob): CratingJobDto {
    return {
        jobId: job.jobId,
        serialNumber: job.serialNumber,
        model: job.model,

        workcellId: job.workcellId,
        vendorId: job.vendorId,
        areaId: job.areaId,

        status: job.status,
        startTime: job.startTime,
        endTime: job.endTime,

        createdBy: job.createdBy,
        createdAt: job.createdAt,
    }
}
