/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
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
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import ContainerDetailsSummary from './ContainerDetailsSummary.svelte';
import { ContainerGroupInfoTypeUI, type ContainerInfoUI } from './ContainerInfoUI';

vi.mock(import('humanize-duration'), () => ({
  default: vi.fn((): string => '3 hours'),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(window.openExternal).mockResolvedValue(undefined);
});

const fakePodContainer: ContainerInfoUI = {
  id: 'fakeId1',
  shortId: 'FID1',
  name: 'fakePodContainer',
  image: 'image1',
  shortImage: 'img1',
  engineId: 'Podman.podman',
  engineName: 'Podman',
  engineType: 'podman',
  state: 'RUNNING',
  uptime: '3 days',
  startedAt: '2024-06-18T15:17:03.000Z',
  ports: [],
  portsAsString: '',
  displayPort: '',
  hasPublicPort: false,
  groupInfo: {
    name: 'group1',
    type: ContainerGroupInfoTypeUI.POD,
    id: 'pod1',
    engineId: 'Podman.podman',
    engineName: 'Podman',
    engineType: 'podman',
    status: 'RUNNING',
    created: '2024-06-18T17:39:46.000Z',
  },
  selected: false,
  created: 1234,
  labels: { label1: 'label1' },
  imageBase64RepoTag: 'fakeRepoTag',
};

const fakeStandaloneContainer: ContainerInfoUI = {
  id: 'fakeId2',
  shortId: 'FID2',
  name: 'fakeStandaloneContainer',
  image: 'image2',
  shortImage: 'img2',
  engineId: 'Podman.podman',
  engineName: 'Podman',
  engineType: 'podman',
  state: 'RUNNING',
  uptime: '3 days',
  startedAt: '2024-06-18T17:39:46.000Z',
  ports: [],
  portsAsString: '',
  displayPort: '',
  hasPublicPort: false,
  groupInfo: {
    name: 'group2',
    type: ContainerGroupInfoTypeUI.STANDALONE,
    id: 'fakeId2',
    engineId: 'Podman.podman',
    engineName: 'podman',
    engineType: 'podman',
  },
  selected: false,
  created: 1234,
  labels: {},
  imageBase64RepoTag: 'fakeRepoTag',
};

test('ContainerDetailsSummary renders with ContainerInfoUI object with a pod group', async () => {
  render(ContainerDetailsSummary, { container: fakePodContainer });

  expect(screen.getByText('fakePodContainer')).toBeInTheDocument();
  expect(screen.getByText('image1')).toBeInTheDocument();
  expect(screen.getByText('None')).toBeInTheDocument();
  expect(screen.getByText('pod')).toBeInTheDocument();
  expect(screen.getAllByText('Running')[0]).toBeInTheDocument();
  expect(screen.getByText('group1')).toBeInTheDocument();
  expect(screen.getByText('pod1')).toBeInTheDocument();
});

test('ContainerDetailsSummary renders with standalone ContainerInfoUI object', async () => {
  render(ContainerDetailsSummary, { container: fakeStandaloneContainer });

  expect(screen.getByText('fakeStandaloneContainer')).toBeInTheDocument();
  expect(screen.getByText('image2')).toBeInTheDocument();
  expect(screen.getByText('None')).toBeInTheDocument();
  expect(screen.getByText('standalone')).toBeInTheDocument();
  expect(screen.getByText('Running')).toBeInTheDocument();
  expect(screen.getByText('group2')).toBeInTheDocument();
});

test('clicking a port opens the browser via openExternal', async () => {
  const containerWithPorts: ContainerInfoUI = {
    ...fakeStandaloneContainer,
    ports: [{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }],
    portsAsString: '8080',
    hasPublicPort: true,
  };

  render(ContainerDetailsSummary, { container: containerWithPorts });

  const portLink = screen.getByText('8080');
  expect(portLink).toBeInTheDocument();

  await userEvent.click(portLink);

  expect(window.openExternal).toHaveBeenCalledWith('http://localhost:8080');
});

test('port link shows tooltip with full URL and external link icon', async () => {
  const containerWithPorts: ContainerInfoUI = {
    ...fakeStandaloneContainer,
    ports: [{ IP: '0.0.0.0', PrivatePort: 80, PublicPort: 3000, Type: 'tcp' }],
    portsAsString: '3000',
    hasPublicPort: true,
  };

  render(ContainerDetailsSummary, { container: containerWithPorts });

  const portLink = screen.getByText('3000');
  expect(portLink).toBeInTheDocument();

  const tooltipTrigger = portLink.closest('[data-testid="tooltip-trigger"]');
  expect(tooltipTrigger).toBeInTheDocument();
});

test('renders status badge for running state', () => {
  render(ContainerDetailsSummary, { container: fakePodContainer });
  const statusBadge = screen.getAllByRole('status');
  expect(statusBadge.length).toBeGreaterThan(0);
});

test('renders labels as pills', () => {
  render(ContainerDetailsSummary, { container: fakePodContainer });
  expect(screen.getByLabelText('label1=label1')).toBeInTheDocument();
});

test('does not render labels section when empty', () => {
  render(ContainerDetailsSummary, { container: fakeStandaloneContainer });
  expect(screen.queryByText('Labels')).not.toBeInTheDocument();
});

test('renders summary sections', () => {
  render(ContainerDetailsSummary, { container: fakePodContainer });
  expect(screen.getByRole('region', { name: 'Details' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Group' })).toBeInTheDocument();
});
