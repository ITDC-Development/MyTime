import { PublicClientApplication, type Configuration } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID ?? '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID ?? 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const MAIL_SCOPES = ['Mail.ReadWrite'];

export async function acquireMailToken(): Promise<string> {
  await msalInstance.initialize();
  const accounts = msalInstance.getAllAccounts();

  if (accounts.length > 0) {
    try {
      const result = await msalInstance.acquireTokenSilent({ scopes: MAIL_SCOPES, account: accounts[0] });
      return result.accessToken;
    } catch {
      // silent fail → popup
    }
  }

  const result = await msalInstance.loginPopup({ scopes: MAIL_SCOPES });
  return result.accessToken;
}
