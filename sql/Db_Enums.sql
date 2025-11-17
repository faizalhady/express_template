USE CPS_Core;

GO
/* ============================================
ENUM-LIKE CHECK CONSTRAINTS
============================================ */
-- 1) CratingArea.Status
--    Idle = free, Occupied = in use, Calling = workcell called,
--    Maintenance = temporarily unavailable
ALTER TABLE ref.CratingArea ADD CONSTRAINT CK_CratingArea_Status CHECK (
    Status IN ('Idle', 'Occupied', 'Calling', 'Maintenance')
);

GO
-- 2) CratingJob.Status
--    Main job lifecycle
ALTER TABLE core.CratingJob ADD CONSTRAINT CK_CratingJob_Status CHECK (
    Status IN (
        'Booked',
        'WaitingConfirmation',
        'Confirmed',
        'Calling',
        'Crating',
        'Crated',
        'ReadyForCollection',
        'Collected',
        'Cancelled',
        'Expired'
    )
);

GO
-- 3) Booking.Status
--    Booking must go through confirmation before job uses it
--    Pending     = booking created, waiting for confirm
--    Confirmed   = approved, slot locked
--    Cancelled   = manually cancelled
--    Expired     = auto-invalid (no confirm / no show)
--    Completed   = job finished using this slot
ALTER TABLE core.Booking ADD CONSTRAINT CK_Booking_Status CHECK (
    Status IN (
        'Pending',
        'Confirmed',
        'Cancelled',
        'Expired',
        'Completed'
    )
);

GO
-- 4) CratingJobStage.StageName
--    Workflow history per job
ALTER TABLE core.CratingJobStage ADD CONSTRAINT CK_CratingJobStage_StageName CHECK (
    StageName IN (
        'Booking',
        'ConfirmationPending',
        'Confirmed',
        'Calling',
        'Crating',
        'CratingComplete',
        'ReadyForCollection',
        'Collected',
        'Cancelled',
        'Expired'
    )
);

GO