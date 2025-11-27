// src/types/workcell.ts
import type { Workcell } from "@/types/cpsCoreTypes"

export interface ListWorkcellsQuery {
    isActive?: string  // "true" | "false"
    search?: string
}

export interface WorkcellDto {
    workcellId: number
    workcellName: string
    division: string | null
    isActive: boolean
    createdAt: string
}

export function toWorkcellDto(w: Workcell): WorkcellDto {
    return {
        workcellId: w.workcellId,
        workcellName: w.workcellName,
        division: w.division,
        isActive: w.isActive,
        createdAt: w.createdAt,
    }
}
