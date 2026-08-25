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

import { injectable } from 'inversify';

export interface DetectedAgent {
  binary: string;
  path: string;
  label: string;
}

const KNOWN_AGENTS = [
  { binary: 'claude', label: 'Claude' },
  { binary: 'codex', label: 'Codex' },
  { binary: 'aider', label: 'Aider' },
  { binary: 'goose', label: 'Goose' },
];

const CACHE_TTL_MS = 30_000;

@injectable()
export class AgentDetectionService {
  private cache: DetectedAgent[] | undefined;
  private cacheTime = 0;

  detectAgents(): DetectedAgent[] {
    if (this.cache && Date.now() - this.cacheTime < CACHE_TTL_MS) {
      return this.cache;
    }

    const whichCmd = os.platform() === 'win32' ? 'where' : 'which';
    const agents: DetectedAgent[] = [];

    for (const agent of KNOWN_AGENTS) {
      try {
        // eslint-disable-next-line n/no-sync
        const path = execSync(`${whichCmd} ${agent.binary}`, { encoding: 'utf-8', timeout: 5000 }).trim();
        if (path) {
          agents.push({ binary: agent.binary, path, label: agent.label });
        }
      } catch {
        // agent not found on PATH
      }
    }

    this.cache = agents;
    this.cacheTime = Date.now();
    return agents;
  }
}
