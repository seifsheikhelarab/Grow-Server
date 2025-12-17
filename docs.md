# Grow Server Specifications

Tech Stack: Node.js, Express.js, Typescript, PostgreSQL, Prisma ORM

## Authentication (For Customer/Worker/Owner)

1. Send OTP (POST /api/v1/auth/send-otp)
   a. takes phone number as input
   b. generates a random 4-digit code
   c. sets expiry to 10 minutes from now
   d. upserts OTP record in database
   e. (DEV) logs OTP to console, (PROD) sends SMS to phone number

2. Verify OTP (POST /api/v1/auth/verify-otp)
   a. takes phone number and OTP as input
   b. finds OTP record in database
   c. checks if record exists, is not expired, and code matches
   d. if valid, deletes OTP record
   e. checks if user exists in database
   f. if user does not exist, generates a temporary JWT token (valid for 30m) for registration
   g. if user exists but is inactive, returns error
   h. if user exists and active, updates `is_verified` to true
   i. generates and returns a full JWT access token (valid for configured expiry)

3. Register(Sign-up) (POST /api/v1/auth/register)
   a. takes phone number, password, full name, and role (CUSTOMER, WORKER, OWNER)
   b. validates inputs (phone length, password length)
   c. checks if user already exists with this phone
   d. hashes password using bcrypt
   e. creates new user record with `is_active=true` and `is_verified=true` (since they passed OTP)
   f. creates a new wallet for the user
   g. checks for any existing Shadow Wallet with this phone number
   h. if Shadow Wallet exists, transfers balance to new real wallet and deletes shadow wallet
   i. generates and returns a full JWT access token

4. Login (POST /api/v1/auth/login)
   a. takes phone number and password
   b. finds user by phone number
   c. checks if user exists and is active
   d. compares provided password with stored hash
   e. if valid, generates and returns a full JWT access token

5. Verify Auth Status (GET /api/v1/auth/verify)
   a. decodes JWT token from header
   b. checks if token is valid and not expired
   c. returns decoded user info (id, phone, role)

6. Delete Account (DELETE /api/v1/auth/delete-account)
   a. identifies user from auth token
   b. performs soft delete by setting `is_active` to false

Kiosks

1. Create new kiosk (Owner only) (POST /api/v1/kiosks)
   a. takes name, kiosk type, location from body; owner id from token
   b. checks if kiosk with same name already exists for this owner
   c. checks system setting `max_kiosks` to ensure owner hasn't reached limit
   d. creates new kiosk record linked to owner
   e. returns created kiosk object

2. Get All kiosks(Owner only) (GET /api/v1/kiosks)
   a. fetches all kiosks where `owner_id` matches user token
   b. includes counts of workers and transactions for each kiosk

3. Invite worker to kiosk (Owner only) (POST /api/v1/kiosks/invite-worker)
   a. takes worker’s phone, kiosk id, position, and working hours
   b. validates kiosk ownership
   c. checks if user with worker phone exists
   d. if not exists, creates a new user with `full_name="Invited Worker"` and role `WORKER`, and creates a wallet
   e. checks if user is actually a WORKER
   f. checks if worker is already assigned to this kiosk
   g. upserts `WorkerProfile` with status `PENDING_INVITE` linked to kiosk and user

4. Get Kiosk workers(Owner Only) (GET /api/v1/kiosks/:kioskId/workers)
   a. takes kiosk id from params
   b. validates kiosk ownership
   c. fetches all `WorkerProfile` records implicated with this kiosk, including user details

5. Get kiosk dues(Owner Only) (GET /api/v1/kiosks/:kioskId/dues)
   a. takes kiosk id from params
   b. validates kiosk ownership
   c. fetches all `KioskDue` records for this kiosk
   d. calculates total dues, total paid, and pending counts

6. Get invitations to kiosks(Worker Only) (GET /api/v1/kiosks/worker-invitations)
   a. fetches `WorkerProfile` records for this user
   b. filters/returns those with status (implied checks based on data returned)

7. Accept Invitation to kiosk(Worker Only) (POST /api/v1/kiosks/accept-invitation/:invitationId)
   a. takes invitation id from params
   b. finds `WorkerProfile` matching id and user id
   c. updates status to `ACTIVE`

Transactions

1. Send Points to customer(Worker/Owner) (POST /api/v1/transactions)
   a. takes customer’s phone, amount, and kiosk id
   b. validates sender: must be active, verified, WORKER or OWNER role
   c. if sender is WORKER, checks if their profile is ACTIVE
   d. validates kiosk: must exist
   e. validates sender-kiosk relationship: Owner must own kiosk, Worker must be assigned to kiosk
   f. fetches system settings for constraints (`max_transaction_amount`, `max_daily_tx_to_customer`, `max_daily_tx`)
   g. checks constraints:
   i. Amount <= max limits
   ii. Daily tx to this customer < limit
   iii. Total daily tx by this worker < limit
   h. Execution (Atomic Transaction):
   i. Calculates `customerAmount` (amount - fee) and `commission`
   ii. Finds receiver user; if exists, increments wallet balance; if not, upserts ShadowWallet
   iii. Increments sender's wallet balance by `commission`
   iv. Creates `KioskDue` record for the full `amount`
   v. Creates `Transaction` record with details
   i. Returns transaction result

2. Get transaction history(customer/worker/owner) (GET /api/v1/transactions)
   a. fetches transactions where user is either sender or receiver
   b. supports pagination (limit/offset)
   c. returns list with kiosk details

3. Get daily statistics(worker/owner) (GET /api/v1/transactions/stats)
   a. aggregates transactions sent by user today
   b. sums up count, total gross amount, and total commission
   c. calculates remaining daily limit based on system settings

Wallet & Goals

1. Get wallet balance(customer/worker/owner) (GET /api/v1/wallet/balance)
   a. fetches user's wallet
   b. returns balance as string

2. Send redemption request(customer/worker/owner) (POST /api/v1/wallet/redeem)
   a. takes amount, method, details
   b. checks if amount >= `MIN_REDEMPTION_AMOUNT` (30)
   c. checks if wallet balance >= amount
   d. Atomic Transaction:
   i. Decrements wallet balance by `amount + REDEMPTION_FEE` (5)
   ii. Creates `RedemptionRequest` with status `PENDING`

3. Create Goal (POST /api/v1/wallet/goals)
   a. takes title, target, type (`SAVING` or `WORKER_TARGET`), deadline
   b. validates: if `WORKER_TARGET`, target/limit logic (max 500)
   c. creates `Goal` record

4. Get Goals (GET /api/v1/wallet/goals)
   a. fetches all goals for user
   b. Calculates `current_amount` dynamically:
   i. If `SAVING`: Sum of net amount of DEPOSIT transactions received between goal creation and deadline
   ii. If `WORKER_TARGET` (Worker): Sum of commissions earned from sent transactions in timeframe
   iii. If `WORKER_TARGET` (Owner): Sum of commissions earned by owned kiosks in timeframe
   c. returns goals with calculated progress

5. Update Goal Progress (PUT /api/v1/wallet/goals/:id)
   a. (Legacy/Manual) increments `current_amount` on `Goal` record directly

Dashboard

1. Owner Dashboard (GET /api/v1/dashboard/owner)
   a. fetches user wallet balance (Total Points)
   b. fetches active kiosks owned by user
   c. for each kiosk, calculates points (sum of completed tx `amount_gross`) and dues (sum of unpaid `KioskDue`)
   d. returns consolidated view

2. Worker Dashboard (GET /api/v1/dashboard/worker)
   a. fetches user wallet balance
   b. fetches current `WORKER_TARGET` goal
   c. calculates goal progress (sum of sender tx `amount_gross` in timeframe)
   d. fetches latest 5 transactions sent by worker

Admin (Admin Only)

1. Dashboard (GET /api/v1/admin/dashboard)
   a. takes time filter (1d, 7d, 30d)
   b. calculates stats: User counts, Total wallet/shadow balance, Transaction sums (gross, net, comm), Unpaid dues, Pending redemptions

2. Workers/Owners/Customers Lists & Details
   a. Standard CRUD: Fetch with pagination/filtering, Get by ID
   b. Includes relation data (e.g. wallet balance, kiosk info for owners)

3. Update Status (Workers/Owners/Customers/Kiosks)
   a. updates `is_active` / `is_verified` based on status (ACTIVE, SUSPENDED, PENDING, REJECTED)
   b. logs action to `AuditLog`

4. Process Redemption (POST /api/v1/admin/redemptions/process)
   a. takes redemption ID and action (APPROVE/REJECT)
   b. checks if pending
   c. Atomic Transaction:
   i. If REJECT: refunds `amount` to user wallet
   ii. Updates `RedemptionRequest` status (COMPLETED/REJECTED) and note
   d. logs action

5. Collect Due (POST /api/v1/admin/dues/collect)
   a. takes due ID
   b. checks if not already paid
   c. updates `is_paid` to true
   d. logs action

6. System Settings (CRUD)
   a. Get: fetches all settings, parses JSON values
   b. Update: upserts setting key/value, logs action

7. Create Admin, Team List
   a. Create: creates new user with role ADMIN and specific `admin_role`, logs action
   b. List: fetches all ADMIN users
