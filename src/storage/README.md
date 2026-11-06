# Storage

The active connection configuration is stored as one versioned record in Expo SecureStore on iOS and Android. Its API key is never written to ordinary metadata storage. Web previews keep the configuration in memory only and clear it on refresh. The connection screen restores the saved configuration for editing; saving does not validate credentials against the server.

`clearConnection` removes the saved URL/key from native SecureStore or web memory. Session disconnection first clears the saved site selection, then the connection, and only then clears active state. If either storage operation fails, the active connection is retained and the UI offers retry; a credential-removal failure after selection cleanup may leave no persisted site selection, so startup rediscovery is used. No server request is made.

Appearance is non-sensitive and uses its own AsyncStorage key, `myrabbit.appearance.v1`, on native and web. Only `auto`, `light`, or `dark` is accepted; missing or invalid values default to `auto`. This preference survives connection removal. Browser credential storage remains memory-only.

The shared analytics date range is another non-sensitive preference stored in AsyncStorage on native and web, under `myrabbit.date-range.v1`. It contains only a supported preset or validated inclusive custom dates. Relative presets are resolved when requesting analytics, rather than storing fixed dates. Missing, invalid, or unreadable preferences fall back to Today without blocking connection restoration. Writes are serialized so the latest selection wins; failed saves leave the active range usable for the current session. This preference survives site switches and connection replacement/removal.
