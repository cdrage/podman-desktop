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

import '@testing-library/jest-dom/vitest';

import type {
  ProviderContainerConnectionInfo,
  ProviderInfo,
  RunImageFromProtocolConfig,
} from '@podman-desktop/core-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { launchContainerWizardConfig } from '/@/stores/launch-container-wizard-store';
import { providerInfos } from '/@/stores/providers';

import LaunchContainerWizard from './LaunchContainerWizard.svelte';

vi.mock(import('tinro'));
vi.mock(import('/@/lib/ui/TerminalWindow.svelte'));

const pInfo: ProviderContainerConnectionInfo = {
  connectionType: 'container',
  name: 'Podman Machine',
  displayName: 'Podman Machine',
  status: 'started',
  endpoint: { socketPath: '/sock' },
  type: 'podman',
};

const providerInfo = {
  id: 'podman',
  internalId: 'podman-id',
  name: 'Podman',
  containerConnections: [pInfo],
  kubernetesConnections: [],
  status: 'started',
  containerProviderConnectionCreation: false,
  containerProviderConnectionInitialization: false,
  kubernetesProviderConnectionCreation: false,
  kubernetesProviderConnectionInitialization: false,
  links: [],
  detectionChecks: [],
  warnings: [],
  images: {},
  cleanupSupport: false,
} as unknown as ProviderInfo;

beforeEach(() => {
  vi.resetAllMocks();
  providerInfos.set([providerInfo]);
});

function setConfig(config: RunImageFromProtocolConfig): void {
  launchContainerWizardConfig.set(config);
}

describe('review step', () => {
  test('should display image name from config', () => {
    setConfig({ image: 'docker.io/nginx:latest' });
    render(LaunchContainerWizard);

    expect(screen.getByLabelText('Image name')).toHaveTextContent('docker.io/nginx:latest');
  });

  test('should show port mappings when provided', () => {
    setConfig({ image: 'nginx:latest', ports: ['8080:80', '3000:3000'] });
    render(LaunchContainerWizard);

    expect(screen.getByText('Port Mappings')).toBeInTheDocument();
    expect(screen.getByText('8080:80')).toBeInTheDocument();
    expect(screen.getByText('3000:3000')).toBeInTheDocument();
  });

  test('should show environment variables when provided', () => {
    setConfig({ image: 'nginx:latest', env: ['DEBUG=true', 'NODE_ENV=production'] });
    render(LaunchContainerWizard);

    expect(screen.getByText('Environment Variables')).toBeInTheDocument();
    expect(screen.getByText('DEBUG=true')).toBeInTheDocument();
    expect(screen.getByText('NODE_ENV=production')).toBeInTheDocument();
  });

  test('should show volume mounts when provided', () => {
    setConfig({ image: 'nginx:latest', volumes: ['/data:/app/data'] });
    render(LaunchContainerWizard);

    expect(screen.getByText('Volume Mounts')).toBeInTheDocument();
    expect(screen.getByText('/data:/app/data')).toBeInTheDocument();
  });

  test('should show container name when provided', () => {
    setConfig({ image: 'nginx:latest', name: 'my-nginx' });
    render(LaunchContainerWizard);

    expect(screen.getByText('Container Name')).toBeInTheDocument();
    expect(screen.getByText('my-nginx')).toBeInTheDocument();
  });

  test('should not show optional sections when not in config', () => {
    setConfig({ image: 'nginx:latest' });
    render(LaunchContainerWizard);

    expect(screen.queryByText('Port Mappings')).not.toBeInTheDocument();
    expect(screen.queryByText('Environment Variables')).not.toBeInTheDocument();
    expect(screen.queryByText('Volume Mounts')).not.toBeInTheDocument();
    expect(screen.queryByText('Container Name')).not.toBeInTheDocument();
  });

  test('should show launch button', () => {
    setConfig({ image: 'nginx:latest' });
    render(LaunchContainerWizard);

    expect(screen.getByRole('button', { name: 'Launch container' })).toBeInTheDocument();
  });

  test('should show cancel button', () => {
    setConfig({ image: 'nginx:latest' });
    render(LaunchContainerWizard);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});

describe('launch flow', () => {
  test('should skip pull when image exists locally', async () => {
    setConfig({ image: 'nginx:latest' });
    vi.mocked(window.listImages).mockResolvedValue([{ RepoTags: ['nginx:latest'], engineId: 'podman' }] as never);
    vi.mocked(window.createAndStartContainer).mockResolvedValue({ id: 'container-123' });

    render(LaunchContainerWizard);

    const launchBtn = screen.getByRole('button', { name: 'Launch container' });
    await fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(window.pullImage).not.toHaveBeenCalled();
      expect(window.createAndStartContainer).toHaveBeenCalled();
    });
  });

  test('should pull image when not found locally', async () => {
    setConfig({ image: 'nginx:latest' });
    vi.mocked(window.listImages)
      .mockResolvedValueOnce([]) // first check: not found
      .mockResolvedValueOnce([{ RepoTags: ['nginx:latest'], engineId: 'podman' }] as never); // after pull
    vi.mocked(window.pullImage).mockResolvedValue(undefined as never);
    vi.mocked(window.createAndStartContainer).mockResolvedValue({ id: 'container-123' });

    render(LaunchContainerWizard);

    const launchBtn = screen.getByRole('button', { name: 'Launch container' });
    await fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(window.pullImage).toHaveBeenCalled();
    });
  });

  test('should build correct ContainerCreateOptions with ports', async () => {
    setConfig({ image: 'nginx:latest', ports: ['8080:80'] });
    vi.mocked(window.listImages).mockResolvedValue([{ RepoTags: ['nginx:latest'], engineId: 'podman' }] as never);
    vi.mocked(window.createAndStartContainer).mockResolvedValue({ id: 'container-123' });

    render(LaunchContainerWizard);

    const launchBtn = screen.getByRole('button', { name: 'Launch container' });
    await fireEvent.click(launchBtn);

    await waitFor(() => {
      const options = vi.mocked(window.createAndStartContainer).mock.calls[0]?.[1];
      expect(options?.Image).toBe('nginx:latest');
      expect(options?.ExposedPorts).toEqual({ '80/tcp': {} });
      expect(options?.HostConfig?.PortBindings).toEqual({ '80/tcp': [{ HostPort: '8080' }] });
    });
  });

  test('should build correct ContainerCreateOptions with env and name', async () => {
    setConfig({ image: 'nginx:latest', env: ['DEBUG=true'], name: 'my-nginx' });
    vi.mocked(window.listImages).mockResolvedValue([{ RepoTags: ['nginx:latest'], engineId: 'podman' }] as never);
    vi.mocked(window.createAndStartContainer).mockResolvedValue({ id: 'container-123' });

    render(LaunchContainerWizard);

    const launchBtn = screen.getByRole('button', { name: 'Launch container' });
    await fireEvent.click(launchBtn);

    await waitFor(() => {
      const options = vi.mocked(window.createAndStartContainer).mock.calls[0]?.[1];
      expect(options?.Env).toEqual(['DEBUG=true']);
      expect(options?.name).toBe('my-nginx');
    });
  });

  test('should clear store after successful launch', async () => {
    setConfig({ image: 'nginx:latest' });
    vi.mocked(window.listImages).mockResolvedValue([{ RepoTags: ['nginx:latest'], engineId: 'podman' }] as never);
    vi.mocked(window.createAndStartContainer).mockResolvedValue({ id: 'container-123' });

    render(LaunchContainerWizard);

    const launchBtn = screen.getByRole('button', { name: 'Launch container' });
    await fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(get(launchContainerWizardConfig)).toBeUndefined();
    });
  });
});

describe('error handling', () => {
  test('should show error when pull fails', async () => {
    setConfig({ image: 'nginx:latest' });
    vi.mocked(window.listImages).mockResolvedValue([]);
    vi.mocked(window.pullImage).mockRejectedValue(new Error('Pull failed: network error'));

    render(LaunchContainerWizard);

    const launchBtn = screen.getByRole('button', { name: 'Launch container' });
    await fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(screen.getByText('Launch failed')).toBeInTheDocument();
    });
  });

  test('should show try again button on error', async () => {
    setConfig({ image: 'nginx:latest' });
    vi.mocked(window.listImages).mockResolvedValue([]);
    vi.mocked(window.pullImage).mockRejectedValue(new Error('Pull failed'));

    render(LaunchContainerWizard);

    const launchBtn = screen.getByRole('button', { name: 'Launch container' });
    await fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
  });
});

describe('cancel behavior', () => {
  test('should clear store on cancel', async () => {
    setConfig({ image: 'nginx:latest' });
    render(LaunchContainerWizard);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await fireEvent.click(cancelBtn);

    expect(get(launchContainerWizardConfig)).toBeUndefined();
  });
});
