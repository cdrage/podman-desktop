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

import { existsSync } from 'node:fs';
import * as os from 'node:os';

import type { WebContents } from 'electron';
import { type IPty, spawn } from 'node-pty';
import { beforeEach, expect, test, vi } from 'vitest';

import { HostTerminalService } from './host-terminal-service.js';

vi.mock(import('node:os'));
vi.mock(import('node:fs'));
vi.mock(import('node-pty'));

const pty = {
  onData: vi.fn(),
  onExit: vi.fn(),
  write: vi.fn(),
  resize: vi.fn(),
  kill: vi.fn(),
};
const sender = {
  send: vi.fn(),
  isDestroyed: vi.fn(),
} satisfies Pick<WebContents, 'send' | 'isDestroyed'>;

let service: HostTerminalService;

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('SHELL', '/bin/bash');
  vi.mocked(os.platform).mockReturnValue('linux');
  vi.mocked(os.homedir).mockReturnValue('/home/user');
  vi.mocked(os.userInfo).mockReturnValue({ shell: '/bin/zsh' } as os.UserInfo<string>);
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(spawn).mockReturnValue(pty as unknown as IPty);
  service = new HostTerminalService();
});

test('creates a login shell with terminal dimensions', () => {
  expect(service.create(sender, 1)).toBe(1);
  expect(spawn).toHaveBeenCalledWith(
    '/bin/bash',
    ['-l'],
    expect.objectContaining({
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: '/home/user',
    }),
  );
});

test('uses the configured folder', () => {
  service.create(sender, 1, { cwd: '/projects/app' });
  expect(spawn).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Array),
    expect.objectContaining({
      cwd: '/projects/app',
    }),
  );
});

test('falls back to home when the folder does not exist', () => {
  vi.mocked(existsSync).mockReturnValue(false);
  service.create(sender, 1, { cwd: '/missing' });
  expect(spawn).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Array),
    expect.objectContaining({
      cwd: '/home/user',
    }),
  );
});

test.each([
  ['/bin/fish', ['--login']],
  ['/bin/zsh', ['-l']],
])('starts %s as a login shell', (shell, args) => {
  vi.stubEnv('SHELL', shell);
  service.create(sender, 1);
  expect(spawn).toHaveBeenCalledWith(shell, args, expect.any(Object));
});

test('uses the account shell when the GUI environment omits SHELL', () => {
  vi.stubEnv('SHELL', '');
  service.create(sender, 1);
  expect(spawn).toHaveBeenCalledWith('/bin/zsh', ['-l'], expect.any(Object));
});

test('starts the Windows command interpreter without Unix login arguments', () => {
  vi.mocked(os.platform).mockReturnValue('win32');
  vi.stubEnv('COMSPEC', 'cmd.exe');
  service.create(sender, 1);
  expect(spawn).toHaveBeenCalledWith('cmd.exe', [], expect.any(Object));
});

test('forwards output and exit notifications', () => {
  service.create(sender, 1);
  pty.onData.mock.calls[0]![0]('output');
  pty.onExit.mock.calls[0]![0]({ exitCode: 0 });
  expect(sender.send).toHaveBeenCalledWith('host-terminal:onData', 1, 'output');
  expect(sender.send).toHaveBeenCalledWith('host-terminal:onExit', 1, 0);
  service.write(1, 'ignored');
  expect(pty.write).not.toHaveBeenCalled();
});

test('ignores output after the window closes', () => {
  service.create(sender, 1);
  sender.isDestroyed.mockReturnValue(true);
  pty.onData.mock.calls[0]![0]('output');
  pty.onExit.mock.calls[0]![0]({ exitCode: 0 });
  expect(sender.send).not.toHaveBeenCalled();
});

test('forwards input and resize requests', () => {
  service.create(sender, 1);
  service.write(1, 'input');
  service.resize(1, 120, 40);
  expect(pty.write).toHaveBeenCalledWith('input');
  expect(pty.resize).toHaveBeenCalledWith(120, 40);
});

test('closes a session once and ignores later requests', () => {
  service.create(sender, 1);
  service.close(1);
  service.close(1);
  service.write(1, 'ignored');
  service.resize(1, 120, 40);
  expect(pty.kill).toHaveBeenCalledOnce();
  expect(pty.write).not.toHaveBeenCalled();
  expect(pty.resize).not.toHaveBeenCalled();
});

test('disposes all sessions', () => {
  service.create(sender, 1);
  service.create(sender, 2);
  service.disposeAll();
  service.disposeAll();
  expect(pty.kill).toHaveBeenCalledTimes(2);
});
