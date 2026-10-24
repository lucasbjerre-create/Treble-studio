import { Hono } from 'hono';
import { studioApi } from './api/studio';

export const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ ok: true }));
app.route('/studio', studioApi);
