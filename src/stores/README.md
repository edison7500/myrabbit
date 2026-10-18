# Application state

`session.tsx` owns startup restoration plus the active site and Dashboard date range shared by overview and metric-detail screens. The selected site identifier is persisted separately by `src/storage/selected-site.ts`; the date range lasts for the current app session.

API keys must never enter the shared application store. Native credentials remain in SecureStore, while web credentials remain memory-only.
