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

import type { ProviderContainerConnectionInfo, ProviderInfo } from '@desktop-framework/api';
import type { ProviderStatus } from '@desktop-framework/extension-api';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { router } from 'tinro';
import { beforeEach, expect, test, vi } from 'vitest';

import { providerInfos } from '/@/stores/providers';

import ImportContainersImages from './ImportContainersImages.svelte';

const pStatus: ProviderStatus = 'started';
const pInfo: ProviderContainerConnectionInfo = {
  connectionType: 'container',
  name: 'test',
  displayName: 'test',
  status: 'started',
  endpoint: {
    socketPath: '',
  },
  canStart: false,
  canStop: false,
  canEdit: false,
  canDelete: false,
  type: 'podman',
};
const providerInfo = {
  id: 'test',
  internalId: 'id',
  name: '',
  containerConnections: [pInfo],
  kubernetesConnections: undefined,
  status: pStatus,
  containerProviderConnectionCreation: false,
  containerProviderConnectionInitialization: false,
  kubernetesProviderConnectionCreation: false,
  kubernetesProviderConnectionInitialization: false,
  links: undefined,
  detectionChecks: undefined,
  warnings: undefined,
  images: undefined,
  installationSupport: undefined,
} as unknown as ProviderInfo;

const closeCallback = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  providerInfos.set([]);
});

test('Expect import button to be disabled', async () => {
  render(ImportContainersImages, { closeCallback });
  const btnImportContainer = screen.getByRole('button', { name: 'Import containers' });
  expect(btnImportContainer).toBeInTheDocument();
  expect(btnImportContainer).toBeDisabled();
});

test('Expect import button to be enabled when atleast one container image is selected', async () => {
  providerInfos.set([providerInfo]);
  vi.mocked(window.openDialog).mockResolvedValue(['path/file.tar']);
  render(ImportContainersImages, { closeCallback });
  const btnAddImages = screen.getByRole('button', { name: 'Add images to import' });
  expect(btnAddImages).toBeInTheDocument();
  await userEvent.click(btnAddImages);

  const btnImportContainer = screen.getByRole('button', { name: 'Import containers' });
  expect(btnImportContainer).toBeInTheDocument();
  expect(btnImportContainer).toBeEnabled();

  expect(vi.mocked(window.openDialog)).toBeCalledWith({
    selectors: ['multiSelections', 'openFile'],
    title: 'Select Containers Images to import',
  });
});

test('Expect import button to be enabled when atleast one container image is selected but there is no provider', async () => {
  providerInfos.set([]);
  vi.mocked(window.openDialog).mockResolvedValue(['path/file.tar']);
  render(ImportContainersImages, { closeCallback });
  const btnAddImages = screen.getByRole('button', { name: 'Add images to import' });
  expect(btnAddImages).toBeInTheDocument();
  await userEvent.click(btnAddImages);

  const btnImportContainer = screen.getByRole('button', { name: 'Import containers' });
  expect(btnImportContainer).toBeInTheDocument();
  expect(btnImportContainer).toBeDisabled();
});

test('Expect import call importContainer func', async () => {
  providerInfos.set([providerInfo]);
  vi.mocked(window.openDialog).mockResolvedValue(['path/file.tar']);
  vi.mocked(window.importContainer).mockResolvedValue();
  const goToMock = vi.spyOn(router, 'goto').mockImplementation(() => {});
  render(ImportContainersImages, { closeCallback });
  const btnAddImages = screen.getByRole('button', { name: 'Add images to import' });
  expect(btnAddImages).toBeInTheDocument();
  await userEvent.click(btnAddImages);

  const btnImportContainer = screen.getByRole('button', { name: 'Import containers' });
  expect(btnImportContainer).toBeInTheDocument();
  expect(btnImportContainer).toBeEnabled();
  await userEvent.click(btnImportContainer);

  expect(vi.mocked(window.importContainer)).toBeCalledWith({
    provider: pInfo,
    archivePath: 'path/file.tar',
    imageTag: 'file',
  });
  expect(closeCallback).toHaveBeenCalledOnce();
  expect(goToMock).not.toHaveBeenCalled();
});

test('Import uses the selected running engine', async () => {
  const secondConnection: ProviderContainerConnectionInfo = { ...pInfo, name: 'second', type: 'docker' };
  const stoppedConnection = { ...pInfo, name: 'stopped', status: 'stopped' as const };
  providerInfos.set([{ ...providerInfo, containerConnections: [pInfo, secondConnection, stoppedConnection] }]);
  vi.mocked(window.openDialog).mockResolvedValue(['path/file.tar']);
  vi.mocked(window.importContainer).mockResolvedValue();
  render(ImportContainersImages, { closeCallback });

  await userEvent.click(screen.getByRole('button', { name: 'Container engine' }));
  expect(screen.queryByRole('button', { name: 'stopped' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'second' }));
  await userEvent.click(screen.getByRole('button', { name: 'Add images to import' }));
  await userEvent.click(screen.getByRole('button', { name: 'Import containers' }));

  expect(window.importContainer).toHaveBeenCalledWith({
    provider: secondConnection,
    archivePath: 'path/file.tar',
    imageTag: 'file',
  });
});

test('Expect error shown if import function fails', async () => {
  providerInfos.set([providerInfo]);
  vi.mocked(window.openDialog).mockResolvedValue(['path/file.tar']);
  vi.mocked(window.importContainer).mockRejectedValue('import failed');
  render(ImportContainersImages, { closeCallback });
  const btnAddImages = screen.getByRole('button', { name: 'Add images to import' });
  expect(btnAddImages).toBeInTheDocument();
  await userEvent.click(btnAddImages);

  const btnImportContainer = screen.getByRole('button', { name: 'Import containers' });
  expect(btnImportContainer).toBeInTheDocument();
  expect(btnImportContainer).toBeEnabled();
  await userEvent.click(btnImportContainer);

  expect(vi.mocked(window.importContainer)).toBeCalledWith({
    provider: pInfo,
    archivePath: 'path/file.tar',
    imageTag: 'file',
  });

  const errorDiv = screen.getByLabelText('Error Message Content');
  expect(errorDiv).toBeInTheDocument();
  expect((errorDiv as HTMLDivElement).innerHTML).toContain('import failed');
  expect(closeCallback).not.toHaveBeenCalled();
  screen.getByRole('dialog', { name: 'Import containers' });
});

test.each(['Cancel', 'Close', 'Escape', 'Backdrop'])('Dismiss with %s', async action => {
  render(ImportContainersImages, { closeCallback });
  screen.getByRole('dialog', { name: 'Import containers' });

  if (action === 'Escape') {
    await userEvent.keyboard('{Escape}');
  } else if (action === 'Backdrop') {
    await userEvent.click(screen.getByLabelText('fade-bg'));
  } else {
    await userEvent.click(screen.getByRole('button', { name: action }));
  }

  expect(closeCallback).toHaveBeenCalledOnce();
  expect(window.importContainer).not.toHaveBeenCalled();
});

test('Keep the modal and files unchanged until import completes', async () => {
  providerInfos.set([providerInfo]);
  vi.mocked(window.openDialog).mockResolvedValue(['path/file.tar']);
  let finishImport!: () => void;
  vi.mocked(window.importContainer).mockReturnValue(
    new Promise(resolve => {
      finishImport = resolve;
    }),
  );
  render(ImportContainersImages, { closeCallback });

  await userEvent.click(screen.getByRole('button', { name: 'Add images to import' }));
  const importButton = screen.getByRole('button', { name: 'Import containers' });
  await userEvent.click(importButton);

  expect(importButton).toBeDisabled();
  expect(importButton).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add images to import' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove container' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'container importing name' })).toBeDisabled();

  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(closeCallback).not.toHaveBeenCalled();

  finishImport();
  await vi.waitFor(() => expect(closeCallback).toHaveBeenCalledOnce());
});

test('Import multiple files with edited names and remove unwanted files', async () => {
  providerInfos.set([providerInfo]);
  vi.mocked(window.openDialog).mockResolvedValue(['path/one.tar', 'path/two.tar', 'path/three.tar']);
  vi.mocked(window.importContainer).mockResolvedValue();
  render(ImportContainersImages, { closeCallback });

  await userEvent.click(screen.getByRole('button', { name: 'Add images to import' }));
  const names = screen.getAllByRole('textbox', { name: 'container importing name' });
  await userEvent.clear(names[0]);
  await userEvent.type(names[0], 'quay.io/test/one');
  await userEvent.click(screen.getAllByRole('button', { name: 'Remove container' })[2]);
  await userEvent.click(screen.getByRole('button', { name: 'Import containers' }));

  expect(window.importContainer).toHaveBeenCalledTimes(2);
  expect(window.importContainer).toHaveBeenNthCalledWith(1, {
    provider: pInfo,
    archivePath: 'path/one.tar',
    imageTag: 'quay.io/test/one',
  });
  expect(window.importContainer).toHaveBeenNthCalledWith(2, {
    provider: pInfo,
    archivePath: 'path/two.tar',
    imageTag: 'two',
  });
  expect(closeCallback).toHaveBeenCalledOnce();
});
