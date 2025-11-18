USE CPS_Core;
GO

/* ============================
   1) PLANTS
   ============================ */
INSERT INTO ref.Plant (PlantName, Location)
VALUES 
  ('Plant 1',    'Penang'),
  ('Plant 2',    'Penang'),
  ('Batu Kawan', 'Penang');


/* ============================
   2) CRATING AREAS
   (assuming Plant_Id = 1,2,3 in order)
   ============================ */
INSERT INTO ref.CratingArea (Plant_Id, AreaName, Status)
VALUES
  (1, 'CRATING AREA A', 'Idle'),
  (1, 'CRATING AREA B', 'Idle'),
  (2, 'CRATING AREA C', 'Maintenance'),
  (2, 'CRATING AREA D', 'Idle');


/* ============================
   3) WORKCELLS (CUSTOMERS)
   ============================ */
INSERT INTO ref.Workcell (WorkcellName, Division, IsActive)
VALUES
  ('ADVANTEST', 'ADVANTEST', 1),
  ('AMAT',      'AMAT',      1);


/* ============================
   4) VENDORS
   ============================ */
INSERT INTO ref.Vendor (VendorName, ContactName, ContactPhone, IsActive)
VALUES
  ('AZ Crating Sdn Bhd',    'Encik Ali', '012-3456789', 1),
  ('FactoryPack Crating',   'Mr. John',  '019-8899777', 1);


/* ============================
   5) AUTH ROLES
   ============================ */
INSERT INTO auth.Role (RoleName, Description)
VALUES
  ('Admin',      'Standard admin with full CPS access'),
  ('SuperAdmin', 'Developer / system-level admin'),
  ('User',       'Internal CPS user'),
  ('Vendor',     'External vendor handling crating work'),
  ('Viewer',     'Read-only dashboard viewer');


/* ============================
   6) AUTH USERS
   ============================ */
INSERT INTO auth.[User] (Username, FullName, Email, IsActive)
VALUES
  ('faiz', 'Faiz CPS',   'faiz@example.com', 1),
  ('rafi', 'Rafi Vendor','rafi@example.com', 1);


/* ============================
   7) USER ↔ ROLE MAPPING
   (assumes:
      faiz = User_Id 1
      rafi = User_Id 2
      roles inserted in order above: 1..5)
   ============================ */

-- Faiz: SuperAdmin + Admin + User
INSERT INTO auth.UserRole (User_Id, Role_Id)
VALUES
  (1, 2),  -- faiz -> SuperAdmin
  (1, 1),  -- faiz -> Admin
  (1, 3);  -- faiz -> User

-- Rafi: Vendor
INSERT INTO auth.UserRole (User_Id, Role_Id)
VALUES
  (2, 4);  -- rafi -> Vendor
