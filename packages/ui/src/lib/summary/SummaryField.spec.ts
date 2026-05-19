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

import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { beforeEach, expect, test, vi } from 'vitest';

import SummaryField from './SummaryField.svelte';

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

test('renders label and value', () => {
  render(SummaryField, { label: 'Name', value: 'my-container' });
  expect(screen.getByText('Name')).toBeInTheDocument();
  expect(screen.getByText('my-container')).toBeInTheDocument();
});

test('renders "Not set" when no value provided', () => {
  render(SummaryField, { label: 'Command' });
  expect(screen.getByText('Not set')).toBeInTheDocument();
});

test('renders children instead of value', () => {
  const children = createRawSnippet(() => ({
    render: (): string => '<a>Click me</a>',
  }));
  render(SummaryField, { label: 'Link', children });
  expect(screen.getByText('Click me')).toBeInTheDocument();
});

test('applies mono class when mono prop is true', () => {
  render(SummaryField, { label: 'ID', value: 'abc123', mono: true });
  const valueElement = screen.getByText('abc123');
  const valueSpan = valueElement.closest('.font-mono') ?? valueElement.parentElement;
  expect(valueSpan).toHaveClass('font-mono');
});

test('shows copy button on hover when copyable', () => {
  render(SummaryField, { label: 'ID', value: 'abc123', copyable: true });
  const copyButton = screen.getByRole('button', { name: /Copy ID to clipboard/i });
  expect(copyButton).toBeInTheDocument();
});

test('copies value to clipboard when copy button clicked', async () => {
  render(SummaryField, { label: 'ID', value: 'abc123', copyable: true });
  const copyButton = screen.getByRole('button', { name: /Copy ID to clipboard/i });
  await fireEvent.click(copyButton);
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abc123');
});

test('does not show copy button when not copyable', () => {
  render(SummaryField, { label: 'Name', value: 'my-container' });
  expect(screen.queryByRole('button', { name: /Copy/i })).not.toBeInTheDocument();
});

test('has aria-label matching the field label', () => {
  render(SummaryField, { label: 'Engine ID', value: 'abc' });
  const field = screen.getByLabelText('Engine ID');
  expect(field).toBeInTheDocument();
});
