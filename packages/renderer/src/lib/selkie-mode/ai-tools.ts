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

import { get } from 'svelte/store';
import { router } from 'tinro';

import { containersInfos } from '/@/stores/containers';
import { imagesInfos } from '/@/stores/images';
import { podsInfos } from '/@/stores/pods';
import { providerInfos } from '/@/stores/providers';
import { volumeListInfos } from '/@/stores/volumes';
import type { ProviderContainerConnectionInfo } from '/@api/provider-info';
import type { ToolDefinition, ToolResult } from '/@api/selkie-mode-info';

export const DESTRUCTIVE_TOOLS = [
  'stop_container',
  'delete_container',
  'delete_image',
  'stop_pod',
  'delete_pod',
  'delete_volume',
  'delete_network',
];

export const AI_TOOLS: ToolDefinition[] = [
  // Container Tools
  {
    name: 'list_containers',
    description:
      'List all containers with their status, names, IDs, and images. Use this to see what containers exist.',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Optional filter by name or status (running, stopped, exited)',
        },
      },
    },
  },
  {
    name: 'start_container',
    description: 'Start a stopped container by its ID',
    parameters: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID (from list_containers)' },
        engineId: { type: 'string', description: 'Engine ID (from list_containers)' },
      },
      required: ['containerId', 'engineId'],
    },
  },
  {
    name: 'stop_container',
    description: 'Stop a running container',
    parameters: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID' },
        engineId: { type: 'string', description: 'Engine ID' },
      },
      required: ['containerId', 'engineId'],
    },
  },
  {
    name: 'restart_container',
    description: 'Restart a container',
    parameters: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID' },
        engineId: { type: 'string', description: 'Engine ID' },
      },
      required: ['containerId', 'engineId'],
    },
  },
  {
    name: 'delete_container',
    description: 'Delete a container permanently. The container must be stopped first.',
    parameters: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID' },
        engineId: { type: 'string', description: 'Engine ID' },
      },
      required: ['containerId', 'engineId'],
    },
  },
  {
    name: 'create_container',
    description: 'Create and start a new container from an image',
    parameters: {
      type: 'object',
      properties: {
        imageName: { type: 'string', description: 'Full image name with tag (e.g., nginx:latest)' },
        containerName: { type: 'string', description: 'Name for the new container' },
        ports: {
          type: 'string',
          description: 'Port mappings as comma-separated host:container pairs (e.g., "8080:80,3000:3000")',
        },
        env: {
          type: 'string',
          description:
            'Environment variables as comma-separated KEY=value pairs (e.g., "NODE_ENV=production,PORT=3000")',
        },
        volumes: {
          type: 'string',
          description: 'Volume mounts as comma-separated source:target pairs (e.g., "/host/path:/container/path")',
        },
      },
      required: ['imageName'],
    },
  },
  {
    name: 'get_container_logs',
    description: 'Get recent logs from a container',
    parameters: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID' },
        engineId: { type: 'string', description: 'Engine ID' },
        tail: { type: 'number', description: 'Number of lines to fetch (default 50)' },
      },
      required: ['containerId', 'engineId'],
    },
  },

  // Image Tools
  {
    name: 'list_images',
    description: 'List all container images available locally',
    parameters: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional filter by repository name' },
      },
    },
  },
  {
    name: 'pull_image',
    description: 'Pull a container image from a registry',
    parameters: {
      type: 'object',
      properties: {
        imageName: {
          type: 'string',
          description: 'Full image name with tag (e.g., nginx:latest, docker.io/library/nginx:latest)',
        },
      },
      required: ['imageName'],
    },
  },
  {
    name: 'delete_image',
    description: 'Delete a container image',
    parameters: {
      type: 'object',
      properties: {
        imageId: { type: 'string', description: 'Image ID' },
        engineId: { type: 'string', description: 'Engine ID' },
      },
      required: ['imageId', 'engineId'],
    },
  },

  // Pod Tools
  {
    name: 'list_pods',
    description: 'List all pods',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'start_pod',
    description: 'Start a pod',
    parameters: {
      type: 'object',
      properties: {
        podId: { type: 'string', description: 'Pod ID' },
        engineId: { type: 'string', description: 'Engine ID' },
      },
      required: ['podId', 'engineId'],
    },
  },
  {
    name: 'stop_pod',
    description: 'Stop a pod',
    parameters: {
      type: 'object',
      properties: {
        podId: { type: 'string', description: 'Pod ID' },
        engineId: { type: 'string', description: 'Engine ID' },
      },
      required: ['podId', 'engineId'],
    },
  },
  {
    name: 'delete_pod',
    description: 'Delete a pod permanently',
    parameters: {
      type: 'object',
      properties: {
        podId: { type: 'string', description: 'Pod ID' },
        engineId: { type: 'string', description: 'Engine ID' },
      },
      required: ['podId', 'engineId'],
    },
  },

  // Volume Tools
  {
    name: 'list_volumes',
    description: 'List all volumes',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_volume',
    description: 'Create a new volume',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Volume name' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_volume',
    description: 'Delete a volume',
    parameters: {
      type: 'object',
      properties: {
        volumeName: { type: 'string', description: 'Volume name' },
        engineId: { type: 'string', description: 'Engine ID' },
      },
      required: ['volumeName', 'engineId'],
    },
  },

  // Navigation Tools
  {
    name: 'navigate_to',
    description: 'Navigate to a page in Podman Desktop',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          description: 'Page to navigate to',
          enum: ['dashboard', 'containers', 'images', 'pods', 'volumes', 'networks', 'settings'],
        },
      },
      required: ['page'],
    },
  },
  {
    name: 'open_container_details',
    description: 'Open the details page for a specific container to show its summary, configuration, and actions',
    parameters: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID' },
      },
      required: ['containerId'],
    },
  },
  {
    name: 'open_container_logs',
    description: 'Open the logs view for a specific container to see its output',
    parameters: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID' },
      },
      required: ['containerId'],
    },
  },
  {
    name: 'open_container_terminal',
    description: 'Open an interactive terminal/shell inside a running container',
    parameters: {
      type: 'object',
      properties: {
        containerId: { type: 'string', description: 'Container ID' },
      },
      required: ['containerId'],
    },
  },
  {
    name: 'open_image_details',
    description: 'Open the details page for a specific image',
    parameters: {
      type: 'object',
      properties: {
        imageId: { type: 'string', description: 'Image ID or name' },
        engineId: { type: 'string', description: 'Engine ID' },
      },
      required: ['imageId', 'engineId'],
    },
  },
  {
    name: 'open_create_container',
    description: 'Open the Create Container form to create a new container, optionally pre-selecting an image',
    parameters: {
      type: 'object',
      properties: {
        imageName: { type: 'string', description: 'Optional image name to pre-select' },
      },
    },
  },
];

function getActiveProviderConnection(): ProviderContainerConnectionInfo | undefined {
  const providers = get(providerInfos);
  for (const provider of providers) {
    const connection = provider.containerConnections?.find(c => c.status === 'started');
    if (connection) {
      return connection;
    }
  }
  return undefined;
}

function getEngineId(): string | undefined {
  const containers = get(containersInfos);
  if (containers.length > 0) {
    return containers[0].engineId;
  }
  const images = get(imagesInfos);
  if (images.length > 0) {
    return images[0].engineId;
  }
  return undefined;
}

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      // Container operations
      case 'list_containers': {
        const containers = get(containersInfos);
        const filter = (args.filter as string | undefined)?.toLowerCase();
        const filtered = filter
          ? containers.filter(
              c =>
                c.Names?.some(n => n.toLowerCase().includes(filter)) ||
                c.State?.toLowerCase() === filter ||
                c.Image?.toLowerCase().includes(filter),
            )
          : containers;
        return {
          success: true,
          data: filtered.map(c => ({
            id: c.Id,
            shortId: c.Id.substring(0, 12),
            names: c.Names,
            image: c.Image,
            state: c.State,
            status: c.Status,
            engineId: c.engineId,
            ports: c.Ports,
          })),
        };
      }

      case 'start_container': {
        await window.startContainer(args.engineId as string, args.containerId as string);
        return {
          success: true,
          data: `Container ${(args.containerId as string).substring(0, 12)} started successfully`,
        };
      }

      case 'stop_container': {
        await window.stopContainer(args.engineId as string, args.containerId as string);
        return {
          success: true,
          data: `Container ${(args.containerId as string).substring(0, 12)} stopped successfully`,
        };
      }

      case 'restart_container': {
        await window.restartContainer(args.engineId as string, args.containerId as string);
        return {
          success: true,
          data: `Container ${(args.containerId as string).substring(0, 12)} restarted successfully`,
        };
      }

      case 'delete_container': {
        await window.deleteContainer(args.engineId as string, args.containerId as string);
        return {
          success: true,
          data: `Container ${(args.containerId as string).substring(0, 12)} deleted successfully`,
        };
      }

      case 'create_container': {
        const connection = getActiveProviderConnection();
        if (!connection) {
          return { success: false, error: 'No container engine connection available. Is Podman running?' };
        }

        const engineId = getEngineId();
        if (!engineId) {
          return { success: false, error: 'Could not determine engine ID' };
        }

        // Parse port mappings
        const portBindings: Record<string, Array<{ HostPort: string }>> = {};
        const exposedPorts: Record<string, object> = {};
        if (args.ports) {
          const portMappings = (args.ports as string).split(',');
          for (const mapping of portMappings) {
            const [hostPort, containerPort] = mapping.trim().split(':');
            if (hostPort && containerPort) {
              const key = `${containerPort}/tcp`;
              portBindings[key] = [{ HostPort: hostPort }];
              exposedPorts[key] = {};
            }
          }
        }

        // Parse environment variables
        const env: string[] = [];
        if (args.env) {
          env.push(...(args.env as string).split(',').map(e => e.trim()));
        }

        // Parse volume mounts
        const binds: string[] = [];
        if (args.volumes) {
          binds.push(...(args.volumes as string).split(',').map(v => v.trim()));
        }

        const options = {
          Image: args.imageName as string,
          name: args.containerName as string | undefined,
          Env: env,
          ExposedPorts: exposedPorts,
          HostConfig: {
            PortBindings: portBindings,
            Binds: binds.length > 0 ? binds : undefined,
          },
        };

        const result = await window.createAndStartContainer(engineId, options);
        return {
          success: true,
          data: `Container created and started with ID: ${result.id.substring(0, 12)}`,
        };
      }

      case 'get_container_logs': {
        const logs: string[] = [];
        const tail = (args.tail as number) || 50;

        await new Promise<void>(resolve => {
          window
            .logsContainer({
              engineId: args.engineId as string,
              containerId: args.containerId as string,
              callback: (_name: string, data: string) => {
                logs.push(data);
              },
            })
            .then(() => resolve())
            .catch(() => resolve());

          // Timeout after 5 seconds
          setTimeout(() => resolve(), 5000);
        });

        const logText = logs.join('');
        const lines = logText.split('\n').slice(-tail).join('\n');
        return { success: true, data: lines || 'No logs available' };
      }

      // Image operations
      case 'list_images': {
        const images = get(imagesInfos);
        const filter = (args.filter as string | undefined)?.toLowerCase();
        const filtered = filter
          ? images.filter(img => img.RepoTags?.some(t => t.toLowerCase().includes(filter)))
          : images;
        return {
          success: true,
          data: filtered.map(img => ({
            id: img.Id,
            shortId: img.Id.substring(0, 12),
            repoTags: img.RepoTags,
            size: `${Math.round(img.Size / 1024 / 1024)}MB`,
            created: new Date(img.Created * 1000).toISOString(),
            engineId: img.engineId,
          })),
        };
      }

      case 'pull_image': {
        const connection = getActiveProviderConnection();
        if (!connection) {
          return { success: false, error: 'No container engine connection available. Is Podman running?' };
        }

        await window.pullImage(connection, args.imageName as string, () => {});
        return { success: true, data: `Image ${args.imageName} pulled successfully` };
      }

      case 'delete_image': {
        await window.deleteImage(args.engineId as string, args.imageId as string);
        return { success: true, data: `Image deleted successfully` };
      }

      // Pod operations
      case 'list_pods': {
        const pods = get(podsInfos);
        return {
          success: true,
          data: pods.map(p => ({
            id: p.Id,
            name: p.Name,
            status: p.Status,
            engineId: p.engineId,
            containers: p.Containers?.length || 0,
          })),
        };
      }

      case 'start_pod': {
        await window.startPod(args.engineId as string, args.podId as string);
        return { success: true, data: 'Pod started successfully' };
      }

      case 'stop_pod': {
        await window.stopPod(args.engineId as string, args.podId as string);
        return { success: true, data: 'Pod stopped successfully' };
      }

      case 'delete_pod': {
        await window.removePod(args.engineId as string, args.podId as string);
        return { success: true, data: 'Pod deleted successfully' };
      }

      // Volume operations
      case 'list_volumes': {
        const volumeList = get(volumeListInfos);
        const volumes = volumeList.flatMap(vl => vl.Volumes);
        return {
          success: true,
          data: volumes.map(v => ({
            name: v.Name,
            driver: v.Driver,
            engineId: v.engineId,
          })),
        };
      }

      case 'create_volume': {
        const connection = getActiveProviderConnection();
        if (!connection) {
          return { success: false, error: 'No container engine connection available' };
        }

        await window.createVolume(connection, { Name: args.name as string });
        return { success: true, data: `Volume ${args.name} created successfully` };
      }

      case 'delete_volume': {
        await window.removeVolume(args.engineId as string, args.volumeName as string);
        return { success: true, data: `Volume ${args.volumeName} deleted successfully` };
      }

      // Navigation
      case 'navigate_to': {
        const pageRoutes: Record<string, string> = {
          dashboard: '/',
          containers: '/containers',
          images: '/images',
          pods: '/pods',
          volumes: '/volumes',
          networks: '/networks',
          settings: '/preferences/resources',
        };

        const route = pageRoutes[args.page as string];
        if (route) {
          router.goto(route);
          return { success: true, data: `Navigated to ${args.page}` };
        }
        return { success: false, error: `Unknown page: ${args.page}` };
      }

      case 'open_container_details': {
        const containerId = args.containerId as string;
        router.goto(`/containers/${containerId}/`);
        return { success: true, data: `Opened container details for ${containerId.substring(0, 12)}` };
      }

      case 'open_container_logs': {
        const containerId = args.containerId as string;
        router.goto(`/containers/${containerId}/logs`);
        return { success: true, data: `Opened logs for container ${containerId.substring(0, 12)}` };
      }

      case 'open_container_terminal': {
        const containerId = args.containerId as string;
        router.goto(`/containers/${containerId}/terminal`);
        return { success: true, data: `Opened terminal for container ${containerId.substring(0, 12)}` };
      }

      case 'open_image_details': {
        const imageId = args.imageId as string;
        const engineId = args.engineId as string;
        router.goto(`/images/${imageId}/${engineId}/`);
        return { success: true, data: `Opened image details for ${imageId.substring(0, 12)}` };
      }

      case 'open_create_container': {
        // Navigate to create container page
        if (args.imageName) {
          // If an image name is provided, navigate to create container with that image
          router.goto(`/images/existing-image-create-container`);
          return { success: true, data: `Opened container creation form` };
        } else {
          router.goto(`/containers/create`);
          return { success: true, data: `Opened container creation form` };
        }
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export function getActionDescription(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'delete_container':
      return `Delete container ${(args.containerId as string)?.substring(0, 12)}`;
    case 'stop_container':
      return `Stop container ${(args.containerId as string)?.substring(0, 12)}`;
    case 'delete_image':
      return `Delete image ${(args.imageId as string)?.substring(0, 12)}`;
    case 'delete_pod':
      return `Delete pod ${args.podId}`;
    case 'stop_pod':
      return `Stop pod ${args.podId}`;
    case 'delete_volume':
      return `Delete volume ${args.volumeName}`;
    case 'delete_network':
      return `Delete network ${args.networkId}`;
    default:
      return `${toolName}`;
  }
}
