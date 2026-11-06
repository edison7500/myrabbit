# Application state

`session.tsx` owns startup restoration plus the active site and date range shared by Dashboard, Explore, and analytics detail screens. The selected site identifier is persisted separately by `src/storage/selected-site.ts`; the date range is persisted by `src/storage/date-range.ts` and restored before startup is ready. The date preference survives site switches and connection replacement/removal. Widget links still explicitly select Today.

API keys must never enter the shared application store. Native credentials remain in SecureStore, while web credentials remain memory-only.
