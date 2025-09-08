// src/api.js
import { getUserAssertion } from "./auth/useDualAuth";
import { API_BASE_URL } from "./authConfig";

/**
 * call your bookings API with a user assertion (Teams SSO or Web MSAL)
 * The server will validate + OBO to Graph.
 */
export async function makeApiCall(requestBody) {
  const { token, mode } = await getUserAssertion();

  const res = await fetch(`${API_BASE_URL}/api/Bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Auth-Mode": mode // optional: handy for server logs
    },
    body: JSON.stringify(requestBody),
    credentials: "include"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}
