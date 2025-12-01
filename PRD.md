
📘 PRODUCT REQUIREMENTS DOCUMENT (PRD)
Product Name: Grow
Version: 1.0
Prepared For: Development Team
Prepared By: Omar (Founder)
________________________________________
1. Vision & Mission
1.1 Vision
Grow aims to make saving and investing accessible and subconscious for every Egyptian.
We are building a nationwide micro-investment ecosystem where every kiosk, every store, and every neighborhood becomes a financial access point, turning every pound of spare change into savings.
Grow supports Egypt’s 2030 Vision by promoting financial inclusion, increasing kiosk worker income, and transforming daily spending habits into recurring investments.
________________________________________
1.2 Mission
To make investing feel like a normal, invisible part of daily life while empowering kiosks to increase income. Grow enables Egyptians to save spare change effortlessly through routine cash transactions, without changing their behavior.
________________________________________
2. The Problem
2.1 Customer Problems
•	Saving & investing is behaviorally difficult
•	Spare change is lost every day
•	Investments are not easily accessible in Egypt
•	No micro-investment ecosystem tied to daily spending
2.2 Kiosk Problems
•	Low income for kiosk workers
•	No financial benefits for owners from digital transactions
•	No system to track customer interactions or earnings
2.3 Market Problem
Egypt lacks a frictionless, mass-market micro-investment app linked to everyday purchases.
________________________________________
3. Primary User Groups
1. Customers
Receive and redeem points, set goals, track savings.
2. Kiosk Workers
Send points, earn commission, view dues, redeem earnings.
3. Kiosk Owners
Manage kiosks, manage workers, set goals, approve workers, track cash flow.
4. Admins (Grow Team)
Oversee system operations, approve redemptions, manage owners, view analytics.
________________________________________
4. Customer App — User Flow
4.1 Onboarding
•	Splash
•	3 intro screens
•	OTP verification
•	Create password
•	No KYC required
•	Land on Home
________________________________________
4.2 Home Page (Dashboard)
Displays:
•	Total points
•	Last transactions
•	Quick actions:
o	Redeem
o	Transactions
o	Goals
________________________________________
4.3 Receiving Points (Balance Add)
Only through kiosks:
•	Customer gives phone number to kiosk worker
•	Worker sends points
•	Customer immediately receives points
•	If customer doesn’t have the app:
o	Points are held under their number
o	Released upon signup
________________________________________
4.4 Viewing Savings
•	Total points
•	Full transaction history
•	Filters: date, kiosk, worker
________________________________________
4.5 Setting Goals
•	Add custom saving goals
•	Assign points to goals
•	Goals do NOT affect backend logic
________________________________________
4.6 Redeeming Points
•	Minimum withdraw: 30 points
•	Fee: 5 points
•	Transfer method:
o	Instapay
o	Vodafone Cash / Etisalat Cash / Orange Money
o	Bank account
Admin processes manually → approves → system deducts.
________________________________________
5. Kiosk Worker App — User Flow
5.1 Registration
•	Splash → intro → OTP
•	No KYC
•	Lands on “Pending Invitations”
________________________________________
5.2 Accepting Invitation
•	Owner sends invitation
•	Worker accepts
•	Lands on Kiosk Dashboard
________________________________________
5.3 Sending Points
Form fields:
•	Customer phone number
•	Points to send (max 100)
System behavior:
•	Customer gets: Points - 5
•	Worker earns: 5 points per transaction
•	Kiosk due = full amount
________________________________________
5.4 Commission
•	Fixed: 5 points per transaction
•	Displayed on commission page
________________________________________
5.5 Dues
Every point sent creates equal due on kiosk:
•	Due = Points Sent
•	Paid manually by Grow team collecting cash
________________________________________
5.6 Redeeming Earnings
Same rules as customers:
•	Min 30
•	Fee 5
•	Admin approval required
________________________________________
6. Kiosk Owner App — User Flow
6.1 Onboarding
•	Splash → OTP → password
•	Lands on “Waiting for Approval”
Admin approves → then owner enters kiosk info.
________________________________________
6.2 Creating Kiosk
Owner enters:
•	Kiosk name
•	Type
•	Address/Location
________________________________________
6.3 Owner Functionalities
•	Send points (same logic as worker)
•	Earn 5 points per transfer
•	Redeem points
•	Invite workers
•	Set goals
•	Track dues
•	Track worker performance
________________________________________
6.4 Worker Goals
Limitations:
•	Max earnings through goal: 500 points
•	Max required transactions: 100
Goal outcomes:
•	If worker completes → keeps all commission
•	If worker fails → unearned goal commission returns to owner
________________________________________
7. Admin Dashboard — User Flow
7.1 Home Page (3 Main Sections)
A. Global Performance Graph (LinkedIn-style)
•	Time filter: Today / 7 Days / 30 Days / Custom
•	Metrics:
o	Kiosk owners
o	Workers
o	Kiosks
o	Transactions
o	Points sent
o	Dues
o	App downloads
o	Worker activity
________________________________________
B. Owner Requests
Admin can approve/reject kiosk owner registration.
________________________________________
C. Redemption Requests
Admin sees:
•	User
•	Amount
•	Wallet method
•	Status
Admin manually sends money → clicks approve → points deducted.
________________________________________
7.2 Owners Page
Lists:
•	Owner name
•	Phone
•	Number of kiosks
•	Number of workers
•	Search bar
Click → Owner Profile
________________________________________
7.3 Kiosks Page
Lists:
•	Kiosk name
•	Location
•	Workers
•	Owner
Click → Kiosk Profile
________________________________________
7.4 Workers Page
Lists:
•	Worker name
•	Phone
•	Kiosk
•	Owner
Click → Worker Profile
________________________________________
7.5 Owner Profile Page
30% Profile
70% Performance
Sections:
1.	Analytics graph
2.	Goals summary
3.	Redemption history
4.	Kiosks list
________________________________________
7.6 Kiosk Profile Page
1.	Kiosk analytics graph
2.	Workers list
________________________________________
7.7 Worker Profile Page
1.	Personal information
2.	Worker-only graph
3.	Goals
4.	History
________________________________________
8. System Rules — Points, Dues & Commission
8.1 Points Logic
•	1 point = 1 EGP (internal value)
•	Customer receives (Points sent - 5)
________________________________________
8.2 Commission Logic
•	Worker earns 5 points per transaction
•	Owner earns 5 points when he personally sends
•	Owner does NOT earn from worker transactions
________________________________________
8.3 Dues Logic
•	Dues = Full points sent
•	Collected manually
•	Due persists until paid
________________________________________
9. Limits & Fees
9.1 Send Limits (Owner & Worker)
•	Max 100 points per transaction
•	Max 2 transactions per day to the same customer
•	Max 150 transactions per day total
________________________________________
9.2 Goal Limits
•	Max goal earnings = 500 points
•	Max goal transactions = 100
________________________________________
9.3 Withdraw Limits
•	Min withdrawal = 30 points
•	Transfer field minimum = 10 points
•	Fee = 5 points
________________________________________
10. Security & Fraud Rules
•	No self-transfer allowed
•	No reversals (admin only)
•	Limit enforcement required in backend
•	Suspicious activity flags:
o	High frequency to same number
o	Many low-value transactions
o	Multiple accounts from same device
________________________________________
11. Backend Requirements
11.1 Key Modules
•	Authentication (OTP, password)
•	Points engine
•	Dues engine
•	Commission engine
•	Transfer validation engine (limits)
•	Notifications
•	Admin dashboard API
•	Kiosk management API
•	Worker management API
•	Redemption flow
________________________________________
11.2 Database Entities
•	Users
•	Kiosks
•	Workers
•	Owner
•	Transactions
•	Commission
•	Dues
•	Redemption requests
•	Goals
•	Held transactions
________________________________________
12. Future Phases
•	Round-up savings from card payments
•	Auto-investment into funds
•	Cashier POS integration
•	Merchant analytics
•	Peer-to-peer transfers
•	Wallet top-up methods (Fawry, bank API)
________________________________________

