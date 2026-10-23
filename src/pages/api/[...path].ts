import type { APIRoute } from 'astro';
import { app } from '../../worker/api';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => app.fetch(request);
