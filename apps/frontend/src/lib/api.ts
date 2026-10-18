import "server-only";

/**
 * Backend base URL. Server-side only: the browser reaches the backend directly
 * just for the OAuth redirects; everything else goes through Next.js on the server.
 */
export const API_URL = process.env.API_URL ?? "http://localhost:4000";
