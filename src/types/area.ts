// src/types/area.ts
import type {
    CratingArea,
    CratingAreaStatus,
    ISODateTimeString,
} from "@/types/cpsCore"

/* --------------------------------------------
   Query params for GET /api/areas
---------------------------------------------*/
export interface ListAreasQuery {
    plantId?: string
    status?: CratingAreaStatus
}

/* --------------------------------------------
   DTO returned to frontend
---------------------------------------------*/
export interface CratingAreaDto {
    areaId: number
    plantId: number
    areaName: string
    status: CratingAreaStatus
    updatedAt: ISODateTimeString
}

/* --------------------------------------------
   Mapper from DB entity -> DTO
---------------------------------------------*/
export function toCratingAreaDto(area: CratingArea): CratingAreaDto {
    return {
        areaId: area.areaId,
        plantId: area.plantId,
        areaName: area.areaName,
        status: area.status,
        updatedAt: area.updatedAt,
    }
}
