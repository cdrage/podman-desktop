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

import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { get } from 'svelte/store';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { hostTerminalTabs } from '/@/stores/host-terminal-store';

import HostTerminalInstance from './HostTerminalInstance.svelte';

vi.mock(import('@xterm/xterm'));
vi.mock(import('@xterm/addon-fit'));

let terminal: Terminal;
let resize: ResizeObserverCallback;

beforeEach(() => {
  vi.resetAllMocks();
  terminal = {
    open: vi.fn(),
    loadAddon: vi.fn(),
    attachCustomKeyEventHandler: vi.fn(),
    onData: vi.fn(),
    onResize: vi.fn(),
    onTitleChange: vi.fn(),
    write: vi.fn(),
    focus: vi.fn(),
    dispose: vi.fn(),
  } as unknown as Terminal;
  vi.mocked(Terminal).mockImplementation(function () {
    return terminal;
  });
  Object.defineProperties(terminal, { cols: { value: 80 }, rows: { value: 24 } });
  vi.mocked(window.hostTerminalCreate).mockResolvedValue(7);
  vi.mocked(window.hostTerminalWrite).mockResolvedValue(undefined);
  vi.mocked(window.hostTerminalResize).mockResolvedValue(undefined);
  vi.mocked(window.hostTerminalClose).mockResolvedValue(undefined);
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(function (callback: ResizeObserverCallback) {
      resize = callback;
      return { observe: vi.fn(), disconnect: vi.fn() };
    }),
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('opens xterm and connects its input and output to the host shell', async () => {
  render(HostTerminalInstance, { tabId: 1, active: true, cwd: '/projects/app' });
  await waitFor(() => expect(window.hostTerminalResize).toHaveBeenCalledWith(7, 80, 24));
  expect(terminal.open).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  const [onData, , options] = vi.mocked(window.hostTerminalCreate).mock.calls[0]!;
  expect(options).toEqual({ cwd: '/projects/app' });
  onData('shell output');
  expect(terminal.write).toHaveBeenCalledWith('shell output');
  vi.mocked(terminal.onData).mock.calls[0]![0]('input');
  expect(window.hostTerminalWrite).toHaveBeenCalledWith(7, 'input');
});

test('resizes xterm and forwards its dimensions to the host shell', async () => {
  render(HostTerminalInstance, { tabId: 1, active: true });
  await waitFor(() => expect(window.hostTerminalCreate).toHaveBeenCalled());
  vi.mocked(FitAddon).mock.instances[0]!.fit = vi.fn();
  resize([], {} as ResizeObserver);
  expect(vi.mocked(FitAddon).mock.instances[0]!.fit).toHaveBeenCalled();
  vi.mocked(terminal.onResize).mock.calls[0]![0]({ cols: 120, rows: 40 });
  expect(window.hostTerminalResize).toHaveBeenCalledWith(7, 120, 40);
});

test('reports shell exit and updates the tab title', async () => {
  hostTerminalTabs.set([{ id: 1, name: 'Terminal 1' }]);
  const onExit = vi.fn();
  render(HostTerminalInstance, { tabId: 1, active: true, onExit });
  await waitFor(() => expect(window.hostTerminalCreate).toHaveBeenCalled());
  vi.mocked(terminal.onTitleChange).mock.calls[0]![0]('bash');
  expect(get(hostTerminalTabs)[0]?.name).toBe('bash');
  vi.mocked(window.hostTerminalCreate).mock.calls[0]![1](0);
  expect(onExit).toHaveBeenCalledWith(1);
});

test('disposes xterm and closes the session when the tab unmounts', async () => {
  const view = render(HostTerminalInstance, { tabId: 1, active: true });
  await waitFor(() => expect(window.hostTerminalResize).toHaveBeenCalled());
  view.unmount();
  expect(terminal.dispose).toHaveBeenCalled();
  expect(window.hostTerminalClose).toHaveBeenCalledWith(7);
});

test('closes a session that finishes creation after the tab unmounts', async () => {
  const session = Promise.withResolvers<number>();
  vi.mocked(window.hostTerminalCreate).mockReturnValue(session.promise);
  const view = render(HostTerminalInstance, { tabId: 1, active: true });
  await waitFor(() => expect(window.hostTerminalCreate).toHaveBeenCalled());
  view.unmount();
  session.resolve(8);
  await waitFor(() => expect(window.hostTerminalClose).toHaveBeenCalledWith(8));
});

test('shows a shell creation error', async () => {
  vi.mocked(window.hostTerminalCreate).mockRejectedValue(new Error('Shell unavailable'));
  render(HostTerminalInstance, { tabId: 1, active: true });
  expect(await screen.findByRole('alert')).toHaveTextContent('Failed to open terminal: Error: Shell unavailable');
});
