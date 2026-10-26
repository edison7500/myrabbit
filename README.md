<p align="center">
  <img src="assets/images/myrabbit-logo.png" width="160" alt="MyRabbit logo" />
</p>

<h1 align="center">MyRabbit</h1>

<p align="center">A lightweight Rybbit analytics client for iOS and Android.<br />Connect directly to Rybbit Cloud or your self-hosted instance.</p>

<p align="center">
  <a href="https://github.com/edison7500/myrabbit/releases/tag/v0.1.0"><img src="https://img.shields.io/badge/version-v0.1.0-8B5CF6" alt="Version: v0.1.0" /></a>
  <a href="https://docs.expo.dev/versions/v57.0.0/"><img src="https://img.shields.io/badge/Expo-SDK_57-000020" alt="Expo SDK 57" /></a>
  <a href="https://reactnative.dev/"><img src="https://img.shields.io/badge/React_Native-0.86.3-61DAFB" alt="React Native 0.86.3" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-6.0-3178C6" alt="TypeScript 6.0" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

## Overview

MyRabbit brings your [Rybbit](https://rybbit.com/) website analytics to your phone: check key metrics, explore traffic, and see recent visitor activity. It communicates directly with your configured Rybbit server, with no MyRabbit backend or proxy.

**v0.1.0 for Android** was published on October 23, 2026. Download the signed APK and SHA-256 checksum from [GitHub Releases](https://github.com/edison7500/myrabbit/releases/tag/v0.1.0). F-Droid packaging is in preparation; Linux x86_64 build validation and F-Droid review remain pending.

## Features

- **Dashboard:** unique users, sessions, pageviews, pages per session, bounce rate, and session duration, with previous-period comparisons when available and selectable date ranges. All six icon-labeled cards open their own interactive trend chart, with no disclosure chevrons.
- **Metric chart orientation:** metric details follow device rotation only while that page is visible; other pages stay portrait. Landscape shows the chart with a fixed header and large back control; rotate upright to restore the details. The fullscreen button opens a chart in the current orientation with a native fade, and the chart continues to follow rotation. Safe areas and scrollable details support smaller screens and larger text.
- **iOS Home Screen widgets:** Small shows unique users; Medium shows users, pageviews, and bounce rate; Large shows all six metrics, the site, and the last successful update. Widgets show Today for the selected site and analytics timezone, with the same values and comparisons as the unfiltered Dashboard.
- **Traffic exploration:** visitor/pageview charts, referrers, content, technology, locations, events, and a weekly trends heatmap, with detailed rankings.
- **Realtime activity:** the latest 100 sessions from the last 30 minutes, expandable visitor details, and refreshes every 30 seconds while visible and active.
- **Cloud and self-hosted connections:** test your server URL and API key before saving, then switch between accessible sites. One saved connection is supported at a time.
- **Appearance:** Light, Dark, or Auto to follow your device.
- **iOS navigation:** system-native tabs stay expanded while scrolling. Health-style large navigation titles collapse into compact titles as content scrolls, with native scroll-edge materials and system accessibility support. Tap the active tab to return to the top. Lucide icons are preserved. Android keeps its existing navigation.
- **Local credential storage:** API keys stay in SecureStore on iOS and Android. Browser previews keep credentials in memory only and require reconnecting after refresh.

## Screenshots

Authentic Android screenshots are still pending and will be added to this page and the F-Droid listing metadata.

| Dashboard | Explore | Realtime |
| --- | --- | --- |
| Coming soon | Coming soon | Coming soon |

## Getting Started

1. Open your Rybbit web interface (Cloud or self-hosted) and create an API key in its settings. See Rybbit’s [API key guide](https://rybbit.com/docs/api/getting-started). The key needs access to organization/site discovery and analytics reads.
2. Install the Android APK from [GitHub Releases](https://github.com/edison7500/myrabbit/releases/tag/v0.1.0), or build the app using the development commands below. On the startup screen, tap **Add a site**, choose Cloud or enter your self-hosted server URL, and paste the API key.
3. Tap **Test Connection**, then **Save & Continue** after verification. MyRabbit opens the first accessible site; use the site switcher to choose another.

You need an existing Rybbit site with analytics data. MyRabbit does not create server-side sites or sign in with a username/password. Removing a connection clears only local credentials and site selection; your Rybbit sites and analytics remain on the server. Self-hosted API availability varies by server version; browser previews also require server CORS support.

## Tech Stack

Versions below match the dependency declarations in [package.json](package.json); exact resolutions are recorded in [package-lock.json](package-lock.json).

| Component | Library / version |
| --- | --- |
| App framework | Expo SDK 57 (`~57.0.23`) |
| UI runtime | React Native `0.86.3` · React `19.2.3` |
| Language | TypeScript `~6.0.3` (strict mode) |
| Navigation | Expo Router `~57.0.19` |
| Icons | Lucide React Native `^1.41.0` · React Native SVG `15.15.4` |
| Native UI | `@expo/ui` `~57.0.16` · Expo Glass Effect `~57.0.1` |
| Motion | React Native Reanimated `4.5.1` · Gesture Handler `~2.32.0` |
| Storage | Expo SecureStore `~57.0.3` · AsyncStorage `2.2.0` (non-sensitive preferences and metadata) |

## Development

Use Node.js 24 LTS and npm:

```sh
npm ci
npm start
```

```sh
npm run ios        # Local iOS build (macOS + Xcode)
npm run ios:release # iOS Release build with embedded JS bundle; select a device
npm run android    # Local Android build (Android SDK)
npm run android:apk:debug # Debug APK (requires Metro to run)
npm run android:apk:unsigned # Unsigned release APK for packaging
npm run android:apk:release # Signed release APK; requires private signing variables
npm run android:release # Build/install signed Release; select via ANDROID_SERIAL if needed
npm run web        # Browser preview
npm test           # Focused tests
npm run typecheck
npm run lint
npm run export     # Bundle iOS, Android, and static web
```

Native builds are required to verify the final app icon and launch screen. For environment setup, Expo prebuild, Release builds, Metro, and Xcode troubleshooting, see the [development guide](docs/DEVELOPMENT.md).

After pulling the chart rotation change, apply the iOS supported-orientation configuration with `npx expo prebuild --platform ios`, then rebuild with `npm run ios`. Metro reloads alone cannot update an installed app's orientation capabilities. Native navigation enables rotation only for metric details and restores the portrait policy when leaving; no app-wide sensor subscription is used.

The launch screen uses `assets/images/myrabbit-splash.png`, a separate transparent asset with continuous rounded corners inspired by the iOS 27 icon silhouette (a visual approximation, not an exported Apple mask). Its rabbit artwork is preserved from the original logo. The app icon keeps the square `myrabbit-logo.png` source so the OS can apply its own mask. After changing the launch asset, run Expo prebuild and rebuild the native app; Metro reloads and Expo Go do not verify the final launch screen.

Android Studio and EAS Build are optional. For Android SDK command-line setup, local APK builds, signing, installation and the release checklist, see [Android releases and F-Droid](docs/ANDROID_RELEASE.md). To validate the published source on a separate Linux machine, follow [Linux x86_64 build validation](docs/LINUX_BUILD.md). An upstream GitHub release does not establish F-Droid acceptance.

### iOS widgets

Run `npx expo prebuild --platform ios` after pulling the widget integration, then rebuild with `npm run ios`. Expo Go cannot install the extension. The config plugin creates the WidgetKit/SwiftUI extension and App Group entitlements on each prebuild; generated Xcode files require no manual edits. The existing app deployment target is preserved.

For signed device or EAS builds, enable App Groups for the app identifier `im.jiaxin.myrabbit` and extension identifier `im.jiaxin.myrabbit.widgets`, with `group.im.jiaxin.myrabbit.widgets` assigned to both. Provisioning profiles must include this capability. The plugin supplies EAS extension signing metadata. If you change the bundle identifier, use the plugin's derived identifiers and register the corresponding App Group.

Open a Dashboard successfully, then long-press the iOS Home Screen, choose **Edit → Add Widget**, and select **MyRabbit**. All installed sizes follow the currently selected site. Tapping opens its Today Dashboard, respecting connection restoration and site guards. Changing sites or analytics timezone clears the old snapshot; removing or replacing a connection clears widget data locally.

Only normalized metrics, site ID/domain, reporting date/timezone, update time, and a hashed context identifier enter the shared App Group container. API keys remain in the app's SecureStore. The extension reads cached data without React Native or network access. Successful Dashboard loads/refreshes publish a new snapshot; if viewing another date range or filtered analytics, the app separately requests unfiltered Today through the same Rybbit client. Network failures retain the last successful snapshot. Missing metrics on older servers display a dash, and missing comparisons are omitted.

WidgetKit is asked to reread the cache about every 30 minutes; iOS controls actual scheduling. This does **not** fetch new analytics while the app is closed. Data older than one hour or from a previous reporting day is marked stale, with its last update time. Open or refresh the Dashboard to obtain new data. Empty, loading, and cached offline states are supported.

## Documentation

- [Development, architecture, builds, troubleshooting, and testing](docs/DEVELOPMENT.md)
- [Android release workflow and F-Droid preparation](docs/ANDROID_RELEASE.md)
- [Linux x86_64 build validation and evidence checklist](docs/LINUX_BUILD.md)
- [v0.1.0 release status and outstanding F-Droid requirements](docs/RELEASE_STATUS.md)
- [Privacy and API key handling](docs/PRIVACY.md)
- [Rybbit API client and response contracts](src/api/rybbit/README.md)
- [Local storage boundaries](src/storage/README.md)
- [Session restoration and site selection](src/stores/README.md)

## License

[MIT](LICENSE). Existing copyright and license notices are preserved.

## Disclaimer

MyRabbit is an independent, unofficial Rybbit client. It is not affiliated with or endorsed by Rybbit. Rybbit names and marks belong to their respective owners.
