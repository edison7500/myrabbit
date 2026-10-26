# v0.1.0 release and F-Droid status

Updated on **2026-10-26** after reviewing the public repository, GitHub release and matching local APK. Linux x86_64 validation is the next planned step and has not been run. This record does not establish F-Droid acceptance or physical-device behavior.

## Published Android release

- Public source: [edison7500/myrabbit](https://github.com/edison7500/myrabbit), under MIT with retained Expo notices.
- [v0.1.0](https://github.com/edison7500/myrabbit/releases/tag/v0.1.0) was published on **2026-10-23**. Its tag resolves to `7e13d3c3abd287514d2eca803416922ad0fec069`.
- Release assets: `MyRabbit-0.1.0-1-release.apk` and `MyRabbit-0.1.0-1-release.apk.sha256`.
- APK SHA-256: `42c2e5bbc353264d4842c92e65174a0a0457e28bff02dd12f9cf91387ccfa123`.
- Signing certificate SHA-256: `82e57d1ffb7b36872ef5e60c9aed49436997a79d6dda8dfd9677dd99ade07ea6`.

The local release APK's computed hash matches the published GitHub asset digest. Android build tools verified its APK Signature Scheme v2 signature, certificate name `CN=MyRabbit Release` and RSA 4096-bit key. This review did not download the remote APK again or verify keystore backup/recovery.

| APK property | Verified value |
| --- | --- |
| Application ID | `im.jiaxin.myrabbit` |
| Version name / code | `0.1.0` / `1` |
| Minimum / target SDK | `24` / `36` |
| Included ABIs | `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64` |
| Permissions | Internet, vibration, network state, biometric/fingerprint and the app's generated non-exported receiver permission |
| Blocked template permissions | External-storage read/write and system overlay are absent from the inspected APK |

### Source provenance to resolve

The matching local APK's ignored `.build-info.json` records `sourceCommit: 0acfd636643841081cb5c71eb114f1d60a8293d6`, `workingTreeDirty: true` and `platform: darwin`. The published tag points to the later `7e13d3c…` commit. This does not prove the source contents differ, but a clean build of the tagged source has not been demonstrated.

Follow [Linux x86_64 build validation](LINUX_BUILD.md), retain the clean source commit and logs, and investigate differences before claiming reproducibility or upstream signature reuse. An unsigned rebuild will have a different whole-file hash from a signed APK. Keep the existing release/tag intact; source fixes should receive a new release and increased version code.

## Prepared

- App/package version `0.1.0`, Android version code `1`, stable application ID `im.jiaxin.myrabbit`.
- Local command-line debug, unsigned release and explicitly signed release build commands, artifact checksums and source/dirty-state sidecars.
- Config plugin overriding Expo's debug signing for release; missing/partial signing configuration and the default debug alias are rejected for signed builds.
- Android Expo modules configured to build from source; OTA updates explicitly disabled.
- Unused template external-storage/overlay permissions blocked; SecureStore backup/transfer exclusion rules configured.
- MIT app notice alongside the retained Expo notice, Android listing text, 512 px icon derived from the existing logo, initial changelog, privacy documentation and signing/update guidance.
- Disabled F-Droid build metadata draft, with missing toolchain/scanner/release prerequisites documented.

## Earlier preparation checks

The following results were recorded on **2026-10-21**, before publication. They have not been rerun on Linux or against the final release tag as part of this documentation update:

| Check | Result / limit |
| --- | --- |
| Node / npm / JDK | Node 24.21.0, npm 11.19.0, Homebrew OpenJDK 17.0.20.1 on macOS |
| `npm ci --offline --no-audit --no-fund` | Passed using the existing local npm cache; registry/network installation was not tested |
| `npm test` | 151 tests passed, including mocked build/signature-failure handling, signing-environment isolation and configuration checks; mock build tests do not produce APKs |
| `npm run typecheck` / `npm run lint` | Passed |
| `npm run export` | iOS, Android and static web bundles passed; this does not build/install an APK |
| Android Expo prebuild | Passed; generated `versionName` is `0.1.0`, signing override and SecureStore backup references are present, blocked permissions use manifest removal directives |
| Android autolinking resolution | 17 modules resolved; `configuration.buildFromSource` is `[".*"]`; this check did not verify actual Gradle dependency selection |
| npm license metadata | All 886 lockfile package entries have recorded license expressions; no missing license field or proprietary expression was identified in that metadata review. This is not a source/license or native dependency audit |
| Selected dependency checks | `expo-updates`, `expo-dev-client` and `@react-native-firebase/app` were absent in the installed dependency tree; this is not a complete tracking-SDK/APK scan |
| npm software bill of materials | Generated CycloneDX 1.5 inventory at `artifacts/release-audit/npm-sbom.cdx.json` with 792 components from this installed macOS npm tree; Android/Maven dependencies are not included |

## Remaining F-Droid work

- **Linux x86_64:** the target machine runs Debian 13 amd64. Its standard APT repository has no `openjdk-17-jdk`; the [guide](LINUX_BUILD.md#install-jdk-17-on-debian-13) uses a checksum-verified Temurin 17 JDK archive to satisfy React Native's explicit toolchain request. Build the tagged source in a fresh checkout and record OS/host architecture, Node/npm, JDK, SDK/NDK/CMake, Gradle, npm checks, the unsigned APK and native dependency reports. No Linux result is recorded yet.
- **F-Droid recipe and scanners:** the draft still contains a commit placeholder and both disable reasons. It checks exact Node/npm/Gradle versions without provisioning them. Complete approved toolchain provisioning and pass metadata lint, source/APK scanning and the build in the F-Droid environment.
- **Device and screenshots:** no completed physical-device acceptance record is available in the repository; real Android screenshots remain missing. Complete the [device acceptance record](ANDROID_RELEASE.md#device-acceptance-record).
- **Signing:** an upstream release signature now exists. Confirm backup/recovery of that same key, publish its certificate fingerprint with the release, and decide whether F-Droid uses a separate signature or verified upstream signature reuse. Byte-for-byte reproducibility is encouraged, not a general inclusion requirement.
- **Native dependency compliance:** Expo packages contain precompiled `local-maven-repo` AAR/source JAR copies even when source builds are selected. Native npm tools, Hermes/React Native artifacts, Maven dependencies and final APK permissions/network behavior still need F-Droid source/APK scanning and provenance review. No scanner exceptions have been added.
- **Artwork/attribution:** the existing logo has been reused; its origin and redistribution rights need maintainer confirmation. Complete third-party attribution against the actual Android dependency graph.
- **Public history:** source and tag availability are confirmed. A complete tracked-file/Git-history secret audit remains unrecorded.
- **Updates:** validate extraction of `expo.version` and `expo.android.versionCode` from `app.json` and configure tag-based updates. The draft currently sets both update modes to `None`.
- **Policy:** the [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/) normally requires three months of active development, with exceptions for established users, authors maintaining other F-Droid apps, or event-specific apps. History begins on **2026-09-05**; three calendar months from that date is **2026-12-05**. The initial commit date alone does not establish three months of active development. Ask maintainers to assess an applicable exception or development evidence.
- **Submission:** no RFP/MR URL or official listing is recorded in this repository. External submission status was not conclusively verified; check existing submissions before creating one. An RFP can request packaging help or policy clarification while validation is pending.

Continue with the [release and packaging gates](ANDROID_RELEASE.md#release-and-packaging-gates) and [packaging draft notes](../fdroid/README.md). Record the Linux result, F-Droid review, official build and public listing independently.
