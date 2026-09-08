# ATARA Backend (Phase 1 MVP)

## Prerequisites

- Node.js (v18+)

---

## Setup Instructions

### **1. Install Dependencies**

```bash
npm ci
```

---

### **2. Configure Environment**

Create a `.env` file in the root directory and add:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/knapp_db?schema=public"
JWT_SECRET="your_secret"
```

---

### **3. Database Setup**

- If you are using your **own empty DB**, run:

```bash
npx prisma migrate dev --name init
```

- If you are using **my shared DB**, **skip migrate** and only run:

```bash
npx prisma generate
```

---

## Running the Application

### **Development Mode**

```bash
npm run dev
```

---
