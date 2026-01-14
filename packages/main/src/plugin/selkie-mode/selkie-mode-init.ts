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

import { inject, injectable } from 'inversify';

import { type IConfigurationNode, IConfigurationRegistry } from '/@api/configuration/models.js';

export const SELKIE_MODE_SETTINGS = {
  SectionName: 'selkie.mode',
  Enabled: 'enabled',
  ApiEndpoint: 'apiEndpoint',
  ApiKey: 'apiKey',
  Model: 'model',
  ConfirmDestructive: 'confirmDestructive',
  MaxTokens: 'maxTokens',
  MaxSteps: 'maxSteps',
  ContextLevel: 'contextLevel',
} as const;

@injectable()
export class SelkieModeInit {
  constructor(@inject(IConfigurationRegistry) private configurationRegistry: IConfigurationRegistry) {}

  init(): void {
    const selkieModeConfiguration: IConfigurationNode = {
      id: 'preferences.selkie.mode',
      title: 'Selkie Mode',
      type: 'object',
      properties: {
        [`${SELKIE_MODE_SETTINGS.SectionName}.${SELKIE_MODE_SETTINGS.Enabled}`]: {
          description: 'Enable Selkie Mode (Ctrl+Shift+A)',
          type: 'boolean',
          default: false,
        },
        [`${SELKIE_MODE_SETTINGS.SectionName}.${SELKIE_MODE_SETTINGS.ApiEndpoint}`]: {
          description: 'OpenAI-compatible API endpoint',
          type: 'string',
          default: 'https://openrouter.ai/api/v1',
          placeholder: 'https://openrouter.ai/api/v1',
        },
        [`${SELKIE_MODE_SETTINGS.SectionName}.${SELKIE_MODE_SETTINGS.ApiKey}`]: {
          description: 'API key for authentication',
          type: 'string',
          format: 'password',
          default: '',
          placeholder: 'sk-or-...',
        },
        [`${SELKIE_MODE_SETTINGS.SectionName}.${SELKIE_MODE_SETTINGS.Model}`]: {
          description: 'Model name (e.g., anthropic/claude-sonnet-4)',
          type: 'string',
          default: 'anthropic/claude-sonnet-4',
          placeholder: 'anthropic/claude-sonnet-4',
        },
        [`${SELKIE_MODE_SETTINGS.SectionName}.${SELKIE_MODE_SETTINGS.ConfirmDestructive}`]: {
          description: 'Confirm before destructive operations',
          type: 'boolean',
          default: true,
        },
        [`${SELKIE_MODE_SETTINGS.SectionName}.${SELKIE_MODE_SETTINGS.MaxTokens}`]: {
          description: 'Maximum tokens for AI responses',
          type: 'number',
          default: 4096,
          minimum: 256,
          maximum: 32768,
        },
        [`${SELKIE_MODE_SETTINGS.SectionName}.${SELKIE_MODE_SETTINGS.MaxSteps}`]: {
          description: 'Maximum steps per task',
          type: 'number',
          default: 30,
          minimum: 5,
          maximum: 100,
        },
        [`${SELKIE_MODE_SETTINGS.SectionName}.${SELKIE_MODE_SETTINGS.ContextLevel}`]: {
          description: 'Conversation history size (minimal/standard/full)',
          type: 'string',
          enum: ['minimal', 'standard', 'full'],
          default: 'standard',
        },
      },
    };

    this.configurationRegistry.registerConfigurations([selkieModeConfiguration]);
  }
}
