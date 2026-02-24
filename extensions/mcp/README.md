# MCP Server Extension for Podman Desktop

This extension provides a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that allows AI assistants like Claude Desktop, Claude Code, and other MCP-compatible clients to control Podman Desktop.

## Features

When Podman Desktop is running, the MCP server exposes tools for:

- **Container Operations**: List, start, stop, restart, delete, create containers, and view logs
- **Image Operations**: List, pull, and delete container images
- **Pod Operations**: List, start, stop, and delete pods
- **Volume Operations**: List, create, and delete volumes
- **System Operations**: Get provider information

## Usage

### 1. Enable the Extension

The MCP Server extension is enabled by default. You can configure it in:
**Settings > Extensions > MCP Server**

### 2. Configure Your AI Assistant

#### Claude Code

Run the following command in your terminal:

```bash
claude mcp add podman-desktop --transport sse http://127.0.0.1:6110/sse
```

The MCP server will be automatically available in your next Claude Code session.

#### Claude Desktop

Add the following to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "podman-desktop": {
      "url": "http://localhost:6110/sse"
    }
  }
}
```

### 3. Restart Your AI Assistant

- **Claude Code**: The MCP server will be available in your next session
- **Claude Desktop**: Restart Claude Desktop after updating the configuration

## Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| `mcp.server.enabled` | `true` | Enable/disable the MCP server |
| `mcp.server.port` | `6110` | Port for the MCP server |

## Available Tools

### Container Tools

| Tool | Description |
|------|-------------|
| `list_containers` | List all containers with status, names, IDs |
| `start_container` | Start a stopped container |
| `stop_container` | Stop a running container |
| `restart_container` | Restart a container |
| `delete_container` | Delete a container |
| `create_container` | Create and start a new container |
| `get_container_logs` | Get recent logs from a container |

### Image Tools

| Tool | Description |
|------|-------------|
| `list_images` | List all container images |
| `pull_image` | Pull an image from a registry |
| `delete_image` | Delete an image |

### Pod Tools

| Tool | Description |
|------|-------------|
| `list_pods` | List all pods |
| `start_pod` | Start a pod |
| `stop_pod` | Stop a pod |
| `delete_pod` | Delete a pod |

### Volume Tools

| Tool | Description |
|------|-------------|
| `list_volumes` | List all volumes |
| `create_volume` | Create a new volume |
| `delete_volume` | Delete a volume |

### System Tools

| Tool | Description |
|------|-------------|
| `get_provider_info` | Get container engine provider information |

## Troubleshooting

### MCP Server not starting

1. Check if port 6110 is already in use
2. Try changing the port in settings
3. Check the Podman Desktop logs for errors

### Claude Desktop not connecting

1. Verify Podman Desktop is running
2. Check the MCP server is enabled in settings
3. Verify the configuration URL matches the port setting
4. Restart Claude Desktop after configuration changes

## License

Apache-2.0
