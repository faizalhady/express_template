/* ============================================
   OPTIONAL: create database CPS_Core
   ============================================ */
-- CREATE DATABASE CPS_Core;
-- GO
-- USE CPS_Core;
-- GO

/* ============================================
   SCHEMAS
   ============================================ */
-- CREATE SCHEMA ref;
-- GO

-- CREATE SCHEMA core;
-- GO

-- CREATE SCHEMA ops;
-- GO

-- CREATE SCHEMA auth;
-- GO

/* ============================================
   REFERENCE TABLES (ref.*)
   ============================================ */

-- 1) Plants
CREATE TABLE ref.Plant (
    Plant_Id    INT IDENTITY(1,1) PRIMARY KEY,
    PlantName   VARCHAR(150) NOT NULL,
    Location    VARCHAR(150) NULL,
    CreatedAt   DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- 2) Crating Areas (per plant)
CREATE TABLE ref.CratingArea (
    Area_Id     INT IDENTITY(1,1) PRIMARY KEY,
    Plant_Id    INT NOT NULL,
    AreaName    VARCHAR(50) NOT NULL UNIQUE,
    Status      VARCHAR(30) NOT NULL DEFAULT 'Idle',   -- Idle, Occupied, Calling, Maintenance
    UpdatedAt   DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_CratingArea_Plant
        FOREIGN KEY (Plant_Id)
        REFERENCES ref.Plant(Plant_Id)
        ON DELETE CASCADE
);
GO

-- 3) Vendors
CREATE TABLE ref.Vendor (
    Vendor_Id    INT IDENTITY(1,1) PRIMARY KEY,
    VendorName   VARCHAR(100) NOT NULL,
    ContactName  VARCHAR(100) NULL,
    ContactPhone VARCHAR(50)  NULL,
    IsActive     BIT NOT NULL DEFAULT 1,
    CreatedAt    DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- 4) Workcells (customers)
CREATE TABLE ref.Workcell (
    Workcell_Id   INT IDENTITY(1,1) PRIMARY KEY,
    WorkcellName  VARCHAR(150) NOT NULL,
    Division      VARCHAR(150) NULL,
    IsActive      BIT NOT NULL DEFAULT 1,
    CreatedAt     DATETIME NOT NULL DEFAULT GETDATE()
);
GO

/* ============================================
   AUTH TABLES (auth.*) - users and roles
   ============================================ */

-- 5) Users
CREATE TABLE auth.[User] (
    User_Id      INT IDENTITY(1,1) PRIMARY KEY,
    Username     VARCHAR(100) NOT NULL UNIQUE,
    FullName     VARCHAR(200) NULL,
    Email        VARCHAR(200) NULL,
    PasswordHash VARCHAR(500) NULL,   -- optional if using SSO/AD
    IsActive     BIT NOT NULL DEFAULT 1,
    CreatedAt    DATETIME NOT NULL DEFAULT GETDATE(),
    LastLogin    DATETIME NULL
);
GO

-- 6) Roles
CREATE TABLE auth.Role (
    Role_Id     INT IDENTITY(1,1) PRIMARY KEY,
    RoleName    VARCHAR(50) NOT NULL UNIQUE,  -- Admin, Operator, Vendor, Viewer, etc
    Description VARCHAR(250) NULL
);
GO

-- 7) User ↔ Role mapping (many to many)
CREATE TABLE auth.UserRole (
    UserRole_Id INT IDENTITY(1,1) PRIMARY KEY,
    User_Id     INT NOT NULL,
    Role_Id     INT NOT NULL,

    CONSTRAINT FK_UserRole_User
        FOREIGN KEY (User_Id)
        REFERENCES auth.[User](User_Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_UserRole_Role
        FOREIGN KEY (Role_Id)
        REFERENCES auth.Role(Role_Id)
        ON DELETE CASCADE
);
GO

/* ============================================
   CORE TABLES (core.*)
   ============================================ */

-- 8) Crating Job (one row per job)
CREATE TABLE core.CratingJob (
    Job_Id       INT IDENTITY(1,1) PRIMARY KEY,
    SerialNumber VARCHAR(150) NOT NULL,
    Model        VARCHAR(150) NULL,

    Workcell_Id  INT NOT NULL,
    Vendor_Id    INT NULL,
    Area_Id      INT NULL,

    Status       VARCHAR(50) NOT NULL DEFAULT 'Booked',
    -- Booked, WaitingConfirmation, Confirmed, Calling,
    -- Crating, Crated, ReadyForCollection, Collected,
    -- Cancelled, Expired

    StartTime    DATETIME NULL,
    EndTime      DATETIME NULL,

    CreatedBy    VARCHAR(100) NULL,   -- store username (no FK)
    CreatedAt    DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_CratingJob_Workcell
        FOREIGN KEY (Workcell_Id)
        REFERENCES ref.Workcell(Workcell_Id)
        ON DELETE CASCADE,

    CONSTRAINT FK_CratingJob_Vendor
        FOREIGN KEY (Vendor_Id)
        REFERENCES ref.Vendor(Vendor_Id)
        ON DELETE SET NULL,

    CONSTRAINT FK_CratingJob_Area
        FOREIGN KEY (Area_Id)
        REFERENCES ref.CratingArea(Area_Id)
        ON DELETE SET NULL
);
GO

-- 9) Booking (calendar slots per area, optional link to job)
CREATE TABLE core.Booking (
    Booking_Id     INT IDENTITY(1,1) PRIMARY KEY,
    Job_Id         INT NULL,
    Area_Id        INT NOT NULL,
    StartDateTime  DATETIME NOT NULL,
    EndDateTime    DATETIME NOT NULL,
    Status         VARCHAR(30) NOT NULL DEFAULT 'Active',
    -- Active, Cancelled, Expired, Completed

    CreatedBy      VARCHAR(100) NULL,   -- username
    CreatedAt      DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Booking_Job
        FOREIGN KEY (Job_Id)
        REFERENCES core.CratingJob(Job_Id)
        ON DELETE SET NULL,

    CONSTRAINT FK_Booking_Area
        FOREIGN KEY (Area_Id)
        REFERENCES ref.CratingArea(Area_Id)
        ON DELETE CASCADE
);
GO

-- 10) CratingJobStage (workflow history per job)
CREATE TABLE core.CratingJobStage (
    Stage_Id   INT IDENTITY(1,1) PRIMARY KEY,
    Job_Id     INT NOT NULL,
    StageName  VARCHAR(50) NOT NULL,
    -- Booking, ConfirmationPending, Confirmed, Calling,
    -- Crating, CratingComplete, ReadyForCollection,
    -- Collected, Cancelled, Expired

    StartedAt  DATETIME NOT NULL DEFAULT GETDATE(),
    EndedAt    DATETIME NULL,
    PIC        VARCHAR(100) NULL,      -- person in charge (username or name)
    Remarks    VARCHAR(500) NULL,

    CONSTRAINT FK_CratingJobStage_Job
        FOREIGN KEY (Job_Id)
        REFERENCES core.CratingJob(Job_Id)
        ON DELETE CASCADE
);
GO

/* ============================================
   OPS TABLE (ops.*) - application audit log
   ============================================ */

-- 11) ActivityLog (audit trail of actions)
CREATE TABLE ops.ActivityLog (
    Activity_Id INT IDENTITY(1,1) PRIMARY KEY,
    EntityType  VARCHAR(50) NOT NULL,   -- Job, Booking, Area, Vendor, Workcell, etc
    EntityId    INT NOT NULL,           -- Id from the corresponding table
    Action      VARCHAR(100) NOT NULL,  -- Created, Updated, StatusChange, etc
    OldValue    NVARCHAR(MAX) NULL,
    NewValue    NVARCHAR(MAX) NULL,
    UserID      VARCHAR(100) NULL,      -- username that performed the action
    Timestamp   DATETIME NOT NULL DEFAULT GETDATE()
);
GO

/* ============================================
   OPTIONAL INDEXES
   ============================================ */

-- Core lookup indexes
CREATE INDEX IX_CratingJob_Workcell
    ON core.CratingJob (Workcell_Id);

CREATE INDEX IX_CratingJob_Area
    ON core.CratingJob (Area_Id);

CREATE INDEX IX_Booking_Area
    ON core.Booking (Area_Id, StartDateTime);

CREATE INDEX IX_CratingJobStage_Job
    ON core.CratingJobStage (Job_Id, StageName, StartedAt);

CREATE INDEX IX_ActivityLog_Entity
    ON ops.ActivityLog (EntityType, EntityId, Timestamp);
GO
