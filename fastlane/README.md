# Android listing metadata

F-Droid can read `metadata/android/en-US/` from this directory; installing or running Fastlane is not required. The metadata describes the intended v0.1.0 release and is not proof that an APK has been released or accepted by F-Droid.

- `title.txt`: application title.
- `short_description.txt`: fewer than 80 characters, without a trailing full stop.
- `full_description.txt`: features and prerequisites; keep it consistent with the tested APK.
- `changelogs/1.txt`: version code 1 release notes, at most 500 characters.
- `images/icon.png`: 512 × 512 PNG derived from the app's existing `assets/images/myrabbit-logo.png`. Confirm artwork redistribution rights before publication.
- `images/phoneScreenshots/1.png`, `2.png`, etc.: **still required**. Capture the real Android release using non-sensitive test data; do not include API keys or real visitor/session data. Screenshot assets have not been supplied.

The F-Droid build recipe is separate: [`fdroid/`](../fdroid/README.md). Privacy information is in [`docs/PRIVACY.md`](../docs/PRIVACY.md).
