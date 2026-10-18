# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# MyRabbit

MyRabbit is a lightweight mobile client for Rybbit with first-class support for self-hosted instances. It communicates directly with the configured Rybbit server. Do not introduce a MyRabbit backend or proxy.

## Stack and development

- Expo SDK 57, React Native, React 19, TypeScript with strict mode, and Expo Router.
- Use Node.js 24 LTS (`.nvmrc`) and npm. Keep `package-lock.json` in sync with dependency changes.
- Use `npx expo install` for Expo/native dependencies to select compatible versions. Do not upgrade the SDK as part of unrelated work.
- Consult relevant skills in `.agents/skills/` for Expo routing, native UI, data fetching, animation, and native modules. Preserve the existing project structure; do not reorganize it solely to match a new-project example.

## Project structure

- `src/app/`: Expo Router layouts and thin route files. Keep feature implementation outside the route directory.
- `src/features/`: Connection setup, site selection, Overview, Realtime, Explore, and Settings.
- `src/components/`: Shared screen and UI components.
- `src/constants/theme.ts`: Shared visual tokens.
- `src/api/rybbit/`: Rybbit requests, API types, and runtime response validation.
- `src/storage/`: Connection configuration and platform-specific persistence.
- `src/stores/session.tsx`: Startup restoration, connection status, and selected site metadata.
- `src/types/instance.ts`: Future instance metadata and active-instance types.
- Use the `@/` alias for imports from `src/`.

## UI style

- Use iOS 26 as the current visual and interaction design baseline for the app.
- Keep layouts, navigation, controls, typography, spacing, and visual effects consistent with that baseline while preserving the Lucide icon preference below.
- Do not adopt iOS 27 beta or preview design changes. After its official release, verify Apple's released guidance and reassess the UI before making a deliberate update.
- This is a design baseline, not a minimum deployment target. Do not change supported OS versions or dependencies solely to enforce the visual style.

## Icons

- Use Lucide for application UI icons. In React Native screens, including their Expo Web rendering, use `lucide-react-native` with the Expo-compatible `react-native-svg` dependency. Reserve `lucide-react` for DOM-only React code.
- Import named icons explicitly. Keep icon sizes, stroke widths, and colors consistent with the surrounding UI and shared theme.
- Do not introduce another UI icon library or use emoji/text glyphs as substitutes for UI icons. This preference takes precedence over icon-library recommendations in skills.
- Give icon-only controls accessible labels; decorative icons should not duplicate the control's accessible name.

## Current behavior

- Connection setup supports Cloud and custom self-hosted server URLs with an API key.
- Native storage saves the connection in SecureStore. Web previews keep it in memory only and require reconnecting after refresh.
- Startup restores the native connection before routing to site selection. The selected site is session-only; saving a connection clears it.
- Dashboard routes require a connection and selected site. Overview requests today's analytics; Realtime and Explore remain placeholders.
- The runtime currently uses one saved connection. The instance types are preparation for future multi-instance support, not a completed implementation.
- Check current code before making changes; do not assume every acceptance criterion from the original issue is implemented.

## Authentication and data boundaries

- Use a manually created Rybbit API key. Do not implement username/password login or depend on Rybbit browser sessions.
- Authenticate with `Authorization: Bearer <api_key>` and omit browser cookies. Never put keys in URLs or query parameters.
- Keep API keys out of shared application state, route parameters, normal local storage, logs, analytics, and error reports. Transient input and request memory are necessary; native credential persistence belongs in SecureStore.
- Preserve the web memory-only credential behavior. Do not silently substitute browser localStorage for SecureStore.
- Support configurable server URLs. Keep URL normalization centralized and do not disable TLS verification to accommodate self-hosted installations.
- When implementing multiple instances, store only non-sensitive metadata and credential references in ordinary storage, with an independent secure credential per instance.

Removing a connection means deleting only its locally saved API URL, API key, and site selection. Never delete Rybbit server sites or analytics data when removing a connection.

## API and navigation changes

- Verify endpoint paths, authentication requirements, and response shapes against current official Rybbit documentation or source. Account for self-hosted version differences.
- Validate external JSON at runtime; TypeScript assertions alone do not validate responses.
- Preserve loading, empty, failure, and retry states. Requests should have cancellation and bounded timeouts.
- Distinguish authentication failure from insufficient permissions where the response allows it. A network failure must not clear stored credentials.
- Changes to connection validation should validate before committing credentials and handle partial storage failures. Do not treat a successful local save as proof of API authentication.
- Preserve startup readiness and route guards. Do not reintroduce scaffold preview links that bypass connection/site requirements.
- Browser API access requires the Rybbit server's CORS support; do not add a proxy to work around it.

## Verification

- `npm ci`: install locked dependencies.
- `npm start`: start Expo; `npm run ios`, `npm run android`, and `npm run web` launch platform development targets.
- Run `npm run typecheck` and `npm run lint` for code changes.
- Run `npm run export` for routing, dependency, app configuration, or cross-platform changes. It bundles iOS, Android, and static web output; it does not prove native runtime behavior.
- For navigation or connection changes, exercise the affected flow on the relevant platform. Report which platforms were actually tested and any checks that could not run.
- Add focused tests for substantial logic when appropriate. Documentation-only changes do not require application builds.

## Working conventions

- Keep changes within the requested scope and preserve unrelated work in the checkout.
- Do not hand-edit generated output such as `dist/`, `.expo/`, `expo-env.d.ts`, or `node_modules/`.
- Update `README.md` when setup instructions or user-visible behavior changes.
- Do not claim placeholders, prepared types, or successful bundles are completed features or device tests.
