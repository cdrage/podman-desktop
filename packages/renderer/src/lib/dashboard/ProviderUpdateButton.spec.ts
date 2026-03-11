/**********************************************************************
 * Copyright (C) 2024-2026 Red Hat, Inc.
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

import type { ProviderInfo } from '@podman-desktop/core-api';
import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeAll, expect, test, vi } from 'vitest';

import ProviderUpdateButton from './ProviderUpdateButton.svelte';

const runUpdatePreflightChecksMock = vi.fn();
const updateProviderMock = vi.fn();

beforeAll(() => {
  Object.defineProperty(window, 'runUpdatePreflightChecks', { value: runUpdatePreflightChecksMock });
  Object.defineProperty(window, 'updateProvider', { value: updateProviderMock });
});

function createProviderInfo(overrides?: Partial<ProviderInfo>): ProviderInfo {
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
    updateInfo: {
      version: '1.0.1',
    },
    extensionId: '',
    cleanupSupport: false,
    ...overrides,
  } as ProviderInfo;
}

test('should show enabled update button when update info is available', async () => {
  render(ProviderUpdateButton, {
    provider: createProviderInfo(),
    onPreflightChecks: vi.fn(),
  });

  await waitFor(() => {
    const button = screen.getByRole('button', { name: 'Update to 1.0.1' });
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });
});

test('should not show update button when no update info', async () => {
  render(ProviderUpdateButton, {
    provider: createProviderInfo({ updateInfo: undefined }),
    onPreflightChecks: vi.fn(),
  });

  await waitFor(() => {
    const button = screen.queryByRole('button', { name: /Update to/ });
    expect(button).not.toBeInTheDocument();
  });
});
