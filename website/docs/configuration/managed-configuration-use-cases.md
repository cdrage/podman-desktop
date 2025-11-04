---
sidebar_position: 11
title: Managed configuration use cases
description: Common use cases and examples for enterprise managed configuration.
tags: [podman-desktop, configuration, enterprise, managed, use-cases]
keywords: [podman desktop, configuration, managed, enterprise, examples, use cases]
---

# Managed configuration use cases

As an administrator, you can use managed configuration to enforce specific settings for all users in your organization. Below are some common use cases with example configurations.

## Enforcing proxy settings

Lock proxy configuration to ensure all users route traffic through corporate proxy servers.

```json title="default-settings.json"
{
  "proxy.http": "http://corp-proxy.example.com:8080"
}
```

```json title="locked.json"
{
  "locked": ["proxy.http"]
}
```

## Managing telemetry

Control telemetry settings for compliance or privacy requirements.

```json title="default-settings.json"
{
  "telemetry.enabled": false
}
```

```json title="locked.json"
{
  "locked": ["telemetry.enabled"]
}
```

## Configuring default registries

Configure default container registries for all users, including registry mirrors, insecure registries, and blocked registries. This is useful for enforcing corporate image repositories or preventing access to specific registries.

### Basic registry configuration

Set default registries that users should use:

```json title="default-settings.json"
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

```json title="locked.json"
{
  "locked": ["registries.defaults"]
}
```

### Blocking specific registries

Prevent users from pulling images from specific registries:

```json title="default-settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "quay.io",
        "location": "quay.io",
        "blocked": true
      }
    }
  ]
}
```

```json title="locked.json"
{
  "locked": ["registries.defaults"]
}
```

### Configuring registry mirrors

Set up registry mirrors for improved performance and reliability:

```json title="default-settings.json"
{
  "registries.defaults": [
    {
      "registry": {
        "prefix": "docker.io",
        "location": "mirror.corp.example.com",
        "insecure": false
      }
    }
  ],
  "registries.mirrors": [
    {
      "registry.mirror": {
        "location": "mirror2.corp.example.com",
        "insecure": false
      }
    }
  ]
}
```

```json title="locked.json"
{
  "locked": ["registries.defaults", "registries.mirrors"]
}
```

### Allowing insecure registries

Configure internal registries that don't use HTTPS:

```json title="default-settings.json"
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

```json title="locked.json"
{
  "locked": ["registries.defaults"]
}
```

## Additional resources

- [Configuring a managed user environment](/docs/configuration/managed-configuration)
- [Configuration settings reference](/docs/configuration/settings-reference)
