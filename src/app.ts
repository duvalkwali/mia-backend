import express from 'express';

export const app = express();

app.use(express.json());

// Simple request logger to help debug why clients sometimes see unexpected responses
app.use((req, _res, next) => {
  console.log(`[HTTP] ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Ensure visiting the root returns the same health payload (avoids "Cannot GET /")
app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

// Final 404 handler that logs unexpected requests (useful for debugging)
app.use((_req, res) => {
  res.status(404).send('Not found');
});

