# Grow Server - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 3. Create database
createdb grow_db

# 4. Run Prisma migration
npx prisma migrate dev --name init

# 5. Generate Prisma client
npx prisma generate
```

## 🏃 Running the Server

### Development
```bash
# With TypeScript compilation and hot reload
npm run dev:watch

# Or just compile and run once
npm run dev:start

# Just compile (outputs to dist/)
npm run dev:build
```

### Production
```bash
# Build for production
npm run dev:build

# Run compiled version
npm run prod:start

# With auto-restart on changes
npm run prod:watch
```

## ✅ Verification

### Health Check
```bash
# Server should respond with 200
curl http://localhost:3000/health
```

### Sample Request
```bash
# Send OTP
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/app.ts` | Express application setup |
| `src/index.ts` | Entry point |
| `prisma/schema.prisma` | Database schema |
| `src/config/env.config.ts` | Environment config |
| `src/shared/utils/response.ts` | Response handlers |
| `src/modules/*/` | Feature modules |
| `.env` | Environment variables |

## 🔑 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/grow_db

# Authentication
JWT_SECRET=your-secure-random-string
JWT_EXPIRY=7d

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📊 Database

### View Schema
```bash
# Open Prisma Studio
npx prisma studio
```

### Run Migrations
```bash
# Create migration
npx prisma migrate dev --name "description"

# Apply existing migrations
npx prisma migrate deploy

# Reset database (warning: data loss)
npx prisma migrate reset
```

## 🧪 Testing

### Check Syntax
```bash
npm run dev:lint
```

### Format Code
```bash
npm run dev:format
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port already in use | Change PORT in .env |
| Database connection error | Check DATABASE_URL and PostgreSQL status |
| TypeScript errors | Run `npm install` to update types |
| Missing Prisma client | Run `npx prisma generate` |

## 📚 API Documentation

### Authentication Flow

```
1. POST /api/auth/send-otp
   └─ Receive: { phone }

2. POST /api/auth/verify-otp
   └─ Receive: { phone, code }
   └─ Response: { token, userExists }

3a. POST /api/auth/register (if new user)
    └─ Receive: { phone, password, role }
    └─ Response: { token, user }

3b. Use token for authenticated requests
    └─ Header: Authorization: Bearer <token>
```

### Send Points

```
POST /api/transactions/send
Headers: Authorization: Bearer <token>
Body: {
  "receiver_phone": "+1234567890",
  "amount": 50,
  "kiosk_id": "kiosk-123"
}

Response: {
  "success": true,
  "data": {
    "transaction_id": "tx-123",
    "amount_gross": 50,
    "amount_net": 45,
    "commission": 5,
    "status": "COMPLETED"
  }
}
```

## 🔒 Security Notes

- Never commit `.env` file
- Rotate JWT_SECRET regularly in production
- Use HTTPS in production
- Monitor rate limit logs
- Keep dependencies updated

## 📞 Support

For issues or questions, check:
- `BUILD_COMPLETION_REPORT.md` - Detailed architecture
- API error codes in response.ts
- Prisma documentation: https://www.prisma.io/docs/

## ✨ Features Implemented

✅ OTP-based authentication
✅ User role management
✅ Points transaction system
✅ Daily transaction limits
✅ Kiosk management
✅ Admin dashboard
✅ Redemption workflow
✅ Goal tracking
✅ Shadow wallets
✅ Rate limiting
✅ Comprehensive error handling
✅ Structured logging
