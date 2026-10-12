# Virtual Shelf

3D virtual library shelf browser for Jellyfin movies, steam games, and opds libraries. Renders DVD cases in a Three.js scene, pulling metadata and cover art from Jellyfin/steam/opds APIs. Allows the user to create collections that can be curated across the libraries.

## Usage

Configure config.js with details

```
npm run start
```

## Jellyfin

The server proxy needs `jellyfin.secret.js` next to `server.js`. It's gitignored, so create it on each deploy:

```js
export const JELLYFIN_SERVER = {
  server: 'https://your-jellyfin-url',
  apiKey: 'your-api-key',
};
```

Without it the proxy stays disabled and `/jellyfin-api/...` requests return 503.

## Warning

This can crash on lower-end devices, run at your own risk.
