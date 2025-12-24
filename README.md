# 🧘‍♂️ FocusWalker

FocusWalker is a Progressive Web App (PWA) designed to bridge the gap between mental focus and physical movement. It transforms your focus sessions into "virtual walks." Instead of a standard countdown, the timer progress is tied to the realistic duration of a physical walk between two geographical points.

If you choose a destination 3km away, FocusWalker gives you the exact time it would take to walk there—roughly 36 minutes of focused work.

## 🧠 The "Walking Logic" Core

The heart of FocusWalker is its predictive timing engine(easy simple logic nothing rocket science). Instead of a simple countdown, it calculates the **Estimated Time of Arrival (ETA)** by analyzing the distance between your start and end coordinates against a realistic walking gait ( or ).

## 🏗️ Technical Architecture (Vercel Monorepo)

This project uses a custom-built **Express + Vite** bridge to allow a stateful backend logic to coexist with a high-performance frontend on Vercel’s serverless infrastructure.

- **Frontend**: React 19 + Vite (located in `/client`)
- **Backend**: Node.js + Express (located in `/server`)
- **Bundling**: Dual-stage build via `scripts/build.ts`
- **Vite** builds the UI to `dist/public`.
- **ESBuild** bundles the Server to `dist/index.cjs`.

---

## ✨ Key Features

- **Realistic Pace Timer**: Dynamic timers that adjust based on walking distance and average human velocity.
- **Spatial Focus**: Uses Leaflet to visualize the path between your current position and the target goal.
- **Offline Mode**: As a PWA, FocusWalker caches your route and map tiles, allowing you to walk in "Dead Zones" without losing your progress.
- **Type-Safe Schema**: Shared Drizzle ORM schemas ensure your walking logs are consistent from the database to the React UI.
- **Speed modes**: you can adjust your walking speed to run( upto 20kph)

---

## 🚀 Development & Deployment

### Environment Setup

Create a `.env` in the root:

```env
DATABASE_URL=your_postgres_url(does not require in base version)
NODE_ENV=development
WALKING_SPEED_DEFAULT=1.4  # meters per second

```

### 1. Local Development

Runs the Express API and Vite HMR simultaneously:

```bash
npm install
npm run dev

```

### 2. The Build Pipeline

To prepare for Vercel deployment, we run a unified build script:

```bash
npm run build

```

_This triggers `vite build` for the walk interface and `esbuild` for the route handler._

---

## 📂 Specialized File Structure

- **`client/src/pages/MapTimer.tsx`**: The main interface where the walking speed calculation and map rendering happen.
- **`server/static.ts`**: Optimized to serve the PWA manifest and service worker so FocusWalker remains "installable" on mobile.

---

## 🛠️ Configuration for Realistic Timing

The walking logic is adjustable.(under development , not ready now) You can modify the speed constants in `shared/schema.ts` or via environment variables to account for:

- **Leisurely Stroll**:
- **Brisk Walk**:
- **Power Walk**:
