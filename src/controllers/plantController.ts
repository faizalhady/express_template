// src/controllers/plantController.ts
import { findPlantById, findPlants } from "@/queries/plantQueries"
import { toPlantDto, type ListPlantsQuery } from "@/types/plant"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"

/* GET /api/plants */
export async function listPlants(
    _req: Request<unknown, unknown, unknown, ListPlantsQuery>,
    res: Response,
    next: NextFunction
) {
    try {
        const plants = await findPlants()
        const dtos = plants.map(toPlantDto)
        return sendSuccess(res, dtos, "Plants fetched successfully")
    } catch (err) {
        next(err)
    }
}

/* GET /api/plants/:id */
export async function getPlantById(
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
                message: "Invalid plant id",
            })
        }

        const plant = await findPlantById(id)
        if (!plant) {
            res.status(404)
            return res.json({
                success: false,
                message: "Plant not found",
            })
        }

        const dto = toPlantDto(plant)
        return sendSuccess(res, dto, "Plant fetched successfully")
    } catch (err) {
        next(err)
    }
}
