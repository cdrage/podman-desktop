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

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { isMac } from '/@/util.js';

import { MdmConfiguration } from './mdm-configuration.js';

vi.mock(import('node:fs/promises'));
vi.mock(import('node:child_process'));

vi.mock(import('/@/util.js'), () => ({
  isMac: vi.fn(),
}));

let mdmConfiguration: MdmConfiguration;

beforeEach(() => {
  vi.resetAllMocks();
  mdmConfiguration = new MdmConfiguration();
});

describe('MdmConfiguration', () => {
  test('returns empty content on non-macOS', async () => {
    vi.mocked(isMac).mockReturnValue(false);

    const result = await mdmConfiguration.getContent();

    expect(result).toEqual({ enforced: {}, defaults: {} });
    expect(mdmConfiguration.getTelemetryInfo()).toBeUndefined();
  });

  test('returns empty content when no plist files exist', async () => {
    vi.mocked(isMac).mockReturnValue(true);
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

    const result = await mdmConfiguration.getContent();

    expect(result).toEqual({ enforced: {}, defaults: {} });
    expect(mdmConfiguration.getTelemetryInfo()).toBeUndefined();
  });

  test('parses root-level keys as enforced', async () => {
    vi.mocked(isMac).mockReturnValue(true);

    // Device-level plist exists
    vi.mocked(access).mockImplementation(async (path: unknown) => {
      if (String(path).startsWith('/Library/Managed Preferences/io.podman_desktop')) {
        return;
      }
      throw new Error('ENOENT');
    });

    const plistJson = JSON.stringify({
      'proxy.http': 'http://proxy.corp:8080',
      'telemetry.enabled': false,
    });

    vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, plistJson, '');
      return {} as ReturnType<typeof execFile>;
    });

    const result = await mdmConfiguration.getContent();

    expect(result.enforced).toEqual({
      'proxy.http': 'http://proxy.corp:8080',
      'telemetry.enabled': false,
    });
    expect(result.defaults).toEqual({});
    expect(mdmConfiguration.getTelemetryInfo()).toEqual({ event: 'mdmConfigurationEnabled' });
  });

  test('parses Defaults sub-dict as defaults', async () => {
    vi.mocked(isMac).mockReturnValue(true);

    vi.mocked(access).mockImplementation(async (path: unknown) => {
      if (String(path).startsWith('/Library/Managed Preferences/io.podman_desktop')) {
        return;
      }
      throw new Error('ENOENT');
    });

    const plistJson = JSON.stringify({
      'proxy.http': 'http://proxy.corp:8080',
      Defaults: {
        'proxy.https': 'http://proxy.corp:8443',
        'preferences.OpenDevTools': 'none',
      },
    });

    vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, plistJson, '');
      return {} as ReturnType<typeof execFile>;
    });

    const result = await mdmConfiguration.getContent();

    expect(result.enforced).toEqual({ 'proxy.http': 'http://proxy.corp:8080' });
    expect(result.defaults).toEqual({
      'proxy.https': 'http://proxy.corp:8443',
      'preferences.OpenDevTools': 'none',
    });
  });

  test('device-level plist overrides user-level plist', async () => {
    vi.mocked(isMac).mockReturnValue(true);

    // Both paths exist
    vi.mocked(access).mockResolvedValue(undefined);

    const userPlist = JSON.stringify({ 'proxy.http': 'http://user-proxy:8080' });
    const devicePlist = JSON.stringify({ 'proxy.http': 'http://device-proxy:9090' });

    vi.mocked(execFile).mockImplementation((_cmd, args, callback) => {
      // plutil args: ['-convert', 'json', '-o', '-', '<path>']
      const plistPath = (args as string[])[4];
      const isDeviceLevel = plistPath === '/Library/Managed Preferences/io.podman_desktop.PodmanDesktop.plist';
      const stdout = isDeviceLevel ? devicePlist : userPlist;
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, stdout, '');
      return {} as ReturnType<typeof execFile>;
    });

    const result = await mdmConfiguration.getContent();

    expect(result.enforced['proxy.http']).toBe('http://device-proxy:9090');
  });

  test('handles plutil failure gracefully', async () => {
    vi.mocked(isMac).mockReturnValue(true);

    vi.mocked(access).mockImplementation(async (path: unknown) => {
      if (String(path).startsWith('/Library/Managed Preferences/io.podman_desktop')) {
        return;
      }
      throw new Error('ENOENT');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(new Error('plutil failed'), '', 'error');
      return {} as ReturnType<typeof execFile>;
    });

    const result = await mdmConfiguration.getContent();

    expect(result).toEqual({ enforced: {}, defaults: {} });
    expect(mdmConfiguration.getTelemetryInfo()).toEqual({
      event: 'mdmConfigurationStartupFailed',
      eventProperties: expect.any(Error),
    });
    consoleSpy.mockRestore();
  });

  test('handles malformed JSON from plutil gracefully', async () => {
    vi.mocked(isMac).mockReturnValue(true);

    vi.mocked(access).mockImplementation(async (path: unknown) => {
      if (String(path).startsWith('/Library/Managed Preferences/io.podman_desktop')) {
        return;
      }
      throw new Error('ENOENT');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, 'not valid json', '');
      return {} as ReturnType<typeof execFile>;
    });

    const result = await mdmConfiguration.getContent();

    expect(result).toEqual({ enforced: {}, defaults: {} });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('treats non-object Defaults value as an enforced key', async () => {
    vi.mocked(isMac).mockReturnValue(true);

    vi.mocked(access).mockImplementation(async (path: unknown) => {
      if (String(path).startsWith('/Library/Managed Preferences/io.podman_desktop')) {
        return;
      }
      throw new Error('ENOENT');
    });

    const plistJson = JSON.stringify({
      Defaults: 'not-a-dict',
      'other.key': true,
    });

    vi.mocked(execFile).mockImplementation((_cmd, _args, callback) => {
      (callback as (err: Error | null, stdout: string, stderr: string) => void)(null, plistJson, '');
      return {} as ReturnType<typeof execFile>;
    });

    const result = await mdmConfiguration.getContent();

    expect(result.enforced).toEqual({ Defaults: 'not-a-dict', 'other.key': true });
    expect(result.defaults).toEqual({});
  });
});
