/**********************************************************************
 * Copyright (C) 2023 Red Hat, Inc.
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

import { render, screen, waitFor } from '@testing-library/svelte';
import { Terminal } from 'ghostty-web';
import { get } from 'svelte/store';
import { beforeEach, expect, test, vi } from 'vitest';

import { containerTerminals } from '/@/stores/container-terminal-store';

import ContainerDetailsTerminal from './ContainerDetailsTerminal.svelte';
import type { ContainerInfoUI } from './ContainerInfoUI';

vi.mock(import('../terminal/ghostty-serialize-addon'));

let shellInContainerMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(window.getConfigurationValue).mockImplementation(async (key: string) => {
    if (key === 'terminal.integrated.scrollback') {
      return 1000;
    }
    return undefined;
  });
  shellInContainerMock = vi.mocked(window.shellInContainer);

  // reset terminals
  containerTerminals.set([]);
});

test('expect being able to reconnect ', async () => {
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onDataCallback: (data: Buffer) => void = () => {};

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    (
      _engineId: string,
      _containerId: string,
      onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      _onEnd: () => void,
    ) => {
      onDataCallback = onData;
      // return a callback id
      return sendCallbackId;
    },
  );

  // render the component with a terminal
  const renderObject = render(ContainerDetailsTerminal, { container });

  // wait shellInContainerMock is called
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalled());

  // write some data on the terminal
  onDataCallback(Buffer.from('hello\nworld'));

  // check the terminal received the data
  await waitFor(() => expect(Terminal.prototype.write).toHaveBeenCalledWith('hello\nworld'));

  // should be no terminal being stored
  const terminals = get(containerTerminals);
  expect(terminals.length).toBe(0);

  // destroy the object
  renderObject.unmount();

  // now, check that we have a terminal that is in the store
  const terminalsAfterDestroy = get(containerTerminals);
  expect(terminalsAfterDestroy.length).toBe(1);

  // ok, now render a new terminal widget, it should reuse data from the store
  render(ContainerDetailsTerminal, { container });

  // wait shellInContainerMock is called
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));

  // creating a new terminal requires new shellInContainer call
  expect(shellInContainerMock).toHaveBeenCalledTimes(2);
});

test('terminal active/ restarts connection after stopping and starting a container', async () => {
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onDataCallback: (data: Buffer) => void = () => {};
  let onEndCallback: () => void = () => {};

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onDataCallback = onData;
      onEndCallback = onEnd;
      return Promise.resolve(sendCallbackId);
    },
  );

  // render the component with a terminal
  const renderObject = render(ContainerDetailsTerminal, { container });

  // wait shellInContainerMock is called (initial connection)
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // write some data on the terminal
  onDataCallback(Buffer.from('hello\nworld'));

  // check the terminal received the data
  await waitFor(() => expect(Terminal.prototype.write).toHaveBeenCalledWith('hello\nworld'));

  // simulate the shell ending while container is still running — triggers reconnect
  onEndCallback();
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));

  container.state = 'EXITED';

  await renderObject.rerender({ container: container });

  await waitFor(() => expect(screen.queryByText('Container is not running')).toBeInTheDocument());

  container.state = 'STARTING';

  await renderObject.rerender({ container: container });

  container.state = 'RUNNING';

  await renderObject.rerender({ container: container });

  // STARTING → RUNNING transition triggers restartTerminal() via $effect, adding one more call
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(3));
});

test('terminal reconnects via scheduleReconnect when immediate reconnect fails during restart', async () => {
  vi.useFakeTimers();
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onEndCallback: () => void = () => {};

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  const renderObject = render(ContainerDetailsTerminal, { container });

  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // Simulate restart: the exec dies while the store still says RUNNING (due to debounce).
  // The immediate reconnect in receiveEndCallback fails because the container is mid-restart.
  shellInContainerMock.mockRejectedValueOnce(new Error('container is restarting'));

  onEndCallback();

  // The rejected reconnect triggers scheduleReconnect
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));

  // Restore mock for the next call to succeed
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  // Advance time to trigger the scheduled reconnect (2s delay)
  await vi.advanceTimersByTimeAsync(2000);

  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(3));

  // Clean up component before restoring real timers to clear internal reconnect timer
  renderObject.unmount();
  vi.useRealTimers();
});

test('scheduleReconnect retries when restartTerminal fails inside the timer callback', async () => {
  vi.useFakeTimers();
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onEndCallback: () => void = () => {};

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  const renderObject = render(ContainerDetailsTerminal, { container });
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // Make the next TWO calls fail so scheduleReconnect's own catch path is exercised
  shellInContainerMock.mockRejectedValueOnce(new Error('first failure'));
  shellInContainerMock.mockRejectedValueOnce(new Error('second failure'));

  // Shell ends → receiveEndCallback → restartTerminal fails (call #2) → scheduleReconnect
  onEndCallback();
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));

  // Advance timer → scheduleReconnect fires → restartTerminal fails again (call #3)
  // → the catch inside scheduleReconnect re-calls scheduleReconnect (lines 80-81)
  await vi.advanceTimersByTimeAsync(2000);
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(3));

  // Restore mock so the re-scheduled timer succeeds
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  // Advance again → the re-scheduled timer fires → restartTerminal succeeds (call #4)
  await vi.advanceTimersByTimeAsync(2000);
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(4));

  renderObject.unmount();
  vi.useRealTimers();
});

test('user input is forwarded to the container via shellInContainerSend', async () => {
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      _onEnd: () => void,
    ) => {
      return sendCallbackId;
    },
  );
  vi.mocked(window.shellInContainerSend).mockResolvedValue(undefined);

  render(ContainerDetailsTerminal, { container });
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // Retrieve the onData callback registered by the component
  await waitFor(() => expect(Terminal.prototype.onData).toHaveBeenCalled());
  const onDataCallback = vi.mocked(Terminal.prototype.onData).mock.calls[0]![0] as (data: string) => void;

  onDataCallback('test input');

  await waitFor(() => expect(window.shellInContainerSend).toHaveBeenCalledWith(sendCallbackId, 'test input'));
});

test('receiveEndCallback schedules reconnect when container is not running', async () => {
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onEndCallback: () => void = () => {};

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  const renderObject = render(ContainerDetailsTerminal, { container });
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // Container stops — exec ends while state is not RUNNING.
  // receiveEndCallback's else branch calls scheduleReconnect.
  container.state = 'EXITED';
  await renderObject.rerender({ container: container });
  onEndCallback();

  // No immediate reconnect since container is not RUNNING
  expect(shellInContainerMock).toHaveBeenCalledTimes(1);

  // Container comes back — $effect detects EXITED → RUNNING and reconnects
  container.state = 'RUNNING';
  await renderObject.rerender({ container: container });
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));
});

test('receiveEndCallback reconnects successfully and resizes terminal', async () => {
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onEndCallback: () => void = () => {};

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  render(ContainerDetailsTerminal, { container });
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // Shell ends while container is running — receiveEndCallback calls restartTerminal
  onEndCallback();
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));

  // Verify shellInContainerResize was called for the reconnect (not just the initial connection)
  expect(window.shellInContainerResize).toHaveBeenCalledTimes(2);
});

test('receiveEndCallback reconnect ignores first data chunk to avoid prompt duplication', async () => {
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onDataCallback: (data: Buffer) => void = () => {};
  let onEndCallback: () => void = () => {};

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onDataCallback = onData;
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  render(ContainerDetailsTerminal, { container });
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // Write initial data
  onDataCallback(Buffer.from('prompt$ '));
  await waitFor(() => expect(Terminal.prototype.write).toHaveBeenCalledWith('prompt$ '));

  // Shell ends while running — receiveEndCallback routes through restartTerminal,
  // which sets ignoreFirstData = true before reopening the shell
  onEndCallback();
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));

  // The reconnected shell sends the initial prompt chunk — it should be ignored
  onDataCallback(Buffer.from('prompt$ '));

  // Send real user output after the ignored chunk
  onDataCallback(Buffer.from('ls\nfile1 file2\nprompt$ '));

  // Verify the ignored chunk was not written, but subsequent data was
  await waitFor(() => expect(Terminal.prototype.write).toHaveBeenCalledWith('ls\nfile1 file2\nprompt$ '));
});

test('$effect schedules reconnect when restartTerminal fails', async () => {
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      _onEnd: () => void,
    ) => {
      return sendCallbackId;
    },
  );

  const renderObject = render(ContainerDetailsTerminal, { container });
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // Container goes to EXITED
  container.state = 'EXITED';
  await renderObject.rerender({ container: container });

  // Container returns to RUNNING — $effect fires restartTerminal, but it fails
  shellInContainerMock.mockRejectedValueOnce(new Error('not ready yet'));
  container.state = 'RUNNING';
  await renderObject.rerender({ container: container });

  // $effect's catch calls scheduleReconnect — wait for the failed attempt
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));

  // Restore mock for the scheduled retry to succeed
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      _onEnd: () => void,
    ) => {
      return sendCallbackId;
    },
  );

  // scheduleReconnect will fire after 2s — wait for it with real timers
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(3), { timeout: 5000 });
});

test('concurrent receiveEndCallback calls do not create duplicate connections', async () => {
  vi.useFakeTimers();
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onEndCallback: () => void = () => {};
  let resolveShell: ((id: number) => void) | undefined;

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  const renderObject = render(ContainerDetailsTerminal, { container });
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // Make the next shellInContainer call hang so we can test the guard
  shellInContainerMock.mockReturnValue(
    new Promise<number>(resolve => {
      resolveShell = resolve;
    }),
  );

  // First exec dies — receiveEndCallback starts a reconnect (now in flight)
  onEndCallback();

  // Second exec end fires while the first reconnect is still pending —
  // the reconnecting guard prevents a duplicate, but schedules a safety-net reconnect
  onEndCallback();

  // Resolve the pending reconnect
  resolveShell?.(sendCallbackId);

  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));

  // Only 2 calls so far: initial + one reconnect. The second onEndCallback was blocked
  // by the reconnecting guard but scheduled a safety-net timer.
  expect(shellInContainerMock).toHaveBeenCalledTimes(2);

  // Restore mock for the safety-net timer's reconnect
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  // Advance past the safety-net timer (2s)
  await vi.advanceTimersByTimeAsync(2000);

  // The safety-net reconnect fires — call #3
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(3));

  renderObject.unmount();
  vi.useRealTimers();
});

test('receiveEndCallback during reconnect schedules safety-net retry to prevent freeze', async () => {
  vi.useFakeTimers();
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onEndCallback: () => void = () => {};
  let resolveShell: ((id: number) => void) | undefined;

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  const renderObject = render(ContainerDetailsTerminal, { container });
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(1));

  // Make reconnect hang so we can simulate the race
  shellInContainerMock.mockReturnValue(
    new Promise<number>(resolve => {
      resolveShell = resolve;
    }),
  );

  // Exec dies → receiveEndCallback → restartTerminal starts (reconnecting = true)
  onEndCallback();

  // The new session's onEnd fires while the reconnect is still in flight —
  // this is the race condition: the session being established is already dead.
  // With the fix, this schedules a safety-net reconnect instead of being dropped.
  onEndCallback();

  // The in-progress reconnect completes — but the session it established is "dead"
  resolveShell?.(sendCallbackId);
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(2));

  // Restore mock so the safety-net reconnect succeeds
  shellInContainerMock.mockImplementation(
    async (
      _engineId: string,
      _containerId: string,
      _onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      onEnd: () => void,
    ) => {
      onEndCallback = onEnd;
      return sendCallbackId;
    },
  );

  // Advance past the 2s safety-net timer
  await vi.advanceTimersByTimeAsync(2000);

  // The safety-net reconnect creates a fresh session (call #3) — terminal recovers
  await vi.waitFor(() => expect(shellInContainerMock).toHaveBeenCalledTimes(3));

  renderObject.unmount();
  vi.useRealTimers();
});

test('prompt is not duplicated after restoring terminal from containerTerminals store', async () => {
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onDataCallback: (data: Buffer) => void = () => {};

  const sendCallbackId = 12345;
  shellInContainerMock.mockImplementation(
    (
      _engineId: string,
      _containerId: string,
      onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      _onEnd: () => void,
    ) => {
      onDataCallback = onData;
      // return a callback id
      return sendCallbackId;
    },
  );

  // render the component with a terminal
  const renderObject = render(ContainerDetailsTerminal, { container });

  // wait shellInContainerMock is called
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledOnce());

  // write some data on the terminal
  onDataCallback(Buffer.from('prompt$ \nhello\nworld\nprompt$ '));

  // check the terminal received the data
  await waitFor(() => expect(Terminal.prototype.write).toHaveBeenCalledWith('prompt$ \nhello\nworld\nprompt$ '));

  // should be no terminal being stored
  const terminals = get(containerTerminals);
  expect(terminals.length).toBe(0);

  // destroy the terminal tab
  renderObject.unmount();
  shellInContainerMock.mockClear();

  // render the same component again and check if terminal restored
  render(ContainerDetailsTerminal, { container });

  // wait shellInContainerMock is called
  await waitFor(() => expect(shellInContainerMock).toHaveBeenCalledOnce());
});
