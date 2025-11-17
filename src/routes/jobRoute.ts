// src/routes/jobRoute.ts
import {
    createJob,
    getJobById,
    listJobs,
    patchJobStatus,
} from "@/controllers/jobController";
import {
    createJobStage,
    listJobStages,
} from "@/controllers/stageController";
import { Router } from "express";

const router = Router()

// Jobs
router.get("/", listJobs)
router.get("/:id", getJobById)
router.post("/", createJob)
router.patch("/:id/status", patchJobStatus)

// Job stages (timeline)
router.get("/:id/stages", listJobStages)
router.post("/:id/stages", createJobStage)

export default router
