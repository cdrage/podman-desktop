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
import { expect, test } from 'vitest';

import SummarySection from './SummarySection.svelte';

const childContent = createRawSnippet(() => ({
  render: (): string => '<div>Section content</div>',
}));

test('renders title', () => {
  render(SummarySection, { title: 'Details', children: childContent });
  expect(screen.getByText('Details')).toBeInTheDocument();
});

test('renders with section role and aria-label', () => {
  render(SummarySection, { title: 'Details', children: childContent });
  const section = screen.getByRole('region', { name: 'Details' });
  expect(section).toBeInTheDocument();
});

test('shows content when expanded', () => {
  render(SummarySection, { title: 'Details', children: childContent, expanded: true });
  expect(screen.getByText('Section content')).toBeInTheDocument();
});

test('hides content when collapsed', () => {
  render(SummarySection, { title: 'Details', children: childContent, collapsible: true, expanded: false });
  expect(screen.queryByText('Section content')).not.toBeInTheDocument();
});

test('toggles content when collapsible and clicked', async () => {
  render(SummarySection, { title: 'Details', children: childContent, collapsible: true, expanded: true });

  expect(screen.getByText('Section content')).toBeInTheDocument();

  await fireEvent.click(screen.getByText('Details'));
  expect(screen.queryByText('Section content')).not.toBeInTheDocument();

  await fireEvent.click(screen.getByText('Details'));
  expect(screen.getByText('Section content')).toBeInTheDocument();
});

test('does not toggle when not collapsible', async () => {
  render(SummarySection, { title: 'Details', children: childContent, collapsible: false });

  expect(screen.getByText('Section content')).toBeInTheDocument();

  await fireEvent.click(screen.getByText('Details'));
  expect(screen.getByText('Section content')).toBeInTheDocument();
});

test('has aria-expanded attribute when collapsible', () => {
  render(SummarySection, { title: 'Details', children: childContent, collapsible: true, expanded: true });
  const button = screen.getByRole('button', { name: /Details/i });
  expect(button).toHaveAttribute('aria-expanded', 'true');
});

test('does not have aria-expanded when not collapsible', () => {
  render(SummarySection, { title: 'Details', children: childContent, collapsible: false });
  const button = screen.getByRole('button', { name: /Details/i });
  expect(button).not.toHaveAttribute('aria-expanded');
});
