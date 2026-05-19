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

import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { expect, test } from 'vitest';

import SummaryGrid from './SummaryGrid.svelte';

const childContent = createRawSnippet(() => ({
  render: (): string => '<div>Child content</div>',
}));

test('renders with region role and aria-label', () => {
  render(SummaryGrid, { children: childContent });
  const region = screen.getByRole('region', { name: 'Summary' });
  expect(region).toBeInTheDocument();
});

test('renders child content', () => {
  render(SummaryGrid, { children: childContent });
  expect(screen.getByText('Child content')).toBeInTheDocument();
});

test('applies custom class', () => {
  render(SummaryGrid, { children: childContent, class: 'my-custom-class' });
  const region = screen.getByRole('region', { name: 'Summary' });
  expect(region).toHaveClass('my-custom-class');
});

test('has layout classes', () => {
  render(SummaryGrid, { children: childContent });
  const region = screen.getByRole('region', { name: 'Summary' });
  expect(region).toHaveClass('h-full', 'overflow-auto', 'p-6');
});
