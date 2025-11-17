Exactly, this is the perfect time to **drive the whole flow with pure SQL** and see if the design really works.

Let’s simulate a **full happy-path job** plus a **failed booking**, using only queries.

I'll give you one script you can run **section by section** inside `CPS_Core`.

---

## 🧱 0. Quick check (not required but useful)

Just to remind you what already exists:

```sql
USE CPS_Core;
GO

SELECT * FROM ref.Plant;
SELECT * FROM ref.CratingArea;
SELECT * FROM ref.Workcell;
SELECT * FROM ref.Vendor;
SELECT * FROM auth.[User];
```

I’ll assume:

* `Workcell_Id = 1` → ADVANTEST
* `Vendor_Id   = 1` → AZ Crating Sdn Bhd
* `Area_Id     = 1` → CRATING AREA A
* `Username    = 'faiz'` exists

If IDs differ, just adjust the numbers in the inserts.

---

## ✅ 1. Create one Crating Job (Booked)

This is your main job row.

```sql
USE CPS_Core;
GO

-- Create one job for ADVANTEST in CRATING AREA A, handled by AZ Crating
INSERT INTO core.CratingJob (
    SerialNumber,
    Model,
    Workcell_Id,
    Vendor_Id,
    Area_Id,
    Status,
    StartTime,
    EndTime,
    CreatedBy
)
VALUES (
    'SN-ADV-0001',       -- SerialNumber
    'ADVANTEST-MODEL-X', -- Model
    1,                   -- Workcell_Id = ADVANTEST
    1,                   -- Vendor_Id   = AZ Crating Sdn Bhd
    1,                   -- Area_Id     = CRATING AREA A
    'Booked',            -- must match CK_CratingJob_Status
    NULL,
    NULL,
    'faiz'               -- CreatedBy username
);

-- Capture the new Job_Id
DECLARE @Job_Id INT = SCOPE_IDENTITY();

SELECT @Job_Id AS NewJobId;

-- See the job
SELECT * FROM core.CratingJob WHERE Job_Id = @Job_Id;
```

You should see your Job row with `Status = 'Booked'`.

---

## ✅ 2. Create Booking for that job (Pending → will need confirm)

```sql
-- Create a booking for CRATING AREA A, linked to this job
DECLARE @Job_Id INT = (
    SELECT TOP 1 Job_Id
    FROM core.CratingJob
    WHERE SerialNumber = 'SN-ADV-0001'
    ORDER BY Job_Id DESC
);

INSERT INTO core.Booking (
    Job_Id,
    Area_Id,
    StartDateTime,
    EndDateTime,
    Status,
    CreatedBy
)
VALUES (
    @Job_Id,
    1,                               -- Area_Id = CRATING AREA A
    DATEADD(HOUR, 1, GETDATE()),     -- Start: 1 hour from now
    DATEADD(HOUR, 3, GETDATE()),     -- End:   3 hours from now
    'Pending',                       -- must match CK_Booking_Status
    'faiz'
);

DECLARE @Booking_Id INT = SCOPE_IDENTITY();

SELECT @Booking_Id AS NewBookingId;

SELECT * FROM core.Booking WHERE Booking_Id = @Booking_Id;
```

Now you have:

* 1 job
* 1 booking (Pending)

---

## ✅ 3. Add Job Stages (Timeline history)

We now simulate the timeline in `core.CratingJobStage`.

### Happy path stages:

1. Booking
2. ConfirmationPending
3. Confirmed
4. Calling
5. Crating
6. CratingComplete
7. ReadyForCollection
8. Collected

```sql
DECLARE @Job_Id INT = (
    SELECT TOP 1 Job_Id
    FROM core.CratingJob
    WHERE SerialNumber = 'SN-ADV-0001'
    ORDER BY Job_Id DESC
);

-- Stage 1: Booking
INSERT INTO core.CratingJobStage (Job_Id, StageName, PIC, Remarks)
VALUES (@Job_Id, 'Booking', 'faiz', 'Booking created for ADVANTEST');

-- Stage 2: ConfirmationPending
INSERT INTO core.CratingJobStage (Job_Id, StageName, PIC, Remarks)
VALUES (@Job_Id, 'ConfirmationPending', 'faiz', 'Waiting workcell confirmation');

-- Stage 3: Confirmed
INSERT INTO core.CratingJobStage (Job_Id, StageName, PIC, Remarks)
VALUES (@Job_Id, 'Confirmed', 'faiz', 'Workcell confirmed booking');

-- Stage 4: Calling
INSERT INTO core.CratingJobStage (Job_Id, StageName, PIC, Remarks)
VALUES (@Job_Id, 'Calling', 'faiz', 'Vendor/workcell called to send goods');

-- Stage 5: Crating
INSERT INTO core.CratingJobStage (Job_Id, StageName, PIC, Remarks)
VALUES (@Job_Id, 'Crating', 'rafi', 'Vendor started crating process');

-- Stage 6: CratingComplete
INSERT INTO core.CratingJobStage (Job_Id, StageName, PIC, Remarks)
VALUES (@Job_Id, 'CratingComplete', 'rafi', 'Crating completed, waiting collection');

-- Stage 7: ReadyForCollection
INSERT INTO core.CratingJobStage (Job_Id, StageName, PIC, Remarks)
VALUES (@Job_Id, 'ReadyForCollection', 'rafi', 'Workcell can collect crated goods');

-- Stage 8: Collected
INSERT INTO core.CratingJobStage (Job_Id, StageName, PIC, Remarks)
VALUES (@Job_Id, 'Collected', 'faiz', 'Workcell collected goods');
GO

-- View the timeline for this job
DECLARE @Job_Id_Debug INT = (
    SELECT TOP 1 Job_Id
    FROM core.CratingJob
    WHERE SerialNumber = 'SN-ADV-0001'
    ORDER BY Job_Id DESC
);

SELECT *
FROM core.CratingJobStage
WHERE Job_Id = @Job_Id_Debug
ORDER BY Stage_Id;
```

You’ll see 8 rows representing the full job lifecycle.

---

## ✅ 4. Keep `CratingJob.Status` in sync with stages

As the job moves, you’d normally update `core.CratingJob.Status`.
You can test these transitions manually:

```sql
DECLARE @Job_Id INT = (
    SELECT TOP 1 Job_Id
    FROM core.CratingJob
    WHERE SerialNumber = 'SN-ADV-0001'
    ORDER BY Job_Id DESC
);

-- After confirmation
UPDATE core.CratingJob
SET Status = 'Confirmed'
WHERE Job_Id = @Job_Id;

-- When vendor is called
UPDATE core.CratingJob
SET Status = 'Calling'
WHERE Job_Id = @Job_Id;

-- When crating started
UPDATE core.CratingJob
SET Status = 'Crating'
WHERE Job_Id = @Job_Id;

-- When crating completed
UPDATE core.CratingJob
SET Status = 'Crated'
WHERE Job_Id = @Job_Id;

-- When ready for collection
UPDATE core.CratingJob
SET Status = 'ReadyForCollection'
WHERE Job_Id = @Job_Id;

-- When collected
UPDATE core.CratingJob
SET Status = 'Collected'
WHERE Job_Id = @Job_Id;

SELECT * FROM core.CratingJob WHERE Job_Id = @Job_Id;
```

You can run these one by one to “step through” the flow.

---

## ✅ 5. Move Booking through its lifecycle

### Booking flow you described:

* `Pending` → must be **Confirmed**
* If never confirmed → `Cancelled` or `Expired`
* If used and job done → `Completed`

For the booking we created earlier:

```sql
DECLARE @Booking_Id INT = (
    SELECT TOP 1 Booking_Id
    FROM core.Booking
    ORDER BY Booking_Id DESC
);

-- Confirm the booking
UPDATE core.Booking
SET Status = 'Confirmed'
WHERE Booking_Id = @Booking_Id;

-- When the job is fully done (collected)
UPDATE core.Booking
SET Status = 'Completed'
WHERE Booking_Id = @Booking_Id;

SELECT * FROM core.Booking WHERE Booking_Id = @Booking_Id;
```

---

## ✅ 6. Simulate a “failed” booking (never confirmed → Cancelled)

This tests another branch of your logic.

```sql
-- Create a second booking for CRATING AREA B, but do NOT confirm it
INSERT INTO core.Booking (
    Job_Id,
    Area_Id,
    StartDateTime,
    EndDateTime,
    Status,
    CreatedBy
)
VALUES (
    NULL,                           -- no job linked yet
    2,                              -- CRATING AREA B
    DATEADD(DAY, 1, GETDATE()),     -- tomorrow
    DATEADD(DAY, 1, DATEADD(HOUR, 2, GETDATE())),
    'Pending',
    'faiz'
);

DECLARE @Booking_Id2 INT = SCOPE_IDENTITY();

-- Later: booking never confirmed, auto-cancel it
UPDATE core.Booking
SET Status = 'Cancelled'
WHERE Booking_Id = @Booking_Id2;

SELECT * FROM core.Booking WHERE Booking_Id = @Booking_Id2;
```

Now you have tested:

* **Happy path**: Pending → Confirmed → Completed
* **Failed path**: Pending → Cancelled

Both pass your enum constraints and FK relationships if the design is correct.

---

## ✅ 7. A few useful SELECTs to “visualize” the flow

### 7.1 Job with its Workcell, Vendor, Area

```sql
SELECT
    j.Job_Id,
    j.SerialNumber,
    j.Status,
    wc.WorkcellName,
    v.VendorName,
    a.AreaName,
    j.CreatedBy,
    j.CreatedAt
FROM core.CratingJob j
LEFT JOIN ref.Workcell   wc ON j.Workcell_Id = wc.Workcell_Id
LEFT JOIN ref.Vendor     v  ON j.Vendor_Id   = v.Vendor_Id
LEFT JOIN ref.CratingArea a ON j.Area_Id     = a.Area_Id;
```

### 7.2 Timeline for a job

```sql
DECLARE @Job_Id INT = (
    SELECT TOP 1 Job_Id
    FROM core.CratingJob
    WHERE SerialNumber = 'SN-ADV-0001'
    ORDER BY Job_Id DESC
);

SELECT Stage_Id, StageName, StartedAt, EndedAt, PIC, Remarks
FROM core.CratingJobStage
WHERE Job_Id = @Job_Id
ORDER BY Stage_Id;
```

### 7.3 All bookings per area

```sql
SELECT 
    b.Booking_Id,
    b.Status,
    b.StartDateTime,
    b.EndDateTime,
    a.AreaName,
    j.SerialNumber,
    j.Status AS JobStatus
FROM core.Booking b
LEFT JOIN ref.CratingArea a ON b.Area_Id = a.Area_Id
LEFT JOIN core.CratingJob j ON b.Job_Id  = j.Job_Id
ORDER BY a.AreaName, b.StartDateTime;
```

---

If all of these inserts and updates work **without errors**, and the SELECTs show what you expect, that means:

* FKs are correct
* Enums are correct
* The flow you imagined (booking + confirmation + crating + collection) fits your schema nicely

From here, the next step would be to turn this flow into:

* API endpoints (Node/Express), and
* Socket.IO events for real-time updates.

We can do that next once you’re happy that the SQL simulation feels right.
