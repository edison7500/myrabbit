# Privacy and API keys

MyRabbit is an independent client that connects directly to the Rybbit Cloud or self-hosted server you configure. There is no MyRabbit backend or proxy. You need an existing Rybbit account/site and a manually created API key; MyRabbit does not implement password login.

## Stored information

- On Android and iOS, the configured connection (server URL, hosting mode and API key) is stored using Expo SecureStore. The app must read the key into request memory to authenticate.
- Browser previews keep the connection and key in memory only. Refreshing requires reconnecting; credentials are not persisted in browser localStorage.
- Selected-site display metadata and appearance preferences are stored separately using AsyncStorage. API keys are not part of those ordinary storage records.
- Analytics responses are displayed in the app and held in memory while in use. They can contain visitor/session information supplied by your server; treat screenshots and device logs accordingly.

## Network access

Authenticated API requests go directly to the configured server using `Authorization: Bearer <api_key>`, with browser cookies omitted. Keys are not placed in request URLs. The app also requests site favicons from that server's public favicon endpoint without an API key. Your Rybbit provider controls how its server processes these requests and analytics data; consult its privacy policy or your self-hosted deployment configuration.

Only use a server you trust. Prefer HTTPS, particularly for remote self-hosted deployments. MyRabbit does not bypass TLS certificate verification. API availability and permissions depend on your Rybbit version and key; browser previews also require server CORS support.

## Removing access

Removing a connection deletes the connection credentials and selected-site record saved by MyRabbit on that device (or in that browser session). It does not delete Rybbit sites or analytics, and it does not revoke the API key on the server. Revoke an exposed or no-longer-needed key through Rybbit itself. Appearance preferences can remain after connection removal.

Do not include real API keys, signing secrets or visitor data in bug reports. Android release dependency/permission and network review is tracked in [the release checklist](ANDROID_RELEASE.md); this document is not a completed independent privacy audit.
