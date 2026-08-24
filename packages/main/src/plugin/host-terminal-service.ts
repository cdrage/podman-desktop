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

import { execSync } from 'node:child_process';
import * as os from 'node:os';

import type { WebContents } from 'electron';
import { injectable } from 'inversify';
import type { IPty } from 'node-pty';
import { spawn } from 'node-pty';

@injectable()
export class HostTerminalService {
  private terminals = new Map<number, IPty>();

  protected getDefaultShell(): string {
    if (os.platform() === 'win32') {
      return process.env['COMSPEC'] ?? 'cmd.exe';
    }
    if (process.env['SHELL']) {
      return process.env['SHELL'];
    }
    // Electron launched from GUI may not have $SHELL — resolve from system
    try {
      // eslint-disable-next-line n/no-sync
      return execSync('/usr/bin/dscl . -read /Users/$USER UserShell', { encoding: 'utf-8' }).trim().split(':').pop()?.trim() ?? '/bin/zsh';
    } catch {
      return '/bin/zsh';
    }
  }

  protected getLoginArgs(shell: string): string[] {
    const base = shell.split('/').pop() ?? '';
    if (base === 'fish') return ['--login'];
    // bash, zsh, sh all accept -l for login shell
    return ['-l'];
  }

  create(webContents: WebContents, callbackId: number): number {
    const shell = this.getDefaultShell();
    const args = this.getLoginArgs(shell);

    const pty = spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: os.homedir(),
      env: process.env as Record<string, string>,
    });

    this.terminals.set(callbackId, pty);

    pty.onData((data: string) => {
      if (!webContents.isDestroyed()) {
        webContents.send('host-terminal:onData', callbackId, data);
      }
    });

    pty.onExit(({ exitCode }) => {
      if (!webContents.isDestroyed()) {
        webContents.send('host-terminal:onExit', callbackId, exitCode);
      }
      this.terminals.delete(callbackId);
    });

    return callbackId;
  }

  write(id: number, data: string): void {
    this.terminals.get(id)?.write(data);
  }

  resize(id: number, cols: number, rows: number): void {
    this.terminals.get(id)?.resize(cols, rows);
  }

  close(id: number): void {
    const pty = this.terminals.get(id);
    if (pty) {
      pty.kill();
      this.terminals.delete(id);
    }
  }

  disposeAll(): void {
    for (const [id, pty] of this.terminals) {
      pty.kill();
      this.terminals.delete(id);
    }
  }
}
