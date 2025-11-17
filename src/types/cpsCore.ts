// src/types/cpsCore.ts

// Helper for date strings from DB
export type ISODateTimeString = string;

/* ============================================
   ENUMS - mirror your SQL CHECK constraints
   ============================================ */

export type CratingAreaStatus =
    | "Idle"
    | "Occupied"
    | "Calling"
    | "Maintenance";

export type CratingJobStatus =
    | "Booked"
    | "WaitingConfirmation"
    | "Confirmed"
    | "Calling"
    | "Crating"
    | "Crated"
    | "ReadyForCollection"
    | "Collected"
    | "Cancelled"
    | "Expired";

export type BookingStatus =
    | "Pending"
    | "Confirmed"
    | "Cancelled"
    | "Expired"
    | "Completed";

export type CratingJobStageName =
    | "Booking"
    | "ConfirmationPending"
    | "Confirmed"
    | "Calling"
    | "Crating"
    | "CratingComplete"
    | "ReadyForCollection"
    | "Collected"
    | "Cancelled"
    | "Expired";

export type ActivityEntityType =
    | "Job"
    | "Booking"
    | "Area"
    | "Vendor"
    | "Workcell"
    | "Plant";

export type RoleName = "Admin" | "SuperAdmin" | "User" | "Vendor" | "Viewer";

/* ============================================
   REF SCHEMA TYPES
   ============================================ */

export interface Plant {
    plantId: number;                 // Plant_Id
    plantName: string;               // PlantName
    location: string | null;         // Location
    createdAt: ISODateTimeString;    // CreatedAt
}

export interface CratingArea {
    areaId: number;                  // Area_Id
    plantId: number;                 // Plant_Id FK -> Plant
    areaName: string;                // AreaName
    status: CratingAreaStatus;       // Status
    updatedAt: ISODateTimeString;    // UpdatedAt
}

export interface Vendor {
    vendorId: number;                // Vendor_Id
    vendorName: string;              // VendorName
    contactName: string | null;      // ContactName
    contactPhone: string | null;     // ContactPhone
    isActive: boolean;               // IsActive
    createdAt: ISODateTimeString;    // CreatedAt
}

export interface Workcell {
    workcellId: number;              // Workcell_Id
    workcellName: string;            // WorkcellName
    division: string | null;         // Division
    isActive: boolean;               // IsActive
    createdAt: ISODateTimeString;    // CreatedAt
}

/* ============================================
   AUTH SCHEMA TYPES
   ============================================ */

export interface User {
    userId: number;                  // User_Id
    username: string;                // Username (NTID or similar)
    fullName: string | null;         // FullName
    email: string | null;            // Email
    passwordHash: string | null;     // PasswordHash (if local auth)
    isActive: boolean;               // IsActive
    createdAt: ISODateTimeString;    // CreatedAt
    lastLogin: ISODateTimeString | null; // LastLogin
}

export interface Role {
    roleId: number;                  // Role_Id
    roleName: RoleName;              // RoleName
    description: string | null;      // Description
}

export interface UserRole {
    userRoleId: number;              // UserRole_Id
    userId: number;                  // User_Id FK
    roleId: number;                  // Role_Id FK
}

/* ============================================
   CORE SCHEMA TYPES
   ============================================ */

export interface CratingJob {
    jobId: number;                   // Job_Id
    serialNumber: string;            // SerialNumber
    model: string | null;            // Model

    workcellId: number;              // Workcell_Id FK
    vendorId: number | null;         // Vendor_Id FK (nullable)
    areaId: number | null;           // Area_Id FK (nullable)

    status: CratingJobStatus;        // Status

    startTime: ISODateTimeString | null; // StartTime
    endTime: ISODateTimeString | null;   // EndTime

    createdBy: string | null;        // CreatedBy (username)
    createdAt: ISODateTimeString;    // CreatedAt
}

export interface Booking {
    bookingId: number;               // Booking_Id
    jobId: number | null;            // Job_Id FK (nullable)
    areaId: number;                  // Area_Id FK

    startDateTime: ISODateTimeString; // StartDateTime
    endDateTime: ISODateTimeString;   // EndDateTime

    status: BookingStatus;           // Status

    createdBy: string | null;        // CreatedBy
    createdAt: ISODateTimeString;    // CreatedAt
}

export interface CratingJobStage {
    stageId: number;                 // Stage_Id
    jobId: number;                   // Job_Id FK
    stageName: CratingJobStageName;  // StageName
    startedAt: ISODateTimeString;    // StartedAt
    endedAt: ISODateTimeString | null; // EndedAt
    pic: string | null;              // PIC (username or name)
    remarks: string | null;          // Remarks
}

/* ============================================
   OPS SCHEMA TYPES
   ============================================ */

export interface ActivityLog {
    activityId: number;              // Activity_Id
    entityType: ActivityEntityType;  // EntityType
    entityId: number;                // EntityId
    action: string;                  // Action (Created, Updated, StatusChange, etc)
    oldValue: string | null;         // OldValue (JSON string)
    newValue: string | null;         // NewValue (JSON string)
    userId: string | null;           // UserID (username)
    timestamp: ISODateTimeString;    // Timestamp
}
