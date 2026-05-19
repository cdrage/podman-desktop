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
import { expect, test } from 'vitest';

import LabelGroup from './LabelGroup.svelte';

test('renders all labels as pills', () => {
  const labels = { app: 'web', env: 'prod', tier: 'frontend' };
  render(LabelGroup, { labels });

  expect(screen.getByLabelText('app=web')).toBeInTheDocument();
  expect(screen.getByLabelText('env=prod')).toBeInTheDocument();
  expect(screen.getByLabelText('tier=frontend')).toBeInTheDocument();
});

test('renders empty when no labels', () => {
  const { container } = render(LabelGroup, { labels: {} });
  const pills = container.querySelectorAll('[aria-label]');
  expect(pills).toHaveLength(0);
});

test('shows all labels when collapsible is false', () => {
  const labels: Record<string, string> = {};
  for (let i = 0; i < 10; i++) {
    labels[`key${i}`] = `value${i}`;
  }
  render(LabelGroup, { labels, collapsible: false });

  for (let i = 0; i < 10; i++) {
    expect(screen.getByLabelText(`key${i}=value${i}`)).toBeInTheDocument();
  }
});

test('truncates labels when collapsible and exceeds maxVisible', () => {
  const labels: Record<string, string> = {};
  for (let i = 0; i < 8; i++) {
    labels[`key${i}`] = `value${i}`;
  }
  render(LabelGroup, { labels, collapsible: true, maxVisible: 3 });

  expect(screen.getByLabelText('key0=value0')).toBeInTheDocument();
  expect(screen.getByLabelText('key1=value1')).toBeInTheDocument();
  expect(screen.getByLabelText('key2=value2')).toBeInTheDocument();
  expect(screen.queryByLabelText('key3=value3')).not.toBeInTheDocument();
  expect(screen.getByText('+5 more')).toBeInTheDocument();
});

test('expands all labels when "more" button is clicked', async () => {
  const labels: Record<string, string> = {};
  for (let i = 0; i < 8; i++) {
    labels[`key${i}`] = `value${i}`;
  }
  render(LabelGroup, { labels, collapsible: true, maxVisible: 3 });

  await fireEvent.click(screen.getByText('+5 more'));

  for (let i = 0; i < 8; i++) {
    expect(screen.getByLabelText(`key${i}=value${i}`)).toBeInTheDocument();
  }
  expect(screen.getByText('Show less')).toBeInTheDocument();
});

test('does not show toggle button when labels are within maxVisible', () => {
  const labels = { a: '1', b: '2' };
  render(LabelGroup, { labels, collapsible: true, maxVisible: 5 });
  expect(screen.queryByText(/more/)).not.toBeInTheDocument();
});
