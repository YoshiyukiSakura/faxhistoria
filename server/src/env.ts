import { config } from 'dotenv';
import { resolve } from 'path';

// Load project-root .env before importing modules that read process.env at module scope.
// `override: true` ensures stale PM2 daemon env vars don't shadow fresh .env values.
config({ path: resolve(__dirname, '../../.env'), override: true });
