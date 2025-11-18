// src/controllers/areaController.ts
import { findAreaOverview } from "@/queries/areaOverviewQueries."
import { findAreaById, findAreas, type AreaFilter } from "@/queries/areaQueries"
import {
    toCratingAreaDto,
    type ListAreasQuery,
} from "@/types/area"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"

/* --------------------------------------------
   GET /api/areas/:id
---------------------------------------------*/
export async function getAreaById(
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
                message: "Invalid area id",
            })
        }

        const area = await findAreaById(id)
        if (!area) {
            res.status(404)
            return res.json({
                success: false,
                message: "Area not found",
            })
        }

        const dto = toCratingAreaDto(area)
        return sendSuccess(res, dto, "Area fetched successfully")
    } catch (err) {
        next(err)
    }
}

/* --------------------------------------------
   GET /api/areas
   Optional filters: plantId, status
---------------------------------------------*/
export async function listAreas(
    req: Request<unknown, unknown, unknown, ListAreasQuery>,
    res: Response,
    next: NextFunction
) {
    try {
        const { plantId, status } = req.query

        const filter: AreaFilter = {}

        if (plantId) {
            const parsed = Number.parseInt(plantId, 10)
            if (!Number.isNaN(parsed)) {
                filter.plantId = parsed
            }
        }

        if (status) {
            filter.status = status
        }

        const areas = await findAreas(filter)
        const dtos = areas.map(toCratingAreaDto)

        return sendSuccess(res, dtos, "Areas fetched successfully")
    } catch (err) {
        next(err)
    }
}


/* --------------------------------------------
   GET /api/areas/overview
   Rich dashboard view per area
---------------------------------------------*/
export async function listAreaOverview(
    req: Request<unknown, unknown, unknown, { plantId?: string }>,
    res: Response,
    next: NextFunction
) {
    try {
        const { plantId } = req.query

        const filter =
            plantId && !Number.isNaN(Number.parseInt(plantId, 10))
                ? { plantId: Number.parseInt(plantId, 10) }
                : {}

        const data = await findAreaOverview(filter)

        return sendSuccess(res, data, "Area overview fetched successfully")
    } catch (err) {
        next(err)
    }
}