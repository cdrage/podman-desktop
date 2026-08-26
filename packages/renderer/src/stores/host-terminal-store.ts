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
  agentCommand?: string;
  agentArgs?: string[];
  cwd?: string;
}

export const hostTerminalTabs = writable<HostTerminalTab[]>([]);
export const activeHostTerminalTabId = writable<number | undefined>();
export const hostTerminalPanelVisible = writable<boolean>(false);

const HEIGHT_KEY = 'host-terminal-panel-height';
const storedHeight = sessionStorage.getItem(HEIGHT_KEY);
export const hostTerminalPanelHeight = writable<number>(storedHeight ? parseInt(storedHeight, 10) : 300);
hostTerminalPanelHeight.subscribe(h => sessionStorage.setItem(HEIGHT_KEY, String(h)));

const CWD_KEY = 'host-terminal-working-directory';
const storedCwd = localStorage.getItem(CWD_KEY);
export const agentWorkingDirectory = writable<string | undefined>(storedCwd ?? undefined);
agentWorkingDirectory.subscribe(d => {
  if (d) {
    localStorage.setItem(CWD_KEY, d);
  } else {
    localStorage.removeItem(CWD_KEY);
  }
});

const FOLLOW_UI_KEY = 'host-terminal-follow-ui';
export const agentFollowUI = writable<boolean>(localStorage.getItem(FOLLOW_UI_KEY) === 'true');
agentFollowUI.subscribe(v => localStorage.setItem(FOLLOW_UI_KEY, String(v)));

const INCLUDE_CONTEXT_KEY = 'host-terminal-include-context';
export const agentIncludeContext = writable<boolean>(localStorage.getItem(INCLUDE_CONTEXT_KEY) === 'true');
agentIncludeContext.subscribe(v => localStorage.setItem(INCLUDE_CONTEXT_KEY, String(v)));

let tabCounter = 0;
let nextTabId = 1;

export function getNextTabId(): number {
  return nextTabId++;
}

export function addTerminalTab(
  id: number,
  options?: { name?: string; agentCommand?: string; agentArgs?: string[]; cwd?: string },
): void {
  tabCounter++;
  const tab: HostTerminalTab = {
    id,
    name: options?.name ?? `Terminal ${tabCounter}`,
    agentCommand: options?.agentCommand,
    agentArgs: options?.agentArgs,
    cwd: options?.cwd,
  };
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
