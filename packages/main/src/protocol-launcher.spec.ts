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
import type { BrowserWindow } from 'electron';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isWindows } from '/@/util.js';

import { ProtocolLauncher } from './protocol-launcher.js';

// mock modules
vi.mock(import('/@/util.js'));

const BROWSER_WINDOW_MOCK: BrowserWindow = {
  isDestroyed: vi.fn(),
  webContents: {
    send: vi.fn(),
  },
} as unknown as BrowserWindow;

function getProtocolLauncher(): ProtocolLauncher {
  // create deferred promise
  const deferred = Promise.withResolvers<BrowserWindow>();
  deferred.resolve(BROWSER_WINDOW_MOCK);

  // create protocol launcher
  return new ProtocolLauncher(deferred);
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('should send the URL to open when mainWindow is created', async () => {
  const protocol = getProtocolLauncher();
  protocol.handleOpenUrl('podman-desktop:extension/my.extension');

  // wait sendMock being called
  await vi.waitFor(() => expect(BROWSER_WINDOW_MOCK.webContents.send).toHaveBeenCalled());

  expect(BROWSER_WINDOW_MOCK.webContents.send).toHaveBeenCalledWith(
    'podman-desktop-protocol:install-extension',
    'my.extension',
  );
});

test('should send the URL to open when mainWindow is created with :// format', async () => {
  const protocol = getProtocolLauncher();
  protocol.handleOpenUrl('podman-desktop://extension/my.extension');

  // wait sendMock being called
  await vi.waitFor(() =>
    expect(BROWSER_WINDOW_MOCK.webContents.send).toHaveBeenCalledWith(
      'podman-desktop-protocol:install-extension',
      'my.extension',
    ),
  );
});

test('should not send the URL for invalid URLs', async () => {
  const protocol = getProtocolLauncher();
  protocol.handleOpenUrl('podman-desktop:foobar');

  // expect an error
  expect(vi.mocked(BROWSER_WINDOW_MOCK.webContents.send)).not.toHaveBeenCalled();
});

test.each([
  {
    url: 'podman-desktop:extension/my.extension',
    webContentsSend: ['podman-desktop-protocol:install-extension', 'my.extension'],
  },
  { url: 'podman-desktop:experimental', webContentsSend: ['podman-desktop-protocol:open-experimental-features'] },
])('should handle valid URL on Windows', async ({ url, webContentsSend }) => {
  vi.mocked(isWindows).mockReturnValue(true);

  const protocol = getProtocolLauncher();
  protocol.handleAdditionalProtocolLauncherArgs([url]);

  // expect handleOpenUrl not be called
  await vi.waitFor(() => expect(BROWSER_WINDOW_MOCK.webContents.send).toHaveBeenCalledWith(...webContentsSend));
});

test.each([
  'podman-desktop:extension/my.extension',
  'podman-desktop:experimental',
])('should not do anything with valid URL on OS different than Windows', async url => {
  vi.mocked(isWindows).mockReturnValue(false);

  const protocol = getProtocolLauncher();

  protocol.handleAdditionalProtocolLauncherArgs([url]);

  // no called on it
  expect(BROWSER_WINDOW_MOCK.webContents.send).not.toHaveBeenCalled();
});

describe('sanitizeProtocolUrl', () => {
  test('handle extension URL sanitization', () => {
    const protocol = getProtocolLauncher();

    const fakeLink = 'podman-desktop://extension/my.extension';
    const sanitizedLink = 'podman-desktop:extension/my.extension';
    expect(protocol.sanitizeProtocolUrl(fakeLink)).toEqual(sanitizedLink);
  });

  test('handle already sanitized URL', () => {
    const protocol = getProtocolLauncher();

    const sanitizedLink = 'podman-desktop:extension/my.extension';
    expect(protocol.sanitizeProtocolUrl(sanitizedLink)).toEqual(sanitizedLink);
  });

  test('handle run-image URL sanitization', () => {
    const protocol = getProtocolLauncher();

    const fakeLink = 'podman-desktop://run-image?config=abc123';
    const sanitizedLink = 'podman-desktop:run-image?config=abc123';
    expect(protocol.sanitizeProtocolUrl(fakeLink)).toEqual(sanitizedLink);
  });
});

describe('parseRunImageConfig', () => {
  test('should parse valid config with all fields', () => {
    const protocol = getProtocolLauncher();
    const config = {
      image: 'docker.io/nginx:latest',
      name: 'my-nginx',
      ports: ['8080:80', '3000:3000'],
      env: ['DEBUG=true', 'NODE_ENV=production'],
      volumes: ['/host:/container'],
      cmd: 'nginx -g "daemon off;"',
      entrypoint: '/entrypoint.sh',
      hostname: 'myhost',
    };
    const base64 = Buffer.from(JSON.stringify(config)).toString('base64');
    const url = `podman-desktop:run-image?config=${base64}`;

    const result = protocol.parseRunImageConfig(url);

    expect(result).toEqual(config);
  });

  test('should parse config with only required image field', () => {
    const protocol = getProtocolLauncher();
    const config = { image: 'nginx:latest' };
    const base64 = Buffer.from(JSON.stringify(config)).toString('base64');
    const url = `podman-desktop:run-image?config=${base64}`;

    const result = protocol.parseRunImageConfig(url);

    expect(result).toEqual({ image: 'nginx:latest' });
  });

  test('should return undefined when config param is missing', () => {
    const protocol = getProtocolLauncher();

    const result = protocol.parseRunImageConfig('podman-desktop:run-image?other=value');

    expect(result).toBeUndefined();
  });

  test('should return undefined when no query params present', () => {
    const protocol = getProtocolLauncher();

    const result = protocol.parseRunImageConfig('podman-desktop:run-image');

    expect(result).toBeUndefined();
  });

  test('should return undefined when image field is missing', () => {
    const protocol = getProtocolLauncher();
    const config = { name: 'my-container' };
    const base64 = Buffer.from(JSON.stringify(config)).toString('base64');
    const url = `podman-desktop:run-image?config=${base64}`;

    const result = protocol.parseRunImageConfig(url);

    expect(result).toBeUndefined();
  });

  test('should return undefined for invalid base64', () => {
    const protocol = getProtocolLauncher();

    const result = protocol.parseRunImageConfig('podman-desktop:run-image?config=!!!invalid!!!');

    expect(result).toBeUndefined();
  });

  test('should return undefined for invalid JSON', () => {
    const protocol = getProtocolLauncher();
    const base64 = Buffer.from('not-json').toString('base64');
    const url = `podman-desktop:run-image?config=${base64}`;

    const result = protocol.parseRunImageConfig(url);

    expect(result).toBeUndefined();
  });

  test('should filter non-string values from arrays', () => {
    const protocol = getProtocolLauncher();
    const config = {
      image: 'nginx:latest',
      ports: ['8080:80', 123, null, '3000:3000'],
      env: ['KEY=VAL', true],
    };
    const base64 = Buffer.from(JSON.stringify(config)).toString('base64');
    const url = `podman-desktop:run-image?config=${base64}`;

    const result = protocol.parseRunImageConfig(url);

    expect(result?.ports).toEqual(['8080:80', '3000:3000']);
    expect(result?.env).toEqual(['KEY=VAL']);
  });
});

describe('handleOpenUrl with run-image', () => {
  test('should send run-image config via IPC', async () => {
    const protocol = getProtocolLauncher();
    const config = { image: 'nginx:latest', ports: ['8080:80'] };
    const base64 = Buffer.from(JSON.stringify(config)).toString('base64');

    protocol.handleOpenUrl(`podman-desktop:run-image?config=${base64}`);

    await vi.waitFor(() =>
      expect(BROWSER_WINDOW_MOCK.webContents.send).toHaveBeenCalledWith('podman-desktop-protocol:run-image', config),
    );
  });

  test('should handle run-image with :// format', async () => {
    const protocol = getProtocolLauncher();
    const config = { image: 'nginx:latest' };
    const base64 = Buffer.from(JSON.stringify(config)).toString('base64');

    protocol.handleOpenUrl(`podman-desktop://run-image?config=${base64}`);

    await vi.waitFor(() =>
      expect(BROWSER_WINDOW_MOCK.webContents.send).toHaveBeenCalledWith('podman-desktop-protocol:run-image', {
        image: 'nginx:latest',
      }),
    );
  });

  test('should not send IPC for invalid run-image config', () => {
    const protocol = getProtocolLauncher();

    protocol.handleOpenUrl('podman-desktop:run-image?config=invalid');

    expect(BROWSER_WINDOW_MOCK.webContents.send).not.toHaveBeenCalled();
  });

  test('should handle run-image URL on Windows', async () => {
    vi.mocked(isWindows).mockReturnValue(true);
    const protocol = getProtocolLauncher();
    const config = { image: 'nginx:latest' };
    const base64 = Buffer.from(JSON.stringify(config)).toString('base64');

    protocol.handleAdditionalProtocolLauncherArgs([`podman-desktop:run-image?config=${base64}`]);

    await vi.waitFor(() =>
      expect(BROWSER_WINDOW_MOCK.webContents.send).toHaveBeenCalledWith('podman-desktop-protocol:run-image', {
        image: 'nginx:latest',
      }),
    );
  });
});
