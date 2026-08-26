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

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { AgentDetectionService } from './agent-detection-service.js';

vi.mock(import('node:child_process'), () => ({
  execSync: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AgentDetectionService', () => {
  test('detects agents found on PATH', () => {
    vi.mocked(execSync).mockImplementation((cmd: string) => {
      if (cmd.includes('claude')) return '/usr/local/bin/claude';
      if (cmd.includes('codex')) return '/usr/local/bin/codex';
      throw new Error('not found');
    });

    const service = new AgentDetectionService();
    const agents = service.detectAgents();

    expect(agents).toEqual([
      { binary: 'claude', path: '/usr/local/bin/claude', label: 'Claude' },
      { binary: 'codex', path: '/usr/local/bin/codex', label: 'Codex' },
    ]);
  });

  test('returns empty array when no agents found', () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found');
    });

    const service = new AgentDetectionService();
    const agents = service.detectAgents();

    expect(agents).toEqual([]);
  });

  test('caches results for subsequent calls', () => {
    vi.mocked(execSync).mockReturnValue('/usr/local/bin/claude');

    const service = new AgentDetectionService();
    service.detectAgents();
    service.detectAgents();

    expect(execSync).toHaveBeenCalledTimes(3);
  });

  test('re-scans after cache expires', () => {
    vi.mocked(execSync).mockReturnValue('/usr/local/bin/claude');

    const service = new AgentDetectionService();
    service.detectAgents();

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    service.detectAgents();

    expect(execSync).toHaveBeenCalledTimes(6);
  });
});
