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

import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';

import type { ProviderInfo } from '/@api/provider-info';

import ProviderUpdateButton from './ProviderUpdateButton.svelte';

const getConfigurationValueMock = vi.fn();
const runUpdatePreflightChecksMock = vi.fn();
const updateProviderMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  (window as unknown as Record<string, unknown>).getConfigurationValue = getConfigurationValueMock;
  (window as unknown as Record<string, unknown>).runUpdatePreflightChecks = runUpdatePreflightChecksMock;
  (window as unknown as Record<string, unknown>).updateProvider = updateProviderMock;
  getConfigurationValueMock.mockResolvedValue(true);
});

function createProvider(updateVersion?: string): ProviderInfo {
  return {
    containerConnections: [],
    containerProviderConnectionCreation: false,
    containerProviderConnectionInitialization: false,
    detectionChecks: [],
    id: 'myproviderid',
    images: {},
    installationSupport: false,
    internalId: 'myproviderid',
    kubernetesConnections: [],
    kubernetesProviderConnectionCreation: false,
    kubernetesProviderConnectionInitialization: false,
    vmConnections: [],
    vmProviderConnectionCreation: false,
    vmProviderConnectionInitialization: false,
    links: [],
    name: 'MyProvider',
    status: 'ready',
    warnings: [],
    version: '1.0.0',
    updateInfo: updateVersion ? { version: updateVersion } : undefined,
    extensionId: '',
    cleanupSupport: false,
  } as unknown as ProviderInfo;
}

test('expect update button to be visible when allowUpdates is true', async () => {
  getConfigurationValueMock.mockResolvedValue(true);
  const provider = createProvider('1.0.1');

  render(ProviderUpdateButton, { provider, onPreflightChecks: vi.fn() });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Update to 1.0.1' })).toBeInTheDocument();
  });
});

test('expect update button to be hidden when allowUpdates is false', async () => {
  getConfigurationValueMock.mockResolvedValue(false);
  const provider = createProvider('1.0.1');

  render(ProviderUpdateButton, { provider, onPreflightChecks: vi.fn() });

  await waitFor(() => {
    expect(getConfigurationValueMock).toHaveBeenCalledWith('preferences.update.allowUpdates');
  });
  expect(screen.queryByRole('button', { name: 'Update to 1.0.1' })).not.toBeInTheDocument();
});

test('expect no update button when no update info available', async () => {
  getConfigurationValueMock.mockResolvedValue(true);
  const provider = createProvider();

  render(ProviderUpdateButton, { provider, onPreflightChecks: vi.fn() });

  expect(screen.queryByRole('button', { name: /Update to/ })).not.toBeInTheDocument();
});
