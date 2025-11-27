import type {
    Booking,
    BookingSwap,
    BookingSwapReq,
    BookingSwapReqStatus,
    BookingSwapType,
    ISODateTimeString,
} from "./cpsCoreTypes";

/**
 * Requester already has a booking (Type A).
 * This matches DB fields:
 * - From_Booking_Id
 * - To_Booking_Id
 * - RequestedBy_User_Id
 * - SwapType
 */
export interface CreateSwapRequestInput {
    fromBookingId: number;
    toBookingId: number;
    requestedByUserId: number;
    expiresInMinutes: number;
    swapType: BookingSwapType;         // REQUIRED (DB column: SwapType)
}

/**
 * Receiver approves a request.
 * Matches DB:
 * - DecisionType
 * - ReceiverNewArea_Id
 * - ReceiverNewStart
 * - ReceiverNewEnd
 */
export interface ApproveSwapRequestInput {
    swapReqId: number;
    approverUserId: number;

    decisionType: BookingSwapType;

    receiverNewAreaId?: number;
    receiverNewStart?: ISODateTimeString;
    receiverNewEnd?: ISODateTimeString;

    decisionReason?: string | null;
}

/**
 * Receiver rejects the request.
 * Maps to DB column DecisionReason.
 */
export interface RejectSwapRequestInput {
    swapReqId: number;
    approverUserId: number;
    reason?: string | null;
}

/**
 * Filtering swap requests for inbox or UI listing.
 */
export interface ListSwapRequestsFilter {
    role?: "requester" | "receiver";
    userId: number;
    status?: BookingSwapReqStatus | "All";
    fromDate?: ISODateTimeString | null;
    toDate?: ISODateTimeString | null;
}

/**
 * View model for booking swap requests.
 * Raw DB => BookingSwapReq is already correct.
 */
export interface BookingSwapRequestView {
    request: BookingSwapReq;

    fromBooking: Booking | null;
    toBooking: Booking;

    fromAreaName?: string | null;
    toAreaName?: string | null;
    requesterName?: string | null;
    receiverName?: string | null;
}

/**
 * View model for swap history rows.
 */
export interface BookingSwapHistoryView {
    swap: BookingSwap;

    fromBooking: Booking | null;
    toBooking: Booking;

    fromAreaName?: string | null;
    toAreaName?: string | null;
    performedByName?: string | null;
}
