// src/types/plant.ts
import type { Plant } from "@/types/cpsCoreTypes"

/* Query params for GET /api/plants (simple for now) */
export interface ListPlantsQuery {
    // later: isActive, search, etc.
}

/* DTO for frontend (same as entity for now) */
export interface PlantDto {
    plantId: number
    plantName: string
    location: string | null
    createdAt: string
}

/* Mapper */
export function toPlantDto(plant: Plant): PlantDto {
    return {
        plantId: plant.plantId,
        plantName: plant.plantName,
        location: plant.location,
        createdAt: plant.createdAt,
    }
}
