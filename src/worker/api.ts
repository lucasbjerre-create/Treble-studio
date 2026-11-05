import { Hono } from 'hono';
import { crossingsApi } from './api/crossings';
import { mediaApi } from './api/media';
import { slideshowApi } from './api/slideshow';
import { studioApi } from './api/studio';
import { viewerApi } from './api/viewer';

export const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ ok: true }));
app.route('/studio', studioApi);
app.route('/viewer', viewerApi);
app.route('/media', mediaApi);
app.route('/slideshow', slideshowApi);
app.route('/crossings', crossingsApi);
