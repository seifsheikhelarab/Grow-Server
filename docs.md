# Grow Server API Documentation (Frontend-Oriented)

## 1. Overview

The **Grow Server API** is a RESTful backend used by mobile and web frontends to manage authentication, wallets, transactions, kiosks, and admin operations.

**Audience:** Frontend & Mobile Developers
**Format:** JSON over HTTP
**Auth:** JWT Bearer Token

---

## 2. Base Configuration

**Base URL**

```
http://localhost:4732/api/v1
```

**Authorization Header (Required for most endpoints)**

```
Authorization: Bearer <JWT_TOKEN>
```

---

## 3. Common Error Responses (Global)

These errors can be returned by **any authenticated endpoint**.

### 401 – Unauthorized

```json
{ "message": "Authentication required" }
```

### 403 – Forbidden

```json
{ "message": "You do not have permission to perform this action" }
```

### 422 – Validation Error

```json
{
  "message": "Validation failed",
  "errors": {
    "field": "Reason"
  }
}
```

### 500 – Server Error

```json
{ "message": "Internal server error" }
```

---

## 4. Authentication APIs

### POST /auth/send-otp

Send OTP to user phone number.

**Request**

```json
{ "phone": "+201234567890" }
```

**Success – 200**

```json
{ "message": "OTP sent successfully" }
```

---

### POST /auth/verify-otp

Verify OTP and authenticate user.

**Request**

```json
{ "phone": "+201234567890", "code": "123456" }
```

**Success – 200**

```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "role": "CUSTOMER"
  }
}
```

---

### POST /auth/register

Register new user.

**Request**

```json
{
  "phone": "+201234567890",
  "full_name": "John Doe",
  "password": "password123",
  "role": "CUSTOMER"
}
```

**Success – 201**

```json
{ "message": "User registered successfully" }
```

---

### POST /auth/login

Login with phone and password.

**Request**

```json
{ "phone": "+201234567890", "password": "password123" }
```

**Success – 200**

```json
{ "token": "jwt_token_here" }
```

---

### GET /auth/verify

Verify authentication status.

**Auth:** Required

**Success – 200**

```json
{ "authenticated": true }
```

---

## 5. Dashboard APIs

### GET /dashboard/owner

Owner overview data.

**Auth:** OWNER

**Success – 200**

```json
{
  "total_kiosks": 3,
  "total_balance": 12000,
  "pending_dues": 4
}
```

---

### GET /dashboard/worker

Worker overview data.

**Auth:** WORKER

**Success – 200**

```json
{
  "kiosk": "Kiosk Name",
  "today_transactions": 15
}
```

---

## 6. Wallet APIs

### GET /wallet/balance

**Success – 200**

```json
{ "balance": 850.75 }
```

---

### POST /wallet/redeem

Create redemption request.

**Request**

```json
{
  "amount": 100,
  "method": "Vodafone Cash",
  "details": "01012345678"
}
```

**Success – 201**

```json
{ "message": "Redemption request created" }
```

---

## 7. Goals APIs

### GET /wallet/goals

**Success – 200**

```json
[
  {
    "id": "uuid",
    "title": "Buy Laptop",
    "target_amount": 10000,
    "current_amount": 2500
  }
]
```

---

### POST /wallet/goals

**Request**

```json
{
  "title": "Buy Laptop",
  "target": 10000,
  "type": "SAVING"
}
```

**Success – 201**

```json
{ "message": "Goal created" }
```

---

### PUT /wallet/goals/{id}

Update goal progress.

**Request**

```json
{ "amount": 500 }
```

**Success – 200**

```json
{ "message": "Goal updated" }
```

---

## 8. Transactions APIs

### POST /transactions

Send points to customer.

**Request**

```json
{
  "phone": "+201234567890",
  "amount": 50,
  "kioskId": "uuid"
}
```

**Success – 200**

```json
{ "message": "Points sent successfully" }
```

---

### GET /transactions

**Success – 200**

```json
[
  {
    "id": "uuid",
    "amount": 50,
    "status": "COMPLETED",
    "created_at": "2025-01-01T12:00:00Z"
  }
]
```

---

## 9. Kiosk APIs (Owner)

### POST /kiosks

**Request**

```json
{ "name": "My Shop", "kiosk_type": "Retail", "location": "Cairo" }
```

**Success – 201**

```json
{ "message": "Kiosk created" }
```

---

### POST /kiosks/invite-worker

**Request**

```json
{ "workerPhone": "+201234567890", "kioskId": "uuid" }
```

**Success – 200**

```json
{ "message": "Worker invited" }
```

---

## 10. Admin APIs (Summary)

### GET /admin/dashboard

**Query Params**

* filter: 1d | 7d | 30d

**Success – 200**

```json
{ "total_users": 1200, "total_transactions": 4500 }
```

---

### POST /admin/redemptions/process

**Request**

```json
{ "reqId": "uuid", "action": "APPROVE", "note": "Processed" }
```

**Success – 200**

```json
{ "message": "Redemption processed" }
```

---

## 11. Frontend Notes

* Always store JWT securely (HTTP-only cookies or secure storage)
* Refresh app state after wallet-affecting operations
* Handle 401 globally → redirect to login
* Use optimistic UI for transactions when possible

---

**End of Frontend API Documentation**
