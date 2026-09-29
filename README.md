# Real-time Chat App (React Native + Node/Express + Socket.io)

## Structure
- `backend/` – Express REST API + Socket.io + SQLite (better-sqlite3)
- `mobile/` – React Native (Expo) app

## Backend
```
cd backend
npm install
npm start        # http://localhost:4000
```
Env vars: `PORT` (default 4000), `DB_PATH` (default chat.db).
REST: `POST /api/messages` (send), `GET /api/messages` (history).
Socket events: `join`, `send_message`, `new_message`, `typing`, `stop_typing`, `online_users`.

## Frontend
```
cd mobile
npm install
# set API_URL in config.js (LAN IP for local, deployed URL for prod)
npx expo start   # scan QR with Expo Go
```
Build APK: `npm i -g eas-cli && eas build -p android --profile preview`

## Deploy backend
Render/Railway: root dir `backend`, build `npm install`, start `npm start`.
(SQLite file resets on free tiers without a disk; attach a disk or swap to MongoDB for persistence.)

## Design decisions
- Socket.io for real-time broadcast; messages persisted in SQLite so history survives refresh.
- Client dedupes messages by id; server is source of truth for timestamps.
- Errors handled via try/catch, socket ack callbacks, and UI error banner.

## Assumptions
- Single global chat room; dummy username login (no password).
- Bonus done: username login, typing indicator, online users.
