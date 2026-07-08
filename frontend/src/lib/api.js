import axios from "axios";

/**
 * API client configured for both local development and production.
 *
 * Local dev:  NEXT_PUBLIC_API_URL is "http://localhost:8000"
 *             → baseURL = "/api" (uses Next.js rewrites to proxy)
 *
 * Production: NEXT_PUBLIC_API_URL is "https://obsidian-api.onrender.com"
 *             → baseURL = "https://obsidian-api.onrender.com" (direct calls)
 */
function getBaseURL() {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "";

  // If the URL points to localhost, use the /api rewrite proxy
  if (!envUrl || envUrl.includes("localhost")) {
    return "/api";
  }

  // In production, call the backend directly
  return envUrl;
}

const api = axios.create({
  baseURL: getBaseURL(),
});

export default api;
