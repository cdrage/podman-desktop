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
import { beforeEach, expect, test } from 'vitest';

import {
  activeHostTerminalTabId,
  addTerminalTab,
  clearAllTerminalTabs,
  hostTerminalTabs,
  removeTerminalTab,
  updateTerminalTabName,
} from './host-terminal-store';

beforeEach(() => {
  hostTerminalTabs.set([]);
  activeHostTerminalTabId.set(undefined);
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
