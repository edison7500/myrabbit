# MyRabbit Development

[Back to MyRabbit](../README.md)

## Environment Setup

Use Node.js 24 LTS and npm. Dependency versions are pinned by `package-lock.json`.

Read the [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) before changing Expo configuration or native code. Install Expo/native dependencies with `npx expo install` and commit the resulting `package-lock.json` changes.

## Development Commands

```sh
npm ci
npm start
```

- `npm run ios` — open with an iOS simulator (requires macOS and Xcode).
- `npm run ios:release` — select an iOS device and build/install Release with the JS bundle embedded; Metro is not started.
- `npm run android` — open with an Android emulator (requires Android SDK).
- `npm run android:release` — build/install a signed Android Release with embedded JavaScript (requires Android SDK and release signing environment variables; see [Android releases](ANDROID_RELEASE.md)).
- `npm run android:apk:debug` / `android:apk:unsigned` / `android:apk:release` — build debug, unsigned packaging, or signed release APKs without Android Studio.
- `npm run web` — browser preview.
- `npm run typecheck` — TypeScript checks.
- `npm run lint` — ESLint checks.
- `npm run export` — bundle iOS, Android and static web assets.

Use an Expo Go version compatible with the installed Expo SDK, or a development build.

## Connection Architecture

Configure your Cloud or self-hosted Server URL and API key, tap **Test Connection**, then **Save & Continue** after verification. Editing any connection field requires a new test. Failed tests leave the saved connection unchanged. Select an accessible site to open its Dashboard with six overview metrics from Rybbit. KPI cards show the change from the preceding equal-length period when a valid baseline is available; comparison failures leave current metrics visible without a change value. The Dashboard date selector mirrors Rybbit Web’s current presets, supports an inclusive custom range, and uses the device IANA timezone. Pull down to refresh the metrics for the selected range. Tap any of the six Dashboard metric cards to push its corresponding trend detail. Cards use metric-specific Lucide icons without disclosure chevrons. Each detail shows the selected metric’s actual bucket values, formats percentages, ratios and durations appropriately, and preserves the active site and date range; expand the chart to view it sideways without rotating the app UI. Both portrait and expanded metric views use a violet current-period line with a fading area fill. Today adds a muted gray solid Yesterday comparison at matching hours. Today always spans 00:00–24:00, even early in the day or when the server returns only a few buckets. Hourly values are plotted at the end of their interval: at 21:30 the 21:00–22:00 interval is dashed without fill, completed intervals remain solid with fill, and later hours stay empty. The interval boundary uses the selected analytics timezone; Yesterday retains its full-day comparison. Tap a metric or Traffic detail chart to inspect exact bucket values. Today readouts show the hourly interval and identify its in-progress bucket; future intervals cannot be selected. Screen readers can increment or decrement the selected bucket, and the web preview supports arrow keys. Chart inspection is static and the expanded chart opens without an added fade. Returning keeps the active site and date range. Tap the site name in the Dashboard header, or use **Switch site** in Settings, to choose another site.

Connection setup and site selection share one Settings modal with an internal navigation stack. Without a selected site, the main page stays visible and offers **Add a site**, which opens connection setup. A saved connection with no selected site loads its accessible sites and automatically opens the first site’s Dashboard. **Save & Continue** saves the verified connection, closes the entire modal and returns to the main page, which performs this discovery. The site list is only shown inside the Settings modal for switching or managing sites. An empty server shows a main-page empty state with refresh, **Add a site** and **Manage sites** actions; saving a connection does not create a server-side Rybbit site. No startup modal opens automatically. Editing the connection and going back use the inner stack. Closing the modal returns to the underlying app when a site is selected, or to the startup screen otherwise. Choosing a site closes the entire modal and opens its Dashboard. Connection setup shows the saved connection; tap it to edit, or use **Add +** at the bottom to open a blank connection form. MyRabbit currently saves one connection, so saving an added connection replaces the existing one after verification. On the Connection setup screen, swipe left on **Saved connection** to reveal **Remove**. Confirming removes only the API URL/key saved on this device (or in browser memory) and the local selected-site record. Rybbit sites and analytics data remain on the server, and the server-side API key is not revoked. Site rows only open Dashboards. Browser previews also provide a visible remove button. Local storage failures show an error and allow retry; no server deletion request is sent.

Settings displays the current site’s favicon from the configured Rybbit server’s public `/api/favicon?domain=…` endpoint, without sending an API key or cookies. Missing icons, older servers, and load failures retain the Globe fallback. Native credentials are stored in SecureStore. Browser previews retain credentials only in memory, so refresh requires reconnecting. The selected site ID and non-sensitive display metadata are stored separately in AsyncStorage. Startup validates that saved site against the accessible site list and opens its Dashboard when it remains available; temporary server failures preserve the saved selection. Saving a new connection clears the selection. Explore contains the Visitors/Pageviews Traffic chart and the first five Referrers for the shared site and date range. Explore also includes Content (Pages, Titles, Entries, Exits, Hostnames), Technology (Browsers, Devices, Operating Systems, Screen Dimensions), Locations (Countries, Regions, Cities, Languages, Timezones), Events (Custom Events, Outbound, Buttons, Forms, Copies), and Weekly Trends. Every ranking section previews at most five rows. The right-side chevron opens a detail page with the selected category and all available rows, including every API page. Weekly Trends displays its full 24-hour heatmap directly in Explore, without a chevron or detail page. Explore section titles use muted gray Lucide icons (ChartSpline for Traffic) and stick below the navigation bar while scrolling, with the next section replacing the previous header. Explore’s navigation title is the site switcher, with the date picker on the right; custom dates open in a bottom sheet. Dashboard retains its in-page controls. Weekly Trends averages hourly buckets by weekday and hour in the selected timezone, with six metrics and tappable cells. Missing hourly metrics are shown as unavailable. All charts share the selected range and filters, refresh on pull, retry independently, and retain successful results when a refresh fails. Tap Explore’s Traffic heading or chart to open its Visitors/Pageviews detail. Tap the Referrers heading to open the full paginated list. Realtime displays the latest 100 sessions from the last 30 minutes in a responsive visitor table, with device, country, pageview/event counts, source, entry/latest pages, start time and duration. Tap a row to expand its details. It refreshes every 30 seconds while the tab is visible and the app is active; pull down or tap the refresh button on the right of the Realtime navigation bar to update manually. The navigation button has no background and its refresh icon rotates while loading (static when Reduce Motion is enabled); only an explicit pull-to-refresh gesture shows the native pull indicator. Automatic and navigation-button refreshes do not trigger the pull animation. Failed refreshes retain the last successful result. Green dots indicate activity within five minutes, not a guaranteed live connection. Rybbit’s timezone-less session timestamps are interpreted as UTC before displaying them in the selected analytics timezone. Anonymous visitor names are generated locally from the visitor ID and may differ from Rybbit Web. Country flags appear beside country codes; unknown locations retain a text fallback. Flags use Unicode country symbols, with rendering dependent on the platform. Application UI icons and visitor avatars continue to use Lucide.

Requests go directly to Rybbit using Bearer authentication, without browser cookies. The key needs organization/site read access and analytics read access. Browser previews also require the server to allow cross-origin API requests.

## Project Structure

- `src/app/`: Expo Router layouts and thin route files
- `src/features/`: Connection setup, site selection and app sections
- `src/api/rybbit/`: API client and response validation
- `src/storage/`: Platform-specific credential storage
- `src/stores/`: Connection restoration and current site metadata

See also the focused [API documentation](../src/api/rybbit/README.md), [storage documentation](../src/storage/README.md), and [session documentation](../src/stores/README.md).

## iOS / Android Builds

`npm run ios` and `npm run android` generate native projects as needed and build locally. iOS requires macOS and Xcode; Android requires a configured Android SDK and an emulator or connected device. The generated `ios/` and `android/` directories are ignored by Git. Keep native configuration in `app.json` and config plugins, then apply it through Expo prebuild.

For an iPhone build that launches without Metro, run `npm run ios:release`. It uses Expo's device picker, builds Release with the JS bundle embedded, and does not start Metro. Debug builds require the development server (`npm start`) to remain reachable from the phone. The local `with-ios-script-sandboxing` config plugin disables Xcode User Script Sandboxing for the app project so Metro can read project files and write the embedded Release JS bundle. After adding or changing this plugin, run `npx expo prebuild --platform ios --no-install` to apply it before building from Xcode.

The initial release configuration uses app/package version `0.1.0`, iOS `buildNumber: "1"`, and Android `versionCode: 1`, following the [Expo SDK 57 app configuration](https://docs.expo.dev/versions/v57.0.0/config/app/). These values prepare the release; they do not indicate a published build. After changing native version or branding configuration, run `npx expo prebuild` for the target platform and rebuild to apply it to an existing generated project. Android Expo modules are configured to build from source. The release signing plugin produces unsigned release APKs unless all release signing variables are supplied; it does not reuse the template's debug key. See [Android build, signing and F-Droid preparation](ANDROID_RELEASE.md).

## Troubleshooting

### Xcode, Metro, and native toolchains

For **Xcode Debug on a physical iPhone**, start Metro with `npm start -- --lan --port 8081` before pressing Run, keep it running, and connect the phone and Mac to the same reachable local network. A USB connection alone does not supply the JS bundle. If launch reports `No script URL provided` / `unsanitizedScriptURLString = (null)`, open `http://<Mac-LAN-IP>:8081/status` in Safari on the phone; it should show `packager-status:running`. If it cannot connect, check MyRabbit's Local Network permission in iOS Settings and any VPN/firewall blocking the connection. If the Mac's IP or Metro port has changed, rebuild the Debug app so its embedded `ip.txt` / `RCTMetroPort` match, then stop and relaunch it. For simulator-only development, Metro can use `npm start -- --localhost --port 8081`. Use a Release build when the app must launch with Metro stopped; switching Xcode's Run configuration to Release embeds the JS bundle during the build.

Xcode 27 requires the UIKit scene lifecycle at launch. This SDK 57 project uses Expo 57.0.23 or newer with `expo-build-properties` and `ios.enableSceneSupport: true`, as described in the [versioned Expo documentation](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/#pluginconfigtypeios). After updating dependencies, run `npx expo prebuild --platform ios`, then rebuild the app from `ios/MyRabbit.xcworkspace` (or use `npm run ios`). Prebuild updates the generated AppDelegate and scene manifest; rebuilding an older generated project can succeed but crash immediately with “UIScene life cycle is required”.

For Xcode 27.1 / Swift 6.4, `expo-build-properties` sets `ios.usePrecompiledModules: false` so Expo modules compile with the active toolchain. The SDK 57 precompiled Swift 6.3.1 modules can fail to import with `cannot find type '__ObjC::expo' in scope` followed by an `ExpoModulesCore` compiler/SDK mismatch. Apply this setting with `npx expo prebuild --platform ios` before rebuilding Release. The first native build takes longer because Expo modules are built from source; React Native's prebuilt core remains enabled.

After switching Xcode/SDK versions, ExpoModulesJSI may also reuse an incompatible cached framework even when the Swift version is unchanged ([upstream issue](https://github.com/expo/expo/issues/50365)). After prebuild/Pod installation, rebuild its device slice with Expo's own script before building the app:

```sh
PODS_ROOT="$PWD/ios/Pods" PLATFORM_NAME=iphoneos bash node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh --clean
```

Use `PLATFORM_NAME=iphonesimulator` instead when targeting a simulator. This regenerates JSI build artifacts without editing generated interfaces or dependency source files.

### Expo Go tools button

The blue floating gear in Expo Go is the development menu's **Tools button**, not a MyRabbit settings control. Hide it in the Expo developer menu by turning off **Tools button**. MyRabbit's settings entry is the bottom Settings tab; no floating settings control is rendered by the app.

## UI Baseline and Branding

The app icon, launch screen, and web favicon use [`assets/images/myrabbit-logo.png`](../assets/images/myrabbit-logo.png). The native launch screen keeps the centered rabbit logo visible while the saved appearance, connection and site restore, then opens the app. Native icon and launch-screen changes require rebuilding the app; Expo Go does not preview the final native branding. Verify launch branding with a Release build (`npx expo run:ios --configuration Release`), since development builds can show Expo loading UI.

Selected tab bar icons and labels use violet; inactive tabs use gray. Navigation, native pickers, sheets, keyboards, charts and the status bar follow the selected appearance.

Initial analytics, chart, realtime, referrer, and site-list loads show pulsing skeletons shaped like their content. With reduced motion enabled, the placeholders stay still. Pull-to-refresh keeps loaded content visible while updating.

In **Settings → Appearance → Theme**, choose **Auto**, **Light**, or **Dark**. Auto is the default and follows system appearance changes, including after returning from a fixed mode. Your choice is stored separately in AsyncStorage on native and web and restored before revealing the app. Changing appearance preserves the active site, date range, loaded data and chart inspection. Storage failures retain the active mode and show a retryable error in Settings; they do not affect credentials. Light uses pale gray backgrounds, white cards and a darker violet accent. Dark retains the Soft Dark `#212121` background, `#2C2C2E` opaque cards, subtly elevated gray controls, and restrained `#A78BFA` violet accent. The native launch screen follows the system until JavaScript restores a saved override; native appearance/launch configuration changes require rebuilding. Colors, spacing, typography, corner radii and layout dimensions live in `src/constants/theme.ts`; shared surfaces, metric cards and section headings live in `src/components/analytics-ui.tsx`. Dashboard metrics use a compact two-column grid with tabular numbers and explicit previous-period comparisons when available. At larger system text sizes, metrics and inline date controls stack vertically. The floating tab bar retains the existing iOS 26 navigation baseline and uses native Liquid Glass when supported. Reduce Transparency and unavailable glass APIs use an opaque fallback matching the active theme. UI icons use `lucide-react-native` with Expo-compatible `react-native-svg`; native hosting controls and Settings rows use `@expo/ui`. On iOS, Settings action rows size to their content and scroll with the page and privacy note. This design baseline does not change the minimum supported OS version.

All four tabs share a persistent native navigation bar. Switching tabs updates only its title. On iOS, the bottom tabs use a floating glass surface when supported; Web uses a matching translucent surface, while Android keeps its standard bottom bar. Tab content stays clear of the floating bar and safe areas; standalone connection screens retain their own safe-area padding.

## Testing

Run `npm test` for focused request, connection validation, storage-boundary and Dashboard tests, plus `npm run typecheck`, `npm run lint` and `npm run export` for project validation. Tests use synthetic credentials and mocked network/platform boundaries; they do not contact your server or access your real Keychain.

Connection testing makes one authenticated `GET /api/organizations` request with a 10-second timeout. It distinguishes invalid URLs, network failures, timeouts, 401/403, unexpected payloads and server errors. Successful validation confirms this endpoint is accessible, not every analytics permission. Web networking may require server CORS configuration.

An export verifies bundling for iOS, Android, and static web; it does not verify native launch, icon rendering, device behavior, or a live Rybbit connection. For connection or navigation changes, exercise the affected flow on the relevant platform and record what was actually tested.
