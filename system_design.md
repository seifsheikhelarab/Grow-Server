# Grow Server - System Design Document

## 1. Architecture Overview
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (using Mongoose ODM) for testing/development, PostgreSQL+Prisma for production
- **Authentication**: JWT (JSON Web Tokens) for session management.
- **Language**: TypeScript

## 2. Database Schema Design

### 2.1 Users (Customers)
- `_id`: ObjectId
- `phone`: String (Unique, Indexed)
- `password`: String (Hashed)
- `name`: String
- `points`: Number (Default: 0)
- `isVerified`: Boolean
- `createdAt`: Date

### 2.2 Owners
- `_id`: ObjectId
- `phone`: String (Unique, Indexed)
- `password`: String (Hashed)
- `name`: String
- `isApproved`: Boolean (Default: false)
- `createdAt`: Date

### 2.3 Kiosks
- `_id`: ObjectId
- `owner`: ObjectId (Ref: Owner)
- `name`: String
- `type`: String
- `location`: String
- `dues`: Number (Total dues pending)
- `createdAt`: Date

### 2.4 Workers
- `_id`: ObjectId
- `phone`: String (Unique, Indexed)
- `name`: String
- `kiosk`: ObjectId (Ref: Kiosk)
- `owner`: ObjectId (Ref: Owner)
- `isActive`: Boolean
- `pointsEarned`: Number (Commission balance)
- `createdAt`: Date

### 2.5 Transactions (Points Transfer)
- `_id`: ObjectId
- `senderType`: String ('Worker' | 'Owner')
- `senderId`: ObjectId (Ref: Worker or Owner)
- `kioskId`: ObjectId (Ref: Kiosk)
- `customerPhone`: String
- `amount`: Number (Points sent)
- `fee`: Number (Fixed: 5)
- `timestamp`: Date

### 2.6 Commissions
- `_id`: ObjectId
- `transactionId`: ObjectId (Ref: Transaction)
- `beneficiaryType`: String ('Worker' | 'Owner')
- `beneficiaryId`: ObjectId
- `amount`: Number (Fixed: 5)
- `timestamp`: Date

### 2.7 Dues
- `_id`: ObjectId
- `kioskId`: ObjectId (Ref: Kiosk)
- `amount`: Number
- `status`: String ('Pending' | 'Paid')
- `transactionId`: ObjectId (Ref: Transaction)
- `timestamp`: Date

### 2.8 Redemption Requests
- `_id`: ObjectId
- `requesterType`: String ('Customer' | 'Worker' | 'Owner')
- `requesterId`: ObjectId
- `amount`: Number
- `method`: String ('Instapay' | 'Wallet' | 'Bank')
- `details`: String (Phone number or Account info)
- `status`: String ('Pending' | 'Approved' | 'Rejected')
- `fee`: Number (Fixed: 5)
- `timestamp`: Date

### 2.9 Goals
- `_id`: ObjectId
- `userId`: ObjectId (Ref: User/Worker)
- `userType`: String
- `title`: String
- `targetAmount`: Number
- `currentAmount`: Number
- `status`: String ('Active' | 'Completed')

## 3. Business Logic Engines

### 3.1 Points Engine
- Handles transfer of points from Kiosk to Customer.
- **Input**: Customer Phone, Amount.
- **Process**:
    1. Validate limits (Max 100/txn, Max 2/day/customer).
    2. Create Transaction record.
    3. Update/Create Customer record (Credit `Amount - 5`).
    4. Trigger Commission Engine.
    5. Trigger Dues Engine.

### 3.2 Commission Engine
- Calculates earnings for the sender.
- **Rule**: 5 points per transaction.
- **Process**:
    1. Identify Sender (Worker or Owner).
    2. Credit 5 points to Sender's earnings wallet.
    3. Log Commission record.

### 3.3 Dues Engine
- Tracks what the Kiosk owes to the platform.
- **Rule**: Due = Full Amount Sent.
- **Process**:
    1. Create Due record linked to Kiosk.
    2. Increment Kiosk's total `dues` field.

### 3.4 Redemption Engine
- Handles cash-out requests.
- **Rules**: Min 30, Fee 5.
- **Process**:
    1. Validate Balance >= Amount + 5.
    2. Deduct (Amount + 5) from User/Worker/Owner balance (hold).
    3. Create Redemption Request (Pending).
    4. Admin manually approves -> Status 'Approved'.
    5. Admin rejects -> Status 'Rejected' -> Refund points.

## 4. API Design (High Level)

### Auth
- `POST /auth/register/customer`
- `POST /auth/register/owner`
- `POST /auth/login` (Generic, returns role)

### Customer
- `GET /customer/me` (Balance, History)
- `POST /customer/goals`
- `POST /customer/redeem`

### Kiosk Management (Owner)
- `POST /owner/kiosks` (Create Kiosk)
- `POST /owner/workers/invite`
- `GET /owner/dashboard` (Stats)

### Worker
- `POST /worker/send-points` (Core Action)
- `GET /worker/history`

### Admin
- `GET /admin/dashboard` (Global Stats)
- `POST /admin/approve-owner`
- `POST /admin/redemptions/:id/approve`
- `POST /admin/dues/:id/mark-paid`

## 5. Security & Fraud
- **Rate Limiting**: Middleware to prevent spamming endpoints.
- **Transaction Limits**:
    - Max 100 points/txn.
    - Max 150 txns/day per kiosk.
    - Max 2 txns/day to same customer.
- **Validation**: Joi or Zod schemas for all inputs.
