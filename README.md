# ATARA

> **Pilote du 7 septembre 2026** : lire [le périmètre livré et la procédure d’activation](docs/PILOT_RELEASE_2026-09-07.md). La simulation web est distincte du backend, des builds mobiles et des contrats à déployer.

**ATARA** is a mobile-first crypto payment application built for everyday peer-to-peer transfers and group expense splitting. It runs on Base Sepolia (ERC-4337), uses Privy embedded wallets with Alchemy smart accounts so users never manage private keys, and authenticates with Google and Apple - no seed phrases, no friction.

---

## What It Does

- **Send crypto** to any ATARA user by handle (e.g. `@karan`) - no wallet addresses needed
- **Group expense splitting** - create groups, log shared expenses, accept or dispute each share, then settle an exact USDC amount with a verified on-chain receipt
- **Contact book** - search and save friends by handle, view threaded conversation history
- **Transaction history** - full activity feed with categories (drinks, food, shopping, transfer, other), notes, and receipt detail views
- **Wallet management** - ETH + USDC balances on Base Sepolia; other ERC-20 tokens require explicit configuration
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
2. Privy handles OAuth → creates / restores an embedded signer (EOA)
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
    │   └── (tabs)/   Home, Activity, Vault, Profile
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
| @privy-io/expo           | OAuth + embedded signer wallet   |
| @alchemy/wallet-apis     | Alchemy Smart Wallets (ERC-4337) |
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

| Method | Path                | Description                                      |
| ------ | ------------------- | ------------------------------------------------ |
| `GET`  | `/portfolio`        | ETH + ERC-20 balances for the authenticated user |
| `POST` | `/onramp-session`   | Create a signed MoonPay URL for the smart account |

### Vaults - `/vaults`

| Method | Path                 | Description                                      |
| ------ | -------------------- | ------------------------------------------------ |
| `GET`  | `/`                  | List Vault addresses for the authenticated member |
| `GET`  | `/:vaultAddress`     | Read a member-only on-chain Vault snapshot        |

### Users - `/user`

| Method  | Path      | Description                                                |
| ------- | --------- | ---------------------------------------------------------- |
| `GET`   | `/me`     | Authenticated user's profile                               |
| `PATCH` | `/me`     | Update profile (handle, email, displayName, profilePicUrl) |
| `DELETE`| `/me`     | Permanently delete the authenticated app account           |
| `GET`   | `/search` | Search users by handle                                     |

### Groups - `/groups`

| Method   | Path            | Description                                               |
| -------- | --------------- | --------------------------------------------------------- |
| `POST`   | `/`             | Create a group                                            |
| `GET`    | `/`             | List all groups the user is a member of                   |
| `GET`    | `/:id`          | Group detail with member balances                         |
| `POST`   | `/:id/expenses` | Add an expense to a group                                 |
| `POST`   | `/:id/settle/:memberId/by-tx` | Settle debt with a verified in-app transaction |
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

# MoonPay (server-only; never put the secret in Expo)
MOONPAY_API_KEY=pk_test_your_publishable_key
MOONPAY_SECRET_KEY=sk_test_your_secret_key
MOONPAY_WIDGET_URL=https://buy-sandbox.moonpay.com/
MOONPAY_CURRENCY_CODE=usdc_base
MOONPAY_BASE_CURRENCY_CODE=eur

# Vault reads and deployment activation
VAULT_FACTORY_ADDRESS=
VAULT_RPC_URL=https://sepolia.base.org

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
EXPO_PUBLIC_API_URL=http://your-backend-ip:4000
EXPO_PUBLIC_POSTHOG_API_KEY=phc_your_posthog_key
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_VAULT_FACTORY_ADDRESS=
EXPO_PUBLIC_VAULT_RPC_URL=https://sepolia.base.org
```

Pour présenter les nouveaux écrans sans clé MoonPay, backend actif ou contrat
déployé, passe `EXPO_PUBLIC_DEMO_MODE=true`. Le mode simulation affiche un
solde fictif, un Vault de démonstration et des confirmations locales ; il ne
appelle ni l’API d’achat ni le portefeuille et n’envoie aucune transaction.

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

### On-ramp and merchant payments

The beta keeps purchases on Base Sepolia. The authenticated backend creates a
signed MoonPay widget URL that sends USDC directly to the user's smart account;
the MoonPay secret stays server-side. The app also offers a merchant payment
screen that sends USDC to a verified merchant address and resumes an in-flight
smart-account bundle after an app restart.

### Collective Vault

Vaults are immutable Base Sepolia USDC group savings contracts. Every member
accepts the terms, deposits before the lock date, and approves the same exact
withdrawal payload. ATARA has no admin withdrawal path. See
[`docs/VAULT_PLAN.md`](docs/VAULT_PLAN.md) for the lifecycle and deployment
gates.

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
