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

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as extensionApi from '@podman-desktop/api';
import * as YAML from 'yaml';

type ToolArgs = Record<string, unknown>;
type ToolHandler = (args: ToolArgs) => Promise<CallToolResult>;

// Helper to get string arg
function str(args: ToolArgs, key: string): string {
  return (args[key] as string) ?? '';
}

// Helper to get optional string arg
function optStr(args: ToolArgs, key: string): string | undefined {
  return args[key] as string | undefined;
}

// Helper to get number arg with default
function num(args: ToolArgs, key: string, defaultVal: number): number {
  return (args[key] as number) ?? defaultVal;
}

// Helper to get boolean arg
function bool(args: ToolArgs, key: string): boolean {
  return (args[key] as boolean) ?? false;
}

// Helper to parse comma-separated key=value pairs
function parseKeyValue(input: string | undefined): Record<string, string> {
  if (!input) return {};
  const result: Record<string, string> = {};
  for (const pair of input.split(',')) {
    const [key, ...valueParts] = pair.trim().split('=');
    if (key) {
      result[key] = valueParts.join('=');
    }
  }
  return result;
}

// Helper to parse comma-separated port mappings (host:container)
function parsePortMappings(input: string | undefined): {
  portBindings: Record<string, { HostPort: string }[]>;
  exposedPorts: Record<string, object>;
} {
  const portBindings: Record<string, { HostPort: string }[]> = {};
  const exposedPorts: Record<string, object> = {};
  if (!input) return { portBindings, exposedPorts };

  for (const mapping of input.split(',')) {
    const [hostPort, containerPort] = mapping.trim().split(':');
    if (hostPort && containerPort) {
      const key = `${containerPort}/tcp`;
      portBindings[key] = [{ HostPort: hostPort }];
      exposedPorts[key] = {};
    }
  }
  return { portBindings, exposedPorts };
}

// Helper to format JSON response
function json(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

// Helper to format text response
function text(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }] };
}

// Helper to format error response
function error(message: string): CallToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

// ============================================================================
// CONTAINER HANDLERS
// ============================================================================
const containerHandlers: Record<string, ToolHandler> = {
  container_list: async () => {
    const containers = await extensionApi.containerEngine.listContainers();
    return json(
      containers.map(c => ({
        id: c.Id,
        shortId: c.Id.substring(0, 12),
        names: c.Names,
        image: c.Image,
        state: c.State,
        status: c.Status,
        engineId: c.engineId,
        ports: c.Ports,
        created: c.Created,
      })),
    );
  },

  container_inspect: async args => {
    const info = await extensionApi.containerEngine.inspectContainer(str(args, 'engineId'), str(args, 'id'));
    return json(info);
  },

  container_create: async args => {
    const engineId = str(args, 'engineId');
    const { portBindings, exposedPorts } = parsePortMappings(optStr(args, 'ports'));
    const env =
      optStr(args, 'env')
        ?.split(',')
        .map(e => e.trim()) ?? [];
    const binds =
      optStr(args, 'volumes')
        ?.split(',')
        .map(v => v.trim()) ?? [];
    const cmd = optStr(args, 'command')?.split(' ');
    const entrypoint = optStr(args, 'entrypoint')?.split(' ');
    const labels = parseKeyValue(optStr(args, 'labels'));

    const options: extensionApi.ContainerCreateOptions = {
      Image: str(args, 'image'),
      name: optStr(args, 'name'),
      Cmd: cmd,
      Entrypoint: entrypoint,
      Env: env.length > 0 ? env : undefined,
      ExposedPorts: Object.keys(exposedPorts).length > 0 ? exposedPorts : undefined,
      WorkingDir: optStr(args, 'workdir'),
      User: optStr(args, 'user'),
      Labels: Object.keys(labels).length > 0 ? labels : undefined,
      Hostname: optStr(args, 'hostname'),
      HostConfig: {
        PortBindings: Object.keys(portBindings).length > 0 ? portBindings : undefined,
        Binds: binds.length > 0 ? binds : undefined,
        Privileged: bool(args, 'privileged'),
        NetworkMode: optStr(args, 'network'),
        RestartPolicy: optStr(args, 'restart') ? { Name: optStr(args, 'restart')! } : undefined,
      },
    };

    const result = await extensionApi.containerEngine.createContainer(engineId, options);
    return text(`Container created with ID: ${result.id}`);
  },

  container_start: async args => {
    await extensionApi.containerEngine.startContainer(str(args, 'engineId'), str(args, 'id'));
    return text(`Container ${str(args, 'id')} started`);
  },

  container_stop: async args => {
    await extensionApi.containerEngine.stopContainer(str(args, 'engineId'), str(args, 'id'));
    return text(`Container ${str(args, 'id')} stopped`);
  },

  container_restart: async args => {
    const engineId = str(args, 'engineId');
    const id = str(args, 'id');
    await extensionApi.containerEngine.stopContainer(engineId, id);
    await extensionApi.containerEngine.startContainer(engineId, id);
    return text(`Container ${id} restarted`);
  },

  container_delete: async args => {
    await extensionApi.containerEngine.deleteContainer(str(args, 'engineId'), str(args, 'id'));
    return text(`Container ${str(args, 'id')} deleted`);
  },

  container_logs: async args => {
    const logs: string[] = [];
    const tail = num(args, 'tail', 100);

    await new Promise<void>(resolve => {
      let resolved = false;
      extensionApi.containerEngine
        .logsContainer(str(args, 'engineId'), str(args, 'id'), (logName: string, data: string) => {
          if (logName === 'data') {
            logs.push(data);
          } else if (logName === 'end' && !resolved) {
            resolved = true;
            resolve();
          }
        })
        .catch(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 10000);
    });

    const logText = logs.join('');
    const lines = logText.split('\n').slice(-tail).join('\n');
    return text(lines || 'No logs available');
  },

  container_stats: args => {
    return new Promise(resolve => {
      let statsReceived = false;
      extensionApi.containerEngine
        .statsContainer(str(args, 'engineId'), str(args, 'id'), stats => {
          if (!statsReceived) {
            statsReceived = true;
            resolve(
              json({
                cpu: stats.cpu_stats,
                memory: stats.memory_stats,
                network: stats.networks,
                pids: stats.pids_stats,
              }),
            );
          }
        })
        .then(disposable => {
          setTimeout(() => {
            disposable.dispose();
            if (!statsReceived) {
              resolve(error('No stats received - container may not be running'));
            }
          }, 5000);
        })
        .catch((e: unknown) => {
          resolve(error(e instanceof Error ? e.message : String(e)));
        });
    });
  },
};

// ============================================================================
// IMAGE HANDLERS
// ============================================================================
const imageHandlers: Record<string, ToolHandler> = {
  image_list: async args => {
    const images = await extensionApi.containerEngine.listImages();
    const filter = optStr(args, 'filter')?.toLowerCase();
    const filtered = filter ? images.filter(img => img.RepoTags?.some(t => t.toLowerCase().includes(filter))) : images;

    return json(
      filtered.map(img => ({
        id: img.Id,
        shortId: img.Id.replace('sha256:', '').substring(0, 12),
        repoTags: img.RepoTags,
        size: img.Size ? `${Math.round(img.Size / 1024 / 1024)}MB` : 'unknown',
        created: img.Created,
        engineId: img.engineId,
      })),
    );
  },

  image_inspect: async args => {
    const info = await extensionApi.containerEngine.getImageInspect(str(args, 'engineId'), str(args, 'id'));
    return json(info);
  },

  image_pull: async args => {
    const imageName = str(args, 'image');
    try {
      const result = await extensionApi.process.exec('podman', ['pull', imageName]);
      return text(`Image pulled successfully:\n${result.stdout}`);
    } catch {
      try {
        const result = await extensionApi.process.exec('docker', ['pull', imageName]);
        return text(`Image pulled successfully:\n${result.stdout}`);
      } catch (e: unknown) {
        return error(`Failed to pull image: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  },

  image_push: async args => {
    const engineId = str(args, 'engineId');
    const id = str(args, 'id');
    const logs: string[] = [];

    await new Promise<void>(resolve => {
      extensionApi.containerEngine
        .pushImage(engineId, id, (logName: string, data: string) => {
          if (logName === 'data') {
            logs.push(data);
          } else if (logName === 'end') {
            resolve();
          }
        })
        .catch(() => resolve());

      setTimeout(() => resolve(), 60000);
    });

    return text(logs.join('\n') || 'Image pushed successfully');
  },

  image_build: async args => {
    const contextDir = str(args, 'contextDir');
    const tag = str(args, 'tag');
    const logs: string[] = [];

    const buildOptions: extensionApi.BuildImageOptions = {
      tag,
      containerFile: optStr(args, 'containerfile'),
      platform: optStr(args, 'platform'),
      nocache: bool(args, 'noCache'),
      extrahosts: optStr(args, 'target'),
    };

    const buildArgs = parseKeyValue(optStr(args, 'buildArgs'));
    if (Object.keys(buildArgs).length > 0) {
      buildOptions.buildArgs = buildArgs;
    }

    await new Promise<void>(resolve => {
      extensionApi.containerEngine
        .buildImage(
          contextDir,
          (eventName, data) => {
            if (eventName === 'stream') {
              logs.push(data);
            } else if (eventName === 'error') {
              logs.push(`ERROR: ${data}`);
            } else if (eventName === 'finish') {
              resolve();
            }
          },
          buildOptions,
        )
        .catch((e: unknown) => {
          logs.push(`Build failed: ${e instanceof Error ? e.message : String(e)}`);
          resolve();
        });

      setTimeout(() => resolve(), 300000);
    });

    return text(logs.join('\n') || `Image ${tag} built successfully`);
  },

  image_tag: async args => {
    await extensionApi.containerEngine.tagImage(
      str(args, 'engineId'),
      str(args, 'id'),
      str(args, 'repo'),
      optStr(args, 'tag'),
    );
    return text(`Image tagged as ${str(args, 'repo')}:${optStr(args, 'tag') ?? 'latest'}`);
  },

  image_delete: async args => {
    await extensionApi.containerEngine.deleteImage(str(args, 'engineId'), str(args, 'id'));
    return text(`Image ${str(args, 'id')} deleted`);
  },

  image_save: async args => {
    await extensionApi.containerEngine.saveImage(str(args, 'engineId'), str(args, 'id'), str(args, 'filename'));
    return text(`Image saved to ${str(args, 'filename')}`);
  },
};

// ============================================================================
// POD HANDLERS
// ============================================================================
const podHandlers: Record<string, ToolHandler> = {
  pod_list: async () => {
    const pods = await extensionApi.containerEngine.listPods();
    return json(
      pods.map(p => ({
        id: p.Id,
        name: p.Name,
        status: p.Status,
        engineId: p.engineId,
        containers: p.Containers?.length ?? 0,
        created: p.Created,
      })),
    );
  },

  pod_inspect: async args => {
    const info = await extensionApi.containerEngine.inspectPod(str(args, 'engineId'), str(args, 'id'));
    return json(info);
  },

  pod_create: async args => {
    const portMappings: extensionApi.PodCreatePortOptions[] = [];
    const portsStr = optStr(args, 'portmappings');
    if (portsStr) {
      for (const mapping of portsStr.split(',')) {
        const [hostPort, containerPort] = mapping.trim().split(':');
        if (hostPort && containerPort) {
          portMappings.push({
            host_port: parseInt(hostPort, 10),
            container_port: parseInt(containerPort, 10),
            protocol: 'tcp',
          });
        }
      }
    }

    const labels = parseKeyValue(optStr(args, 'labels'));
    const networks = optStr(args, 'networks')
      ?.split(',')
      .map(n => n.trim());

    const options: extensionApi.PodCreateOptions = {
      name: str(args, 'name'),
      portmappings: portMappings.length > 0 ? portMappings : undefined,
      labels: Object.keys(labels).length > 0 ? labels : undefined,
      networks,
    };

    const result = await extensionApi.containerEngine.createPod(options);
    return text(`Pod created with ID: ${result.Id}`);
  },

  pod_start: async args => {
    await extensionApi.containerEngine.startPod(str(args, 'engineId'), str(args, 'id'));
    return text(`Pod ${str(args, 'id')} started`);
  },

  pod_stop: async args => {
    await extensionApi.containerEngine.stopPod(str(args, 'engineId'), str(args, 'id'));
    return text(`Pod ${str(args, 'id')} stopped`);
  },

  pod_restart: async args => {
    const engineId = str(args, 'engineId');
    const id = str(args, 'id');
    await extensionApi.containerEngine.stopPod(engineId, id);
    await extensionApi.containerEngine.startPod(engineId, id);
    return text(`Pod ${id} restarted`);
  },

  pod_delete: async args => {
    await extensionApi.containerEngine.removePod(str(args, 'engineId'), str(args, 'id'));
    return text(`Pod ${str(args, 'id')} deleted`);
  },
};

// ============================================================================
// VOLUME/NETWORK/SYSTEM HANDLERS
// ============================================================================
const infraHandlers: Record<string, ToolHandler> = {
  volume_list: async () => {
    const volumeList = await extensionApi.containerEngine.listVolumes();
    const volumes = volumeList.flatMap(vl => vl.Volumes);
    return json(
      volumes.map(v => ({
        name: v.Name,
        driver: v.Driver,
        mountpoint: v.Mountpoint,
        engineId: v.engineId,
      })),
    );
  },

  volume_create: async args => {
    await extensionApi.containerEngine.createVolume({ Name: str(args, 'name') });
    return text(`Volume ${str(args, 'name')} created`);
  },

  volume_delete: async args => {
    await extensionApi.containerEngine.deleteVolume(str(args, 'name'));
    return text(`Volume ${str(args, 'name')} deleted`);
  },

  network_list: async () => {
    const networks = await extensionApi.containerEngine.listNetworks();
    return json(
      networks.map(n => ({
        id: n.Id,
        name: n.Name,
        driver: n.Driver,
        scope: n.Scope,
        ipam: n.IPAM,
      })),
    );
  },

  network_create: async args => {
    const name = str(args, 'name');
    const cliArgs = ['network', 'create'];

    if (optStr(args, 'driver')) {
      cliArgs.push('--driver', optStr(args, 'driver')!);
    }
    if (bool(args, 'internal')) {
      cliArgs.push('--internal');
    }
    if (optStr(args, 'subnet')) {
      cliArgs.push('--subnet', optStr(args, 'subnet')!);
    }
    if (optStr(args, 'gateway')) {
      cliArgs.push('--gateway', optStr(args, 'gateway')!);
    }
    cliArgs.push(name);

    try {
      const result = await extensionApi.process.exec('podman', cliArgs);
      return text(`Network created: ${result.stdout.trim()}`);
    } catch {
      try {
        const result = await extensionApi.process.exec('docker', cliArgs);
        return text(`Network created: ${result.stdout.trim()}`);
      } catch (e: unknown) {
        return error(`Failed to create network: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  },

  system_info: async () => {
    const infos = await extensionApi.containerEngine.listInfos();
    return json(infos);
  },

  system_prune: async args => {
    const all = bool(args, 'all');
    const containers = bool(args, 'containers') || all;
    const images = bool(args, 'images') || all;
    const volumes = bool(args, 'volumes') || all;
    const results: string[] = [];

    const prune = async (resource: string): Promise<string> => {
      try {
        const result = await extensionApi.process.exec('podman', [resource, 'prune', '-f']);
        return result.stdout.trim();
      } catch {
        try {
          const result = await extensionApi.process.exec('docker', [resource, 'prune', '-f']);
          return result.stdout.trim();
        } catch {
          return 'prune failed';
        }
      }
    };

    if (containers) results.push(`Containers: ${await prune('container')}`);
    if (images) results.push(`Images: ${await prune('image')}`);
    if (volumes) results.push(`Volumes: ${await prune('volume')}`);

    return text(results.join('\n') || 'Nothing to prune');
  },
};

// ============================================================================
// KUBERNETES/CLI HANDLERS
// ============================================================================
const kubeAndCliHandlers: Record<string, ToolHandler> = {
  kube_get_config: async () => {
    const kubeconfig = extensionApi.kubernetes.getKubeconfig();
    return json({ path: kubeconfig.fsPath });
  },

  kube_create_resources: async args => {
    const context = str(args, 'context');
    const yamlContent = str(args, 'yaml');
    const manifests = YAML.parseAllDocuments(yamlContent).map(doc => doc.toJSON());
    await extensionApi.kubernetes.createResources(context, manifests);
    return text(`Created ${manifests.length} resource(s) in context ${context}`);
  },

  exec: async args => {
    const command = str(args, 'command');
    const argsStr = optStr(args, 'args');
    const cwd = optStr(args, 'cwd');
    const envStr = optStr(args, 'env');

    const cmdArgs = argsStr ? argsStr.split(' ') : [];
    const env = parseKeyValue(envStr);

    const options: extensionApi.RunOptions = {};
    if (cwd) options.workingDirectory = cwd;
    if (Object.keys(env).length > 0) options.env = env;

    const result = await extensionApi.process.exec(command, cmdArgs, options);
    return text(`stdout:\n${result.stdout}\n\nstderr:\n${result.stderr}`);
  },

  podman: async args => {
    const argsStr = str(args, 'args');
    const cmdArgs = argsStr.split(' ').filter(a => a.length > 0);
    const result = await extensionApi.process.exec('podman', cmdArgs);
    return text(result.stdout + (result.stderr ? `\nstderr: ${result.stderr}` : ''));
  },

  docker: async args => {
    const argsStr = str(args, 'args');
    const cmdArgs = argsStr.split(' ').filter(a => a.length > 0);
    const result = await extensionApi.process.exec('docker', cmdArgs);
    return text(result.stdout + (result.stderr ? `\nstderr: ${result.stderr}` : ''));
  },

  kubectl: async args => {
    const argsStr = str(args, 'args');
    const cmdArgs = argsStr.split(' ').filter(a => a.length > 0);
    const result = await extensionApi.process.exec('kubectl', cmdArgs);
    return text(result.stdout + (result.stderr ? `\nstderr: ${result.stderr}` : ''));
  },
};

// Combine all handlers into a single dispatch table
const handlers: Record<string, ToolHandler> = {
  ...containerHandlers,
  ...imageHandlers,
  ...podHandlers,
  ...infraHandlers,
  ...kubeAndCliHandlers,
};

/**
 * Handle a tool call and return the result
 */
export async function handleToolCall(name: string, args: ToolArgs): Promise<CallToolResult> {
  const handler = handlers[name];
  if (!handler) {
    return error(`Unknown tool: ${name}`);
  }

  try {
    return await handler(args);
  } catch (e: unknown) {
    return error(e instanceof Error ? e.message : String(e));
  }
}
