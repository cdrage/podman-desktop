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

import '@testing-library/jest-dom/vitest';

import { render, waitFor } from '@testing-library/svelte';
import { Terminal } from 'ghostty-web';
import { beforeAll, expect, test, vi } from 'vitest';

import ContainerDetailsTtyTerminal from './ContainerDetailsTtyTerminal.svelte';
import type { ContainerInfoUI } from './ContainerInfoUI';

const getConfigurationValueMock = vi.fn();
const attachContainerMock = vi.fn();

beforeAll(() => {
  getConfigurationValueMock.mockImplementation((key: string) => {
    if (key === 'terminal.integrated.scrollback') {
      return 1000;
    }
    return undefined;
  });
  Object.defineProperty(window, 'getConfigurationValue', { value: getConfigurationValueMock });
  Object.defineProperty(window, 'attachContainer', { value: attachContainerMock });
  Object.defineProperty(window, 'attachContainerSend', { value: vi.fn() });
});

test('expect being able to attach terminal ', async () => {
  const container: ContainerInfoUI = {
    id: 'myContainer',
    state: 'RUNNING',
    engineId: 'podman',
  } as unknown as ContainerInfoUI;

  let onDataCallback: (data: Buffer) => void = () => {};

  const sendCallbackId = 12345;
  attachContainerMock.mockImplementation(
    (
      _engineId: string,
      _containerId: string,
      onData: (data: Buffer) => void,
      _onError: (error: string) => void,
      _onEnd: () => void,
    ) => {
      onDataCallback = onData;
      // return a callback id
      return sendCallbackId;
    },
  );

  // render the component with a terminal
  render(ContainerDetailsTtyTerminal, { container });

  // wait attachContainerMock is called
  await waitFor(() => expect(attachContainerMock).toHaveBeenCalled());

  // write some data on the terminal
  onDataCallback(Buffer.from('hello\nworld'));

  // check the terminal received the data
  await waitFor(() => expect(Terminal.prototype.write).toHaveBeenCalledWith('hello\nworld'));

  // check we have called attachContainer
  expect(attachContainerMock).toHaveBeenCalledTimes(1);
});
