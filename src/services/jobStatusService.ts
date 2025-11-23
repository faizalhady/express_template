// src/services/jobStatusService.ts

import { safeLogActivity } from "@/queries/activityLogQueries"
import {
    completeCratingJob,
    findJobById,
    startCratingJob,
    updateJobStatus,
} from "@/queries/jobQueries"
import { insertJobStage } from "@/queries/stageQueries"
import type {
    CratingJob,
    CratingJobStageName,
    CratingJobStatus,
} from "@/types/cpsCore"

export interface ChangeJobStatusOptions {
    userId: string
    areaId?: number | null
    source?: string          // e.g. "ManualStatusUpdate", "VendorScanStart"
    remarks?: string
}

/**
 * Allowed transitions for CratingJob.Status.
 * Adjust this mapping later if business rules change.
 */
const allowedTransitions: Record<CratingJobStatus, CratingJobStatus[]> = {
    Booked: [
        "WaitingConfirmation",
        "Confirmed",
        "Calling",
        "Crating",
        "Cancelled",
        "Expired",
    ],
    WaitingConfirmation: ["Confirmed", "Cancelled", "Expired"],
    Confirmed: ["Calling", "Crating", "Cancelled", "Expired"],
    Calling: ["Crating", "Cancelled", "Expired"],
    Crating: ["CratingComplete", "Cancelled"],
    CratingComplete: ["ReadyForCollection"],
    ReadyForCollection: ["Collected", "Cancelled", "Expired"],
    Collected: [],           // terminal
    Cancelled: [],           // terminal
    Expired: [],             // terminal
}

function ensureAllowedTransition(
    oldStatus: CratingJobStatus,
    newStatus: CratingJobStatus
) {
    if (oldStatus === newStatus) return

    const allowed = allowedTransitions[oldStatus] ?? []
    if (!allowed.includes(newStatus)) {
        throw new Error(
            `Status change from '${oldStatus}' to '${newStatus}' is not allowed`
        )
    }
}

/**
 * Central status change helper.
 * - Validates transition
 * - Updates CratingJob (using existing helpers)
 * - Inserts CratingJobStage
 * - Logs ActivityLog
 */
export async function changeJobStatus(
    jobId: number,
    newStatus: CratingJobStatus,
    options: ChangeJobStatusOptions
): Promise<{ job: CratingJob; stageId: number }> {
    const existing = await findJobById(jobId)
    if (!existing) {
        throw new Error("Job not found")
    }

    ensureAllowedTransition(existing.status, newStatus)

    let updated: CratingJob | null = null

    // Reuse your existing helpers for specific statuses
    if (newStatus === "Crating") {
        // Vendor scan start / manual start
        updated = await startCratingJob(jobId, options.areaId ?? existing.areaId)
    } else if (newStatus === "CratingComplete") {
        // Vendor scan finish
        updated = await completeCratingJob(jobId)
    } else {
        // Generic status change, optionally move to another area
        updated = await updateJobStatus(jobId, newStatus, options.areaId ?? null)
    }

    if (!updated) {
        throw new Error("Failed to update job status")
    }

    const stageName = newStatus as CratingJobStageName

    const remarks =
        options.remarks ??
        `Status changed from ${existing.status} to ${newStatus}${options.source ? ` (source: ${options.source})` : ""
        }`

    const stage = await insertJobStage(jobId, {
        stageName,
        pic: options.userId,
        remarks,
    })

    await safeLogActivity({
        entityType: "Job",
        entityId: updated.jobId,
        action: "UpdatedStatus",
        oldValue: { status: existing.status },
        newValue: { status: updated.status },
        userId: options.userId,
    })

    return { job: updated, stageId: stage.stageId }
}
