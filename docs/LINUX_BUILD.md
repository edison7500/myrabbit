# Linux x86_64 build validation

[Back to Android releases](ANDROID_RELEASE.md)

Use a separate **64-bit x86 Linux host** (`uname -m`: `x86_64`; Debian/Ubuntu architecture: `amd64`) to validate the published Android source. The host can cross-compile the ARM and x86 Android ABIs; it does not need to match the phone's CPU. A 32-bit x86 installation is not the intended environment.

**Status: pending execution.** These instructions prepare the next validation run; they are not a successful Linux build report. First establish a clean unsigned release build, then validate the F-Droid recipe and scanners separately. Neither step proves device behavior or byte-for-byte reproducibility.

## 1. Provision the host

Use Bash on **Debian 13 (trixie), amd64**. This guide does not require Android Studio, an Expo account, EAS, a signing key or a Rybbit API key. Record the actual distribution and installed tool versions.

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates git curl unzip zip xz-utils build-essential python3 pkg-config libfontconfig1
```

### Install JDK 17 on Debian 13

Debian 13 provides [OpenJDK 21](https://packages.debian.org/trixie/openjdk-21-jdk); its standard repository does not provide the `openjdk-17-jdk` package used in the earlier Ubuntu example. Gradle supports running on Java 21, but the locked React Native Gradle plugin explicitly requests `jvmToolchain(17)` in its build scripts and configures Android Kotlin projects to use that toolchain. Installing only JDK 21 does not satisfy that explicit Java 17 toolchain request unless a separate JDK 17 is provisioned.

For this validation run, install a **Temurin 17 JDK, Linux x64, HotSpot, tar.gz** from the [official release selector](https://adoptium.net/temurin/releases/?version=17&os=linux&arch=x64), following Adoptium's [archive installation instructions](https://adoptium.net/installation/archives/). Select the JDK, not the JRE. Keep the exact release/download URL and published SHA-256 with the build evidence. This avoids changing Debian's APT sources or system Java selection.

Download the archive and obtain its published checksum, then replace the first two values below. Run in the same Bash session as the rest of this guide:

```sh
set -euo pipefail
jdk_archive=/absolute/path/to/the/downloaded-temurin-17-jdk.tar.gz
jdk_sha256=REPLACE_WITH_PUBLISHED_SHA256
printf '%s  %s\n' "$jdk_sha256" "$jdk_archive" | sha256sum --check
jdk_install_dir="$HOME/.local/share/myrabbit/jdk17"
test ! -e "$jdk_install_dir"
mkdir -p "$jdk_install_dir"
tar --extract --gzip --file "$jdk_archive" --directory "$jdk_install_dir" --strip-components=1
export JAVA_HOME="$jdk_install_dir"
export PATH="$JAVA_HOME/bin:$PATH"
test -x "$JAVA_HOME/bin/javac"
"$JAVA_HOME/bin/java" -version
"$JAVA_HOME/bin/javac" -version
```

The destination must be new. If a verified JDK 17 is already installed, set `JAVA_HOME` to its actual directory and skip extraction. Keep this JDK outside the checkout. The archive is a local build setup; its use does not establish that the F-Droid recipe's toolchain provisioning is approved.

### Node.js and Android SDK

Provision **Node 24.21.0 and npm 11.19.0** to match the current packaging draft. Use the [official Node.js downloads](https://nodejs.org/en/download) or an existing version manager; verify downloaded tool archives against their published checksums. The repository's `.nvmrc` selects major version 24, so choosing the latest 24.x alone does not guarantee this exact baseline. If a different supported 24.x/npm version is used, record it as a separate experiment and update the packaging baseline deliberately.

Download the Linux Android command-line tools from [Android Developers](https://developer.android.com/studio#command-tools), verify the listed SHA-256, and extract them so that `$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager` exists. Record the downloaded archive name, version and checksum. The `latest` directory name below is a local extraction path, not a pinned download version.

In the Bash session used for the remaining steps:

```sh
set -euo pipefail
test "$(uname -m)" = x86_64
test "$(node --version)" = v24.21.0
test "$(npm --version)" = 11.19.0
export JAVA_HOME="$HOME/.local/share/myrabbit/jdk17"
test -x "$JAVA_HOME/bin/javac"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
export EXPO_NO_TELEMETRY=1
export EXPO_NO_DOTENV=1
export CI=1
unset MYRABBIT_KEYSTORE_FILE MYRABBIT_KEYSTORE_PASSWORD MYRABBIT_KEY_ALIAS MYRABBIT_KEY_PASSWORD
"$JAVA_HOME/bin/java" -version
"$JAVA_HOME/bin/javac" -version
sdkmanager --sdk_root="$ANDROID_HOME" --licenses
sdkmanager --sdk_root="$ANDROID_HOME" \
  'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' \
  'ndk;27.1.12297006' 'cmake;3.30.5'
```

Accept SDK licenses interactively. JDK 17 matches the locked React Native toolchain request; the Debian 13 build is still pending execution. If you used an existing JDK installation, substitute its actual path above. Native dependencies may request additional CMake versions; record the exact requirement and installed package if this occurs. Keep host paths in the shell, outside tracked configuration. Initial npm, SDK, Gradle and Maven downloads require network access.

## 2. Check out the published source

Clone into a new directory rather than copying `node_modules`, `android` or caches from macOS. Run the following from the directory where you want to create the checkout:

```sh
git clone --branch v0.1.0 https://github.com/edison7500/myrabbit.git myrabbit-linux-v0.1.0
cd myrabbit-linux-v0.1.0
test "$(git rev-parse HEAD)" = 7e13d3c3abd287514d2eca803416922ad0fec069
test -z "$(git status --porcelain)"
test ! -d android
test ! -d node_modules
mkdir -p artifacts/release-audit/linux-x86_64
audit_dir="$PWD/artifacts/release-audit/linux-x86_64"
```

The detached checkout is intentional. If a build needs source changes, preserve the failing log and patch separately, commit the fix on a branch, and rerun from a fresh checkout of that commit. Do not move the existing tag or present a modified-tree build as validation of v0.1.0.

## 3. Record the environment and run project checks

Continue in the same Bash session, with `pipefail` enabled so a failing command remains a failure when its output is saved through `tee`:

```sh
{
  date -u
  uname -sm
  cat /etc/os-release
  git rev-parse HEAD
  git status --porcelain
  node --version
  npm --version
  java -version
  javac -version
  cat "$JAVA_HOME/release"
  sdkmanager --sdk_root="$ANDROID_HOME" --list_installed
} 2>&1 | tee "$audit_dir/environment.txt"
npm ci --include=dev --no-audit --no-fund 2>&1 | tee "$audit_dir/npm-ci.log"
npm test 2>&1 | tee "$audit_dir/tests.log"
npm run typecheck 2>&1 | tee "$audit_dir/typecheck.log"
npm run lint 2>&1 | tee "$audit_dir/lint.log"
npm run export 2>&1 | tee "$audit_dir/export.log"
npm sbom --sbom-format cyclonedx > "$audit_dir/npm-sbom.cdx.json"
```

The export bundles iOS, Android and static web assets without building an iOS native application. npm tests use mocked platform boundaries. The Linux npm inventory differs from the macOS inventory and does not include resolved Maven dependencies.

## 4. Build and inspect the unsigned release

```sh
npm run android:apk:unsigned 2>&1 | tee "$audit_dir/unsigned-build.log"
./android/gradlew --project-dir android --version 2>&1 | tee "$audit_dir/gradle-version.txt"
./android/gradlew --project-dir android :app:dependencies \
  --configuration releaseRuntimeClasspath --no-daemon --console=plain \
  2>&1 | tee "$audit_dir/release-runtime-dependencies.txt"
"$ANDROID_HOME/build-tools/36.0.0/aapt" dump badging \
  artifacts/android/MyRabbit-0.1.0-1-unsigned.apk > "$audit_dir/apk-badging.txt"
"$ANDROID_HOME/build-tools/36.0.0/aapt" dump permissions \
  artifacts/android/MyRabbit-0.1.0-1-unsigned.apk > "$audit_dir/apk-permissions.txt"
sha256sum artifacts/android/MyRabbit-0.1.0-1-unsigned.apk | tee "$audit_dir/apk-sha256.txt"
cat artifacts/android/MyRabbit-0.1.0-1-unsigned.apk.build-info.json
test -z "$(git status --porcelain)"
```

The build command generates `android/` with Expo prebuild, then uses its Gradle wrapper. Retain the generated `android/gradle/wrapper/gradle-wrapper.properties` with the audit evidence and check the wrapper version against the draft's Gradle 9.3.1 baseline. This does not provision the separate `gradle` executable expected by the F-Droid draft.

Inspect the evidence before marking this step passed:

- Application ID `im.jiaxin.myrabbit`, version name `0.1.0`, version code `1`.
- `.build-info.json` has the expected full source commit, `workingTreeDirty: false`, `platform: linux` and `mode: unsigned`.
- The APK is unsigned. `apksigner verify` must fail for lack of a signature; investigate any different failure. Keep the unsigned artifact for packaging, not installation.
- Release permissions do not include external-storage read/write or system overlay. Compare remaining permissions with the [published APK record](RELEASE_STATUS.md#published-android-release).
- Check the resolved Gradle projects/artifacts to confirm Expo source selection. `buildFromSource: [".*"]` is configured, but that declaration and an npm license inventory do not establish native dependency compliance.

Keep the APK, checksum and `.build-info.json` together. Do not compare the unsigned APK's whole-file SHA-256 directly with the signed GitHub APK as a reproducibility test. For an initial repeat-build comparison, repeat the process in another fresh checkout with the same toolchain and compare unsigned APKs; investigate any differences.

If Gradle runs out of memory, record the failure and any local Gradle JVM/worker settings used for a retry. Retain the full log and failing task for toolchain, Maven, CMake or compiler failures. Do not bypass failures by upgrading dependencies, hand-editing the lockfile, disabling TLS verification or adding broad scanner exclusions.

## 5. Validate F-Droid packaging separately

After the clean Linux build, follow the current [F-Droid submission guide](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/#test-the-metadata) to prepare a `fdroiddata` checkout and supported build environment. Use a separate review copy of [the disabled recipe](../fdroid/im.jiaxin.myrabbit.yml):

1. Provision its exact toolchain using approved sources and pinned checksums. A host-installed Node or Gradle is not automatically available in the F-Droid environment.
2. Replace the commit placeholder with the tested immutable hash and remove both disable reasons in the review copy.
3. Review npm/native binaries, Expo `local-maven-repo` files, Maven artifacts, Hermes tooling and Gradle wrapper files. Use targeted deletion only for files proven unused. Assess permitted official prebuilt tools against the current [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/).
4. From the `fdroiddata` root, run:

```sh
fdroid rewritemeta im.jiaxin.myrabbit
fdroid lint im.jiaxin.myrabbit
fdroid build --test im.jiaxin.myrabbit:1
```

Record source-scanner and APK-scanner invocations/results explicitly using the installed fdroidserver version; a default build alone is not evidence that every optional scan ran. Preserve tool versions and logs. Configure and test tag-based update detection before submitting enabled metadata. See [packaging notes](../fdroid/README.md) for the remaining policy, licensing and submission work.

## Result to record

Fill in this record after the run, link retained logs/artifacts, and update [release status](RELEASE_STATUS.md) with actual outcomes. Review shared logs for credentials and private visitor data.

| Evidence | Result |
| --- | --- |
| Date, Linux distribution and host architecture | Pending |
| Full source commit; clean before/after build | Pending |
| Node/npm, JDK, SDK/NDK/CMake and Gradle versions | Pending |
| Dependency installation, tests, typecheck, lint and export | Pending |
| Unsigned APK build, SHA-256 and build-info sidecar | Pending |
| APK package/version/permissions/signature inspection | Pending |
| Native dependency source/license review | Pending |
| Second clean build comparison, if attempted | Pending |
| F-Droid tool versions, lint, source/APK scans and build | Pending |
| Physical Android device tests and screenshots | Pending; tracked separately |

For device tests, use the existing signed GitHub release or sign a build through the [upstream release workflow](ANDROID_RELEASE.md#upstream-signing-and-installation) with the existing release key. Do not transfer the release key to the Linux machine just to validate an unsigned build. F-Droid upstream signature reuse requires its own [reproducibility verification](https://f-droid.org/docs/Reproducible_Builds/).
