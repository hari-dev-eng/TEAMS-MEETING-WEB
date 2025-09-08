// auth.js
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, loginRequest } from "./authConfig";

const msalInstance = new PublicClientApplication(msalConfig);

export async function getApiToken() {
  if (window?.microsoftTeams) {
    await window.microsoftTeams.app.initialize();
    const ssoToken = await window.microsoftTeams.authentication.getAuthToken();
    return ssoToken;
  }
  // Website flow: MSAL
  const accounts = msalInstance.getAllAccounts();
  const account = accounts[0] || (await msalInstance.loginPopup(loginRequest)).account;
  const res = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
  return res.accessToken;
}
