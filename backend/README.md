# mia-backend
Privacy-first, cost-efficient AI reply generation system (MVP)

MIA is an AI-powered backend service designed to generate smart, contextual replies for messaging workflows. It combines Redis caching, Prisma database access, OpenAI integration, and webhook-driven messaging to help businesses automate conversational responses while keeping privacy and cost-efficiency in mind.

## What MIA Does
- Generates AI-driven reply suggestions and message responses.
- Supports webhook integrations for messaging platforms.
- Uses Redis for fast caching and Prisma for relational data storage.
- Includes modules for auth, business logic, signal processing, and style prompts.
- Provides a frontend dashboard for managing profiles, replies, signals, and prompts.

## Setup
1. Install required system tools if they are not already installed:
   - Node.js (recommended latest LTS) and npm
   - Redis server for local caching and session storage
   - Optional: ngrok only if you need a public webhook tunnel for external integrations
2. Clone the repository and navigate to the backend project root:
   ```powershell
   cd <path-to-your-repo>\mia-backend
   ```
3. Install backend dependencies:
   ```powershell
   npm install
   ```
4. Install frontend dependencies from the `frontend` folder:
   ```powershell
   cd frontend
   npm install
   ```
5. Configure environment variables for the backend in your `.env` or env configuration. Typical settings include:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `OPENAI_API_KEY`
   - webhook secrets or auth values used by the application
6. Run Prisma migrations and generate the client:
   ```powershell
   cd <path-to-your-repo>\mia-backend
   npx prisma migrate dev --name init
   npx prisma generate
   ```

### Notes for users without Redis or ngrok
- If you do not have Redis installed, install it locally using your package manager, Docker, or a Redis distribution for Windows.
- `ngrok` is not required to run the app locally. It is only needed if you want to expose a local backend to external webhook providers.
- If you are not using external webhooks, you can run the backend locally and point the frontend to `http://localhost:3000` or the configured local API endpoint.

## Run Backend and Frontend Simultaneously
From the project root, open two terminal windows or tabs.

Terminal 1: Start the backend
```powershell
cd <path-to-your-repo>\mia-backend
npm run dev
```

Terminal 2: Start the frontend
```powershell
cd <path-to-your-repo>\frontend
npm run dev
```

If you want to run both from a single terminal, you can also use a tool like `concurrently` if installed globally, or add a script to the root package.

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
