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

import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { join } from 'node:path';

import { injectable } from 'inversify';

import { isMac } from '/@/util.js';
import product from '/@product.json' with { type: 'json' };

const MANAGED_PREFS_DIR = '/Library/Managed Preferences';
const DEFAULTS_KEY = 'Defaults';

interface TelemetryInfo {
  event: string;
  eventProperties?: unknown;
}

export interface MdmContent {
  enforced: Record<string, unknown>;
  defaults: Record<string, unknown>;
}

const EMPTY_CONTENT: MdmContent = { enforced: {}, defaults: {} };

/**
 * Reads Apple MDM managed preferences on macOS.
 *
 * MDM profiles write preferences to /Library/Managed Preferences/<bundleId>.plist.
 * Root-level keys are enforced (locked). Keys under the "Defaults" sub-dictionary
 * are suggested defaults the user can override. Follows the Slack two-tier model.
 */
@injectable()
export class MdmConfiguration {
  private telemetryInfo: TelemetryInfo | undefined;

  public async getContent(): Promise<MdmContent> {
    if (!isMac()) {
      return EMPTY_CONTENT;
    }

    const plistFilename = `${product.appId}.plist`;

    // Device-level managed prefs apply to all users on the machine
    const devicePath = join(MANAGED_PREFS_DIR, plistFilename);

    // Per-user managed prefs apply to the current user only
    let userPath: string | undefined;
    try {
      const username = userInfo().username;
      userPath = join(MANAGED_PREFS_DIR, username, plistFilename);
    } catch {
      // userInfo() can throw on some systems; skip per-user path
    }

    const deviceData = await this.readPlist(devicePath);
    const userData = userPath ? await this.readPlist(userPath) : undefined;

    if (!deviceData && !userData) {
      return EMPTY_CONTENT;
    }

    this.telemetryInfo = { event: 'mdmConfigurationEnabled' };

    // Device-level takes precedence over user-level (Apple convention)
    const merged = this.mergePlistData(userData, deviceData);
    return this.splitContent(merged);
  }

  public getTelemetryInfo(): TelemetryInfo | undefined {
    return this.telemetryInfo;
  }

  private async readPlist(plistPath: string): Promise<Record<string, unknown> | undefined> {
    try {
      await access(plistPath);
    } catch {
      console.debug(`[Managed-by]: No MDM plist found at ${plistPath}`);
      return undefined;
    }

    try {
      const stdout = await this.execPlutil(plistPath);
      const parsed = JSON.parse(stdout) as Record<string, unknown>;
      console.log(`[Managed-by]: Loaded MDM plist from: ${plistPath}`);
      return parsed;
    } catch (error) {
      console.error(`[Managed-by]: Failed to parse MDM plist at ${plistPath}:`, error);
      this.telemetryInfo = { event: 'mdmConfigurationStartupFailed', eventProperties: error };
      return undefined;
    }
  }

  private execPlutil(plistPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('/usr/bin/plutil', ['-convert', 'json', '-o', '-', plistPath], (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Merge two plist data objects. The overlay wins on key conflicts.
   */
  private mergePlistData(
    base: Record<string, unknown> | undefined,
    overlay: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    if (!base) {
      return overlay ?? {};
    }
    if (!overlay) {
      return base;
    }
    return { ...base, ...overlay };
  }

  /**
   * Split a flat plist object into enforced keys and default keys.
   *
   * Root-level keys (except "Defaults") are enforced.
   * Keys under the "Defaults" sub-dictionary are suggested defaults.
   */
  private splitContent(data: Record<string, unknown>): MdmContent {
    const enforced: Record<string, unknown> = {};
    let defaults: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === DEFAULTS_KEY && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        defaults = value as Record<string, unknown>;
      } else {
        enforced[key] = value;
      }
    }

    return { enforced, defaults };
  }
}
