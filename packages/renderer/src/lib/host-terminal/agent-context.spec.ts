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

import type { ContainerInfo, ProviderInfo, VolumeListInfo } from '@podman-desktop/api';
import type { KubeContext } from '@podman-desktop/api/kubernetes-context';
import type { PodInfo } from '@podman-desktop/api/pod-info';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { gatherAgentContext } from './agent-context';

vi.mock(import('svelte/store'), async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    get: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(get).mockReturnValue({ name: 'Containers', path: '/containers' });

  vi.mocked(window.getProviderInfos).mockResolvedValue([]);
  vi.mocked(window.listContainers).mockResolvedValue([]);
  vi.mocked(window.listPods).mockResolvedValue([]);
  vi.mocked(window.listImages).mockResolvedValue([]);
  vi.mocked(window.listVolumes).mockResolvedValue([]);
  vi.mocked(window.kubernetesGetDetailedContexts).mockResolvedValue([]);
});

describe('gatherAgentContext', () => {
  test('includes static preamble', async () => {
    const result = await gatherAgentContext();

    expect(result).toContain('Podman Desktop');
    expect(result).toContain('podman');
    expect(result).toContain('MCP');
    expect(result).toContain('port 6110');
  });

  test('includes current page name', async () => {
    vi.mocked(get).mockReturnValue({ name: 'Images', path: '/images' });

    const result = await gatherAgentContext();
    expect(result).toContain('Current page: Images');
  });

  test('shows container summary', async () => {
    vi.mocked(window.listContainers).mockResolvedValue([
      { Id: 'abc123', Names: ['web'], State: 'running', Image: 'nginx' } as unknown as ContainerInfo,
      { Id: 'def456', Names: ['db'], State: 'running', Image: 'postgres' } as unknown as ContainerInfo,
      { Id: 'ghi789', Names: ['old'], State: 'exited', Image: 'alpine', Status: 'Exited (0) 2 hours ago' } as unknown as ContainerInfo,
    ]);

    const result = await gatherAgentContext();

    expect(result).toContain('2 running, 1 stopped (3 total)');
    expect(result).toContain('warning: old: exited (Exited (0) 2 hours ago)');
  });

  test('shows no containers message when empty', async () => {
    const result = await gatherAgentContext();
    expect(result).toContain('Containers: none');
  });

  test('shows pod summary', async () => {
    vi.mocked(window.listPods).mockResolvedValue([
      { Name: 'my-pod', Status: 'Running' } as unknown as PodInfo,
      { Name: 'broken-pod', Status: 'Degraded' } as unknown as PodInfo,
    ]);

    const result = await gatherAgentContext();

    expect(result).toContain('Pods: 1 running (2 total)');
    expect(result).toContain('warning: broken-pod: Degraded');
  });

  test('shows image count', async () => {
    vi.mocked(window.listImages).mockResolvedValue([
      { Id: 'img1' },
      { Id: 'img2' },
      { Id: 'img3' },
    ] as never[]);

    const result = await gatherAgentContext();
    expect(result).toContain('Images: 3 total');
  });

  test('shows volume count', async () => {
    vi.mocked(window.listVolumes).mockResolvedValue([
      { Volumes: [{ Name: 'v1' }, { Name: 'v2' }], Warnings: [] } as unknown as VolumeListInfo,
    ]);

    const result = await gatherAgentContext();
    expect(result).toContain('Volumes: 2 total');
  });

  test('shows active kubernetes context', async () => {
    vi.mocked(window.kubernetesGetDetailedContexts).mockResolvedValue([
      { name: 'minikube', cluster: 'minikube', user: 'minikube', currentContext: true } as KubeContext,
    ]);

    const result = await gatherAgentContext();
    expect(result).toContain('Kubernetes: context "minikube" on cluster "minikube"');
  });

  test('shows engine info from providers', async () => {
    vi.mocked(window.getProviderInfos).mockResolvedValue([
      {
        containerConnections: [{ type: 'podman', name: 'Podman Machine', status: 'started' }],
      } as unknown as ProviderInfo,
    ]);

    const result = await gatherAgentContext();
    expect(result).toContain('Engines: podman Podman Machine (started)');
  });

  test('includes container details when on container page', async () => {
    vi.mocked(get).mockReturnValue({ name: 'Container Details', path: '/containers/abc123/logs' });

    vi.mocked(window.listContainers).mockResolvedValue([
      { Id: 'abc123full', Names: ['web-server'], State: 'running', Image: 'nginx:latest', Status: 'Up 2 hours' } as unknown as ContainerInfo,
    ]);

    const result = await gatherAgentContext();

    expect(result).toContain('Viewing container: web-server (running)');
    expect(result).toContain('Image: nginx:latest');
    expect(result).toContain('Tab: Logs');
  });

  test('includes pod details when on pod page', async () => {
    vi.mocked(get).mockReturnValue({ name: 'Pod Details', path: '/pods/podman/my-pod/engine1/logs' });

    const result = await gatherAgentContext();
    expect(result).toContain('Viewing pod: my-pod');
    expect(result).toContain('Tab: Logs');
  });

  test('limits failing container warnings to 5', async () => {
    const containers = Array.from({ length: 8 }, (_, i) => ({
      Id: `id${i}`,
      Names: [`container-${i}`],
      State: 'exited',
      Image: 'alpine',
    })) as unknown as ContainerInfo[];

    vi.mocked(window.listContainers).mockResolvedValue(containers);

    const result = await gatherAgentContext();

    expect(result).toContain('warning: container-0');
    expect(result).toContain('warning: container-4');
    expect(result).not.toContain('warning: container-5');
    expect(result).toContain('... and 3 more');
  });

  test('fetches all data via IPC in parallel', async () => {
    await gatherAgentContext();

    expect(window.getProviderInfos).toHaveBeenCalledOnce();
    expect(window.listContainers).toHaveBeenCalledOnce();
    expect(window.listPods).toHaveBeenCalledOnce();
    expect(window.listImages).toHaveBeenCalledOnce();
    expect(window.listVolumes).toHaveBeenCalledOnce();
    expect(window.kubernetesGetDetailedContexts).toHaveBeenCalledOnce();
  });
});
