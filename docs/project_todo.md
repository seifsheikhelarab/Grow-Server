# Grow Server - Project To-Do List

## Phase 1: Foundation & Configuration
- [ ] **Project Setup**
    - [ ] Initialize Node.js project (package.json).
    - [ ] Install dependencies (express, mongoose, dotenv, cors, helmet, morgan).
    - [ ] Install dev dependencies (typescript, ts-node, nodemon, @types/*).
    - [ ] Configure `tsconfig.json`.
    - [ ] Create `.env` file structure.
- [ ] **Database Connection**
    - [ ] Create `src/config/database.ts` to connect to MongoDB.
    - [ ] Handle connection errors and events.
- [ ] **Server Structure**
    - [ ] Create `src/app.ts` (Express app setup, middlewares).
    - [ ] Create `src/server.ts` (Entry point, server listen).

## Phase 2: Core Models (Mongoose Schemas)
- [ ] **User Model** (`src/models/user.model.ts`)
    - [ ] Define schema with fields: phone, password, name, points, isVerified.
- [ ] **Owner Model** (`src/models/owner.model.ts`)
    - [ ] Define schema: phone, password, name, isApproved.
- [ ] **Kiosk Model** (`src/models/kiosk.model.ts`)
    - [ ] Define schema: owner, name, type, location, dues.
- [ ] **Worker Model** (`src/models/worker.model.ts`)
    - [ ] Define schema: phone, name, kiosk, owner, pointsEarned.
- [ ] **Transaction Model** (`src/models/transaction.model.ts`)
    - [ ] Define schema: sender, kiosk, customerPhone, amount, fee.
- [ ] **Commission Model** (`src/models/commission.model.ts`)
    - [ ] Define schema: transactionId, beneficiary, amount.
- [ ] **Due Model** (`src/models/due.model.ts`)
    - [ ] Define schema: kioskId, amount, status.
- [ ] **Redemption Model** (`src/models/redemption.model.ts`)
    - [ ] Define schema: requester, amount, method, status.
- [ ] **Goal Model** (`src/models/goal.model.ts`)
    - [ ] Define schema: userId, title, targetAmount, currentAmount.

## Phase 3: Authentication & Authorization
- [ ] **Auth Middleware**
    - [ ] Implement `src/middlewares/auth.middleware.ts` (JWT verification).
    - [ ] Create role-based guards (e.g., `requireAdmin`, `requireOwner`).
- [ ] **Auth Controller** (`src/controllers/auth.controller.ts`)
    - [ ] Implement `registerCustomer`.
    - [ ] Implement `registerOwner`.
    - [ ] Implement `login` (Handle different user types).

## Phase 4: Core Features Implementation
- [ ] **Kiosk Management** (Owner Side)
    - [ ] Create Kiosk endpoint.
    - [ ] Invite Worker endpoint.
- [ ] **Points Engine** (Worker/Owner Side)
    - [ ] Implement `sendPoints` logic in `transaction.controller.ts`.
    - [ ] **Critical**: Implement atomic transactions (Mongoose Sessions) to ensure data integrity across Transaction, Customer, Commission, and Due collections.
    - [ ] Implement daily limit checks.
- [ ] **Commission Engine**
    - [ ] Logic to credit 5 points to sender.
- [ ] **Dues Engine**
    - [ ] Logic to record dues for the kiosk.

## Phase 5: Customer Features
- [ ] **Dashboard Data**
    - [ ] Endpoint to get balance and recent transactions.
- [ ] **Goals**
    - [ ] CRUD for savings goals.
- [ ] **Redemption**
    - [ ] Endpoint to request redemption.
    - [ ] Logic to hold points/deduct balance.

## Phase 6: Admin Dashboard
- [ ] **Analytics Endpoints**
    - [ ] Aggregation pipelines for Global Performance Graph.
- [ ] **Management Endpoints**
    - [ ] Approve Owner.
    - [ ] Approve/Reject Redemptions.
    - [ ] Mark Dues as Paid.

## Phase 7: Security & Validation
- [ ] **Input Validation**
    - [ ] Create validation schemas (Joi/Zod) for all request bodies.
- [ ] **Security Headers**
    - [ ] Configure Helmet.
- [ ] **Rate Limiting**
    - [ ] Configure express-rate-limit.

## Phase 8: Testing & Documentation
- [ ] **Unit Tests**
    - [ ] Test critical business logic (Points Engine).
- [ ] **API Documentation**
    - [ ] Setup Swagger/OpenAPI.
