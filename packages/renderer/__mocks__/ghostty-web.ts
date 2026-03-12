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

import { vi } from 'vitest';

export const init = vi.fn();

export const Terminal = vi.fn(function (this: Record<string, unknown>) {
  this.cols = 80;
  this.rows = 24;
  this.element = document.createElement('div');
  this.textarea = document.createElement('textarea');
  this.buffer = {
    active: {
      length: 0,
      baseY: 0,
      cursorX: 0,
      cursorY: 0,
      viewportY: 0,
      getLine: vi.fn(),
    },
  };
  this.options = {};
});

Terminal.prototype.onData = vi.fn(() => ({ dispose: vi.fn() }));
Terminal.prototype.onBinary = vi.fn(() => ({ dispose: vi.fn() }));
Terminal.prototype.onTitleChange = vi.fn(() => ({ dispose: vi.fn() }));
Terminal.prototype.onResize = vi.fn(() => ({ dispose: vi.fn() }));
Terminal.prototype.onRender = vi.fn(() => ({ dispose: vi.fn() }));
Terminal.prototype.onKey = vi.fn(() => ({ dispose: vi.fn() }));
Terminal.prototype.open = vi.fn();
Terminal.prototype.write = vi.fn();
Terminal.prototype.writeln = vi.fn();
Terminal.prototype.dispose = vi.fn();
Terminal.prototype.clear = vi.fn();
Terminal.prototype.reset = vi.fn();
Terminal.prototype.focus = vi.fn();
Terminal.prototype.blur = vi.fn();
Terminal.prototype.resize = vi.fn();
Terminal.prototype.loadAddon = vi.fn();
Terminal.prototype.scrollToBottom = vi.fn();
Terminal.prototype.scrollLines = vi.fn();
Terminal.prototype.select = vi.fn();
Terminal.prototype.clearSelection = vi.fn();
Terminal.prototype.paste = vi.fn();
Terminal.prototype.refresh = vi.fn();

export const FitAddon = vi.fn();
FitAddon.prototype.activate = vi.fn();
FitAddon.prototype.fit = vi.fn();
FitAddon.prototype.proposeDimensions = vi.fn();
FitAddon.prototype.dispose = vi.fn();
