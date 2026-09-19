# Voxentra — Real-Time Live Polling & Interactive Gaming Platform
> **GUVI / HCL Internship: Developer Task Submission**
> **Tagline:** Small Vote, Bigger Impact. Together.

Voxentra is a high-concurrency, real-time live polling, community commentary, and interactive gaming web application. It empowers communities to vote on trending topics, engage in live discussions, compete in fast-paced tech games, and watch live results stream in with **zero page refreshes**.

---

## 1. Flow & System Architecture

```
                                  +-------------------------------------+
                                  |       Audience / Host Browser       |
                                  |       React 19 SPA (Vite)           |
                                  +------------------+------------------+
                                                     |
                                  HTTP / REST (JSON) | WebSocket (WSS)
                                                     v
                                  +-------------------------------------+
                                  |          Go Backend (Gin)           |
                                  |  - Mandatory User Registration/Auth |
                                  |  - Exclusive Admin Controls         |
                                  |  - Gorilla WebSocket Hub Manager    |
                                  |  - Live Commentary Moderation       |
                                  +------------------+------------------+
                                                     |
                          +--------------------------+--------------------------+
                          |                                                     |
                          v                                                     v
              +-----------------------+                             +-----------------------+
              |    Redis (Realtime)   |                             |   MongoDB (Storage)   |
              | - HINCRBY (Atomic)    |                             | - User Accounts (JWT) |
              | - SADD (Deduplication)|                             | - Preloaded Questions |
              | - Pub/Sub (Realtime)  |                             | - Live Commentary     |
              | - Referral Analytics  |                             | - Game Leaderboards   |
              +-----------------------+                             +-----------------------+
```

### Core Flows:
1. **Audience Registration & Authentication:**
   - Mandatory user registration before voting or commenting is permitted.
   - Collects username, email, and password with server-side email verification and duplicate prevention.
   - Persistent JWT session stored securely.
2. **Pre-Loaded Official Questions:**
   - **Question 1:** *"Which AI technology is used to generate human-like text?"* (Options: Computer Vision, Natural Language Processing (NLP), Blockchain, Cloud Computing, IoT).
   - **Question 2:** *"Web Development: Which technology is mainly used to make a website interactive?"* (Options: HTML, CSS, JavaScript, SQL, Python).
3. **Atomic Voting & Deduplication:**
   - Vote requests hit `POST /api/polls/:id/vote` with JWT authorization.
   - Go registers the vote atomically in Redis using `SADD` (enforcing one vote per registered user) and `HINCRBY` (atomic counter).
   - Automatic timer verification ensures votes are rejected once a poll expires or is manually closed by the admin.
   - Broadcasts real-time vote distribution and percentages via WebSockets without exposing individual voter identities.
4. **Live Commentary Stream:**
   - Real-time commentary stream alongside each poll and game.
   - Registered users post timestamped reactions pushed instantly to all participants over WebSockets.
5. **Interactive Games Arena:**
   - **Game 1 (Color Match):** Rapid cognitive reflex Stroop effect test challenging players to match semantic color words against font color under a 30-second blitz timer with streak multipliers.
   - **Game 2 (Snake Classic):** Retro arcade navigation with neon food, smooth grid collision detection, tail growth, and WASD/arrow/touch controls.
   - Integrated live chat and game-specific leaderboards.
6. **Social Sharing & Referral Tracking:**
   - Unique shareable URLs generated for every poll and game (`?ref=...`).
   - One-click copy and direct triggers for WhatsApp, Telegram, X (Twitter), and LinkedIn.
   - QR code generation for scanning via mobile camera.
   - Clicks and converted votes are tracked by referral source and visualized in the Admin Dashboard.
7. **Exclusive Administrator Portal:**
   - Designated admin: `swetha4110@gmail.com` with password `segu7624`.
   - Credentials completely hidden from all public UI (no default placeholders or exposed fields).
   - Dedicated separate admin login route (`#admin-login`).
   - Exclusive controls: create polls, edit questions/options, delete/archive polls, manual open/close toggles, timer configuration, live commentary moderation, and comprehensive analytics.

---

## 2. Tech Stack (Strictly Implemented)

| Layer | Technology | Role & Responsibility |
| :--- | :--- | :--- |
| **Frontend** | **React 19 + Vite** | Sleek dark glassmorphic design matching the UI mockup, live animated charts, 3D holographic podium, and auto-reconnecting WebSockets. |
| **Backend** | **Go (Gin)** | High-performance compiled REST API, JWT auth, input validation, and WebSocket Hub manager. |
| **Database**| **MongoDB** | Persistent datastore for users, password hashes (`bcrypt`), poll definitions, vote records, commentary, and game scores. Built-in zero-config thread-safe store for local testing. |
| **Realtime**| **Redis** | Atomic vote counting (`HINCRBY`), one-vote-per-user deduplication (`SADD`), and cross-instance Pub/Sub broadcasting. Built-in thread-safe fallback for local development. |

---

## 3. How to Run Locally

### Prerequisites:
- Go 1.22+
- Node.js 18+ and npm
- (Optional) Docker & Docker Compose for local MongoDB & Redis

### Step 1: Start the Go Backend
```bash
cd backend

# Run Go backend (automatically uses thread-safe in-memory store if Redis/Mongo URIs are unset)
go run .
```
Backend runs on `http://localhost:8080`.

### Step 2: Start the React Frontend
```bash
cd frontend

# Install dependencies (if not already installed)
npm install

# Start Vite dev server
npm run dev
```
Frontend runs on `http://localhost:5173`.

### (Optional) Run with Docker Compose
```bash
docker-compose up --build
```

---

## 4. Admin Access & Credentials Note

- **Designated Administrator Account:** `swetha4110@gmail.com`
- **Security Password:** `segu7624`
- **Admin Portal URL:** Navigate to `http://localhost:5173/#admin-login` (or click "Admin Access" in the footer).
- As per the requirements, the credentials are never displayed or exposed on any public page.

---

## 5. Submission Video Guide (3–5 min)

When recording your submission walkthrough video for **devhiring@hclguvi.com**, address the following:

### Question 1: The One Challenge That Gave You the Most Trouble, and How You Solved It
- **Challenge:** Maintaining strict vote integrity under concurrent load while keeping voter identities strictly anonymous to the public and updating live charts in real-time.
- **Solution:** Designed a two-layer validation architecture. On the backend, incoming votes are verified against the user's JWT. In Redis, `SADD poll:{id}:voters {user_id}` guarantees $O(1)$ atomic deduplication. Concurrently, `HINCRBY poll:{id}:votes {option_id} 1` increments counts without lock contention. The resulting aggregated tally (percentages and total counts) is broadcast over WebSockets, decoupling voter identity from public results while maintaining complete vote integrity.

### Question 2: Did You Use Any AI Tools While Building This?
- **Response:** *"Yes, I utilized Google Antigravity / Gemini to assist in scaffolding the full-stack architecture, writing unit tests for concurrency, and refining the dark glassmorphic CSS styling. The AI helped accelerate boilerplate generation, allowing me to focus on solidifying backend input validation, Redis atomicity, and ensuring complete compliance with the evaluation criteria."*

---

## 6. Project Structure

```
live-polling-app/
├── backend/
│   ├── config/          # Environment configuration
│   ├── controllers/     # Auth, Polls, Comments, and Games controllers
│   ├── database/        # MongoDB & Redis managers with thread-safe stores
│   ├── middleware/      # JWT auth, Admin-only check, CORS
│   ├── models/          # Struct definitions and Gin request DTOs
│   ├── websocket/       # Gorilla WebSocket Hub and Pub/Sub manager
│   ├── main.go          # Server entrypoint and route definitions
│   └── main_test.go     # Automated unit and integration tests
├── frontend/
│   ├── src/
│   │   ├── api/         # Fetch client and WebSocket helpers
│   │   ├── components/  # Navbar, AuthModal, ShareModal, LiveResultsChart
│   │   ├── context/     # AuthContext with persistent session
│   │   ├── pages/       # Home, PollView, Games, Leaderboard, Dashboard, AdminPortal, About
│   │   ├── App.jsx      # Client-side router and root layout
│   │   └── index.css    # Cyber dark glassmorphic styling and animations
│   ├── index.html       # HTML with OpenGraph metadata
│   └── vite.config.js   # Vite configuration
└── README.md            # Comprehensive project documentation
```
