# Apple MDM Support for Podman Desktop

Podman Desktop supports Apple MDM (Mobile Device Management) configuration profiles on macOS. Administrators can deploy managed preferences through their MDM vendor instead of writing JSON files to disk.

## How it works

On macOS, MDM deploys configuration profiles that write managed preferences to:

```
/Library/Managed Preferences/io.podman_desktop.PodmanDesktop.plist    (device-level)
/Library/Managed Preferences/<username>/io.podman_desktop.PodmanDesktop.plist  (per-user)
```

Podman Desktop reads these plist files at startup and merges them into the managed configuration system.

## Plist schema

The plist uses two tiers, following the same model as Slack:

- **Root-level keys** = enforced. The user cannot change these settings.
- **`Defaults` sub-dictionary** = suggested defaults. The user can override these.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Enforced: user cannot change these -->
  <key>proxy.http</key>
  <string>http://proxy.corp:8080</string>

  <key>telemetry.enabled</key>
  <false/>

  <!-- Suggested defaults: user can override these -->
  <key>Defaults</key>
  <dict>
    <key>proxy.https</key>
    <string>http://proxy.corp:8443</string>
  </dict>
</dict>
</plist>
```

The key names are the same flat dot-notation keys used in `default-settings.json` (for example `proxy.http`, `telemetry.enabled`, `extensions.catalog.enabled`).

## Precedence

From highest to lowest priority:

1. MDM enforced keys (root-level plist keys)
2. JSON `locked.json` keys
3. User settings (`settings.json`)
4. MDM defaults (`Defaults` sub-dictionary in plist)
5. JSON `default-settings.json`
6. Schema defaults built into Podman Desktop

When both MDM plist and JSON files exist, MDM values take precedence on conflict.

When both device-level and per-user plist files exist, device-level takes precedence (Apple convention).

## Example MDM profile

Below is a complete `.mobileconfig` profile that an administrator can deploy through Jamf, Kandji, Mosyle, Intune, or any MDM vendor.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key>
      <string>io.podman_desktop.PodmanDesktop</string>
      <key>PayloadIdentifier</key>
      <string>com.example.podman-desktop.managed-config</string>
      <key>PayloadUUID</key>
      <string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>PayloadDisplayName</key>
      <string>Podman Desktop Configuration</string>

      <!-- Enforced settings -->
      <key>proxy.http</key>
      <string>http://proxy.corp:8080</string>
      <key>proxy.https</key>
      <string>https://proxy.corp:8443</string>
      <key>proxy.no</key>
      <string>localhost,127.0.0.1,.corp.example.com</string>
      <key>telemetry.enabled</key>
      <false/>
      <key>extensions.catalog.enabled</key>
      <false/>

      <!-- Suggested defaults (user can override) -->
      <key>Defaults</key>
      <dict>
        <key>preferences.update.appUpdate</key>
        <false/>
      </dict>
    </dict>
  </array>

  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadIdentifier</key>
  <string>com.example.podman-desktop</string>
  <key>PayloadUUID</key>
  <string>F1E2D3C4-B5A6-0987-FEDC-BA9876543210</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadDisplayName</key>
  <string>Podman Desktop Managed Configuration</string>
  <key>PayloadDescription</key>
  <string>Enforces corporate proxy and telemetry settings for Podman Desktop.</string>
</dict>
</plist>
```

Replace the `PayloadUUID` values with unique UUIDs. Generate them with `uuidgen` on macOS.

## Architecture

```
                    ConfigurationRegistry.init()
                              |
         +--------------------+--------------------+
         |                    |                    |
  DefaultConfiguration  LockedConfiguration  MdmConfiguration
  reads JSON defaults   reads JSON locked    reads macOS plist
  (default-settings.json)  (locked.json)     (/Library/Managed Preferences/)
         |                    |                    |
         +-------- all merged into ----------------+
              MANAGED_DEFAULTS + MANAGED_LOCKED scopes
                              |
                         LockedKeys
                    (resolves enforced values)
                              |
                       ConfigurationImpl
                    (serves get() requests)
```

On non-macOS platforms, `MdmConfiguration` returns empty data and has no effect. The existing JSON-based managed configuration continues to work on all platforms.

## Implementation files

| File | Role |
|------|------|
| `packages/main/src/plugin/mdm-configuration.ts` | Reads and parses the MDM plist |
| `packages/main/src/plugin/configuration-registry.ts` | Merges MDM data into managed config scopes |
| `packages/main/src/plugin/index.ts` | DI container binding |
| `packages/main/src/plugin/telemetry/telemetry.ts` | Tracks MDM telemetry events |

## Testing

Run the unit tests:

```bash
npx vitest run packages/main/src/plugin/mdm-configuration.spec.ts
npx vitest run packages/main/src/plugin/configuration-registry.spec.ts
```

Manual test on macOS:

1. Create a plist file at `/Library/Managed Preferences/io.podman_desktop.PodmanDesktop.plist`.
2. Launch Podman Desktop.
3. Open Settings. Verify that enforced settings show a lock icon and cannot be changed.
4. Verify that default settings are applied but can be overridden by the user.

## Reserved keys

The key name `Defaults` is reserved in the MDM plist schema. Do not use it as a configuration key in Podman Desktop.

## Comparison with other Electron apps

| Feature | Podman Desktop | Slack | Firefox |
|---------|---------------|-------|---------|
| macOS MDM profiles | Yes | Yes | Yes |
| JSON config files | Yes | No | Yes (`policies.json`) |
| Windows Group Policy | No | Yes (registry) | Yes (ADMX) |
| Enforced/defaults split | Yes (two-tier) | Yes (two-tier) | No (all enforced) |
| Preference domain | `io.podman_desktop.PodmanDesktop` | `com.tinyspeck.slackmacgap` | `org.mozilla.firefox` |

## References

- [Apple MDM Protocol Reference](https://developer.apple.com/documentation/devicemanagement)
- [Slack MDM Configuration](https://slack.com/help/articles/11906214948755-Manage-desktop-app-configurations)
- [Firefox Policy Templates](https://mozilla.github.io/policy-templates/)
- [Podman Desktop Managed Configuration Docs](website/docs/configuration/managed-configuration.mdx)
