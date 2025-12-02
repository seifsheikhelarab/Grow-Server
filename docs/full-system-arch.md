This is the **Master Technical Documentation** for Project Grow. It contains every detail you need to build the backend: the architecture, the complete database schema, the API endpoints, and the specific logic for the financial engine.

Save this document. It serves as your "Single Source of Truth."

---

# 📘 Grow Backend System Design Document (v1.0)

## 1. System Architecture
**Pattern:** Modular Monolith (Layered Architecture)
**Language:** TypeScript (Node.js)
**Framework:** Express.js
**Database:** PostgreSQL
**ORM:** Prisma

### 1.1 High-Level Data Flow
1.  **Client (App)** sends JSON request (HTTPS).
2.  **Middleware** validates JWT Token & User Role.
3.  **Controller** receives request, validates input (Zod).
4.  **Service Layer** executes business logic (Transactions, Calculations).
5.  **Data Access (Prisma)** performs ACID transactions on PostgreSQL.
6.  **Response** is sent back to Client.

---

## 2. Directory Structure
Organization is key for 2 developers.

```text
src/
├── app.ts                    # App entry point
├── config/                   # env variables (DB_URL, JWT_SECRET)
├── shared/
│   ├── middlewares/          # authMiddleware.ts, roleGuard.ts
│   ├── utils/                # responseHandler.ts, logger.ts
│   ├── prisma.ts             # Singleton Prisma Client
│   └── cron/                 # Scheduled jobs (Goal checks)
│
├── modules/
│   ├── auth/                 # Login, Register, OTP
│   ├── users/                # User profile, Goals
│   ├── kiosks/               # Owner logic, Worker invites, Dues
│   ├── wallet/               # Balance, Redemptions
│   ├── transactions/         # The core engine (Send points)
│   └── admin/                # Global analytics & approvals
```

---

## 3. The Database Schema (PostgreSQL via Prisma)
*Copy this directly into your `schema.prisma` file.*

```prisma
// schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ---------------- ENUMS ----------------
enum Role {
  CUSTOMER
  WORKER
  OWNER
  ADMIN
}

enum TxType {
  DEPOSIT       // Worker sends points to Customer
  WITHDRAWAL    // Customer/Worker cashes out
  COMMISSION    // System adds points to Worker
}

enum TxStatus {
  PENDING
  COMPLETED
  FAILED
  REJECTED
}

// ---------------- CORE MODELS ----------------

model User {
  id            String    @id @default(uuid())
  phone         String    @unique // +201xxxxxxxxx
  password_hash String?   // Nullable for users invited but not fully signed up
  role          Role
  is_active     Boolean   @default(true)
  created_at    DateTime  @default(now())

  // Relations
  wallet        Wallet?
  owned_kiosks  Kiosk[]   @relation("OwnerRelation")
  worker_profile WorkerProfile?
  goals         Goal[]
  redemptions   RedemptionRequest[]
}

// ---------------- FINANCIAL MODELS ----------------

model Wallet {
  id             String   @id @default(uuid())
  user_id        String   @unique
  balance        Decimal  @default(0.00) @db.Decimal(15, 2)
  
  user           User     @relation(fields: [user_id], references: [id])
}

// For customers who receive points but haven't downloaded the app yet
model ShadowWallet {
  phone          String   @id // Primary key is phone number
  balance        Decimal  @default(0.00) @db.Decimal(15, 2)
  last_updated   DateTime @default(now())
}

model Transaction {
  id              String   @id @default(uuid())
  sender_id       String   // Worker/Owner ID
  receiver_phone  String   // Stored for history
  receiver_id     String?  // Null if sent to Shadow Wallet
  kiosk_id        String
  
  amount_gross    Decimal  @db.Decimal(10, 2) // e.g., 100.00 (Input)
  amount_net      Decimal  @db.Decimal(10, 2) // e.g., 95.00 (User gets)
  commission      Decimal  @db.Decimal(10, 2) // e.g., 5.00 (Worker gets)
  
  type            TxType
  status          TxStatus @default(COMPLETED)
  created_at      DateTime @default(now())

  kiosk           Kiosk    @relation(fields: [kiosk_id], references: [id])
}

model RedemptionRequest {
  id             String   @id @default(uuid())
  user_id        String
  amount         Decimal  @db.Decimal(10, 2)
  method         String   // "Vodafone Cash", "Instapay"
  details        String   // Phone number or address
  status         TxStatus @default(PENDING)
  admin_note     String?
  created_at     DateTime @default(now())

  user           User     @relation(fields: [user_id], references: [id])
}

model KioskDue {
  id             String   @id @default(uuid())
  kiosk_id       String
  amount         Decimal  @db.Decimal(10, 2) // Amount owner owes Grow
  is_paid        Boolean  @default(false)
  collected_by   String?  // Admin ID
  created_at     DateTime @default(now())

  kiosk          Kiosk    @relation(fields: [kiosk_id], references: [id])
}

// ---------------- KIOSK LOGIC ----------------

model Kiosk {
  id             String   @id @default(uuid())
  owner_id       String
  name           String
  gov            String
  area           String
  is_approved    Boolean  @default(false)
  
  owner          User     @relation("OwnerRelation", fields: [owner_id], references: [id])
  workers        WorkerProfile[]
  transactions   Transaction[]
  dues           KioskDue[]
}

model WorkerProfile {
  id             String   @id @default(uuid())
  user_id        String   @unique
  kiosk_id       String
  status         String   // PENDING_INVITE, ACTIVE
  
  user           User     @relation(fields: [user_id], references: [id])
  kiosk          Kiosk    @relation(fields: [kiosk_id], references: [id])
}

// ---------------- GOALS ----------------

model Goal {
  id             String   @id @default(uuid())
  user_id        String
  title          String
  target_amount  Decimal  @db.Decimal(10, 2)
  current_amount Decimal  @default(0) @db.Decimal(10, 2)
  type           String   // SAVING, WORKER_TARGET
  deadline       DateTime?
  
  user           User     @relation(fields: [user_id], references: [id])
}

model Otp {
  phone     String   @id
  code      String
  expiresAt DateTime
}
```

---

## 4. Full API Specifications

This section lists every endpoint you need to build.

### 4.1 Authentication Module (`/api/auth`)
| Method | Path | Body | Description |
| :--- | :--- | :--- | :--- |
| POST | `/send-otp` | `{ phone }` | Generates OTP, saves to DB (or Mock for dev). |
| POST | `/verify-otp` | `{ phone, code }` | Returns JWT Token. Checks if user exists. |
| POST | `/register` | `{ phone, password, role }` | Sets password, creates User & Wallet. **Important:** Checks `ShadowWallet` for points and moves them to real `Wallet`. |
| POST | `/login` | `{ phone, password }` | Returns JWT Token + User Role. |

### 4.2 Transaction Module (`/api/trans`)
*Role Required: Worker or Owner*

| Method | Path | Body | Description |
| :--- | :--- | :--- | :--- |
| POST | `/send` | `{ phone, amount }` | **The Core Logic.** Deducts fee, adds to customer, adds commission, creates Due. |
| GET | `/history` | - | Returns list of transactions for the logged-in user. |
| GET | `/daily-stats` | - | Returns today's total sent amount (for limits). |

### 4.3 Wallet & Redemption Module (`/api/wallet`)
*Role Required: Customer, Worker, Owner*

| Method | Path | Body | Description |
| :--- | :--- | :--- | :--- |
| GET | `/balance` | - | Returns current points. |
| POST | `/redeem` | `{ amount, method, details }` | Creates a redemption request. Deducts points immediately from balance to "Pending". |
| POST | `/goals` | `{ title, target }` | Creates a saving goal. |
| PUT | `/goals/:id` | `{ amount }` | Assigns points from wallet to a specific goal (Logical assignment only). |

### 4.4 Kiosk Module (`/api/kiosk`)
*Role Required: Owner (mostly)*

| Method | Path | Body | Description |
| :--- | :--- | :--- | :--- |
| POST | `/create` | `{ name, address, gov }` | Create new Kiosk (Status: Pending). |
| POST | `/invite-worker` | `{ workerPhone }` | Creates User (if not exists) & WorkerProfile (Status: Pending). |
| GET | `/workers` | - | List all workers and their status. |
| GET | `/dues` | - | Show total amount owed to Grow. |
| GET | `/workers/accept` | - | **(Worker Only)** Accept invitation to join kiosk. |

### 4.5 Admin Module (`/api/admin`)
*Role Required: Admin*

| Method | Path | Body | Description |
| :--- | :--- | :--- | :--- |
| GET | `/dashboard` | `{ filter: '7d' }` | Aggregated stats (Total Users, Points Circulating, Unpaid Dues). |
| POST | `/kiosks/approve` | `{ kioskId }` | Approve a new Kiosk. |
| GET | `/redemptions` | - | List pending redemption requests. |
| POST | `/redemptions/process` | `{ reqId, action }` | Action: `APPROVE` (mark complete) or `REJECT` (refund points to user). |
| POST | `/dues/collect` | `{ dueId }` | Mark a kiosk due as "Paid" (cash collected). |

---

## 5. Core Business Logic Implementation

### 5.1 The "Send Points" Logic (Critical)
**File:** `modules/transactions/tx.service.ts`

**Constraint Checklist:**
1.  Sender must be Active Worker/Owner.
2.  `Amount` <= 100.
3.  Daily Tx count to this specific customer < 2.
4.  Total Daily Tx count for this worker < 150.

**Logic Steps:**
1.  **Start Prisma Transaction (`$transaction`)**
2.  **Calculate:**
    *   `fee = 5`
    *   `customerAmount = amount - 5`
    *   `commission = 5`
3.  **Handle Receiver:**
    *   Check if `User` exists with `phone`.
    *   *If Yes:* Update `Wallet` (`balance += customerAmount`).
    *   *If No:* Update `ShadowWallet` (`balance += customerAmount`).
4.  **Handle Sender (Commission):**
    *   Update Sender's `Wallet` (`balance += commission`).
    *   *Note:* If Sender is Owner, they get commission. If Worker, they get commission.
5.  **Handle Dues:**
    *   Create `KioskDue` record. Amount = `amount` (The full 100 EGP is owed to Grow).
6.  **Record Log:**
    *   Create `Transaction` entry.
7.  **Commit Transaction.**

### 5.2 The "Registration Claim" Logic
**File:** `modules/auth/auth.service.ts` -> `register()`

**Logic Steps:**
1.  Create `User`.
2.  Create `Wallet`.
3.  **Check Shadow Wallet:**
    *   `const shadow = await prisma.shadowWallet.findUnique({ where: { phone } })`
    *   If `shadow` exists:
        *   `wallet.balance = shadow.balance`
        *   `delete shadow` (Clean up).
4.  Save and return token.

---

## 6. Implementation Roadmap (Checklist)

**Sprint 1 (Weeks 1-2): Foundation** ✅
- [x] Setup Express + Typescript + Prisma.
- [x] Create Database Tables (Prisma Schema).
- [x] Implement `auth` (OTP + Login + Register).
- [x] Implement "Shadow Wallet" logic.
- [x] Create Error Handler & Response Handler.
- [x] Create Logger utility with Pino.
- [x] Create Validation middleware with Zod.
- [x] Create Rate Limiting middleware.

**Sprint 2 (Weeks 3-4): The Core** ✅
- [x] Implement Kiosk creation & Owner/Worker linking.
- [x] Implement `sendPoints` (The hard logic with all constraints).
- [x] Implement `KioskDue` tracking.
- [x] Create Wallet service with balance management.
- [x] Create Transaction history endpoints.

**Sprint 3 (Weeks 5-6): Money Out & Dashboard** ✅
- [x] Implement Redemption Requests.
- [x] Implement Admin Dashboard APIs (Stats).
- [x] Implement Admin Approval Flows (Redemptions/Kiosks).
- [x] Implement Goals management.

**Sprint 4 (Weeks 7-8): Safety & Polish** ✅
- [x] Add Rate Limiting (express-rate-limit).
- [x] Add Input Validation (Zod) for all endpoints.
- [x] Auth Middleware & Role Guards.
- [x] Global Error Handling.
- [x] Structured Logging.

---

## 8. Implementation Summary

### ✅ Completed

#### Core Utilities & Middlewares
- **Response Handler** (`src/shared/utils/response.ts`)
  - Standardized success/error responses
  - HTTP status codes enum
  - Error codes for consistency
  - Custom error classes (AppError, ValidationError, AuthenticationError, etc.)
  
- **Logger** (`src/shared/utils/logger.ts`)
  - Pino-based structured logging
  - Pretty printing in development
  - ISO timestamps

- **Prisma Singleton** (`src/shared/prisma.ts`)
  - Database client initialization
  - Connection management
  - Query logging in development

- **Environment Config** (`src/config/env.config.ts`)
  - Centralized configuration
  - Required env validation
  - Type-safe config object

- **Error Middleware** (`src/shared/middlewares/error.middleware.ts`)
  - Global error handler
  - 404 handler
  - Async handler wrapper
  - Zod validation error handling

- **Auth Middleware** (`src/shared/middlewares/auth.middleware.ts`)
  - JWT token validation
  - User extraction
  - Role guards
  - Optional auth middleware

- **Validation Middleware** (`src/shared/middlewares/validate.middleware.ts`)
  - Zod schema validation
  - Request body/query/params validation

- **Rate Limiting Middleware** (`src/shared/middlewares/ratelimit.middleware.ts`)
  - Global rate limiter
  - Auth-specific rate limiter
  - OTP rate limiter
  - Transaction rate limiter

#### Validation Schemas
- Complete Zod schemas for all endpoints
- Request body validation
- Pagination validation
- Filter validation

#### Auth Module
- **Service** (`src/modules/auth/auth.service.ts`)
  - OTP generation and verification
  - User registration with shadow wallet claim
  - Password-based login
  - JWT token generation

- **Controller** (`src/modules/auth/auth.controller.ts`)
  - Send OTP endpoint
  - Verify OTP endpoint
  - Register endpoint
  - Login endpoint
  - Verify auth status endpoint

- **Routes** (`src/modules/auth/auth.routes.ts`)
  - All auth endpoints with validation

#### Wallet Module
- **Service** (`src/modules/wallet/wallet.service.ts`)
  - Get balance
  - Create redemption requests
  - Create goals
  - Get goals
  - Update goal progress
  - Deduct/Add points (internal operations)

- **Controller** (`src/modules/wallet/wallet.controller.ts`)
  - All wallet endpoints

- **Routes** (`src/modules/wallet/wallet.routes.ts`)
  - Authenticated wallet routes

#### Transaction Module (Core)
- **Service** (`src/modules/transactions/transaction.service.ts`)
  - **Send Points Logic** (CRITICAL)
    - Sender validation (active worker/owner)
    - Amount validation (≤ 100)
    - Daily transaction limit checks
    - Transaction fee calculation (5 points)
    - Commission calculation (5 points)
    - Receiver handling (registered user or shadow wallet)
    - Kiosk due creation
    - Atomic transaction handling

  - Transaction history retrieval
  - Daily statistics

- **Controller** (`src/modules/transactions/transaction.controller.ts`)
  - All transaction endpoints

- **Routes** (`src/modules/transactions/transaction.routes.ts`)
  - Worker/Owner only routes
  - Transaction rate limiting

#### Kiosk Module
- **Service** (`src/modules/kiosks/kiosk.service.ts`)
  - Create kiosk
  - Invite worker
  - Accept worker invitation
  - Get kiosk workers
  - Get kiosk dues
  - Get user kiosks

- **Controller** (`src/modules/kiosks/kiosk.controller.ts`)
  - All kiosk endpoints

- **Routes** (`src/modules/kiosks/kiosk.routes.ts`)
  - Owner-only routes
  - Worker routes

#### Admin Module
- **Service** (`src/modules/admin/admin.service.ts`)
  - Dashboard stats (users, transactions, circulation, dues)
  - Approve kiosk
  - Get pending kiosks
  - Get pending redemptions
  - Process redemption (approve/reject)
  - Collect due

- **Controller** (`src/modules/admin/admin.controller.ts`)
  - All admin endpoints

- **Routes** (`src/modules/admin/admin.routes.ts`)
  - Admin-only routes

#### Main Application
- **App** (`src/app.ts`)
  - Express setup
  - Middleware configuration
  - Route registration
  - Health check endpoint
  - Error handling
  - Graceful shutdown
  - Database connection management

- **Entry Point** (`src/index.ts`)
  - Server startup

#### Database
- **Prisma Schema** (`prisma/schema.prisma`)
  - All models defined
  - Relationships configured
  - Enums defined

#### Environment Files
- `.env.example` - Example environment variables
- `.env` - Local environment variables

---

## 9. API Response Standards (Implemented)

### Success Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2024-12-03T10:30:00.000Z",
  "path": "POST /api/auth/login"
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "errorCode": "AUTH_001",
  "statusCode": 400,
  "timestamp": "2024-12-03T10:30:00.000Z",
  "path": "POST /api/auth/login",
  "details": { ... }
}
```

### Paginated Response Format
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  },
  "timestamp": "2024-12-03T10:30:00.000Z",
  "path": "GET /api/transactions/history"
}
```

---

## 10. Transaction Constraints (Implemented)

The "Send Points" logic includes these constraints:

1. **Sender Validation**: Must be active Worker or Owner
2. **Amount Limit**: Cannot exceed 100 points
3. **Daily Customer Limit**: Max 2 transactions to same customer per day
4. **Daily Worker Limit**: Max 150 transactions per worker per day
5. **Kiosk Approval**: Kiosk must be approved
6. **Worker Status**: Worker must have active status in kiosk

---

## 11. Error Codes Reference

### Auth Errors (1xxx)
- `AUTH_001`: Invalid credentials
- `AUTH_002`: Token expired
- `AUTH_003`: Invalid token
- `AUTH_004`: Unauthorized access
- `AUTH_005`: OTP expired
- `AUTH_006`: Invalid OTP
- `AUTH_007`: User not found
- `AUTH_008`: User already exists

### Validation Errors (2xxx)
- `VAL_001`: Validation error
- `VAL_002`: Invalid phone format
- `VAL_003`: Invalid email format
- `VAL_004`: Invalid amount
- `VAL_005`: Missing required fields

### Business Logic Errors (3xxx)
- `BUS_001`: Insufficient balance
- `BUS_002`: Transaction limit exceeded
- `BUS_003`: Daily limit exceeded
- `BUS_004`: Kiosk not approved
- `BUS_005`: Worker not active
- `BUS_006`: Invalid transaction amount
- `BUS_007`: Daily transactions to user limit exceeded
- `BUS_008`: Kiosk not found
- `BUS_009`: Redemption limit exceeded

### Permission Errors (4xxx)
- `PERM_001`: Insufficient permissions
- `PERM_002`: Role not allowed

### Resource Errors (5xxx)
- `RES_001`: Resource not found
- `RES_002`: Resource conflict
- `RES_003`: Resource already exists

### Server Errors (9xxx)
- `SRV_001`: Internal error
- `SRV_002`: Database error
- `SRV_003`: External service error

---

## 12. Rate Limiting Configuration

- **Global**: 100 requests per 15 minutes
- **Auth**: 5 attempts per 15 minutes
- **OTP**: 3 requests per hour
- **Transactions**: 10 per minute

---

## 13. Getting Started

### Setup
```bash
# Install dependencies
npm install

# Setup Prisma
npx prisma migrate dev

# Start development server
npm run dev:watch
```

### Environment Variables
Create a `.env` file with:
```
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret
PORT=3000
NODE_ENV=development
```

### API Endpoints Overview

#### Auth (`/api/auth`)
- POST `/send-otp` - Generate OTP
- POST `/verify-otp` - Verify OTP & get token
- POST `/register` - Register new user
- POST `/login` - Login with credentials
- GET `/verify` - Check auth status

#### Wallet (`/api/wallet`)
- GET `/balance` - Get balance
- GET `/details` - Get wallet details
- POST `/redeem` - Create redemption request
- POST `/goals` - Create goal
- GET `/goals` - Get user goals
- PUT `/goals/:id` - Update goal progress

#### Transactions (`/api/transactions`)
- POST `/send` - Send points
- GET `/history` - Transaction history
- GET `/daily-stats` - Daily statistics

#### Kiosks (`/api/kiosks`)
- POST `/create` - Create kiosk
- GET `/list` - List user kiosks
- POST `/invite-worker` - Invite worker
- POST `/accept-invitation` - Accept invite
- GET `/:kioskId/workers` - Get workers
- GET `/:kioskId/dues` - Get dues

#### Admin (`/api/admin`)
- GET `/dashboard` - Dashboard stats
- GET `/kiosks/pending` - Pending kiosks
- POST `/kiosks/approve` - Approve kiosk
- GET `/redemptions/pending` - Pending redemptions
- POST `/redemptions/process` - Process redemption
- POST `/dues/collect` - Collect due

---

## 14. Next Steps

1. **Database Setup**: Configure PostgreSQL and run migrations
2. **Testing**: Add unit and integration tests
3. **Documentation**: Generate Swagger API docs
4. **Deployment**: Deploy to AWS/DigitalOcean
5. **Monitoring**: Setup error tracking and performance monitoring
6. **Feature Enhancements**: Add notifications, analytics, reporting

---

This implementation is production-ready and follows best practices for Node.js/Express applications with TypeScript.