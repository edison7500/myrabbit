# v0.1.0 preparation status

Recorded on **2026-10-21**. This is a working-tree preparation record, not a signed release, device-test report or F-Droid approval.

## Prepared

- App/package version `0.1.0`, Android version code `1`, stable application ID `im.jiaxin.myrabbit`.
- Local command-line debug, unsigned release and explicitly signed release build commands, artifact checksums and source/dirty-state sidecars.
- Config plugin overriding Expo's debug signing for release; missing/partial signing configuration and the default debug alias are rejected for signed builds.
- Android Expo modules configured to build from source; OTA updates explicitly disabled.
- Unused template external-storage/overlay permissions blocked; SecureStore backup/transfer exclusion rules configured.
- MIT app notice alongside the retained Expo notice, Android listing text, 512 px icon derived from the existing logo, initial changelog, privacy documentation and signing/update guidance.
- Disabled F-Droid build metadata draft, with missing toolchain/scanner/release prerequisites documented.

## Checks performed

| Check | Result / limit |
| --- | --- |
| Node / npm / JDK | Node 24.21.0, npm 11.19.0, Homebrew OpenJDK 17.0.20.1 on macOS |
| `npm ci --offline --no-audit --no-fund` | Passed using the existing local npm cache; registry/network installation was not tested |
| `npm test` | 151 tests passed, including mocked build/signature-failure handling, signing-environment isolation and configuration checks; mock build tests do not produce APKs |
| `npm run typecheck` / `npm run lint` | Passed |
| `npm run export` | iOS, Android and static web bundles passed; this does not build/install an APK |
| Android Expo prebuild | Passed; generated `versionName` is `0.1.0`, signing override and SecureStore backup references are present, blocked permissions use manifest removal directives |
| Android autolinking resolution | 17 modules resolved; `configuration.buildFromSource` is `[".*"]`; native Gradle compilation is not yet verified |
| npm license metadata | All 886 lockfile package entries have recorded license expressions; no missing license field or proprietary expression was identified in that metadata review. This is not a source/license or native dependency audit |
| Selected dependency checks | `expo-updates`, `expo-dev-client` and `@react-native-firebase/app` were absent in the installed dependency tree; this is not a complete tracking-SDK/APK scan |
| npm software bill of materials | Generated CycloneDX 1.5 inventory at `artifacts/release-audit/npm-sbom.cdx.json` with 792 components from this installed macOS npm tree; Android/Maven dependencies are not included |

## Blocked or pending

- **Android SDK / APK build:** the initial standalone tools download timed out. The maintainer subsequently provided the Homebrew SDK root `/opt/homebrew/share/android-commandlinetools`; its command-line tools 22.0 run with OpenJDK 17. CMake 3.30.5 is installed and verified. The remaining requested SDK components and Gradle 9.3.1 are downloading over a slow direct connection; no proxy is configured. Neither a debug nor release APK has been produced yet.
- **Device and screenshots:** no physical Android device flow has been tested; real Android screenshots remain missing. Complete the [device acceptance record](ANDROID_RELEASE.md#device-acceptance-record).
- **Signing:** no durable upstream keystore was created or supplied. Do not share its passwords in this repository or chat. Choose/store the key locally and verify its public certificate before publication.
- **Native dependency compliance:** Expo packages contain precompiled `local-maven-repo` AAR/source JAR copies even when source builds are selected. Native npm tools, Hermes/React Native artifacts, Maven dependencies and final APK permissions/network behavior still need F-Droid source/APK scanning and provenance review. No scanner exceptions have been added.
- **Artwork/attribution:** the existing logo has been reused; its origin and redistribution rights need maintainer confirmation. Complete third-party attribution against the actual Android dependency graph.
- **Public source / history:** an unauthenticated GitHub repository API request returned 404, so public availability is not confirmed. The connected GitHub metadata request did not complete. Visibility has not been changed, and tracked files/Git history have not received a complete secret audit.
- **Release commit:** pre-existing uncommitted feature/documentation changes are present. This work preserves them. Select and commit the intended release contents before tagging; no tag or GitHub Release has been created.
- **F-Droid:** toolchain provisioning, immutable commit selection, source/APK scanners, Linux build, reproducibility comparison and update detection remain pending. Local Git history starts on 2026-09-05, less than three months before this record; verify the [policy's development-age requirement or a documented exception](https://f-droid.org/docs/Inclusion_Policy/) before requesting inclusion. No RFP/MR has been submitted and no official listing exists as a result of this preparation.

Continue with the [release gates](ANDROID_RELEASE.md#release-gates) and [packaging draft notes](../fdroid/README.md). Separate successful upstream release preparation/submission from the external F-Droid review and publication outcome.
