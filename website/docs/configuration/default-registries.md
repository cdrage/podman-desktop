---
sidebar_position: 3
title: Configuring default registries
description: Configure default container registries for Podman Desktop
tags: [podman-desktop, registries, configuration, managed]
keywords: [podman desktop, registries, default, mirrors, insecure, blocked]
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Configuring default registries

Podman Desktop allows you to configure default container registries through the `settings.json` configuration file. This enables you to:

- Set default registries for image pulling
- Configure registry mirrors for improved performance
- Mark registries as insecure (HTTP instead of HTTPS)
- Block specific registries from being used

This feature is particularly useful in enterprise environments where administrators need to enforce registry policies across all users.

## Registry configuration structure

Default registries are configured using the `registries.defaults` key in your settings file. Each registry entry can include:

| Property   | Type    | Required | Description                                           |
| ---------- | ------- | -------- | ----------------------------------------------------- |
| `prefix`   | string  | Yes      | Registry prefix (e.g., `docker.io`, `quay.io`)        |
| `location` | string  | Yes      | Registry URL or hostname                              |
| `insecure` | boolean | No       | Allow HTTP connections (default: `false`)             |
| `blocked`  | boolean | No       | Prevent pulling images from this registry             |

Registry mirrors use the `registries.mirrors` key with a similar structure:

| Property   | Type    | Required | Description                                    |
| ---------- | ------- | -------- | ---------------------------------------------- |
| `location` | string  | Yes      | Mirror URL or hostname                         |
| `insecure` | boolean | No       | Allow HTTP connections (default: `false`)      |

## Configuration file location

<Tabs groupId="operating-systems">
<TabItem value="windows" label="Windows">

```
%APPDATA%\podman-desktop\configuration\settings.json
```

</TabItem>
<TabItem value="mac" label="macOS">

```
~/Library/Application Support/podman-desktop/configuration/settings.json
```

</TabItem>
<TabItem value="linux" label="Linux">

```
~/.local/share/podman-desktop/configuration/settings.json
```

</TabItem>
</Tabs>

## Configuration examples

### Basic registry configuration

Configure a default registry for Docker Hub images:

```json title="settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "docker.io",
        "location": "registry.corp.example.com",
        "insecure": false,
        "blocked": false
      }
    }
  ]
}
```

This configuration redirects all `docker.io` pulls to `registry.corp.example.com`.

### Configuring multiple registries

You can configure multiple registries with different settings:

```json title="settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "docker.io",
        "location": "mirror.corp.example.com",
        "insecure": false
      }
    },
    {
      "registry": {
        "prefix": "quay.io",
        "location": "quay-mirror.corp.example.com",
        "insecure": false
      }
    }
  ]
}
```

### Allowing insecure registries

For internal registries without HTTPS:

```json title="settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "internal-registry.local",
        "location": "internal-registry.local:5000",
        "insecure": true,
        "blocked": false
      }
    }
  ]
}
```

### Blocking specific registries

Prevent users from pulling images from specific registries:

```json title="settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "untrusted-registry.io",
        "location": "untrusted-registry.io",
        "blocked": true
      }
    }
  ]
}
```

When a registry is blocked:
- Users cannot pull images from it
- The registry appears in the UI with a disabled configure button
- Attempts to pull from the blocked registry will fail with an error

### Configuring registry mirrors

Set up multiple mirrors for improved reliability:

```json title="settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "docker.io",
        "location": "primary-mirror.corp.example.com",
        "insecure": false
      }
    }
  ],
  "registries.mirrors": [
    {
      "registry.mirror": {
        "location": "secondary-mirror.corp.example.com",
        "insecure": false
      }
    },
    {
      "registry.mirror": {
        "location": "tertiary-mirror.corp.example.com",
        "insecure": false
      }
    }
  ]
}
```

## How it works with Podman

Podman Desktop applies default registry configurations to Podman's `registries.conf.d` directory:

1. **Loading**: On startup, Podman Desktop loads your default registry configuration
2. **Merging**: Configurations are merged with existing Podman registry settings
3. **Conflict resolution**: If conflicts exist (e.g., different `insecure` or `blocked` values), warnings are logged
4. **Application**: The merged configuration is written to Podman's configuration directory
5. **Usage**: When pulling images, Podman uses these registry settings

### Conflict handling

When merging default registries with existing Podman configurations:

- **Location conflicts**: Warnings logged if registry locations differ
- **Insecure flag conflicts**: Warnings logged if security settings differ
- **Blocked flag conflicts**: Warnings logged if blocking status differs
- **Mirror conflicts**: New mirrors are added; existing mirrors are preserved

## UI integration

Default registries appear in the Podman Desktop preferences:

- **Suggested registries section**: Shows all configured default registries
- **Blocked registries**: Displayed with a disabled configure button
- **Duplicate handling**: Registries with matching prefixes shown once, using the blocked status from defaults

## Enterprise deployment

For enterprise environments, administrators can use [managed configuration](/docs/configuration/managed-configuration) to enforce registry settings:

<Tabs groupId="operating-systems">
<TabItem value="linux" label="Linux">

```json title="/usr/share/podman-desktop/default-settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "docker.io",
        "location": "registry.corp.example.com",
        "insecure": false
      }
    }
  ]
}
```

```json title="/usr/share/podman-desktop/locked.json"
{
  "locked": ["registries.defaults"]
}
```

</TabItem>
<TabItem value="mac" label="macOS">

```json title="/Library/Application Support/com.podman.desktop/default-settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "docker.io",
        "location": "registry.corp.example.com",
        "insecure": false
      }
    }
  ]
}
```

```json title="/Library/Application Support/com.podman.desktop/locked.json"
{
  "locked": ["registries.defaults"]
}
```

</TabItem>
<TabItem value="win" label="Windows">

```json title="%PROGRAMDATA%\com.podman.desktop\default-settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "docker.io",
        "location": "registry.corp.example.com",
        "insecure": false
      }
    }
  ]
}
```

```json title="%PROGRAMDATA%\com.podman.desktop\locked.json"
{
  "locked": ["registries.defaults"]
}
```

</TabItem>
</Tabs>

## Troubleshooting

### Registries not being applied

If your registry configuration is not being applied:

1. Verify JSON syntax is valid
2. Check that file paths are correct for your operating system
3. Restart Podman Desktop after making changes
4. Check console output (Help > Toggle Developer Tools) for error messages

### Conflicts with existing registries

If you see conflict warnings:

1. Open Developer Tools (Help > Toggle Developer Tools)
2. Look for messages about registry conflicts
3. Verify your configuration matches the expected format
4. Consider removing conflicting entries from Podman's `registries.conf.d`

### Blocked registry still accessible

If a blocked registry can still be accessed:

1. Verify the `blocked` property is set to `true`
2. Ensure the registry prefix matches exactly
3. Restart Podman Desktop
4. Check if managed configuration is properly locked (for enterprise deployments)

## Additional resources

- [Settings reference](/docs/configuration/settings-reference) - Complete list of all settings
- [Managed configuration](/docs/configuration/managed-configuration) - Enterprise deployment guide
- [Managed configuration use cases](/docs/configuration/managed-configuration-use-cases) - Common enterprise scenarios
- [Extension API: RegistrySuggestedProvider](/api) - API documentation for registry providers

## Next steps

- [Configure proxy settings](/docs/proxy)
- [Manage container registries](/docs/containers/registries)
- [Install extensions](/docs/extensions/install)
