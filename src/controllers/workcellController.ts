// src/controllers/workcellController.ts
import {
    findWorkcellById,
    findWorkcells,
    type WorkcellFilter,
} from "@/queries/workcellQueries"
import {
    toWorkcellDto,
    type ListWorkcellsQuery,
} from "@/types/workcellTypes"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"

export async function listWorkcells(
    req: Request<unknown, unknown, unknown, ListWorkcellsQuery>,
    res: Response,
    next: NextFunction
) {
    try {
        const { isActive, search } = req.query
        const filter: WorkcellFilter = {}

        if (isActive === "true") filter.isActive = true
        if (isActive === "false") filter.isActive = false
        if (search) filter.search = search

        const workcells = await findWorkcells(filter)
        const dtos = workcells.map(toWorkcellDto)

        return sendSuccess(res, dtos, "Workcells fetched successfully")
    } catch (err) {
        next(err)
    }
}

export async function getWorkcellById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
            res.status(400)
            return res.json({ success: false, message: "Invalid workcell id" })
        }

        const workcell = await findWorkcellById(id)
        if (!workcell) {
            res.status(404)
            return res.json({ success: false, message: "Workcell not found" })
        }

        const dto = toWorkcellDto(workcell)
        return sendSuccess(res, dto, "Workcell fetched successfully")
    } catch (err) {
        next(err)
    }
}
