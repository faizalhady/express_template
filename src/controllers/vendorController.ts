// src/controllers/vendorController.ts
import { findVendorById, findVendors, type VendorFilter } from "@/queries/vendorQueries"
import { toVendorDto, type ListVendorsQuery } from "@/types/vendorTypes"
import { sendSuccess } from "@/utils/responseHandler"
import type { NextFunction, Request, Response } from "express"

export async function listVendors(
    req: Request<unknown, unknown, unknown, ListVendorsQuery>,
    res: Response,
    next: NextFunction
) {
    try {
        const { isActive, search } = req.query
        const filter: VendorFilter = {}

        if (isActive === "true") filter.isActive = true
        if (isActive === "false") filter.isActive = false
        if (search) filter.search = search

        const vendors = await findVendors(filter)
        const dtos = vendors.map(toVendorDto)

        return sendSuccess(res, dtos, "Vendors fetched successfully")
    } catch (err) {
        next(err)
    }
}

export async function getVendorById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
) {
    try {
        const id = Number.parseInt(req.params.id, 10)
        if (Number.isNaN(id)) {
            res.status(400)
            return res.json({ success: false, message: "Invalid vendor id" })
        }

        const vendor = await findVendorById(id)
        if (!vendor) {
            res.status(404)
            return res.json({ success: false, message: "Vendor not found" })
        }

        const dto = toVendorDto(vendor)
        return sendSuccess(res, dto, "Vendor fetched successfully")
    } catch (err) {
        next(err)
    }
}
