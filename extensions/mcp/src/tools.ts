/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Tool definitions exposing the full Podman Desktop extension API
 */
export const tools: Tool[] = [
  // ============================================================================
  // CONTAINER TOOLS
  // ============================================================================
  {
    name: 'container_list',
    description: 'List all containers with their status, names, IDs, images, and ports',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'container_inspect',
    description: 'Get detailed low-level information about a specific container',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID (from container_list)' },
        id: { type: 'string', description: 'Container ID or name' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'container_create',
    description: 'Create a new container from an image (does not start it)',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID (from container_list or image_list)' },
        image: { type: 'string', description: 'Image name with tag (e.g., nginx:latest)' },
        name: { type: 'string', description: 'Container name' },
        command: { type: 'string', description: 'Command to run (space-separated)' },
        entrypoint: { type: 'string', description: 'Entrypoint (space-separated)' },
        env: { type: 'string', description: 'Environment variables (KEY=value,KEY2=value2)' },
        ports: { type: 'string', description: 'Port mappings (hostPort:containerPort,...)' },
        volumes: { type: 'string', description: 'Volume mounts (hostPath:containerPath,...)' },
        workdir: { type: 'string', description: 'Working directory inside container' },
        user: { type: 'string', description: 'User to run as (user:group)' },
        restart: { type: 'string', description: 'Restart policy (no, always, on-failure, unless-stopped)' },
        privileged: { type: 'boolean', description: 'Run in privileged mode' },
        network: { type: 'string', description: 'Network mode (bridge, host, none, or network name)' },
        hostname: { type: 'string', description: 'Container hostname' },
        labels: { type: 'string', description: 'Labels (key=value,key2=value2)' },
      },
      required: ['engineId', 'image'],
    },
  },
  {
    name: 'container_start',
    description: 'Start a stopped container',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Container ID or name' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'container_stop',
    description: 'Stop a running container',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Container ID or name' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'container_restart',
    description: 'Restart a container (stop + start)',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Container ID or name' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'container_delete',
    description: 'Delete a container (must be stopped first)',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Container ID or name' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'container_logs',
    description: 'Get logs from a container',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Container ID or name' },
        tail: { type: 'number', description: 'Number of lines from the end (default: 100)' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'container_stats',
    description: 'Get CPU, memory, and network stats for a running container',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Container ID or name' },
      },
      required: ['engineId', 'id'],
    },
  },

  // ============================================================================
  // IMAGE TOOLS
  // ============================================================================
  {
    name: 'image_list',
    description: 'List all container images with their tags, sizes, and IDs',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Filter by repository name (optional)' },
      },
    },
  },
  {
    name: 'image_inspect',
    description: 'Get detailed information about an image including layers, config, and history',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Image ID or name:tag' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'image_pull',
    description: 'Pull an image from a registry',
    inputSchema: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Image name with tag (e.g., docker.io/nginx:latest)' },
      },
      required: ['image'],
    },
  },
  {
    name: 'image_push',
    description: 'Push an image to a registry (image must be tagged with registry)',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Image ID or name:tag' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'image_build',
    description: 'Build an image from a Dockerfile/Containerfile',
    inputSchema: {
      type: 'object',
      properties: {
        contextDir: { type: 'string', description: 'Path to build context directory' },
        containerfile: { type: 'string', description: 'Path to Dockerfile/Containerfile (relative to context)' },
        tag: { type: 'string', description: 'Tag for the built image (e.g., myapp:latest)' },
        buildArgs: { type: 'string', description: 'Build arguments (ARG=value,ARG2=value2)' },
        target: { type: 'string', description: 'Target build stage for multi-stage builds' },
        platform: { type: 'string', description: 'Target platform (e.g., linux/amd64, linux/arm64)' },
        noCache: { type: 'boolean', description: 'Do not use cache when building' },
      },
      required: ['contextDir', 'tag'],
    },
  },
  {
    name: 'image_tag',
    description: 'Add a new tag to an existing image',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Source image ID or name:tag' },
        repo: { type: 'string', description: 'New repository name (e.g., myregistry/myimage)' },
        tag: { type: 'string', description: 'New tag (default: latest)' },
      },
      required: ['engineId', 'id', 'repo'],
    },
  },
  {
    name: 'image_delete',
    description: 'Delete an image',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Image ID or name:tag' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'image_save',
    description: 'Export an image to a tar file',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Image ID or name:tag' },
        filename: { type: 'string', description: 'Output tar file path' },
      },
      required: ['engineId', 'id', 'filename'],
    },
  },

  // ============================================================================
  // POD TOOLS
  // ============================================================================
  {
    name: 'pod_list',
    description: 'List all pods with their status and containers',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'pod_inspect',
    description: 'Get detailed information about a pod',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Pod ID' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'pod_create',
    description: 'Create a new pod',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Pod name' },
        portmappings: { type: 'string', description: 'Port mappings (hostPort:containerPort,...)' },
        networks: { type: 'string', description: 'Networks to connect (comma-separated)' },
        labels: { type: 'string', description: 'Labels (key=value,key2=value2)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'pod_start',
    description: 'Start a pod',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Pod ID' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'pod_stop',
    description: 'Stop a pod',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Pod ID' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'pod_restart',
    description: 'Restart a pod',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Pod ID' },
      },
      required: ['engineId', 'id'],
    },
  },
  {
    name: 'pod_delete',
    description: 'Delete a pod',
    inputSchema: {
      type: 'object',
      properties: {
        engineId: { type: 'string', description: 'Engine ID' },
        id: { type: 'string', description: 'Pod ID' },
      },
      required: ['engineId', 'id'],
    },
  },

  // ============================================================================
  // VOLUME TOOLS
  // ============================================================================
  {
    name: 'volume_list',
    description: 'List all volumes',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'volume_create',
    description: 'Create a new volume',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Volume name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'volume_delete',
    description: 'Delete a volume',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Volume name' },
      },
      required: ['name'],
    },
  },

  // ============================================================================
  // NETWORK TOOLS
  // ============================================================================
  {
    name: 'network_list',
    description: 'List all networks',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'network_create',
    description: 'Create a new network',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Network name' },
        driver: { type: 'string', description: 'Network driver (bridge, macvlan, etc.)' },
        internal: { type: 'boolean', description: 'Restrict external access' },
        subnet: { type: 'string', description: 'Subnet in CIDR format (e.g., 172.28.0.0/16)' },
        gateway: { type: 'string', description: 'Gateway IP address' },
      },
      required: ['name'],
    },
  },

  // ============================================================================
  // SYSTEM/ENGINE TOOLS
  // ============================================================================
  {
    name: 'system_info',
    description: 'Get system information about all container engines (version, OS, resources)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'system_prune',
    description: 'Remove unused containers, images, networks, and volumes',
    inputSchema: {
      type: 'object',
      properties: {
        containers: { type: 'boolean', description: 'Prune stopped containers' },
        images: { type: 'boolean', description: 'Prune unused images' },
        volumes: { type: 'boolean', description: 'Prune unused volumes' },
        all: { type: 'boolean', description: 'Prune everything' },
      },
    },
  },

  // ============================================================================
  // KUBERNETES TOOLS
  // ============================================================================
  {
    name: 'kube_get_config',
    description: 'Get the current kubeconfig file path',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'kube_create_resources',
    description: 'Create Kubernetes resources from YAML/JSON manifests',
    inputSchema: {
      type: 'object',
      properties: {
        context: { type: 'string', description: 'Kubernetes context to use' },
        yaml: { type: 'string', description: 'YAML manifest content' },
      },
      required: ['context', 'yaml'],
    },
  },

  // ============================================================================
  // PROCESS/CLI TOOLS
  // ============================================================================
  {
    name: 'exec',
    description: 'Execute a shell command on the host system',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        args: { type: 'string', description: 'Command arguments (space-separated)' },
        cwd: { type: 'string', description: 'Working directory' },
        env: { type: 'string', description: 'Environment variables (KEY=value,KEY2=value2)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'podman',
    description: 'Execute a podman CLI command directly',
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'string', description: 'Podman command arguments (e.g., "ps -a" or "images")' },
      },
      required: ['args'],
    },
  },
  {
    name: 'docker',
    description: 'Execute a docker CLI command directly',
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'string', description: 'Docker command arguments (e.g., "ps -a" or "images")' },
      },
      required: ['args'],
    },
  },
  {
    name: 'kubectl',
    description: 'Execute a kubectl command directly',
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'string', description: 'kubectl command arguments (e.g., "get pods -A")' },
      },
      required: ['args'],
    },
  },
];

/**
 * List of destructive tools that modify or delete resources
 */
export const DESTRUCTIVE_TOOLS = [
  'container_stop',
  'container_delete',
  'container_restart',
  'image_delete',
  'pod_stop',
  'pod_delete',
  'pod_restart',
  'volume_delete',
  'system_prune',
  'exec',
  'podman',
  'docker',
  'kubectl',
];
