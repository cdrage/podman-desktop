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

import type { ProviderContainerConnectionInfo, ProviderInfo } from '@desktop-framework/api';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

import { providerInfos } from '/@/stores/providers';

import ImportContainersImages from './ImportContainersImages.svelte';

const connection: ProviderContainerConnectionInfo = {
  connectionType: 'container',
  name: 'test',
  displayName: 'test',
  status: 'started',
  endpoint: { socketPath: '' },
  canStart: false,
  canStop: false,
  canEdit: false,
  canDelete: false,
  type: 'podman',
};
const provider = {
  id: 'test',
  internalId: 'id',
  name: 'test',
  containerConnections: [connection],
  status: 'started',
} as ProviderInfo;
const closeCallback = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  providerInfos.set([provider]);
  vi.mocked(window.openDialog).mockResolvedValue(['path/file.tar']);
  vi.mocked(window.importContainer).mockResolvedValue();
});

async function selectImages(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Add images to import' }));
}

async function importImages(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Import containers' }));
}

test('renders a modal with Cancel and Import actions', () => {
  render(ImportContainersImages, { closeCallback });

  const dialog = screen.getByRole('dialog', { name: 'Import containers' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveStyle({ maxWidth: '768px' });
  within(dialog).getByRole('button', { name: 'Cancel' });
  expect(within(dialog).getByRole('button', { name: 'Import containers' })).toBeDisabled();
});

test.each(['Cancel', 'Close'])('%s closes the modal', async name => {
  render(ImportContainersImages, { closeCallback });

  await userEvent.click(screen.getByRole('button', { name }));

  expect(closeCallback).toHaveBeenCalledOnce();
  expect(window.importContainer).not.toHaveBeenCalled();
});

test('Escape closes the modal', async () => {
  render(ImportContainersImages, { closeCallback });

  await userEvent.keyboard('{Escape}');

  expect(closeCallback).toHaveBeenCalledOnce();
});

test('selects archives and enables Import', async () => {
  render(ImportContainersImages, { closeCallback });

  await selectImages();

  expect(screen.getByRole('button', { name: 'Import containers' })).toBeEnabled();
  expect(window.openDialog).toHaveBeenCalledWith({
    selectors: ['multiSelections', 'openFile'],
    title: 'Select Containers Images to import',
  });
  const table = screen.getByRole('table', { name: 'Containers to import' });
  within(table).getByRole('columnheader', { name: 'Archive' });
  within(table).getByRole('columnheader', { name: 'Image name' });
  within(table).getByRole('cell', { name: 'file.tar' });
  expect(within(table).getByRole('textbox', { name: 'container importing name' })).toHaveValue('file');

  await userEvent.hover(within(table).getByTestId('tooltip-trigger'));

  expect(await screen.findByRole('tooltip')).toHaveTextContent('path/file.tar');
});

test('exposes the full archive path to keyboard users', async () => {
  render(ImportContainersImages, { closeCallback });
  await selectImages();

  await userEvent.tab();

  expect(screen.getByText('file.tar')).toHaveFocus();
  expect(await screen.findByRole('tooltip')).toHaveTextContent('path/file.tar');
});

test.each([
  { providers: [] },
  { providers: [{ ...provider, containerConnections: [{ ...connection, status: 'stopped' }] }] },
])('disables Import without a started connection: $providers', async ({ providers }) => {
  providerInfos.set(providers as ProviderInfo[]);
  render(ImportContainersImages, { closeCallback });

  await selectImages();

  expect(screen.getByRole('button', { name: 'Import containers' })).toBeDisabled();
  expect(window.importContainer).not.toHaveBeenCalled();
});

test('cancels the archive picker without adding images', async () => {
  vi.mocked(window.openDialog).mockResolvedValue(undefined);
  render(ImportContainersImages, { closeCallback });

  await selectImages();

  expect(screen.queryByRole('table', { name: 'Containers to import' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import containers' })).toBeDisabled();
  expect(closeCallback).not.toHaveBeenCalled();
});

test('removes selected archives and disables Import when the list is empty', async () => {
  render(ImportContainersImages, { closeCallback });
  await selectImages();

  await userEvent.click(screen.getByRole('button', { name: 'Remove container' }));

  expect(screen.queryByRole('table', { name: 'Containers to import' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import containers' })).toBeDisabled();
});

test('keeps archive paths and edited names paired after removing a table row', async () => {
  vi.mocked(window.openDialog).mockResolvedValue(['/first/file.tar', 'C:\\second\\file.tar']);
  render(ImportContainersImages, { closeCallback });
  await selectImages();

  const table = screen.getByRole('table', { name: 'Containers to import' });
  expect(within(table).getAllByRole('row')).toHaveLength(3);
  await userEvent.click(within(table).getAllByRole('button', { name: 'Remove container' })[0]);
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  const name = within(table).getByRole('textbox', { name: 'container importing name' });
  await userEvent.clear(name);
  await userEvent.type(name, 'quay.io/example/remaining');

  await importImages();

  expect(window.importContainer).toHaveBeenCalledExactlyOnceWith({
    provider: connection,
    archivePath: 'C:/second/file.tar',
    imageTag: 'quay.io/example/remaining',
  });
  expect(closeCallback).toHaveBeenCalledOnce();
});

test('imports with the edited image name and closes after success', async () => {
  render(ImportContainersImages, { closeCallback });
  await selectImages();
  const name = screen.getByRole('textbox', { name: 'container importing name' });
  await userEvent.clear(name);
  await userEvent.type(name, 'quay.io/example/image:latest');

  await importImages();

  expect(window.importContainer).toHaveBeenCalledExactlyOnceWith({
    provider: connection,
    archivePath: 'path/file.tar',
    imageTag: 'quay.io/example/image:latest',
  });
  expect(closeCallback).toHaveBeenCalledOnce();
});

test.each([
  ['C:\\exports\\file.tar', 'C:/exports/file.tar', 'file'],
  ['/exports/file', '/exports/file', 'file'],
  ['/exports.v1/file', '/exports.v1/file', 'file'],
])('imports archive %s with its default name', async (selectedPath, archivePath, imageTag) => {
  vi.mocked(window.openDialog).mockResolvedValue([selectedPath]);
  render(ImportContainersImages, { closeCallback });
  await selectImages();

  await importImages();

  expect(window.importContainer).toHaveBeenCalledWith({ provider: connection, archivePath, imageTag });
  expect(closeCallback).toHaveBeenCalledOnce();
});

test('imports into the selected engine', async () => {
  const otherConnection = { ...connection, name: 'other', displayName: 'other' };
  providerInfos.set([{ ...provider, containerConnections: [connection, otherConnection] }]);
  render(ImportContainersImages, { closeCallback });
  await selectImages();
  await userEvent.click(screen.getByRole('button', { name: 'Container engine' }));
  await userEvent.click(screen.getByText('other'));

  await importImages();

  expect(window.importContainer).toHaveBeenCalledWith({
    provider: otherConnection,
    archivePath: 'path/file.tar',
    imageTag: 'file',
  });
});

test('keeps the modal open and displays each import error', async () => {
  vi.mocked(window.openDialog).mockResolvedValue(['path/first.tar', 'path/second.tar']);
  vi.mocked(window.importContainer)
    .mockRejectedValueOnce(new Error('invalid archive'))
    .mockRejectedValueOnce(new Error('permission denied'));
  render(ImportContainersImages, { closeCallback });
  await selectImages();

  await importImages();

  expect(window.importContainer).toHaveBeenCalledTimes(2);
  const error = screen.getByRole('alert');
  expect(error).toHaveTextContent('Error while importing path/first.tar: Error: invalid archive');
  expect(error).toHaveTextContent('Error while importing path/second.tar: Error: permission denied');
  expect(closeCallback).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Import containers' })).toBeEnabled();
  screen.getByRole('dialog', { name: 'Import containers' });
});

test('continues after a failed import and clears errors on retry', async () => {
  vi.mocked(window.openDialog).mockResolvedValue(['path/first.tar', 'path/second.tar']);
  vi.mocked(window.importContainer).mockRejectedValueOnce(new Error('import failed'));
  render(ImportContainersImages, { closeCallback });
  await selectImages();

  await importImages();

  expect(window.importContainer).toHaveBeenNthCalledWith(2, {
    provider: connection,
    archivePath: 'path/second.tar',
    imageTag: 'second',
  });
  screen.getByRole('alert');
  expect(closeCallback).not.toHaveBeenCalled();

  await importImages();

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(closeCallback).toHaveBeenCalledOnce();
});

test('displays archive picker errors inside the modal', async () => {
  vi.mocked(window.openDialog).mockRejectedValue(new Error('Cannot open file picker'));
  render(ImportContainersImages, { closeCallback });

  await selectImages();

  expect(screen.getByRole('alert')).toHaveTextContent('Cannot open file picker');
  expect(closeCallback).not.toHaveBeenCalled();
});

test('locks import controls and prevents dismissal until all imports finish', async () => {
  const pending = Promise.withResolvers<void>();
  vi.mocked(window.importContainer).mockReturnValue(pending.promise);
  render(ImportContainersImages, { closeCallback });
  await selectImages();

  await importImages();

  const button = screen.getByRole('button', { name: 'Import containers' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button', { name: 'Add images to import' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove container' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'container importing name' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  await userEvent.keyboard('{Escape}');
  await fireEvent.mouseDown(screen.getByLabelText('fade-bg'));
  expect(closeCallback).not.toHaveBeenCalled();
  expect(window.importContainer).toHaveBeenCalledOnce();

  pending.resolve();
  await waitFor(() => expect(closeCallback).toHaveBeenCalledOnce());
});
