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

import { createRequire } from 'node:module';

import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
interface Manifest {
  dependencies: Record<string, string>;
}

const mainPackage = require('../package.json') as Manifest;
const appPackage = require('../../../package.json') as Manifest;

test('ships the external host terminal dependency in the packaged app', () => {
  // Electron Builder collects runtime dependencies from the root application manifest.
  expect(appPackage.dependencies).toHaveProperty('node-pty', mainPackage.dependencies['node-pty']);
});
