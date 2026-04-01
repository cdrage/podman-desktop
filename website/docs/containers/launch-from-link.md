---
sidebar_position: 35
title: Launch a container from a link
description: Launch containers directly from external links using the podman-desktop:// protocol.
keywords: [podman desktop, podman, containers, protocol, launch, badge, readme]
tags: [launching-a-container, protocol-link]
---

# Launching a container from an external link

Podman Desktop supports a custom protocol (`podman-desktop://run-image`) that allows you to launch containers directly from clickable links. This is useful for README badges, documentation, or any web page where you want to provide a one-click container launch experience.

When a user clicks a launch link, Podman Desktop opens a wizard that shows the container configuration for review before launching.

## How it works

1. A link encodes the container configuration (image, ports, environment variables, etc.) as a base64 JSON payload.
2. When clicked, the operating system opens Podman Desktop with the encoded configuration.
3. Podman Desktop displays a **Launch Container** wizard where the user can review and toggle individual settings.
4. The image is pulled automatically if it is not already available locally.
5. The container is created and started.

## Creating a launch link

### Using the badge generator

The easiest way to create a launch link is to use the **Launch Badge Generator** page on the Podman Desktop website:

1. Go to the [Launch Badge Generator](/launch-generator) page.
1. Paste a `podman run` or `docker run` command into the text field. For example:
   ```shell-session
   podman run -d -p 8080:80 -e DEBUG=true --name my-nginx docker.io/nginx:latest
   ```
1. Click **Generate Badge**.
1. Review the parsed configuration to verify it is correct.
1. Copy the generated Markdown snippet.
1. Paste it into your README or documentation.

The generated badge looks like this:

[![Launch in Podman Desktop](https://img.shields.io/badge/Launch%20in-Podman%20Desktop-purple)](#)

### Manual link construction

You can also construct a launch link manually:

1. Create a JSON object with your container configuration:

   ```json
   {
     "image": "docker.io/nginx:latest",
     "name": "my-nginx",
     "ports": ["8080:80"],
     "env": ["DEBUG=true"],
     "volumes": ["/host/path:/container/path"],
     "cmd": "nginx -g \"daemon off;\"",
     "entrypoint": "/entrypoint.sh",
     "hostname": "myhost"
   }
   ```

   Only the `image` field is required. All other fields are optional.

1. Base64-encode the JSON string.

1. Construct the URL:

   ```
   podman-desktop://run-image?config=<base64-encoded-json>
   ```

1. Use the URL in a Markdown badge or HTML link:
   ```markdown
   [![Launch in Podman Desktop](https://img.shields.io/badge/Launch%20in-Podman%20Desktop-purple)](podman-desktop://run-image?config=<base64-encoded-json>)
   ```

## Configuration reference

| Field        | Type     | Required | Description                                                 |
| ------------ | -------- | -------- | ----------------------------------------------------------- |
| `image`      | string   | Yes      | The container image to run (e.g., `docker.io/nginx:latest`) |
| `name`       | string   | No       | Container name                                              |
| `ports`      | string[] | No       | Port mappings in `hostPort:containerPort` format            |
| `env`        | string[] | No       | Environment variables in `KEY=VALUE` format                 |
| `volumes`    | string[] | No       | Volume mounts in `/host:/container` format                  |
| `cmd`        | string   | No       | Command to run in the container                             |
| `entrypoint` | string   | No       | Container entrypoint                                        |
| `hostname`   | string   | No       | Container hostname                                          |

## Using a launch link

#### Prerequisites

- [Podman Desktop is installed](/docs/installation).
- [A running Podman machine](/docs/podman/creating-a-podman-machine).

#### Procedure

1. Click a "Launch in Podman Desktop" badge or link. Podman Desktop opens with the **Launch Container** wizard.
1. Review the container configuration. Use the checkboxes to toggle any optional settings you want to skip.
1. If multiple container engines are available, select which one to use.
1. Click **Launch**. Podman Desktop pulls the image (if needed) and creates the container.
1. When the launch completes, click **View Container** to see the running container.
