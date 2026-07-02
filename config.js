export const JELLYFIN = {
  server: 'jellyfin server url',
  apiKey: 'jellyfin api key',
  userId: 'jellyfin user id',
};

export const JELLYFIN_WEB = 'https://<jellyfin server url>/web/#/details?id=';

export const STEAM = {
  apiKey: 'steam api key',
  steamId: 'steam public user id',
};

export const OPDS = {
  feedUrl: 'opds link',
  maxItems: 500,
  useProxy: true,
  proxyBase: 'https://localhost' // or if publically hosted then public url,
  auth: { username: 'username', password: 'password' }, // in case we need auth
  // auth: { token: '' },
};
