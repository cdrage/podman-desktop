/**********************************************************************
 * Copyright (C) 2023 Red Hat, Inc.
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

import type { ProviderKubernetesConnectionInfo } from '@podman-desktop/core-api';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';

import PreferencesKubernetesConnectionDetailsSummary from './PreferencesKubernetesConnectionDetailsSummary.svelte';

beforeEach(() => {
  vi.resetAllMocks();
});

const kubernetesConnection: ProviderKubernetesConnectionInfo = {
  connectionType: 'kubernetes',
  name: 'connection',
  endpoint: {
    apiURL: 'url',
  },
  status: 'started',
  canStart: false,
  canStop: false,
  canEdit: false,
  canDelete: false,
};

test('Expect that name, url and kubernetes are displayed', async () => {
  render(PreferencesKubernetesConnectionDetailsSummary, {
    kubernetesConnectionInfo: kubernetesConnection,
  });
  const nameField = screen.getByLabelText('Name');
  expect(nameField).toBeInTheDocument();
  expect(nameField).toHaveTextContent('connection');
  const endpointField = screen.getByLabelText('Endpoint');
  expect(endpointField).toBeInTheDocument();
  expect(endpointField).toHaveTextContent('url');
  const typeField = screen.getByLabelText('Type');
  expect(typeField).toBeInTheDocument();
  expect(typeField).toHaveTextContent('Kubernetes');
});

test('Expect error is displayed when connection has error', async () => {
  render(PreferencesKubernetesConnectionDetailsSummary, {
    kubernetesConnectionInfo: { ...kubernetesConnection, error: 'Failed to start cluster' },
  });
  const errorAlert = screen.getByRole('alert');
  expect(errorAlert).toBeInTheDocument();
  expect(errorAlert).toHaveTextContent('Failed to start cluster');
});

test('Expect error is not displayed when connection has no error', async () => {
  render(PreferencesKubernetesConnectionDetailsSummary, {
    kubernetesConnectionInfo: kubernetesConnection,
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
