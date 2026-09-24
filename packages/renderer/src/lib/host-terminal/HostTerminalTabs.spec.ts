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

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  activeHostTerminalTabId,
  addTerminalTab,
  hostTerminalPanelVisible,
  hostTerminalTabs,
} from '/@/stores/host-terminal-store';

import HostTerminalInstance from './HostTerminalInstance.svelte';
import HostTerminalPanel from './HostTerminalPanel.svelte';
import HostTerminalTabs from './HostTerminalTabs.svelte';

vi.mock(import('./HostTerminalInstance.svelte'));
vi.mock(import('./agent-context'));

let resizeCallback: ResizeObserverCallback;
let frames: FrameRequestCallback[];

beforeEach(() => {
  vi.resetAllMocks();
  frames = [];
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(function (callback: ResizeObserverCallback) {
      resizeCallback = callback;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }),
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollBy = vi.fn();
  hostTerminalTabs.set([
    { id: 1, name: 'Shell' },
    { id: 2, name: 'Agent', agentCommand: '/bin/agent' },
    { id: 3, name: 'Logs' },
  ]);
  activeHostTerminalTabId.set(2);
  hostTerminalPanelVisible.set(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderTabs(): ReturnType<typeof render> {
  return render(HostTerminalTabs, { onCreate: vi.fn(), onClose: vi.fn() });
}

function setTabBounds(): void {
  for (const [index, tab] of screen.getAllByRole('tab').entries()) {
    vi.spyOn(tab.parentElement!, 'getBoundingClientRect').mockReturnValue(new DOMRect(index * 100, 0, 100, 28));
  }
}

async function startDrag(name: string): Promise<void> {
  await fireEvent.dragStart(screen.getByRole('tab', { name }), {
    dataTransfer: { setData: vi.fn(), effectAllowed: 'none' },
  });
}

async function dragEvent(type: string, clientX: number): Promise<void> {
  await fireEvent(screen.getByRole('tablist'), new MouseEvent(type, { bubbles: true, cancelable: true, clientX }));
}

async function setOverflow(): Promise<HTMLElement> {
  const viewport = screen.getByRole('tablist');
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, value: 200 },
    scrollWidth: { configurable: true, value: 600 },
  });
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 28));
  resizeCallback([], {} as ResizeObserver);
  await tick();
  return viewport;
}

test('places the new terminal button after the tab strip', async () => {
  const onCreate = vi.fn();
  render(HostTerminalTabs, { onCreate, onClose: vi.fn() });
  const tablist = screen.getByRole('tablist');
  const create = screen.getByRole('button', { name: 'New Terminal' });

  expect(tablist.contains(create)).toBe(false);
  expect(tablist.nextElementSibling?.contains(create)).toBe(true);
  expect(screen.queryByRole('button', { name: 'Scroll terminals left' })).not.toBeInTheDocument();
  await fireEvent.click(create);
  expect(onCreate).toHaveBeenCalledOnce();
});

test('selects and closes tabs without a close action that selects the tab', async () => {
  const onClose = vi.fn();
  render(HostTerminalTabs, { onCreate: vi.fn(), onClose });
  await fireEvent.click(screen.getByRole('button', { name: 'Close Shell' }));
  expect(onClose).toHaveBeenCalledWith(1, expect.any(MouseEvent));
  expect(get(activeHostTerminalTabId)).toBe(2);

  await fireEvent.click(screen.getByRole('tab', { name: 'Logs' }));
  expect(get(activeHostTerminalTabId)).toBe(3);
  expect(screen.getByRole('tab', { name: 'Logs' })).toHaveAttribute('aria-selected', 'true');
});

test.each([
  ['Shell', 290, ['Agent', 'Logs', 'Shell']],
  ['Logs', 10, ['Logs', 'Shell', 'Agent']],
  ['Shell', 210, ['Agent', 'Shell', 'Logs']],
  ['Logs', 90, ['Shell', 'Logs', 'Agent']],
] as const)('drags %s to position %s', async (name, clientX, expected) => {
  renderTabs();
  setTabBounds();
  const originalTab = screen.getByRole('tab', { name });
  await startDrag(name);
  await dragEvent('dragover', clientX);
  await dragEvent('drop', clientX);

  expect(screen.getAllByRole('tab').map(tab => tab.textContent?.trim())).toEqual(expected);
  expect(screen.getByRole('tab', { name })).toBe(originalTab);
  expect(get(activeHostTerminalTabId)).toBe(2);
});

test('cancels a drag without a change to the tab order', async () => {
  renderTabs();
  setTabBounds();
  await startDrag('Shell');
  await dragEvent('dragover', 290);
  await fireEvent.dragEnd(screen.getByRole('tab', { name: 'Shell' }));
  await dragEvent('drop', 290);

  expect(get(hostTerminalTabs).map(tab => tab.id)).toEqual([1, 2, 3]);
  expect(cancelAnimationFrame).toHaveBeenCalled();
});

test('ignores external drops', async () => {
  renderTabs();
  setTabBounds();
  await dragEvent('drop', 290);
  expect(get(hostTerminalTabs).map(tab => tab.id)).toEqual([1, 2, 3]);
});

test('moves a focused tab with Alt and arrow keys', async () => {
  renderTabs();
  const agent = screen.getByRole('tab', { name: 'Agent' });
  agent.focus();
  await fireEvent.keyDown(agent, { key: 'ArrowLeft', altKey: true });
  expect(get(hostTerminalTabs).map(tab => tab.id)).toEqual([2, 1, 3]);
  expect(agent).toHaveFocus();

  await fireEvent.keyDown(agent, { key: 'ArrowLeft', altKey: true });
  expect(get(hostTerminalTabs).map(tab => tab.id)).toEqual([2, 1, 3]);
  await fireEvent.keyDown(agent, { key: 'ArrowRight', altKey: true });
  expect(get(hostTerminalTabs).map(tab => tab.id)).toEqual([1, 2, 3]);
  expect(get(activeHostTerminalTabId)).toBe(2);
});

test('selects tabs with arrow, Home, and End keys', async () => {
  renderTabs();
  await fireEvent.keyDown(screen.getByRole('tab', { name: 'Agent' }), { key: 'ArrowLeft' });
  expect(get(activeHostTerminalTabId)).toBe(1);
  expect(screen.getByRole('tab', { name: 'Shell' })).toHaveFocus();

  await fireEvent.keyDown(screen.getByRole('tab', { name: 'Shell' }), { key: 'End' });
  expect(get(activeHostTerminalTabId)).toBe(3);
  await fireEvent.keyDown(screen.getByRole('tab', { name: 'Logs' }), { key: 'Home' });
  expect(get(activeHostTerminalTabId)).toBe(1);
});

test('reveals a new or selected tab', async () => {
  renderTabs();
  const reveal = vi.mocked(Element.prototype.scrollIntoView);
  reveal.mockClear();
  addTerminalTab(4, { name: 'New shell' });
  await tick();
  expect(reveal).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  expect(reveal.mock.contexts.at(-1)).toBe(screen.getByRole('tab', { name: 'New shell' }).parentElement);

  await fireEvent.click(screen.getByRole('tab', { name: 'Shell' }));
  expect(reveal.mock.contexts.at(-1)).toBe(screen.getByRole('tab', { name: 'Shell' }).parentElement);
});

test('shows scroll controls for overflow and disables them at either end', async () => {
  renderTabs();
  const viewport = await setOverflow();
  expect(screen.getByRole('button', { name: 'Scroll terminals left' })).toBeDisabled();
  const right = screen.getByRole('button', { name: 'Scroll terminals right' });
  expect(right).toBeEnabled();
  await fireEvent.click(right);
  expect(viewport.scrollBy).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });

  viewport.scrollLeft = 400;
  await fireEvent.scroll(viewport);
  expect(right).toBeDisabled();
  const left = screen.getByRole('button', { name: 'Scroll terminals left' });
  expect(left).toBeEnabled();
  await fireEvent.click(left);
  expect(viewport.scrollBy).toHaveBeenCalledWith({ left: -200, behavior: 'smooth' });

  viewport.scrollLeft = 0;
  Object.defineProperty(viewport, 'clientWidth', { value: 600 });
  resizeCallback([], {} as ResizeObserver);
  await tick();
  expect(screen.queryByRole('button', { name: 'Scroll terminals right' })).not.toBeInTheDocument();
});

test('keeps the active tab visible after the viewport shrinks', async () => {
  renderTabs();
  const reveal = vi.mocked(Element.prototype.scrollIntoView);
  reveal.mockClear();

  await setOverflow();

  expect(reveal).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  expect(reveal.mock.contexts.at(-1)).toBe(screen.getByRole('tab', { name: 'Agent' }).parentElement);
});

test('scrolls at the edge during a drag and stops after the pointer leaves', async () => {
  renderTabs();
  setTabBounds();
  const viewport = await setOverflow();
  await startDrag('Shell');
  await dragEvent('dragover', 195);
  for (const frame of frames.splice(0)) {
    frame(0);
  }
  expect(viewport.scrollLeft).toBeGreaterThan(0);

  await fireEvent.dragLeave(viewport);
  expect(cancelAnimationFrame).toHaveBeenCalled();
});

test('reorders the panel without a restart of terminal instances', async () => {
  render(HostTerminalPanel);
  const panels = screen.getAllByRole('tabpanel', { hidden: true });
  const instances = vi.mocked(HostTerminalInstance).mock.calls.length;
  expect(instances).toBe(3);
  setTabBounds();
  await startDrag('Logs');
  await dragEvent('drop', 10);

  expect(screen.getAllByRole('tabpanel', { hidden: true })).toEqual([panels[2], panels[0], panels[1]]);
  expect(HostTerminalInstance).toHaveBeenCalledTimes(instances);
});

test('creates a terminal from the panel and hides the panel after the last tab closes', async () => {
  hostTerminalTabs.set([{ id: 100, name: 'Shell' }]);
  activeHostTerminalTabId.set(100);
  render(HostTerminalPanel);
  await fireEvent.click(screen.getByRole('button', { name: 'New Terminal' }));
  expect(get(hostTerminalTabs)).toHaveLength(2);
  expect(screen.getAllByRole('tab')).toHaveLength(2);

  for (const tab of get(hostTerminalTabs)) {
    await fireEvent.click(screen.getByRole('button', { name: `Close ${tab.name}` }));
  }
  expect(get(hostTerminalPanelVisible)).toBe(false);
  expect(get(hostTerminalTabs)).toHaveLength(0);
});
