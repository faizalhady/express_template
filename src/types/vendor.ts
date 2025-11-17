// src/types/vendor.ts
import type { Vendor } from "@/types/cpsCore"

export interface ListVendorsQuery {
    isActive?: string  // "true" | "false"
    search?: string
}

export interface VendorDto {
    vendorId: number
    vendorName: string
    contactName: string | null
    contactPhone: string | null
    isActive: boolean
    createdAt: string
}

export function toVendorDto(v: Vendor): VendorDto {
    return {
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        contactName: v.contactName,
        contactPhone: v.contactPhone,
        isActive: v.isActive,
        createdAt: v.createdAt,
    }
}
