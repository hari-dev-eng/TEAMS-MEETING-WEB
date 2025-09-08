// src/authConfig.js
export const msalConfig = {
  auth: {
    clientId: "e993e6b1-9127-4d76-8873-adff75542ed1",
    authority: "https://login.microsoftonline.com/388b828e-0007-4935-b8e4-d5d5f5671f61",
    redirectUri: "https://teams-meeting-web.vercel.app/"
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false
  }
};

// IMPORTANT: this scope must exist in Entra -> "Expose an API"
export const WEB_API_SCOPE =
  "api://teams-meeting-web.vercel.app/e993e6b1-9127-4d76-8873-adff75542ed1/access_as_user";

// Optionally keep any other exports you had before.
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "https://teamsbackendapi-production.up.railway.app";
