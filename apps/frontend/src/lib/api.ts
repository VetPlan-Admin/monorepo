import "server-only";

/**
 * Backend base URL for server-to-server calls. Server-side only: the browser reaches the backend
 * directly just for the sign-in redirects; everything else goes through Next.js on the server.
 */
export const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Backend URL as the browser sees it, for the sign-in links. Same as API_URL unless the server reaches
 * the backend on a private address (Docker Compose: API_URL=http://backend:4000). The login page's
 * provider links are prerendered, so set it at build time too.
 */
export const PUBLIC_API_URL = process.env.PUBLIC_API_URL ?? API_URL;
