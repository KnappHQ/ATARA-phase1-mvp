# ATARA

**ATARA** is a mobile-first crypto payment application built for everyday peer-to-peer transfers and group expense splitting. It runs on Base Sepolia (ERC-4337), uses Alchemy Smart Wallets so users never manage private keys, and authenticates with Google and Apple - no seed phrases, no friction.

---

## What It Does

- **Send crypto** to any ATARA user by handle (e.g. `@karan`) - no wallet addresses needed
- **Group expense splitting** - create groups, log shared expenses, settle directly on-chain with automatic USD value verification
- **Contact book** - search and save friends by handle, view threaded conversation history
- **Transaction history** - full activity feed with categories (drinks, food, shopping, transfer, other), notes, and receipt detail views
- **Wallet management** - ETH + USDC/USDT balances on Base Sepolia
- **Feedback** - in-app feedback submissions delivered via Resend

---

## Architecture

```
┌─────────────────────────────────────┐
│         React Native (Expo)         │
│         expo-router · NativeWind    │
│         Zustand · Moti              │
└────────────┬────────────────────────┘
             │ HTTPS (JWT Bearer)
┌────────────▼────────────────────────┐
│         Express API (TypeScript)    │
│         /api/v1                     │
│         Helmet · CORS · Rate-limit  │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼──────┐  ┌───────▼──────────────┐
│ PostgreSQL│  │  Alchemy / Base      │
│ (Prisma) │  │  Sepolia (ERC-4337)  │
│          │  │  Smart Wallets       │
└──────────┘  └──────────────────────┘
```

**Auth flow:**

1. User taps "Continue with Google" or "Continue with Apple"
2. Alchemy SDK handles OAuth → creates / restores an embedded signer (EOA)
3. Alchemy deploys a ModularAccountV2 smart account (ERC-4337) for the user
4. Frontend calls `/api/v1/auth/login` (or `/register` for new users) with the signer address
5. Backend issues a **30-day JWT** - all subsequent API calls use this token
6. On app restart, `loadSession` checks JWT expiry before trusting the stored token; expired tokens trigger a silent logout

---

## Repository Structure

```
knapp-phase1-mvp/
├── backend/          Express API
│   ├── app.ts        Entry point
│   ├── routers/      Route definitions
│   ├── controllers/  Request handlers
│   ├── services/     Business logic
│   ├── middleware/   Auth + error handling
│   ├── prisma/       Schema + migrations
│   └── utils/        Constants, error helpers
│
└── frontend/         React Native app
    ├── app/          expo-router screens
    │   └── (tabs)/   Home, Activity, Profile
    ├── components/   Reusable UI components
    ├── services/     API client, analytics, smart account
    ├── stores/       Zustand state stores
    ├── providers/    AlchemyProvider wrapper
    └── utils/        Constants, formatting helpers
```

---

## Tech Stack

### Backend

| Technology           | Purpose                  |
| -------------------- | ------------------------ |
| Node.js + TypeScript | Runtime + type safety    |
| Express              | HTTP framework           |
| Prisma               | ORM + migrations         |
| PostgreSQL           | Primary database         |
| jsonwebtoken         | JWT auth (HS256, 30d)    |
| ethers.js            | On-chain tx verification |
| helmet               | HTTP security headers    |
| express-rate-limit   | 100 req / 15 min         |
| axios                | External API calls       |
| resend               | Feedback email delivery  |

### Frontend

| Technology                | Purpose                          |
| ------------------------- | -------------------------------- |
| React Native              | Cross-platform mobile            |
| Expo SDK                  | Build toolchain + native modules |
| expo-router               | File-based navigation            |
| NativeWind                | Tailwind CSS for React Native    |
| Zustand                   | Global state management          |
| Moti                      | Declarative animations           |
| @account-kit/react-native | Alchemy Smart Wallets (ERC-4337) |
| ethers.js                 | EVM utilities                    |
| viem / wagmi              | EVM types + hooks                |
| posthog-react-native      | Product analytics                |
| TanStack Query            | Server state + caching           |
| react-native-reanimated   | High-performance animations      |
| expo-haptics              | Haptic feedback                  |
| lucide-react-native       | Icon set                         |

---

## Backend API

Base URL: `http://localhost:4000/api/v1`

### Auth - `/auth`

| Method | Path                    | Description                                                      |
| ------ | ----------------------- | ---------------------------------------------------------------- |
| `POST` | `/register`             | Create account (handle + signer address + smart account address) |
| `POST` | `/login`                | Authenticate by signer address, returns JWT                      |
| `GET`  | `/check-handle/:handle` | Check handle availability                                        |

### Transactions - `/transaction`

| Method | Path               | Description                                              |
| ------ | ------------------ | -------------------------------------------------------- |
| `POST` | `/sync`            | Sync a completed on-chain tx to the database             |
| `GET`  | `/history`         | Paginated transaction history for the authenticated user |
| `GET`  | `/resolve/:handle` | Resolve a handle to a user + wallet address              |

### Wallet - `/wallet`

| Method | Path        | Description                          |
| ------ | ----------- | ------------------------------------ |
| `GET`  | `/balances` | ETH + ERC-20 balances for an address |

### Users - `/user`

| Method  | Path      | Description                                                |
| ------- | --------- | ---------------------------------------------------------- |
| `GET`   | `/me`     | Authenticated user's profile                               |
| `PATCH` | `/me`     | Update profile (handle, email, displayName, profilePicUrl) |
| `GET`   | `/search` | Search users by handle                                     |

### Groups - `/groups`

| Method   | Path            | Description                                               |
| -------- | --------------- | --------------------------------------------------------- |
| `POST`   | `/`             | Create a group                                            |
| `GET`    | `/`             | List all groups the user is a member of                   |
| `GET`    | `/:id`          | Group detail with member balances                         |
| `POST`   | `/:id/expenses` | Add an expense to a group                                 |
| `POST`   | `/:id/settle`   | Settle debt via on-chain transaction (USD value verified) |
| `DELETE` | `/:id`          | Delete a group (creator only)                             |

### Feedback - `/feedback`

| Method | Path | Description                                              |
| ------ | ---- | -------------------------------------------------------- |
| `POST` | `/`  | Submit feedback (delivered via SMTP to configured inbox) |

### Health - `/health`

| Method | Path | Description    |
| ------ | ---- | -------------- |
| `GET`  | `/`  | Liveness check |

---

## Database Schema

```
User
├── id (uuid)
├── handle (unique)
├── email (unique, optional)
├── publicAddress          - EOA / signer address
├── smartAccountAddress    - ERC-4337 smart account (unique, optional)
├── authProvider           - "google" | "apple"
├── profilePicUrl
└── displayName

Transaction
├── id, txHash (unique)
├── senderId → User
├── receiverId → User (nullable - external wallet)
├── receiverAddress        - on-chain destination
├── assetSymbol, amount, rawAmountWei
├── category               - drinks | food | shopping | transfer | other
├── userNote
└── status                 - PENDING | COMPLETED | FAILED

Group
├── id, name, description
└── createdById → User

GroupMember
├── groupId → Group
└── userId → User  (unique pair)

GroupExpense
├── groupId → Group
├── paidById → User
├── description, amount (Decimal 24,8), assetSymbol
└── splits → GroupExpenseSplit[]

GroupExpenseSplit
├── expenseId → GroupExpense
├── userId → User
├── amount
├── settled (bool)
└── settledAt (DateTime?)

Feedback
├── id, message
├── userId → User (optional)
└── handle (optional)
```

---

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Expo Dev Client (`expo-dev-client` is already included as a dependency)
- An [Alchemy](https://www.alchemy.com/) account with:
  - An app on Base Sepolia
  - Account Kit (Smart Wallets) enabled
  - OAuth configured for Google and Apple (Apple via Auth0 connection)
- A [PostHog](https://posthog.com/) project (for frontend analytics)
- A Resend account with the `atara.finance` domain verified for feedback email delivery

---

### Backend

```bash
cd backend
npm install
```

Create a `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/atara

# Auth
JWT_SECRET=your_jwt_secret_here

# Alchemy
ALCHEMY_API_KEY=your_alchemy_api_key
ALCHEMY_NETWORK=base-sepolia

# Resend (for feedback)
RESEND_API_KEY=re_your_resend_api_key
FEEDBACK_FROM_EMAIL=feedback@atara.finance
FEEDBACK_RECIPIENT_EMAIL=feedback@yourdomain.com

# Server
PORT=4000
```

Run migrations and start:

```bash
npx prisma migrate deploy
npm run dev          # development (nodemon, no compile step)
npm run build && npm start  # production
```

---

### Frontend

```bash
cd frontend
npm install
```

Create a `.env` file (Expo reads `EXPO_PUBLIC_` prefixed variables on the client):

```env
EXPO_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
EXPO_PUBLIC_ALCHEMY_POLICY_ID=your_gas_manager_policy_id
EXPO_PUBLIC_API_BASE_URL=http://your-backend-ip:4000/api/v1
EXPO_PUBLIC_POSTHOG_API_KEY=phc_your_posthog_key
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

Start the development server:

```bash
npm start              # Metro bundler
npm run android        # Build and run on Android device/emulator
npm run ios            # Build and run on iOS simulator (macOS only)
```

> **Note:** This app uses `expo-dev-client` (not Expo Go) because of native modules - `@account-kit/react-native`, `react-native-mmkv`, etc. Run `expo run:android` or `expo run:ios` to generate the native shell on first use.

---

## Key Features in Detail

### Gasless Transactions (ERC-4337)

All transactions are sent as UserOperations through Alchemy's bundler. Gas is sponsored by an Alchemy Gas Manager policy, so users pay zero gas fees. The backend verifies each transaction on-chain by checking `receipt.status === 1` before writing it to the database.

### Group Expense Splitting

When a group expense is created, the cost is split equally among all members. To settle, a member submits an on-chain transaction and calls the settle endpoint with the tx hash, asset, decimal amount, raw wei amount, and current token price in USD. The backend verifies the tx landed on-chain and that the USD value sent covers the required debt within a 2% tolerance.

### Smart Account Resolution

Sending to a handle resolves the recipient's `smartAccountAddress` via `/transaction/resolve/:handle`. If the receiver is not an ATARA user (e.g. a raw wallet address), `receiverId` is stored as `null` in the database and `receiverAddress` holds the raw on-chain address.

### Auth Guard

`_layout.tsx` enforces a two-factor authentication gate: the Alchemy signer must be `CONNECTED` **and** a valid, non-expired JWT must exist. Either condition failing redirects to `/onboarding`. Any 401 response from the API automatically triggers a logout via a registered callback (preventing circular imports between `api.ts` and `useAuthStore`).

### Product Analytics

PostHog is active in production only (disabled in `__DEV__`). Tracked events:

| Event                     | Trigger                              |
| ------------------------- | ------------------------------------ |
| `user signed up`          | First registration                   |
| `$screen`                 | Every route change via `usePathname` |
| `transaction sent`        | Successful send                      |
| `transaction send failed` | Failed send attempt                  |
| `group created`           | New group saved                      |
| `group settled`           | Debt settled on-chain                |

---

## Environment Notes

- **Network:** Base Sepolia (testnet). The `ZEROX_CHAIN_ID` constant points to Base Mainnet (8453) for a future swap integration.
- **Rate limiting:** 100 requests per 15-minute window per IP.
- **Supported tokens:** ETH, USDC (`0x036CbD...`), USDT (`0x7c6b91...`) on Base Sepolia.
- **Analytics persistence:** PostHog uses `persistence: "file"` (file system) rather than AsyncStorage to avoid serialization issues on React Native.

---

## Scripts

### Backend

```bash
npm run dev       # Start with nodemon (TypeScript, no compile step)
npm run build     # Compile TypeScript → dist/
npm start         # Run compiled output
```

### Frontend

```bash
npm start         # Start Expo Metro bundler
npm run android   # Build and launch on Android
npm run ios       # Build and launch on iOS
npm run lint      # Run ESLint
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: describe your change"`
4. Push and open a pull request

Keep backend and frontend changes in separate commits for cleaner review.
