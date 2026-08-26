/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import type { ContainerInfo } from '@podman-desktop/api';
import { get } from 'svelte/store';

import { currentPage } from '/@/stores/breadcrumb';

const STATIC_PREAMBLE = `You are being launched from the built-in terminal in Podman Desktop, an open-source desktop application for managing containers, images, pods, volumes, and Kubernetes clusters.

You have direct access to the host system. The \`podman\` CLI is fully compatible with Docker — you can run any podman command directly (ps, logs, exec, build, run, etc.). Podman also provides a Docker-compatible socket, so \`docker\` CLI commands work as well.

\`podman compose\` is available for multi-container applications — it uses the \`docker-compose\` binary underneath, automatically passing the Podman socket. \`docker compose\` also works.

Podman Desktop has a plugin-based extension system. Extensions provide container engines (Podman, Docker, CRC), Kubernetes providers (Kind, Minikube), and additional functionality. Installed extensions are listed below.

An MCP server extension may be available at http://localhost:6110/mcp for structured programmatic access to Podman Desktop resources via the Model Context Protocol.

Below is a snapshot of the current Podman Desktop state:
`;

function getPageContext(path: string, containers: ContainerInfo[]): string[] {
  const lines: string[] = [];

  const containerMatch = /^\/containers\/([^/]+)/.exec(path);
  if (containerMatch) {
    const containerId = containerMatch[1];
    const container = containers.find(c => c.Id === containerId || c.Id.startsWith(containerId!));
    if (container) {
      const name = container.Names?.[0] ?? 'unknown';
      lines.push(`Viewing container: ${name} (${container.State})`);
      lines.push(`  Image: ${container.Image}`);
      if (container.Status) {
        lines.push(`  Status: ${container.Status}`);
      }
      const tab = path.split('/').pop();
      if (tab === 'logs') {
        lines.push('  Tab: Logs — user is looking at this container\'s log output');
      } else if (tab === 'terminal') {
        lines.push('  Tab: Terminal — user has a shell into this container');
      } else if (tab === 'inspect') {
        lines.push('  Tab: Inspect — user is viewing container configuration');
      }
    }
    return lines;
  }

  const podMatch = /^\/pods\/podman\/([^/]+)/.exec(path);
  if (podMatch) {
    const podName = decodeURIComponent(podMatch[1]!);
    lines.push(`Viewing pod: ${podName}`);
    const tab = path.split('/').pop();
    if (tab === 'logs') {
      lines.push('  Tab: Logs');
    } else if (tab === 'k8s-terminal') {
      lines.push('  Tab: Terminal');
    }
    return lines;
  }

  if (path.startsWith('/images/') && path.split('/').length > 3) {
    lines.push('Viewing image details');
    return lines;
  }

  return lines;
}

export async function gatherAgentContext(cwd?: string): Promise<string> {
  const lines: string[] = [STATIC_PREAMBLE];

  const page = get(currentPage);
  if (page?.name) {
    lines.push(`Current page: ${page.name}`);
  }

  const [providers, containers, pods, images, volumes, k8sContexts, extensions] = await Promise.all([
    window.getProviderInfos(),
    window.listContainers(),
    window.listPods(),
    window.listImages(),
    window.listVolumes(),
    window.kubernetesGetDetailedContexts(),
    window.listExtensions(),
  ]);

  for (const provider of providers) {
    const engines = provider.containerConnections
      .map(c => `${c.type} ${c.name} (${c.status})`)
      .join(', ');
    if (engines) {
      lines.push(`Engines: ${engines}`);
    }
  }

  if (page?.path) {
    const pageLines = getPageContext(page.path, containers);
    if (pageLines.length > 0) {
      lines.push(...pageLines);
    }
  }

  if (containers.length > 0) {
    const running = containers.filter(c => c.State === 'running').length;
    const stopped = containers.length - running;
    lines.push(`Containers: ${running} running, ${stopped} stopped (${containers.length} total)`);

    const failing = containers.filter(c => c.State === 'exited' || c.State === 'dead' || c.State === 'restarting');
    if (failing.length > 0) {
      for (const c of failing.slice(0, 5)) {
        const name = c.Names?.[0] ?? c.Id.substring(0, 12);
        const status = c.Status ? ` (${c.Status})` : '';
        lines.push(`  warning: ${name}: ${c.State}${status}`);
      }
      if (failing.length > 5) {
        lines.push(`  ... and ${failing.length - 5} more`);
      }
    }
  } else {
    lines.push('Containers: none');
  }

  if (pods.length > 0) {
    const running = pods.filter(p => p.Status === 'Running').length;
    lines.push(`Pods: ${running} running (${pods.length} total)`);

    const failing = pods.filter(p => p.Status !== 'Running' && p.Status !== 'Created');
    if (failing.length > 0) {
      for (const p of failing.slice(0, 5)) {
        lines.push(`  warning: ${p.Name}: ${p.Status}`);
      }
    }
  }

  if (images.length > 0) {
    lines.push(`Images: ${images.length} total`);
  }

  if (volumes.length > 0) {
    const totalVolumes = volumes.reduce((sum, vli) => sum + vli.Volumes.length, 0);
    lines.push(`Volumes: ${totalVolumes} total`);
  }

  const activeCtx = k8sContexts.find(c => c.currentContext);
  if (activeCtx) {
    lines.push(`Kubernetes: context "${activeCtx.name}" on cluster "${activeCtx.cluster}"`);
  }

  const activeExtensions = extensions.filter(e => e.state === 'started');
  if (activeExtensions.length > 0) {
    const names = activeExtensions.map(e => e.displayName || e.name).join(', ');
    lines.push(`Extensions (${activeExtensions.length} active): ${names}`);
  }

  if (cwd) {
    lines.push(`Working directory: ${cwd}`);
  }

  lines.push('');
  return lines.join('\n') + '\n';
}

export function buildContextArgs(binary: string, context: string): string[] {
  switch (binary) {
    case 'claude':
    case 'pi':
      return ['--append-system-prompt', context];
    case 'codex':
      return ['-c', `developer_instructions=${context}`];
    default:
      return [];
  }
}
