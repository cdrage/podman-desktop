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

import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  activeHostTerminalTabId,
  agentFollowUI,
  agentIncludeContext,
  agentWorkingDirectory,
  hostTerminalPanelVisible,
  hostTerminalTabs,
  recentTerminalFolders,
} from '/@/stores/host-terminal-store';

import { isMcpServerRunning } from './agent-context';
import HostTerminalInstance from './HostTerminalInstance.svelte';
import HostTerminalPanel from './HostTerminalPanel.svelte';
import { terminalFolderName } from './terminal-folder';

vi.mock(import('./HostTerminalInstance.svelte'));
vi.mock(import('./agent-context'));

beforeEach(() => {
  vi.resetAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  agentWorkingDirectory.set(undefined);
  recentTerminalFolders.set([]);
  agentFollowUI.set(false);
  agentIncludeContext.set(false);
  hostTerminalPanelVisible.set(true);
  hostTerminalTabs.set([{ id: 100, name: 'Existing shell', cwd: '/projects/original' }]);
  activeHostTerminalTabId.set(100);
  vi.mocked(window.openDialog).mockResolvedValue(undefined);
  vi.mocked(window.hostTerminalDetectAgents).mockResolvedValue([]);
  vi.mocked(isMcpServerRunning).mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('opens below the caret and limits its height to the available space', async () => {
  render(HostTerminalPanel);
  const caret = screen.getByRole('button', { name: 'New terminal options' });
  const bounds = new DOMRect(20, window.innerHeight - 100, 20, 28);
  vi.spyOn(caret, 'getBoundingClientRect').mockReturnValue(bounds);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);

  await fireEvent.click(caret);

  const menu = screen.getByRole('dialog', { name: 'New terminal options' });
  const top = Number.parseFloat(menu.style.top);
  expect(top).toBeGreaterThan(bounds.bottom);
  expect(Number.parseFloat(menu.style.maxHeight)).toBeLessThanOrEqual(window.innerHeight - top);
});

test('shows only the current folder and its chooser in the caret menu', async () => {
  agentWorkingDirectory.set('/Users/cdrage/Downloads/foobar');
  render(HostTerminalPanel);

  const folder = screen.getByRole('button', { name: 'New terminal options' });
  expect(screen.queryByRole('button', { name: 'Terminal folder' })).not.toBeInTheDocument();
  expect(screen.queryByText('Folder:')).not.toBeInTheDocument();
  expect(folder).toHaveAttribute('title', 'Default folder: /Users/cdrage/Downloads/foobar');
  await fireEvent.click(folder);
  const menu = screen.getByRole('dialog', { name: 'New terminal options' });
  expect(menu).toHaveTextContent('/Users/cdrage/Downloads/foobar');
  expect(within(menu).getAllByRole('button')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Choose folder…' })).toHaveFocus();
});

test('chooses a default folder without a change to existing terminal sessions', async () => {
  render(HostTerminalPanel);
  const original = get(hostTerminalTabs)[0];
  vi.mocked(window.openDialog).mockResolvedValue(['/projects/new']);
  await fireEvent.click(screen.getByRole('button', { name: 'New terminal options' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Choose folder…' }));
  await vi.waitFor(() => expect(get(agentWorkingDirectory)).toBe('/projects/new'));

  expect(get(hostTerminalTabs)).toEqual([original]);
  expect(get(hostTerminalTabs)[0]).toBe(original);
  expect(HostTerminalInstance).toHaveBeenCalledOnce();
  expect(get(recentTerminalFolders)).toEqual(['/projects/new']);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await fireEvent.click(screen.getByRole('button', { name: 'New Terminal' }));
  expect(get(hostTerminalTabs).at(-1)?.cwd).toBe('/projects/new');
  expect(screen.getByRole('tab', { name: 'Existing shell' })).toHaveAttribute(
    'title',
    expect.stringContaining('Launch folder: /projects/original'),
  );
});

test('a canceled folder dialog preserves the default and the tabs', async () => {
  agentWorkingDirectory.set('/projects/default');
  render(HostTerminalPanel);
  await fireEvent.click(screen.getByRole('button', { name: 'New terminal options' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Choose folder…' }));

  expect(get(agentWorkingDirectory)).toBe('/projects/default');
  expect(get(hostTerminalTabs)).toHaveLength(1);
});

test('uses the home folder when no folder is selected', async () => {
  render(HostTerminalPanel);
  await fireEvent.click(screen.getByRole('button', { name: 'New terminal options' }));
  expect(screen.getByRole('dialog', { name: 'New terminal options' })).toHaveTextContent('Folder: Home');

  await fireEvent.click(screen.getByRole('button', { name: 'New Terminal' }));
  const tab = get(hostTerminalTabs).at(-1)!;
  expect(tab.cwd).toBeUndefined();
  expect(screen.getByRole('tab', { name: tab.name })).toHaveAttribute(
    'title',
    expect.stringContaining('Launch folder: Home folder'),
  );
});

test('launches an agent in the selected default folder', async () => {
  agentWorkingDirectory.set('/projects/default');
  vi.mocked(window.hostTerminalDetectAgents).mockResolvedValue([
    { binary: 'codex', label: 'Codex', path: '/bin/codex' },
  ]);
  render(HostTerminalPanel);
  await fireEvent.click(screen.getByRole('button', { name: 'Launch AI Agent' }));
  await fireEvent.click(await screen.findByRole('button', { name: 'Codex' }));
  expect(get(hostTerminalTabs).at(-1)).toMatchObject({
    name: 'Codex',
    agentCommand: '/bin/codex',
    cwd: '/projects/default',
  });
});

test('dismisses folder controls with Escape or an outside click', async () => {
  render(HostTerminalPanel);
  const folder = screen.getByRole('button', { name: 'New terminal options' });
  await fireEvent.click(folder);
  await fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(folder).toHaveFocus();

  await fireEvent.click(folder);
  await fireEvent.click(screen.getByRole('tab', { name: 'Existing shell' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  await fireEvent.click(folder);
  await fireEvent.click(screen.getByRole('button', { name: 'New terminal options' }));
  expect(screen.queryByRole('dialog', { name: 'New terminal options' })).not.toBeInTheDocument();
});

test.each([
  [undefined, 'Home'],
  ['/projects/foobar/', 'foobar'],
  ['/', '/'],
  ['C:\\projects\\foobar\\', 'foobar'],
  ['C:\\', 'C:'],
])('names the folder %s as %s', (path, expected) => {
  expect(terminalFolderName(path)).toBe(expected);
});
