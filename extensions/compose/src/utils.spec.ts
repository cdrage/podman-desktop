/**********************************************************************
 * Copyright (C) 2023 Red Hat, Inc.
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

import { expect, test, vi, vitest, describe } from 'vitest';
import { makeExecutable, extractVersion, getCliVersion } from './utils';
import { promises } from 'fs';
import * as extensionApi from '@podman-desktop/api';

vi.mock('@podman-desktop/api', async () => {
  return {
    process: {
      exec: vi.fn(),
    },
  };
});

describe('makeExecutable', async () => {
  const fakePath = '/fake/path';
  test('mac', async () => {
    vitest.spyOn(process, 'platform', 'get').mockReturnValue('darwin');

    // fake chmod
    const chmodMock = vi.spyOn(promises, 'chmod');
    chmodMock.mockImplementation(() => Promise.resolve());
    await makeExecutable(fakePath);
    // check it has been called
    expect(chmodMock).toHaveBeenCalledWith(fakePath, 0o755);
  });

  test('linux', async () => {
    vitest.spyOn(process, 'platform', 'get').mockReturnValue('linux');

    // fake chmod
    const chmodMock = vi.spyOn(promises, 'chmod');
    chmodMock.mockImplementation(() => Promise.resolve());
    await makeExecutable(fakePath);
    // check it has been called
    expect(chmodMock).toHaveBeenCalledWith(fakePath, 0o755);
  });

  test('windows', async () => {
    vitest.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    // fake chmod
    const chmodMock = vi.spyOn(promises, 'chmod');
    chmodMock.mockImplementation(() => Promise.resolve());
    await makeExecutable(fakePath);
    // check it has not been called on Windows
    expect(chmodMock).not.toHaveBeenCalled();
  });
});

describe('test extractVersion', async () => {
  test('version with v', async () => {
    const output = `some output
    v1.1.1
    some other output`;
    expect(extractVersion(output)).toEqual('1.1.1');
  });

  test('version without v', async () => {
    const output = `some output
    1.1.1
    some other output`;
    expect(extractVersion(output)).toEqual('1.1.1');
  });

  test('version with hash values', async () => {
    const output = `some output
    1.1.1-rc1
    some other output`;
    expect(extractVersion(output)).toEqual('1.1.1-rc1');
  });

  test('version with alpha in the name', async () => {
    const output = `some output
    1.1.1-alpha
    some other output`;
    expect(extractVersion(output)).toEqual('1.1.1-alpha');
  });
});

describe('getCLIversion', async () => {
  test('test getCliVersion returns the version number', async () => {
    // Return output '1.1.1'
    vi.spyOn(extensionApi.process, 'exec').mockImplementation(
      () =>
        new Promise<extensionApi.RunResult>(resolve => {
          resolve({ stdout: '1.1.1' } as extensionApi.RunResult);
        }),
    );
    const result = await getCliVersion('/fake/path', '--version');
    expect(result).toEqual('1.1.1');
  });
  test('test getCliVersion returns error if process.exec was unable to be ran', async () => {
    vi.spyOn(extensionApi.process, 'exec').mockImplementation(
      () =>
        new Promise<extensionApi.RunResult>((_, reject) => {
          // eslint-disable-next-line prefer-promise-reject-errors
          reject({ exitCode: -1 } as extensionApi.RunError);
        }),
    );

    await expect(getCliVersion('/fake/path', '--version')).rejects.toThrowError();
  });
});
