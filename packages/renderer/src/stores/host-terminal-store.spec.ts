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

import { get } from 'svelte/store';
import { beforeEach, expect, test, vi } from 'vitest';

import {
  activeHostTerminalTabId,
  addTerminalTab,
  agentWorkingDirectory,
  clearAllTerminalTabs,
  hostTerminalTabs,
  moveTerminalTab,
  recentTerminalFolders,
  removeTerminalTab,
  TerminalTabPlacement,
  updateTerminalTabName,
} from './host-terminal-store';

beforeEach(() => {
  hostTerminalTabs.set([]);
  activeHostTerminalTabId.set(undefined);
  agentWorkingDirectory.set(undefined);
  recentTerminalFolders.set([]);
});

test('addTerminalTab adds a tab and sets it active', () => {
  addTerminalTab(1);

  const tabs = get(hostTerminalTabs);
  expect(tabs).toHaveLength(1);
  expect(tabs[0]!.id).toBe(1);
  expect(tabs[0]!.name).toMatch(/^Terminal \d+$/);
  expect(get(activeHostTerminalTabId)).toBe(1);
});

test('addTerminalTab adds multiple tabs', () => {
  addTerminalTab(1);
  addTerminalTab(2);

  const tabs = get(hostTerminalTabs);
  expect(tabs).toHaveLength(2);
  expect(get(activeHostTerminalTabId)).toBe(2);
});

test('remembers recent folders in last-used order without duplicates', () => {
  agentWorkingDirectory.set('/projects/one');
  agentWorkingDirectory.set('/projects/two');
  agentWorkingDirectory.set('/projects/one');

  expect(get(recentTerminalFolders)).toEqual(['/projects/one', '/projects/two']);
  expect(JSON.parse(localStorage.getItem('host-terminal-recent-folders')!)).toEqual(['/projects/one', '/projects/two']);
});

test('remembers a terminal folder without a change to the default folder', () => {
  agentWorkingDirectory.set('/projects/default');
  addTerminalTab(1, { cwd: '/projects/other' });

  expect(get(agentWorkingDirectory)).toBe('/projects/default');
  expect(get(recentTerminalFolders)).toEqual(['/projects/other', '/projects/default']);
});

test('uses the default folder when a caller omits the folder', () => {
  agentWorkingDirectory.set('/projects/default');
  addTerminalTab(1);

  expect(get(hostTerminalTabs)[0]?.cwd).toBe('/projects/default');
});

test('allows an explicit home folder even when a default folder exists', () => {
  agentWorkingDirectory.set('/projects/default');
  addTerminalTab(1, { cwd: undefined });

  expect(get(hostTerminalTabs)[0]?.cwd).toBeUndefined();
});

test('keeps recent folders after the default resets to the home folder', () => {
  agentWorkingDirectory.set('/projects/one');
  agentWorkingDirectory.set(undefined);

  expect(get(recentTerminalFolders)).toEqual(['/projects/one']);
  expect(localStorage.getItem('host-terminal-working-directory')).toBeNull();
});

test('limits the recent folder list to the last eight folders', () => {
  for (let index = 0; index < 10; index++) {
    agentWorkingDirectory.set(`/projects/${index}`);
  }

  expect(get(recentTerminalFolders)).toEqual([
    '/projects/9',
    '/projects/8',
    '/projects/7',
    '/projects/6',
    '/projects/5',
    '/projects/4',
    '/projects/3',
    '/projects/2',
  ]);
});

test.each([
  ['invalid JSON', []],
  ['{}', []],
  ['["/projects/one", 12, "", "/projects/one", "/projects/two"]', ['/projects/one', '/projects/two']],
] as const)('restores usable folder history from %s', async (saved, expected) => {
  localStorage.setItem('host-terminal-recent-folders', saved);
  vi.resetModules();
  const { recentTerminalFolders: restored } = await import('./host-terminal-store');

  expect(get(restored)).toEqual(expected);
});

test('removeTerminalTab removes tab and switches to next', () => {
  addTerminalTab(1);
  addTerminalTab(2);
  addTerminalTab(3);

  removeTerminalTab(2);

  const tabs = get(hostTerminalTabs);
  expect(tabs).toHaveLength(2);
  expect(tabs.map(t => t.id)).toEqual([1, 3]);
  expect(get(activeHostTerminalTabId)).toBe(3);
});

test('removeTerminalTab switches to previous when last tab is removed', () => {
  addTerminalTab(1);
  addTerminalTab(2);

  removeTerminalTab(2);

  expect(get(activeHostTerminalTabId)).toBe(1);
});

test('removeTerminalTab sets undefined when all tabs removed', () => {
  addTerminalTab(1);
  removeTerminalTab(1);

  expect(get(hostTerminalTabs)).toHaveLength(0);
  expect(get(activeHostTerminalTabId)).toBeUndefined();
});

test('clearAllTerminalTabs removes all tabs and resets counter', () => {
  addTerminalTab(1);
  addTerminalTab(2);
  clearAllTerminalTabs();

  expect(get(hostTerminalTabs)).toHaveLength(0);
  expect(get(activeHostTerminalTabId)).toBeUndefined();

  addTerminalTab(3);
  const tabs = get(hostTerminalTabs);
  expect(tabs[0]!.name).toBe('Terminal 1');
});

test('updateTerminalTabName updates the name of a tab', () => {
  addTerminalTab(1);
  updateTerminalTabName(1, 'fish');

  const tabs = get(hostTerminalTabs);
  expect(tabs[0]!.name).toBe('fish');
});

test('removeTerminalTab resets counter when last tab removed', () => {
  addTerminalTab(1);
  removeTerminalTab(1);

  addTerminalTab(2);
  const tabs = get(hostTerminalTabs);
  expect(tabs[0]!.name).toBe('Terminal 1');
});

test.each([
  [1, 3, TerminalTabPlacement.After, [2, 3, 1]],
  [3, 1, TerminalTabPlacement.Before, [3, 1, 2]],
  [1, 3, TerminalTabPlacement.Before, [2, 1, 3]],
  [3, 1, TerminalTabPlacement.After, [1, 3, 2]],
  [1, 1, TerminalTabPlacement.After, [1, 2, 3]],
  [4, 1, TerminalTabPlacement.Before, [1, 2, 3]],
  [1, 4, TerminalTabPlacement.After, [1, 2, 3]],
] as const)('moveTerminalTab moves %s %s %s', (id, targetId, placement, expected) => {
  addTerminalTab(1);
  addTerminalTab(2, { name: 'Agent', agentCommand: '/bin/agent', agentArgs: ['--help'], cwd: '/tmp' });
  addTerminalTab(3);
  const original = get(hostTerminalTabs);

  moveTerminalTab(id, targetId, placement);

  const reordered = get(hostTerminalTabs);
  expect(reordered.map(tab => tab.id)).toEqual(expected);
  expect(get(activeHostTerminalTabId)).toBe(3);
  for (const tab of reordered) {
    expect(tab).toBe(original.find(entry => entry.id === tab.id));
  }
});

test('close the active tab after a move selects its new neighbor', () => {
  addTerminalTab(1);
  addTerminalTab(2);
  addTerminalTab(3);

  moveTerminalTab(3, 1, TerminalTabPlacement.Before);
  removeTerminalTab(3);

  expect(get(activeHostTerminalTabId)).toBe(1);
});
