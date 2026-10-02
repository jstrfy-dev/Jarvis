# JARVIS Personal AI Assistant

A futuristic personal AI assistant with a responsive desktop/mobile HUD, voice input, chat, system monitoring, permission-aware tool execution, and local backend services.

## Quick start

1. Install dependencies:
   npm install
2. Copy `.env.example` to `.env` and edit values as needed.
3. Start the app:
   npm run dev
4. Open the frontend in your browser (local machine or mobile on same network).

## Frontend

- URL: http://localhost:5173
- Signals: WebSocket-based live status and log updates

## Backend

- API server: http://localhost:3001
- WebSocket: ws://localhost:3001

## Security

- High-risk actions require confirmation.
- Safe allowlist handles terminal commands.
- Secrets and API keys should remain in `.env` and never be exposed to the frontend.

## Commands examples

- Open my website project
- Show system information
- Search my project for error
- Run my project
- Remember that my main website project is Final
- Forget that information
- Check git status

## Mobile access

Open the frontend from the same Wi-Fi network using the PC IP address, for example:

http://192.168.1.10:5173
