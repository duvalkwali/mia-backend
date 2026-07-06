# MIA Frontend

Next.js dashboard for MIA, an AI-powered reply generation system. Talks to the [backend](../backend) API for auth, business logic, signal processing, and style prompts.

## Setup
1. Install Node.js (latest LTS) and pnpm.
2. Install dependencies:
   ```powershell
   pnpm install
   ```
3. Copy `.env.example` to `.env.local` and point it at your running backend instance.
4. Start the backend separately (see [backend/README.md](../backend/README.md)), then run the frontend:
   ```powershell
   pnpm dev
   ```

## How to Use the App
1. Open the frontend URL shown in the terminal, usually `http://localhost:3000`.
2. Sign in or register if the app requires authentication.
3. Use the dashboard to access:
   - `Playground` for testing AI reply generation and prompt variations.
   - `Profile` to manage user or bot settings.
   - `Replies` to view and edit generated responses.
   - `Signals` to manage triggers and message context.
   - `Style` to adjust tone, formatting, or reply behavior.
4. Send messages or connect messaging webhooks to let MIA process incoming requests and return AI-generated replies.
5. Monitor the backend logs for webhook activity, OpenAI request handling, and cache behavior.

## Notes
- Ensure the backend and frontend are both running and that the frontend is configured to call the backend API.
- Update your `DATABASE_URL` and `REDIS_URL` before running migrations and starting the server.
