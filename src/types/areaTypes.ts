// src/types/area.ts
import type {
    Area,
    AreaStatus,
    AreaType,
    ISODateTimeString,
} from "@/types/cpsCoreTypes"

/* --------------------------------------------
   Query params for GET /api/areas
---------------------------------------------*/
export interface ListAreasQuery {
    plantId?: string
    status?: AreaStatus
}

/* --------------------------------------------
   DTO returned to frontend
---------------------------------------------*/
export interface AreaDto {
    areaId: number
    plantId: number
    areaName: string
    status: AreaStatus
    areaType: AreaType
    updatedAt: ISODateTimeString
}

/* --------------------------------------------
   Mapper from DB entity -> DTO
---------------------------------------------*/
export function toAreaDto(area: Area): AreaDto {
    return {
        areaId: area.areaId,
        plantId: area.plantId,
        areaName: area.areaName,
        status: area.status,
        areaType: area.areaType,
        updatedAt: area.updatedAt,
    }
}
