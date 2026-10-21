# F-Droid packaging draft

[`im.jiaxin.myrabbit.yml`](im.jiaxin.myrabbit.yml) is a disabled starting recipe, **not a validated submission**. The app's user-facing listing metadata lives separately in [`fastlane/metadata/android/en-US`](../fastlane/metadata/android/en-US).

The draft generates the ignored Android project in `init`, before F-Droid source scanning, then invokes Gradle from the repository root using `--project-dir android`. It intentionally has no `subdir: android`: that directory does not exist in a fresh checkout. Its version checks require an already provisioned Linux environment with Node 24.21.0/npm 11.19.0 and Gradle 9.3.1 on PATH. Provision these through an F-Droid-approved, checksum-pinned toolchain before enabling the recipe; the draft does not provision them. The SDK additionally needs platform 36, build-tools 36.0.0, NDK 27.1.12297006 and the CMake versions requested by the native dependencies. OpenJDK 17 is the initial local baseline, not a successfully validated F-Droid environment.

Outstanding packaging work:

- Publish the complete source and tested release commit. Replace `REPLACE_WITH_TESTED_RELEASE_COMMIT_SHA` with its full immutable hash; the v0.1.0 tag must identify that same commit.
- Keep all `MYRABBIT_*` signing variables unset in the packaging environment. The generated release must be unsigned, with the expected application ID, version name and version code.
- Verify the Expo Android source-build setting in actual Gradle resolution. npm packages retain unused `local-maven-repo` AARs/source JARs; handle only confirmed-unused copies with targeted scanner deletion rules. Review all remaining npm native binaries, Hermes tooling, React Native/Maven artifacts and Gradle wrapper files. No blanket scan exceptions are included.
- Record licenses and provenance for resolved Android dependencies, the icon and screenshots. npm package license fields alone do not establish compliance.
- Run `fdroid rewritemeta`, `fdroid lint`, source/APK scanners and `fdroid build --test im.jiaxin.myrabbit:1` with the recipe in a current `fdroiddata` checkout. This machine has not run those tools.
- Compare clean Linux rebuilds and record any differences; configure `Binaries`/`AllowedAPKSigningKeys` only if upstream signature reuse actually verifies. Otherwise document separate upstream/F-Droid signing.
- Test version extraction from `app.json` (`expo.version` and `expo.android.versionCode`) and configure tag-based updates. Prepared version values are not a published release.
- Add authentic Android screenshots and finish physical-device testing. Resolve the development-age requirement or applicable exception with maintainers.

For local validation, replace the commit placeholder and remove both disable reasons in a review copy. Keep submitted metadata disabled until the requirements above pass. Submit one [fdroiddata merge request](https://gitlab.com/fdroid/fdroiddata/-/merge_requests) with the tested recipe, or an [RFP](https://gitlab.com/fdroid/rfp/-/issues) if packaging assistance is needed. Track the submission URL, review feedback, official build and eventual app listing in the release issue. No submission has been made by adding these files.

See the [Android release checklist](../docs/ANDROID_RELEASE.md) and [F-Droid metadata reference](https://f-droid.org/docs/Build_Metadata_Reference/).
