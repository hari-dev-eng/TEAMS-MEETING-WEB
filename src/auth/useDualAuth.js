// src/auth/useDualAuth.js
import { app, authentication } from "@microsoft/teams-js";
import { PublicClientApplication, InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalConfig, WEB_API_SCOPE } from "../authConfig";

const pca = new PublicClientApplication(msalConfig);

/**
 * Returns a user assertion token usable by your backend:
 * - In Teams: Teams SSO ID token (aud = your ClientId)
 * - On website: MSAL access token for your API (scope = access_as_user)
 */
export async function getUserAssertion() {
  // Try Teams SSO first
  try {
    await app.initialize();
    await app.getContext(); // throws if not running in Teams
    const idToken = await authentication.getAuthToken(); // silent, no popup
    return { mode: "teams", token: idToken };
  } catch (e) {
    // Not in Teams → fall through to MSAL
  }

  const accounts = pca.getAllAccounts();
  if (accounts.length === 0) {
    await pca.loginRedirect({ scopes: [WEB_API_SCOPE, "openid", "profile", "email"] });
    throw new Error("Redirecting for login");
  }

  try {
    const res = await pca.acquireTokenSilent({ account: accounts[0], scopes: [WEB_API_SCOPE] });
    return { mode: "web", token: res.accessToken };
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await pca.acquireTokenRedirect({ account: accounts[0], scopes: [WEB_API_SCOPE] });
    }
    throw e;
  }
}
