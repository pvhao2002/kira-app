# Kira Life iPhone companion

SwiftUI + HealthKit app for iOS 17 and later. This is a separate native project; the existing Expo `mobile-app` is unchanged. It only signs in and synchronizes health data. Use the Kira Life web app for profile/weight input, meal/workout planning and journals.

## Open and install

1. On a Mac with Xcode 16 or later, open `KiraLife.xcodeproj`. The shared scheme is **KiraLife**; no third-party packages or project generators are required.
2. In Signing & Capabilities, choose your Apple development team and set an available bundle identifier (default `vn.kira.life`). Keep HealthKit enabled, including background delivery entitlement. These deployment identifiers must match your provisioning profile.
3. Select a paired physical iPhone running iOS 17+. Build/run from Xcode after trusting the development profile and enabling Developer Mode when prompted. Signing and installation require your Apple account and device; no credentials or team ID are included in this repository.
4. Deploy the Kira Life backend with migration V23 and expose it over HTTPS using a certificate trusted by the iPhone. No ATS exception is included. The phone must be able to reach that origin; `localhost` refers to the iPhone itself.
5. On the web, save a health profile with your health timezone and at least one weight measurement. Sign into the companion using the same account and the HTTPS origin (for example `https://life.example.com`, no `/api` suffix).
6. Review the Health permission prompt for active energy, resting energy, steps and workouts. Enable sync and tap **Sync now**. Initial sync covers today plus the previous 29 days.

This development project has no App Store artwork or distribution signing configuration; App Store publication is outside this change. A simulator is useful for UI work but does not establish Apple Watch or real-device sync correctness.

## User behavior

- **Review Health permissions** asks HealthKit for read access; the app never writes to Apple Health. Empty results cannot establish whether read access was denied.
- **Enable sync** explicitly registers this iPhone. A second phone is rejected until the existing connection is disconnected on the web or its companion.
- **Sync now** refreshes pending changes and recent daily aggregates. Opening an enabled app also syncs. iOS controls observer/background delivery, and timing is not guaranteed.
- **Disable sync** pauses local observers/uploads while retaining the server connection and existing data. Re-enable to resume.
- **Disconnect iPhone** removes the connection but retains server snapshots. A new connection starts a fresh dataset; use the web **Disconnect & delete synced data** action to erase snapshots immediately.
- **Sign out** revokes the refresh token on the server before clearing the local session and progress file. If offline, retry logout when connected; it does not claim a remote revocation that did not happen.
- The timezone is taken from the web profile, not the phone's travel timezone. Disconnect before changing it on the web. A reconnect rebuilds the daily dataset in the chosen timezone.

UI text follows the iPhone's Vietnamese/English language. The permission usage description is included in the plist; iOS permission controls remain system-managed.

## Data and retry design

- Session and refresh credentials use device-only Keychain (`AfterFirstUnlockThisDeviceOnly`). No passwords are stored. Requests use an ephemeral URLSession without cookies/cache, and reject redirects to another origin.
- UUID/date mappings, query anchors and pending dates live in an atomically written, protected file under Application Support, excluded from backups. The file is scoped to server + user + connection generation; it contains progress identifiers, not raw sample values.
- `HKAnchoredObjectQuery` discovers changes, including deletions. Deleted UUIDs resolve to previously stored dates. The app then reads `HKStatisticsCollectionQuery` daily cumulative values and workout snapshots. It does not manually add calories across devices or add workout energy on top of active energy.
- Updates are replacement snapshots, up to 31 days per request. Successful chunks are removed from the pending set only after the server acknowledges them. On restart/network uncertainty the current server revision is fetched, and remaining dates are re-read. Server generation checks reject deliveries from disconnected devices.
- Today and yesterday are refreshed on every sync; older affected dates are selected by anchors. Unknown deletion IDs trigger reconciliation from the initial window start. Calendar dates follow the fixed health timezone, including DST.
- HealthKit availability, read access, first unlock, background runtime and network access are all device-dependent. Errors preserve pending work and display a generic message without raw health records or provider responses.

## Verification status

This project was authored on Windows. Plist/scheme XML and project source references were inspected; **Swift compilation, signing, installation and real HealthKit behavior remain unverified**. No iOS build or tests were run, per repository/task instructions.

After installation, exercise initial sync, foreground/background updates, missing/partial permissions, multi-source steps/energy, edit/delete of a historical sample/workout, offline retries, app restart during sync, expired session, web disconnect and timezone reset. Compare daily values against Apple Health in the configured timezone; total burn must never include workout calories twice.

See [Health API and full acceptance checklist](../docs/api/health.md).

Sources: [HealthKit setup](https://developer.apple.com/documentation/healthkit/setting-up-healthkit), [anchored changes](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery), [background delivery](https://developer.apple.com/documentation/healthkit/executing-observer-queries).
