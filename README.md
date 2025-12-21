# 🚀 Order Execution Engine

# Video Link : https://www.loom.com/share/67faca25d2544ac3b1f2f663d34c86ce
# Live Link : https://order-execution-engine-trxe.onrender.com

A high-performance order execution engine for Solana DEX trading with real-time WebSocket updates and intelligent DEX routing between Raydium and Meteora.

## 📋 Table of Contents
- [Order Type Choice](#order-type-choice)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [WebSocket Usage](#websocket-usage)
- [Testing](#testing)
- [Deployment](#deployment)

---

## 🎯 Order Type Choice

**We chose Market Order** for this implementation because it offers immediate execution at the current best available price, providing the most straightforward trading experience with deterministic outcomes. Market orders execute instantly without waiting for specific price conditions, making them ideal for demonstrating real-time DEX routing and order lifecycle management.

### Extension to Other Order Types

**Limit Order Extension:**
- Add `targetPrice` field to order input
- Modify routing state to continuously poll DEX prices
- Only execute when `currentPrice <= targetPrice` (buy) or `currentPrice >= targetPrice` (sell)
- Implement price monitoring service that checks prices every N seconds
- Transition to execution when price condition is met

**Sniper Order Extension:**
- Add `tokenLaunchAddress` and `triggerCondition` fields
- Listen to Solana program logs for token deployment events
- Use WebSocket subscriptions to monitor new token pools
- Execute immediately upon pool creation/migration detection
- Implement fast transaction building to compete with other snipers

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER REQUEST                         │
│              POST /api/orders/execute                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    FASTIFY API SERVER                        │
│  - Validates input (tokenIn, tokenOut, amount, slippage)    │
│  - Generates unique orderId                                  │
│  - Returns orderId immediately                               │
└───────────────┬────────────────────┬────────────────────────┘
                │                    │
                ▼                    ▼
┌──────────────────────┐   ┌──────────────────────┐
│  WEBSOCKET MANAGER   │   │   BULLMQ QUEUE       │
│  - Registers client  │   │   - Stores job       │
│  - Sends updates     │   │   - 10 concurrent    │
│  - Caches state      │   │   - Retry 3x         │
└──────────────────────┘   └──────┬───────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │   ORDER WORKER       │
                        │  (Background Task)   │
                        └──────────┬───────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                           │
        ▼                          ▼                           ▼
  ┌─────────┐              ┌──────────────┐          ┌────────────┐
  │ PENDING │──────────────▶│   ROUTING    │──────────▶│  BUILDING  │
  └─────────┘              └──────┬───────┘          └─────┬──────┘
                                  │                         │
                          ┌───────▼────────┐               │
                          │  MOCK DEX      │               │
                          │  ROUTER        │               │
                          │  - Raydium     │               │
                          │  - Meteora     │               │
                          │  - Compare     │               │
                          │  - Select Best │               │
                          └────────────────┘               │
                                                            ▼
                                                   ┌────────────────┐
                                                   │   SUBMITTED    │
                                                   └────────┬───────┘
                                                            │
                                                            ▼
                                                   ┌────────────────┐
                                                   │   CONFIRMED    │
                                                   │  (or FAILED)   │
                                                   └────────────────┘
```

---

## ✨ Features

### ✅ Implemented

- **Mock DEX Router**
  - Fetches quotes from Raydium (0.3% fee) and Meteora (0.2% fee)
  - Parallel quote fetching for speed (~200ms per DEX)
  - Automatic best-price selection
  - Realistic price variance (±2-5%)

- **Real-time WebSocket Updates**
  - Live order status streaming
  - 6 states: pending → routing → building → submitted → confirmed/failed
  - Detailed execution information (txHash, price, DEX used)
  - Support for multiple concurrent connections per order

- **Queue Management**
  - BullMQ + Redis for reliable job processing
  - 10 concurrent workers (100 orders/minute capacity)
  - Exponential backoff retry (3 attempts: 1s, 2s, 4s)
  - Automatic failure handling with error persistence

- **Error Handling**
  - Try-catch blocks throughout execution flow
  - State machine validation (prevents invalid transitions)
  - Failed state with error details broadcast via WebSocket
  - Comprehensive input validation

- **Testing**
  - 80+ unit and integration tests
  - DEX router logic coverage
  - State machine validation
  - WebSocket lifecycle tests
  - API endpoint validation

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Runtime** | Node.js + TypeScript | Type-safe backend development |
| **Web Framework** | Fastify | High-performance HTTP + WebSocket support |
| **Queue System** | BullMQ + Redis | Concurrent order processing |
| **WebSocket** | @fastify/websocket | Real-time status updates |
| **Testing** | Vitest | Fast unit/integration tests |
| **Logging** | Pino | Structured JSON logging |

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+ 
- Redis server (local or cloud)

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd order-execution-engine/backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Create `.env` file:
```env
PORT=8080
NODE_ENV=development
REDIS_URL=redis://localhost:6379
```

For cloud Redis (Upstash), use:
```env
REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_HOST.upstash.io:6379
```

### 4. Start Redis (if local)
```bash
# Option 1: Direct
redis-server

# Option 2: Docker
docker run -d -p 6379:6379 redis:alpine
```

### 5. Run Development Server
```bash
npm run dev
```

Server will start at `http://localhost:8080`

### 6. Run Tests
```bash
npm test
```

---

## 📚 API Documentation

### Base URL
```
Development: http://localhost:8080
Production: <YOUR_DEPLOYED_URL>
```

### Endpoints

#### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

---

#### 2. Execute Order
```http
POST /api/orders/execute
Content-Type: application/json
```

**Request Body:**
```json
{
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amount": 1.5,
  "slippage": 0.01
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenIn` | string | Yes | Input token symbol |
| `tokenOut` | string | Yes | Output token symbol |
| `amount` | number | Yes | Amount to swap (must be > 0) |
| `slippage` | number | No | Max slippage tolerance (default: 0.01 = 1%) |

**Response (200 OK):**
```json
{
  "orderId": "abc-123-def-456",
  "order": {
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amount": 1.5,
    "slippage": 0.01
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Missing required fields",
  "required": ["tokenIn", "tokenOut", "amount"]
}
```

```json
{
  "error": "Amount must be greater than 0"
}
```

---

#### 3. WebSocket Connection
```
ws://localhost:8080/ws/orders/:orderId
```

Connect using the `orderId` received from the execute endpoint.

**Example Messages:**

**PENDING:**
```json
{
  "orderId": "abc-123-def-456",
  "state": "pending"
}
```

**ROUTING:**
```json
{
  "orderId": "abc-123-def-456",
  "state": "routing",
  "raydiumPrice": "99.50",
  "meteoraPrice": "98.20",
  "selectedDex": "Meteora"
}
```

**BUILDING:**
```json
{
  "orderId": "abc-123-def-456",
  "state": "building",
  "selectedDex": "Meteora",
  "message": "Building swap on Meteora..."
}
```

**SUBMITTED:**
```json
{
  "orderId": "abc-123-def-456",
  "state": "submitted",
  "message": "Transaction submitted to blockchain..."
}
```

**CONFIRMED:**
```json
{
  "orderId": "abc-123-def-456",
  "state": "confirmed",
  "txHash": "5j7K3mN2pQ8rS9tU1vW3xY4zA6bC7dE8fG9hJ0kL1mN2",
  "dexUsed": "Meteora",
  "inputAmount": 1.5,
  "outputAmount": "147.30",
  "executedPrice": "98.20",
  "fee": "0.20%"
}
```

**FAILED:**
```json
{
  "orderId": "abc-123-def-456",
  "state": "failed",
  "error": "Slippage tolerance exceeded",
  "message": "Order execution failed"
}
```

---

## 🔌 WebSocket Usage

### JavaScript/Node.js
```javascript
import WebSocket from 'ws';

// 1. Submit order
const response = await fetch('http://localhost:8080/api/orders/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokenIn: 'SOL',
    tokenOut: 'USDC',
    amount: 1.5,
    slippage: 0.01
  })
});

const { orderId } = await response.json();

// 2. Connect to WebSocket
const ws = new WebSocket(`ws://localhost:8080/ws/orders/${orderId}`);

ws.on('message', (data) => {
  const update = JSON.parse(data.toString());
  console.log('Status:', update.state);
  
  if (update.state === 'confirmed') {
    console.log('Transaction Hash:', update.txHash);
    ws.close();
  }
});
```

### Browser
```javascript
const response = await fetch('http://localhost:8080/api/orders/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokenIn: 'SOL',
    tokenOut: 'USDC',
    amount: 1
  })
});

const { orderId } = await response.json();

const ws = new WebSocket(`ws://localhost:8080/ws/orders/${orderId}`);

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Status:', update.state);
};
```

### WebSocket Behavior

Clients may connect at any time using an `orderId`. If the order has already progressed, the server replays all completed states (in order) before streaming live updates. This provides full visibility into the order lifecycle (pending → routing → building → submitted → confirmed/failed) for late subscribers.


---

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test dex-router
npm test state-machine
npm test api
```

### Watch Mode
```bash
npm test -- --watch
```

### Test Coverage
```bash
npm test -- --coverage
```

### Test Statistics
- **Total Tests:** 78
- **Unit Tests:** 61
- **Integration Tests:** 17
- **Coverage:** DEX routing, queue behavior, WebSocket lifecycle, state machine, API validation

---

## 🚀 Deployment

### Deploy to Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and initialize:
```bash
railway login
railway init
```

3. Add Redis service:
```bash
railway add
# Select Redis
```

4. Set environment variables:
```bash
railway variables set PORT=8080
railway variables set NODE_ENV=production
# REDIS_URL is auto-set by Railway
```

5. Deploy:
```bash
railway up
```

### Deploy to Render

1. Create `render.yaml`:
```yaml
services:
  - type: web
    name: order-execution-engine
    env: node
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: REDIS_URL
        sync: false
```

2. Connect GitHub repo and deploy

### Deploy to Fly.io

1. Install flyctl:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Launch app:
```bash
fly launch
```

3. Add Redis:
```bash
fly redis create
```

4. Deploy:
```bash
fly deploy
```

---

## 📊 Order Flow States

```
PENDING   → Order received and queued
    ↓
ROUTING   → Fetching quotes from Raydium and Meteora
    ↓
BUILDING  → Creating transaction for selected DEX
    ↓
SUBMITTED → Transaction sent to network
    ↓
CONFIRMED → Transaction successful ✅
    or
FAILED    → Execution failed ❌
```

---

## 🎥 Demo Video

> Link to video: `<YOUR_YOUTUBE_LINK>`

**Video shows:**
- Submitting 5 concurrent orders
- WebSocket status updates in real-time
- DEX routing decisions (Raydium vs Meteora)
- Queue processing multiple orders
- All state transitions (pending → confirmed)

---

## 📦 Project Structure

```
backend/
├── src/
│   ├── app.ts                      # Fastify app setup
│   ├── index.ts                    # Entry point
│   ├── config/
│   │   ├── env.ts                  # Environment configuration
│   │   ├── logger.ts               # Pino logger setup
│   │   └── redis.ts                # Redis connection
│   ├── modules/
│   │   └── orders/
│   │       ├── order.controller.ts # HTTP handlers
│   │       ├── order.routes.ts     # Route definitions
│   │       ├── order.service.ts    # Business logic
│   │       ├── order.ws.ts         # WebSocket endpoint
│   │       ├── dex/
│   │       │   ├── dex.types.ts    # Type definitions
│   │       │   └── mock-dex-router.ts # DEX routing logic
│   │       ├── domain/
│   │       │   ├── order.state.ts  # State enum
│   │       │   ├── order.state-machine.ts # State transitions
│   │       │   └── order.transactions.ts # Transition rules
│   │       └── queue/
│   │           ├── order.queue.ts  # BullMQ queue
│   │           └── order.worker.ts # Background processor
│   └── shared/
│       └── websocket/
│           └── ws.manager.ts       # WebSocket manager
├── tests/
│   ├── unit/                       # Unit tests
│   └── integration/                # Integration tests
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🤝 Contributing

This is a technical assessment project. For production use, consider:
- Adding database persistence (PostgreSQL)
- Implementing real Solana DEX integration
- Adding authentication/authorization
- Rate limiting and API quotas
- Enhanced error monitoring (Sentry)
- Circuit breakers for external APIs

---

## 📄 License

MIT

---

## 👤 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- Fastify for excellent TypeScript support
- BullMQ for reliable queue management
- Raydium & Meteora for DEX inspiration
