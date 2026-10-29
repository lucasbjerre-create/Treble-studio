import { Hono } from 'hono';
import { mediaApi } from './api/media';
import { studioApi } from './api/studio';
import { viewerApi } from './api/viewer';

export const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ ok: true }));
app.route('/studio', studioApi);
app.route('/viewer', viewerApi);
app.route('/media', mediaApi);
