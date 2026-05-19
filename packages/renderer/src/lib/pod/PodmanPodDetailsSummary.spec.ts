/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import { render, screen } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';

import type { PodInfoUI } from './PodInfoUI';
import PodmanPodDetailsSummary from './PodmanPodDetailsSummary.svelte';

vi.mock(import('humanize-duration'), () => ({
  default: vi.fn((): string => '3 hours'),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

const fakePod: PodInfoUI = {
  id: 'fakePodId',
  shortId: 'FPI',
  name: 'pod1',
  engineId: 'fakeEngineId',
  engineName: 'fakeEngineName',
  status: 'RUNNING',
  age: '3 days',
  created: '2021-01-01T00:00:00Z',
  selected: false,
  containers: [
    {
      Id: 'fakeCId1',
      Names: 'fakeContainer1',
      Status: 'running',
    },
    {
      Id: 'fakeCId2',
      Names: 'fakeContainer2',
      Status: 'running',
    },
  ],
};

// Test render PodmanPodDetailsSummary with the PodInfoUI object
test('PodmanPodDetailsSummary renders with PodInfoUI object', async () => {
  // Render
  render(PodmanPodDetailsSummary, { pod: fakePod });

  // Check that the rendered text is correct
  expect(screen.getByText('pod1')).toBeInTheDocument();
  expect(screen.getByText('fakePodId')).toBeInTheDocument();
  expect(screen.getByText('3 days')).toBeInTheDocument();
  expect(screen.getByText('fakeCId1')).toBeInTheDocument();
  expect(screen.getByText('fakeContainer1')).toBeInTheDocument();
  expect(screen.getByText('fakeCId2')).toBeInTheDocument();
  expect(screen.getByText('fakeContainer2')).toBeInTheDocument();
  // StatusBadge capitalizes the status text
  expect(screen.getAllByText('Running')[0]).toBeInTheDocument();
});

test('renders summary sections with correct roles', () => {
  render(PodmanPodDetailsSummary, { pod: fakePod });

  expect(screen.getByRole('region', { name: 'Details' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Pod Status' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Containers' })).toBeInTheDocument();
});

test('renders status badges for pod and container statuses', () => {
  render(PodmanPodDetailsSummary, { pod: fakePod });

  const statusBadges = screen.getAllByRole('status');
  // 1 for the pod status + 2 for the container statuses
  expect(statusBadges).toHaveLength(3);
});

test('renders loading state when pod is undefined', () => {
  render(PodmanPodDetailsSummary, { pod: undefined });

  expect(screen.getByText('Loading...')).toBeInTheDocument();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});

test('renders "Not set" when pod has no containers', () => {
  const emptyPod: PodInfoUI = {
    ...fakePod,
    containers: [],
  };

  render(PodmanPodDetailsSummary, { pod: emptyPod });

  expect(screen.getByText('Not set')).toBeInTheDocument();
});

test('renders formatted date for created field', () => {
  render(PodmanPodDetailsSummary, { pod: fakePod });

  // FormattedDate with relative prop renders a <time> element
  const timeElement = screen.getByRole('region', { name: 'Details' }).querySelector('time');
  expect(timeElement).toBeInTheDocument();
});
