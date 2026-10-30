# Spyfall — Trust Nobody

A responsive real-time multiplayer social deduction game built with React, Vite, Express, and Socket.IO.

## Game rules
- 3–12 players per room. A room creator is the host.
- The server privately assigns one spy and a role to every other player.
- Non-spies see the secret location and their own role; the spy sees only that they are the spy.
- Players talk using a voice call or group chat outside the app, then use **Call a vote**.
- Every connected player votes for one other player. If the spy receives the most votes alone, the group wins; a tie or wrong accusation lets the spy win.
- The spy can attempt one location guess during play. A correct guess wins; an incorrect guess awards the win to the group.
- Group win: each non-spy earns 1 point. Spy win: the spy earns 2 points.
- The host can start another round after results.

## Requirements
- Node.js 20 LTS or newer (Node 22 LTS recommended)
- npm

## Run locally on Windows
1. Install Node.js LTS from the official Node.js website: https://nodejs.org/
2. Extract this ZIP to a normal folder.
3. Open PowerShell in that folder.
4. Run:
   ```powershell
   npm install
   npm run dev
   ```
5. Open the local Vite URL shown in the terminal (usually http://localhost:5173).
6. Keep both terminal processes running while testing.

Health check: open `http://localhost:3001/api/health`; it should return JSON with `"ok":true`.

## Production deployment (public internet)
The frontend and backend must both be deployed. A static frontend alone will NOT provide multiplayer.

### 1. Deploy the backend to Render
1. Push this project to a GitHub repository.
2. In Render, create a **Web Service** connected to that repository.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variables:
   - `NODE_ENV` = `production`
   - `CLIENT_ORIGIN` = your eventual frontend URL (you can set `*` temporarily for first testing; replace it after frontend deploy)
6. Deploy. Open `https://YOUR-BACKEND.onrender.com/api/health` and confirm it returns `{"ok":true,...}`.
7. Copy the backend URL.

### 2. Deploy the frontend to Vercel
1. Import the same repository into Vercel.
2. Framework preset: Vite.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variable `VITE_SERVER_URL` = your backend URL, e.g. `https://YOUR-BACKEND.onrender.com`
6. Deploy and copy the public frontend URL.
7. In Render, set `CLIENT_ORIGIN` to the exact Vercel URL, then redeploy the backend.
8. Open the Vercel URL in two separate devices/browser profiles and test room creation, joining, roles, voting, and next round.

Note: Free hosting tiers can sleep or have limits. The first request after inactivity may take a little while. For stable public play, check current hosting limits/pricing before launch.

## Important production notes
- This is a deployable MVP, not a security-audited commercial service.
- Room state lives in server memory; restarting/redeploying the backend clears active rooms. Use a shared persistent store and Socket.IO adapter if you later need multiple backend instances or durable rooms.
- The current server has no rate limiting or moderation controls. Add these before a large public launch.
- Secret roles are sent privately to each player's socket, not included in the public room snapshot.
- Players can only start rounds as host; server validates game actions.
- Do not use the same display name twice in one room.
- This MVP uses external Google Fonts; the core layout remains usable if fonts fail to load.

## Project structure
```text
spyfall-multiplayer/
├── server/index.js
├── src/main.jsx
├── src/ui/App.jsx
├── src/ui/styles.css
├── index.html
├── package.json
├── vite.config.js
└── README.md
```
