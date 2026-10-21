# Android release and F-Droid

[Back to MyRabbit](../README.md)

This is the preparation workflow for **v0.1.0**, not evidence of a published or F-Droid-approved release. The stable Android application ID is `im.jiaxin.myrabbit`; the initial version name is `0.1.0` and version code is `1`. Keep the application ID unchanged for future updates and increase the version code for each release.

## Command-line environment

Android Studio, an Expo account and EAS Build are not required. Use Linux (including WSL) or macOS, Node.js 24 LTS, npm, a FLOSS JDK, and the Android SDK command-line tools from [Android Developers](https://developer.android.com/studio#command-tools). Start with OpenJDK 17. Download the appropriate command-line tools archive, verify its published checksum, and extract its `cmdline-tools` directory under `$ANDROID_HOME/cmdline-tools/19.0/` when using command-line tools 19.0. The resulting SDK manager path must be `$ANDROID_HOME/cmdline-tools/19.0/bin/sdkmanager`.

Set paths in your shell, for example:

```sh
export JAVA_HOME=/absolute/path/to/openjdk-17
export ANDROID_HOME=/absolute/path/to/android-sdk
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/19.0/bin:$ANDROID_HOME/platform-tools:$PATH"
sdkmanager --sdk_root="$ANDROID_HOME" --licenses
sdkmanager --sdk_root="$ANDROID_HOME" \
  'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' \
  'ndk;27.1.12297006' 'cmake;3.30.5'
```

With Homebrew on Apple Silicon, the SDK root may instead be `/opt/homebrew/share/android-commandlinetools`. Point `ANDROID_HOME` at that root, not its nested `cmdline-tools/latest` directory:

```sh
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
sdkmanager --sdk_root="$ANDROID_HOME" --list_installed
```

The Homebrew command-line tools 22.0 run with OpenJDK 17. Installing the command-line tools alone does not install platform-tools, Android platforms, build-tools, NDK or CMake; install the components listed above as well. The tool reports that `sdkmanager` is deprecated in favor of Android CLI, but the commands here remain supported by this installed version. Keep the SDK path in your shell; do not commit a machine-specific `local.properties` file.

Review and accept SDK licenses interactively. These SDK/NDK versions come from the locked React Native 0.86.3 Android version catalog. Native libraries can request additional CMake versions; record those from an actual clean build before finalizing the F-Droid recipe. Use the generated Gradle wrapper for local builds; do not install an arbitrary global Gradle version. SDK packages, npm packages and Maven/Gradle artifacts require network access when populating caches.

```sh
npm ci
npm run android:apk:debug
npm run android:apk:unsigned
```

Each local build command applies Expo prebuild with `--no-clean`, then builds with Gradle. SDK 57's CLI cleans native directories by default; the explicit flag preserves the existing native directory and build cache between local debug/release builds. Validate the final release from a fresh checkout as described below. Native directories remain generated and ignored; make durable changes through app configuration or config plugins. Debug needs Metro (`npm start`); an unsigned release embeds JavaScript but cannot be installed until signed. The build commands disable Expo CLI telemetry and dotenv loading. Never put API keys or signing passwords in `.env`, app config, build arguments, metadata or CI logs.

Artifacts, SHA-256 checksums and source/dirty-state `.build-info.json` sidecars are written to the ignored `artifacts/android/` directory:

- `MyRabbit-0.1.0-1-debug.apk`
- `MyRabbit-0.1.0-1-unsigned.apk`
- `MyRabbit-0.1.0-1-release.apk` (only when explicitly signed)

The config plugin clears Expo's default debug signing for release builds. Running Gradle directly without signing variables also produces an unsigned release, as required for F-Droid packaging.

`package.json` sets `expo.autolinking.android.buildFromSource` to `[".*"]` so Expo Android modules use their source projects instead of npm-packaged precompiled AARs. The unused copies still exist in installed packages and need scanner handling before F-Droid acceptance. This setting does not rebuild every Maven dependency; React Native and Hermes artifacts require separate provenance review. App configuration disables Expo OTA updates and blocks the template's external-storage and overlay permissions. The explicit SecureStore plugin excludes its encrypted preferences from Android backup/transfer rules; confirm these in the final merged release manifest as well as generated sources.

## Upstream signing and installation

Create a dedicated release key outside the checkout with `keytool`; retain an encrypted offline backup and its passwords. This command prompts for passwords rather than putting them in shell history:

```sh
keytool -genkeypair -v -keystore /secure/location/myrabbit-release.jks \
  -alias myrabbit -keyalg RSA -keysize 4096 -validity 10000
```

Supply these variables through your local secret manager or private shell session:

| Variable | Value |
| --- | --- |
| `MYRABBIT_KEYSTORE_FILE` | Absolute keystore path outside the checkout |
| `MYRABBIT_KEYSTORE_PASSWORD` | Keystore password |
| `MYRABBIT_KEY_ALIAS` | Release key alias, for example `myrabbit` |
| `MYRABBIT_KEY_PASSWORD` | Key password |

```sh
npm run android:apk:release
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose --print-certs \
  artifacts/android/MyRabbit-0.1.0-1-release.apk
adb devices -l
npm run android:release
```

`android:release` builds a signed release and installs it. With multiple devices, set `ANDROID_SERIAL` to the intended serial. A signed release runs without Metro. Verify its certificate fingerprint and record it with the release. Do not distribute debug-signed APKs, temporary validation keys or unsigned artifacts as installable releases. `android:apk:unsigned` and `android:apk:debug` explicitly remove signing variables from their child processes.

GitHub APK updates must use the same release key. F-Droid normally builds and signs its own APKs, so its signature can differ from GitHub's; users cannot directly switch between differently signed builds with the same package name. Uninstalling to switch may delete local configuration. If seamless switching is required, first achieve F-Droid-verifiable reproducible builds and configure upstream signature reuse (`Binaries` and `AllowedAPKSigningKeys`) with the F-Droid maintainers. Do not promise cross-channel updates before that verification. See [F-Droid reproducible builds](https://f-droid.org/docs/Reproducible_Builds/).

## Device acceptance record

Record device model, Android version, source commit, APK SHA-256, signing certificate, date and result. Use a test Rybbit account and redact credentials, site identifiers and visitor data from screenshots/logs. The following remain unchecked until exercised on a physical Android device with the actual release APK:

- [ ] Install and cold launch with Metro stopped; icon and splash render correctly.
- [ ] Test Cloud and a configurable HTTPS self-hosted server with a manually created API key.
- [ ] Invalid key, insufficient permissions, timeout and unavailable server show appropriate retryable states.
- [ ] Save, force-stop and reopen: the connection restores from SecureStore and the accessible site opens.
- [ ] Site switching, Dashboard metrics/date selection, Explore and Realtime work with representative data.
- [ ] Light/dark appearance, Android back navigation and large text remain usable.
- [ ] Removing the connection clears local credentials/site selection without changing server sites or analytics.
- [ ] An update signed by the same release key installs over the prior build and preserves expected local settings.
- [ ] Capture authentic Android screenshots with non-sensitive test data for Fastlane metadata.

## F-Droid preparation

Read the current [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/), [submission guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/), [metadata reference](https://f-droid.org/docs/Build_Metadata_Reference/) and [anti-features](https://f-droid.org/docs/Anti-Features/). Check the policy's active-development requirement (normally three months, with documented exceptions) before requesting inclusion.

Upstream listing text, icon and version-code changelog live in `fastlane/metadata/android/en-US/`. Fastlane itself is not needed. Add real Android screenshots under `images/phoneScreenshots/`; do not substitute mockups or iOS/web captures. The draft build recipe is in [`fdroid/im.jiaxin.myrabbit.yml`](../fdroid/im.jiaxin.myrabbit.yml). It is disabled and has not passed `fdroid build`; it must be completed in `fdroiddata` before submission. Listing metadata and the F-Droid build recipe serve different purposes.

Before enabling the recipe:

1. Make the complete source/tag publicly readable after reviewing tracked files and Git history for secrets. Confirm app, artwork and dependency redistribution licenses, retaining Expo and other third-party notices. `package.json`'s `private` flag only prevents npm publication; it does not control GitHub visibility.
2. Build from a clean checkout in Linux using the locked dependencies, a pinned Node 24/npm toolchain and the recipe's exact SDK/JDK/Gradle/NDK versions. Record native dependency resolution and Gradle dependency verification data. Local source buildability and byte-for-byte reproducibility are separate checks.
3. Run F-Droid source and APK scanners. Review transitive Android/Maven dependencies and prebuilt npm/native binaries, including React Native/Hermes, rather than relying solely on npm license fields. Resolve findings individually; do not add blanket `scanignore` rules.
4. Verify that the release has no dependency on proprietary build services, Google Play Services, proprietary tracking or ad SDKs. Review release permissions, network behavior, any remote-code update mechanism and the need for anti-feature disclosures. Viewing Rybbit analytics alone does not establish that the client tracks its own users.
5. Confirm all needed operations work with a self-hosted server, without a mandatory hosted service or build-time API key. Users supply their own Rybbit API keys at runtime; F-Droid must not need a private account/key to build.
6. In a local review copy, replace the commit placeholder and remove the draft disable reasons, then run `fdroid rewritemeta im.jiaxin.myrabbit`, `fdroid lint im.jiaxin.myrabbit` and a clean `fdroid build --test im.jiaxin.myrabbit:1` in the F-Droid environment. Only submit enabled metadata after resolving build/scanner findings and finishing update detection. An RFP is an alternative if packaging assistance is needed.

For a local inventory of the installed npm dependency tree, generate a CycloneDX SBOM after `npm ci`:

```sh
mkdir -p artifacts/release-audit
npm sbom --sbom-format cyclonedx > artifacts/release-audit/npm-sbom.cdx.json
```

This inventory is platform-dependent and does not include Android's resolved Maven graph or prove license/scanner compliance. Keep it alongside the Gradle dependency report and actual APK audit results; regenerate it on the eventual Linux packaging environment.

## Release gates

Preparation does not authorize declaring unfinished work released. Track these gates independently:

- [ ] Review and commit the intended changes, including any existing working-tree changes chosen for v0.1.0.
- [ ] `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run export` pass.
- [ ] Clean Android debug and unsigned/signed release builds pass; inspect release manifest, permissions and dependency reports.
- [ ] Complete and attach the physical-device acceptance record above.
- [ ] Finalize MIT/asset attribution, README installation instructions, privacy documentation, listing metadata and screenshots.
- [ ] Select the durable release key/update strategy; verify and back up its certificate/key.
- [ ] Confirm public repository access and create `v0.1.0` pointing to the tested release commit.
- [ ] Publish a GitHub Release containing the signed APK, checksum, release notes and signing certificate fingerprint; verify a downloaded copy.
- [ ] Complete the F-Droid build recipe and submit one RFP or `fdroiddata` merge request; record its URL.
- [ ] Track maintainer feedback, official build success and the public F-Droid app URL separately from upstream release completion.

Do not create the tag from an uncommitted working tree or claim F-Droid publication while review is pending. Google Play distribution, Android widgets and future developer-verification changes are outside this release.
