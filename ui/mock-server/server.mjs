// Entry point: node mock-server/server.mjs
// Env: PORT (default 3000), MOCK_EMPTY=1 (start with no people), MOCK_DELAY_MS (artificial latency).
import { createMockServer } from './app.mjs';

const port = Number(process.env.PORT) || 3000;
const empty = ['1', 'true'].includes((process.env.MOCK_EMPTY ?? '').toLowerCase());
const delayMs = Number(process.env.MOCK_DELAY_MS) || 0;

const server = createMockServer({ empty, delayMs });
server.listen(port, () => {
  const extras = [empty && 'empty seed', delayMs > 0 && `${delayMs} ms delay`]
    .filter(Boolean)
    .join(', ');
  console.log(`ACTS mock API listening on http://localhost:${port}${extras ? ` (${extras})` : ''}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
