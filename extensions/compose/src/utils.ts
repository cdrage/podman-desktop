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

import { promises } from 'fs';
import * as extensionApi from '@podman-desktop/api';
import { OS } from './os';

// New OS class
const os = new OS();

export async function makeExecutable(filePath: string): Promise<void> {
  if (os.isLinux() || os.isMac()) {
    await promises.chmod(filePath, 0o755);
  }
}

// Extracts a version from an output string. This is a best-effort attempt to
// extract a version from the output of a command. It is not guaranteed to
// succeed.
export function extractVersion(output: string): string {
  // This regex captures:
  // - A leading "v" (optional)
  // - Major, minor, and patch numbers
  // - Optional suffixes like -alpha, -beta, -rc1, etc.
  const regex = /v?(\d+\.\d+(\.\d+)?(-[a-zA-Z0-9]+)?)/;
  const match = output.match(regex);
  return match ? match[1] : '';
}

// Take in the name, storage path, and help command for a binary and return the version.
// we will check the compose storage folder
export async function getCliVersion(binary: string, helpCommand: string): Promise<string> {
  try {
    const result = await extensionApi.process.exec(binary, [helpCommand]);
    return extractVersion(result.stdout);
  } catch (e) {
    return Promise.reject(e);
  }
}
