import { PublicClientApplication, type Configuration } from '@azure/msal-browser';

const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID ?? '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID ?? 'common'}`,
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'localStorage' },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Initialize once at module load. handleRedirectPromise() must run so that
// when the popup loads this app it posts the auth result back to the parent and closes.
const initPromise = msalInstance.initialize().then(() =>
  msalInstance.handleRedirectPromise().catch(e => console.error('[MSAL] handleRedirectPromise:', e))
);

export const MAIL_SCOPES = ['Mail.ReadWrite'];

export async function acquireMailToken(): Promise<string> {
  await initPromise;
  const accounts = msalInstance.getAllAccounts();

  if (accounts.length > 0) {
    try {
      const result = await msalInstance.acquireTokenSilent({ scopes: MAIL_SCOPES, account: accounts[0] });
      return result.accessToken;
    } catch {
      // silent fail → popup
    }
  }

  const result = await msalInstance.loginPopup({
    scopes: MAIL_SCOPES,
    redirectUri: `${window.location.origin}/auth-redirect.html`,
  });
  return result.accessToken;
}
