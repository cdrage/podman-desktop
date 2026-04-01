/**********************************************************************
 * Copyright (C) 2025-2026 Red Hat, Inc.
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
import type { RunImageFromProtocolConfig } from '@podman-desktop/core-api';
import type { BrowserWindow } from 'electron';

import { isWindows } from '/@/util.js';

export class ProtocolLauncher {
  constructor(private browserWindow: PromiseWithResolvers<BrowserWindow>) {}

  /**
   * Normalize podman-desktop:// URLs to podman-desktop: format
   * @param url
   */
  sanitizeProtocolUrl(url: string): string {
    if (url.startsWith('podman-desktop://extension/')) {
      url = url.replace('podman-desktop://extension/', 'podman-desktop:extension/');
    } else if (url.startsWith('podman-desktop://preferences/experimental')) {
      url = url.replace('podman-desktop://preferences/experimental', 'podman-desktop:experimental');
    } else if (url.startsWith('podman-desktop://run-image')) {
      url = url.replace('podman-desktop://run-image', 'podman-desktop:run-image');
    }

    return url;
  }

  handleAdditionalProtocolLauncherArgs(args: ReadonlyArray<string>): void {
    // On Windows protocol handler will call the app with '<url>' args
    // on macOS it's done with 'open-url' event
    if (isWindows()) {
      // now search if we have 'open-url' in the list of args and give it to the handler
      for (const arg of args) {
        const analyzedArg = this.sanitizeProtocolUrl(arg);
        if (
          analyzedArg.startsWith('podman-desktop:extension/') ||
          analyzedArg.startsWith('podman-desktop:experimental') ||
          analyzedArg.startsWith('podman-desktop:run-image')
        ) {
          this.handleOpenUrl(analyzedArg);
        }
      }
    }
  }

  parseRunImageConfig(url: string): RunImageFromProtocolConfig | undefined {
    try {
      const queryStart = url.indexOf('?');
      if (queryStart === -1) {
        console.error('run-image URL has no query parameters');
        return undefined;
      }

      const params = new URLSearchParams(url.substring(queryStart + 1));
      const configBase64 = params.get('config');
      if (!configBase64) {
        console.error('run-image URL missing required "config" parameter');
        return undefined;
      }

      const jsonString = Buffer.from(configBase64, 'base64').toString('utf-8');
      const parsed: unknown = JSON.parse(jsonString);

      if (!parsed || typeof parsed !== 'object') {
        console.error('run-image config is not a valid object');
        return undefined;
      }

      const config = parsed as Record<string, unknown>;
      if (typeof config['image'] !== 'string') {
        console.error('run-image config missing required "image" field');
        return undefined;
      }

      const result: RunImageFromProtocolConfig = {
        image: config['image'],
      };

      if (typeof config['name'] === 'string') result.name = config['name'];
      if (typeof config['cmd'] === 'string') result.cmd = config['cmd'];
      if (typeof config['entrypoint'] === 'string') result.entrypoint = config['entrypoint'];
      if (typeof config['hostname'] === 'string') result.hostname = config['hostname'];
      if (Array.isArray(config['ports']))
        result.ports = config['ports'].filter((p): p is string => typeof p === 'string');
      if (Array.isArray(config['env'])) result.env = config['env'].filter((e): e is string => typeof e === 'string');
      if (Array.isArray(config['volumes']))
        result.volumes = config['volumes'].filter((v): v is string => typeof v === 'string');

      return result;
    } catch (error: unknown) {
      console.error('Failed to parse run-image config', error);
      return undefined;
    }
  }

  handleOpenUrl(url: string): void {
    // if url starts with 'podman-desktop://', normalize to 'podman-desktop:'
    url = this.sanitizeProtocolUrl(url);

    if (url.startsWith('podman-desktop:extension/')) {
      // grab the extension id
      const extensionId = url.substring('podman-desktop:extension/'.length);

      // wait that the window is ready
      this.browserWindow.promise
        .then(w => {
          w.webContents.send('podman-desktop-protocol:install-extension', extensionId);
        })
        .catch((error: unknown) => {
          console.error('Error sending open-url event to webcontents', error);
        });
    } else if (url.startsWith('podman-desktop:experimental')) {
      this.browserWindow.promise
        .then(w => {
          w.webContents.send('podman-desktop-protocol:open-experimental-features');
        })
        .catch((error: unknown) => {
          console.error('Error sending open-url event to webcontents', error);
        });
    } else if (url.startsWith('podman-desktop:run-image')) {
      const config = this.parseRunImageConfig(url);
      if (config) {
        this.browserWindow.promise
          .then(w => {
            w.webContents.send('podman-desktop-protocol:run-image', config);
          })
          .catch((error: unknown) => {
            console.error('Error sending run-image event to webcontents', error);
          });
      }
    } else {
      console.log(
        `url ${url} does not start with podman-desktop:extension/, podman-desktop:experimental, or podman-desktop:run-image, skipping.`,
      );
      return;
    }
  }
}
