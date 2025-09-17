# Enterprise Admin Defaults Example

This example demonstrates how to use the new admin defaults functionality.

## Usage

Load configuration values from the admin defaults scope:

```typescript
import { CONFIGURATION_ADMIN_DEFAULTS_SCOPE } from '/@api/configuration/constants.js';

// Get configuration with admin defaults scope
const config = getConfiguration('myapp.settings', CONFIGURATION_ADMIN_DEFAULTS_SCOPE);
const adminValue = config.get('someKey');
```

## File Locations

The admin defaults are loaded from these OS-specific locations:

- **macOS**: `/Library/Application Support/com.podman.desktop/default-settings.json`
- **Windows**: `%PROGRAMDATA%\PodmanDesktop\default-settings.json`
- **Linux**: `/usr/share/podman-desktop/default-settings.json`

## Example default-settings.json

```json
{
  "registry.defaultRegistry": "https://enterprise.registry.com",
  "security.allowUntrustedImages": false,
  "enterprise.companyName": "Acme Corp",
  "proxy.httpProxy": "http://proxy.company.com:8080"
}
```

## Implementation Details

- File is loaded during ConfigurationRegistry initialization
- Gracefully handles missing or corrupted files
- Uses the same JSON structure as user configuration
- Accessible via `CONFIGURATION_ADMIN_DEFAULTS_SCOPE`
- Errors are logged but don't prevent application startup