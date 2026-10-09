import { BrowserCacheLocation } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || "organizations";

export const msalConfig = {
  auth: {
    clientId:
      import.meta.env.VITE_ENTRA_CLIENT_ID || "replace-with-your-client-id",
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: BrowserCacheLocation.SessionStorage,
  },
};

export const loginRequest = {
  scopes: ["openid", "profile"],
};

export const apiScopes = (import.meta.env.VITE_API_SCOPES || "")
  .split(/\s+/)
  .filter(Boolean);

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
