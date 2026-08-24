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

import type { WebContents } from 'electron';
import type { IPty } from 'node-pty';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { HostTerminalService } from './host-terminal-service.js';

vi.mock(import('node:child_process'), () => ({
  execSync: vi.fn(),
}));

vi.mock(import('node-pty'), () => ({
  spawn: vi.fn(),
}));

class TestableHostTerminalService extends HostTerminalService {
  public getDefaultShell(): string {
    return super.getDefaultShell();
  }
  public getLoginArgs(shell: string): string[] {
    return super.getLoginArgs(shell);
  }
}

let mockPty: {
  onData: ReturnType<typeof vi.fn>;
  onExit: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
};

let mockWebContents: {
  send: ReturnType<typeof vi.fn>;
  isDestroyed: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  vi.resetAllMocks();

  mockPty = {
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };

  mockWebContents = {
    send: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
  };

  const nodePty = await import('node-pty');
  vi.mocked(nodePty.spawn).mockReturnValue(mockPty as unknown as IPty);
});

describe('HostTerminalService', () => {
  test('create spawns a pty and returns the callback id', async () => {
    const service = new HostTerminalService();
    const result = service.create(mockWebContents as unknown as WebContents, 1);

    expect(result).toBe(1);

    const nodePty = await import('node-pty');
    expect(nodePty.spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
      }),
    );
  });

  test('create wires onData to webContents.send', async () => {
    const service = new HostTerminalService();
    service.create(mockWebContents as unknown as WebContents, 1);

    const onDataCallback = mockPty.onData.mock.calls[0]![0] as (data: string) => void;
    onDataCallback('hello');

    expect(mockWebContents.send).toHaveBeenCalledWith('host-terminal:onData', 1, 'hello');
  });

  test('create wires onExit to webContents.send and cleans up', async () => {
    const service = new HostTerminalService();
    service.create(mockWebContents as unknown as WebContents, 1);

    const onExitCallback = mockPty.onExit.mock.calls[0]![0] as (e: { exitCode: number }) => void;
    onExitCallback({ exitCode: 0 });

    expect(mockWebContents.send).toHaveBeenCalledWith('host-terminal:onExit', 1, 0);
  });

  test('write forwards data to pty', () => {
    const service = new HostTerminalService();
    service.create(mockWebContents as unknown as WebContents, 1);

    service.write(1, 'test input');
    expect(mockPty.write).toHaveBeenCalledWith('test input');
  });

  test('resize forwards dimensions to pty', () => {
    const service = new HostTerminalService();
    service.create(mockWebContents as unknown as WebContents, 1);

    service.resize(1, 120, 40);
    expect(mockPty.resize).toHaveBeenCalledWith(120, 40);
  });

  test('close kills pty and removes from map', () => {
    const service = new HostTerminalService();
    service.create(mockWebContents as unknown as WebContents, 1);

    service.close(1);
    expect(mockPty.kill).toHaveBeenCalled();

    service.write(1, 'should not reach');
    expect(mockPty.write).toHaveBeenCalledTimes(0);
  });

  test('disposeAll kills all ptys', () => {
    const service = new HostTerminalService();
    service.create(mockWebContents as unknown as WebContents, 1);
    service.create(mockWebContents as unknown as WebContents, 2);

    service.disposeAll();
    expect(mockPty.kill).toHaveBeenCalledTimes(2);
  });

  test('does not send to destroyed webContents', () => {
    mockWebContents.isDestroyed.mockReturnValue(true);
    const service = new HostTerminalService();
    service.create(mockWebContents as unknown as WebContents, 1);

    const onDataCallback = mockPty.onData.mock.calls[0]![0] as (data: string) => void;
    onDataCallback('hello');

    expect(mockWebContents.send).not.toHaveBeenCalled();
  });
});

describe('getDefaultShell', () => {
  test('returns SHELL env var when set', () => {
    const original = process.env['SHELL'];
    process.env['SHELL'] = '/usr/bin/fish';
    try {
      const service = new TestableHostTerminalService();
      expect(service.getDefaultShell()).toBe('/usr/bin/fish');
    } finally {
      if (original) {
        process.env['SHELL'] = original;
      } else {
        delete process.env['SHELL'];
      }
    }
  });

  test('returns COMSPEC on win32', () => {
    const origPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const origComspec = process.env['COMSPEC'];
    process.env['COMSPEC'] = 'C:\\Windows\\System32\\cmd.exe';
    try {
      const service = new TestableHostTerminalService();
      expect(service.getDefaultShell()).toBe('C:\\Windows\\System32\\cmd.exe');
    } finally {
      if (origPlatform) {
        Object.defineProperty(process, 'platform', origPlatform);
      }
      if (origComspec) {
        process.env['COMSPEC'] = origComspec;
      } else {
        delete process.env['COMSPEC'];
      }
    }
  });
});

describe('getLoginArgs', () => {
  test('returns --login for fish', () => {
    const service = new TestableHostTerminalService();
    expect(service.getLoginArgs('/usr/bin/fish')).toEqual(['--login']);
  });

  test('returns -l for bash', () => {
    const service = new TestableHostTerminalService();
    expect(service.getLoginArgs('/bin/bash')).toEqual(['-l']);
  });

  test('returns -l for zsh', () => {
    const service = new TestableHostTerminalService();
    expect(service.getLoginArgs('/bin/zsh')).toEqual(['-l']);
  });
});
