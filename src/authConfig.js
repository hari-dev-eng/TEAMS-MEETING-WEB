// authConfig.js
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

export const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "email",
    "User.Read", 
    "api://e993e6b1-9127-4d76-8873-adff75542ed1/Bookings.ReadWrite"
  ]
};

export const apiConfig = {
  apiUrl: "https://teamsbackendapi-production.up.railway.app" // backend API
};
