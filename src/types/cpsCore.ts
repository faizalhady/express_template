// src/types/cpsCore.ts

// Helper for date strings from DB
export type ISODateTimeString = string;

/* ============================================
   ENUMS - mirror your SQL CHECK constraints
   ============================================ */

export type AreaStatus =
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
    | "CratingComplete"
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
    | "Booked"
    | "WaitingConfirmation"
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

export type BookingSwapType =
    | "SwapSlots"                 // both parties swap slots
    | "GiveSlot_CancelReceiver"   // receiver gives slot, then cancels own booking
    | "GiveSlot_RescheduleReceiver"; // receiver gives slot, then moves to new slot

export type BookingSwapReqStatus =
    | "Pending"   // waiting for receiver to approve or reject
    | "Approved"  // receiver approved, swap already executed
    | "Rejected"  // receiver rejected
    | "Expired";  // auto expired (no response within time limit)


export type RoleName = "Admin" | "SuperAdmin" | "User" | "Vendor" | "Viewer";

export type AreaType = "Crating" | "Holding";

/* ============================================
   REF SCHEMA TYPES
   ============================================ */

export interface Plant {
    plantId: number;                 // Plant_Id
    plantName: string;               // PlantName
    location: string | null;         // Location
    createdAt: ISODateTimeString;    // CreatedAt
}

export interface Area {
    areaId: number
    plantId: number
    areaName: string
    status: AreaStatus
    areaType: AreaType
    updatedAt: ISODateTimeString
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

    createdBy: string | null;        // CreatedBy (username or NTID)
    createdAt: ISODateTimeString;    // CreatedAt

    // New: extra DB columns
    replacedByBookingId: number | null; // ReplacedBy_Booking_Id
    createdByUserId: number | null;     // CreatedBy_User_Id (FK to auth.User)
}


export interface BookingSwap {
    bookingSwapId: number;        // BookingSwap_Id
    fromBookingId: number;        // From_Booking_Id
    toBookingId: number;          // To_Booking_Id

    swapType: BookingSwapType;    // SwapType

    fromOldAreaId: number;        // From_OldArea_Id
    fromOldStart: ISODateTimeString;
    fromOldEnd: ISODateTimeString;

    fromNewAreaId: number;        // From_NewArea_Id
    fromNewStart: ISODateTimeString;
    fromNewEnd: ISODateTimeString;

    toOldAreaId: number | null;   // To_OldArea_Id
    toOldStart: ISODateTimeString | null;
    toOldEnd: ISODateTimeString | null;

    toNewAreaId: number;          // To_NewArea_Id
    toNewStart: ISODateTimeString;
    toNewEnd: ISODateTimeString;

    reason: string | null;        // Reason
    performedBy: string | null;   // PerformedBy
    performedAt: ISODateTimeString; // PerformedAt
}

// export interface BookingSwapReq {
//     bookingSwapReqId: number;            // BookingSwapReq_Id
//     fromBookingId: number | null;        // From_Booking_Id (nullable)
//     toBookingId: number;                 // To_Booking_Id

//     // Who initiated the request
//     requestedByUserId: number;           // RequestedBy_User_Id

//     // Time windows
//     requestedAt: ISODateTimeString;      // RequestedAt
//     expiresAt: ISODateTimeString;        // ExpiresAt

//     // Lifecycle of the request
//     status: BookingSwapReqStatus;        // Status: Pending, Approved, Rejected, Expired

//     // Decision info (nullable until resolved)
//     decisionByUserId: number | null;     // DecisionBy_User_Id
//     decisionAt: ISODateTimeString | null;// DecisionAt
//     decisionReason: string | null;       // DecisionReason

//     // Link to the executed swap history row, if approved
//     linkedBookingSwapId: number | null;  // Linked_BookingSwap_Id
// }


export interface BookingSwapReq {
    bookingSwapReqId: number;              // BookingSwapReq_Id
    fromBookingId: number | null;          // From_Booking_Id (nullable for "new booking" scenario, future)
    toBookingId: number;                   // To_Booking_Id

    requestedType: BookingSwapType;        // RequestedType (currently just defaulted, decision is at approval time)
    requestedByUserId: number;             // RequestedBy_User_Id
    requestedAt: ISODateTimeString;        // RequestedAt
    expiresAt: ISODateTimeString;          // ExpiresAt

    status: BookingSwapReqStatus;          // Status

    decisionByUserId: number | null;       // DecisionBy_User_Id
    decisionAt: ISODateTimeString | null;  // DecisionAt
    decisionReason: string | null;         // DecisionReason

    receiverNewSlotAreaId: number | null;        // Receiver_NewSlot_AreaId
    receiverNewSlotStart: ISODateTimeString | null; // Receiver_NewSlot_Start
    receiverNewSlotEnd: ISODateTimeString | null;   // Receiver_NewSlot_End

    linkedBookingSwapId: number | null;    // Linked_BookingSwap_Id (FK to core.BookingSwap)
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
