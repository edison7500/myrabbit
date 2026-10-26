# F-Droid packaging draft

[`im.jiaxin.myrabbit.yml`](im.jiaxin.myrabbit.yml) is a disabled starting recipe, **not a validated submission**. The app's user-facing listing metadata lives separately in [`fastlane/metadata/android/en-US`](../fastlane/metadata/android/en-US).

The draft generates the ignored Android project in `init`, before F-Droid source scanning, then invokes Gradle from the repository root using `--project-dir android`. It intentionally has no `subdir: android`: that directory does not exist in a fresh checkout. Its version checks require an already provisioned Linux environment with Node 24.21.0/npm 11.19.0 and Gradle 9.3.1 on PATH. Provision these through an F-Droid-approved, checksum-pinned toolchain before enabling the recipe; the draft does not provision them. The SDK additionally needs platform 36, build-tools 36.0.0, NDK 27.1.12297006 and the CMake versions requested by the native dependencies. OpenJDK 17 is the initial local baseline, not a successfully validated F-Droid environment.

The repository is public and [v0.1.0](https://github.com/edison7500/myrabbit/releases/tag/v0.1.0) was published on October 23, 2026 with a signed APK and checksum. Its tag resolves to `7e13d3c3abd287514d2eca803416922ad0fec069`. The recipe's release-related disable text predates that publication; it remains disabled because packaging has not been validated. See the [current release status](../docs/RELEASE_STATUS.md) for the APK provenance limitation.

Start with the [Linux x86_64 validation guide](../docs/LINUX_BUILD.md) on the separate Debian 13 amd64 machine, including its Temurin 17 archive setup. The locked React Native plugin requests a Java 17 toolchain even if Gradle itself runs on a newer JDK. A successful wrapper-based Linux build is an initial source-build check; the recipe's separately provisioned JDK/Gradle invocation and F-Droid scans still need their own validation.

Outstanding packaging work:

- Build the published release commit from a clean Linux checkout. After it passes, replace `REPLACE_WITH_TESTED_RELEASE_COMMIT_SHA` with the full tested hash in the review copy. If source fixes are needed, commit them and publish a new version with an increased version code; keep the published v0.1.0 tag unchanged.
- Keep all `MYRABBIT_*` signing variables unset in the packaging environment. The generated release must be unsigned, with the expected application ID, version name and version code.
- Verify the Expo Android source-build setting in actual Gradle resolution. npm packages retain unused `local-maven-repo` AARs/source JARs; handle only confirmed-unused copies with targeted scanner deletion rules. Review all remaining npm native binaries, Hermes tooling, React Native/Maven artifacts and Gradle wrapper files. No blanket scan exceptions are included.
- Record licenses and provenance for resolved Android dependencies, the icon and screenshots. npm package license fields alone do not establish compliance.
- Run `fdroid rewritemeta`, `fdroid lint`, source/APK scanners and `fdroid build --test im.jiaxin.myrabbit:1` with the recipe in a current `fdroiddata` checkout. No passing F-Droid tool/build results are recorded.
- Compare clean Linux rebuilds and record any differences; configure `Binaries`/`AllowedAPKSigningKeys` only if upstream signature reuse actually verifies. Otherwise document separate upstream/F-Droid signing.
- Test version extraction from `app.json` (`expo.version` and `expo.android.versionCode`) and configure tag-based updates. Both update modes are currently `None`.
- Add authentic Android screenshots and finish physical-device testing. Resolve the development-age requirement or applicable exception with maintainers; see the dated [status record](../docs/RELEASE_STATUS.md#remaining-f-droid-work).

For local validation, replace the commit placeholder and remove both disable reasons in a review copy. Keep the repository draft disabled until build/scanner requirements pass. Submit a [fdroiddata merge request](https://gitlab.com/fdroid/fdroiddata/-/merge_requests) with the tested, enabled recipe, or open an [RFP](https://gitlab.com/fdroid/rfp/-/issues) now if packaging assistance or policy clarification is needed. Cross-link any RFP and later MR. No submission URL or official listing is recorded in this repository; confirm existing submissions before opening another. Track review feedback, the official build and eventual app listing separately.

See the [Android release checklist](../docs/ANDROID_RELEASE.md) and [F-Droid metadata reference](https://f-droid.org/docs/Build_Metadata_Reference/).
