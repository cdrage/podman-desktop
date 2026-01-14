/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import { writable } from 'svelte/store';

import type { ChatMessage, SelkieModeConfig } from '/@api/selkie-mode-info';

export const selkieModeMessages = writable<ChatMessage[]>([]);
export const selkieModeLoading = writable<boolean>(false);
export const selkieModeEnabled = writable<boolean>(false);
export const selkieModeConfig = writable<SelkieModeConfig | null>(null);

export function generateMessageId(): string {
  // eslint-disable-next-line sonarjs/pseudo-random -- safe for generating non-security-sensitive message IDs
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
  const fullMessage: ChatMessage = {
    ...message,
    id: generateMessageId(),
    timestamp: Date.now(),
  };
  selkieModeMessages.update(messages => [...messages, fullMessage]);
  return fullMessage;
}

export function updateLastAssistantMessage(content: string): void {
  selkieModeMessages.update(messages => {
    const lastIndex = messages.length - 1;
    if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
      const updated = [...messages];
      updated[lastIndex] = { ...updated[lastIndex], content };
      return updated;
    }
    return messages;
  });
}

export function clearMessages(): void {
  selkieModeMessages.set([]);
}
