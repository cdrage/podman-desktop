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

import { chmod } from 'node:fs/promises';

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock(import('node:fs/promises'));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test.each(['darwin', 'linux'])('sets executable permissions for the %s helper', async platform => {
  vi.stubGlobal('process', { ...process, platform, arch: 'arm64' });
  await import('./prepare-node-pty.js');
  expect(chmod).toHaveBeenCalledWith(
    expect.stringContaining(`/node-pty/prebuilds/${platform}-arm64/spawn-helper`),
    0o755,
  );
});

test('does not change permissions on Windows', async () => {
  vi.stubGlobal('process', { ...process, platform: 'win32' });
  await import('./prepare-node-pty.js');
  expect(chmod).not.toHaveBeenCalled();
});
