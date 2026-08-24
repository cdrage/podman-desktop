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

import { writable } from 'svelte/store';

export interface HostTerminalTab {
  id: number;
  name: string;
}

export const hostTerminalTabs = writable<HostTerminalTab[]>([]);
export const activeHostTerminalTabId = writable<number | undefined>();
export const hostTerminalPanelVisible = writable<boolean>(false);

const HEIGHT_KEY = 'host-terminal-panel-height';
const storedHeight = sessionStorage.getItem(HEIGHT_KEY);
export const hostTerminalPanelHeight = writable<number>(storedHeight ? parseInt(storedHeight, 10) : 300);
hostTerminalPanelHeight.subscribe(h => sessionStorage.setItem(HEIGHT_KEY, String(h)));

let tabCounter = 0;
let nextTabId = 1;

export function getNextTabId(): number {
  return nextTabId++;
}

export function addTerminalTab(id: number): void {
  tabCounter++;
  const tab: HostTerminalTab = { id, name: `Terminal ${tabCounter}` };
  hostTerminalTabs.update(tabs => [...tabs, tab]);
  activeHostTerminalTabId.set(id);
}

export function removeTerminalTab(id: number): void {
  hostTerminalTabs.update(tabs => {
    const idx = tabs.findIndex(t => t.id === id);
    const filtered = tabs.filter(t => t.id !== id);
    if (filtered.length > 0) {
      const nextIdx = Math.min(idx, filtered.length - 1);
      activeHostTerminalTabId.set(filtered[nextIdx]!.id);
    } else {
      tabCounter = 0;
      activeHostTerminalTabId.set(undefined);
    }
    return filtered;
  });
}

export function clearAllTerminalTabs(): void {
  hostTerminalTabs.set([]);
  activeHostTerminalTabId.set(undefined);
  tabCounter = 0;
}

export function updateTerminalTabName(id: number, name: string): void {
  hostTerminalTabs.update(tabs => tabs.map(t => (t.id === id ? { ...t, name } : t)));
}
