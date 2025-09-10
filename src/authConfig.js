// msalConfig.js

export const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_CLIENT_ID || "e993e6b1-9127-4d76-8873-adff75542ed1",
    authority: process.env.REACT_APP_AUTHORITY || "https://login.microsoftonline.com/388b828e-0007-4935-b8e4-d5d5f5671f61",
    redirectUri: process.env.REACT_APP_REDIRECT_URI || "https://teams-meeting-web.vercel.app/",
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
};

// ----- API scope for YOUR backend (Expose an API -> Scopes) -----
export const API_SCOPE =
  process.env.REACT_APP_API_SCOPE ||
  "api://e993e6b1-9127-4d76-8873-adff75542ed1/Bookings.ReadWrite";

// Login request includes Graph + your API scope
export const loginRequest = {
  scopes: ["openid", "profile", "email", "User.Read", API_SCOPE],
};

// Your backend base URL
export const apiConfig = {
  apiUrl: process.env.REACT_APP_API_URL || "https://teamsbackendapi-production.up.railway.app",
};

// Helper: get a token for YOUR API (audience = your API app)
export async function getApiAccessToken(instance, account) {
  const req = { scopes: [API_SCOPE], account };
  try {
    const r = await instance.acquireTokenSilent(req);
    return r.accessToken;
  } catch {
    const r = await instance.acquireTokenPopup(req);
    return r.accessToken;
  }
}
