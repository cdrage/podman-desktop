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
import { expect, test, vi } from 'vitest';

import FormattedDate from './FormattedDate.svelte';

vi.mock(import('humanize-duration'), () => ({
  default: vi.fn((ms: number): string => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.round(minutes / 60);
    return `${hours} hours`;
  }),
}));

test('renders a formatted date', () => {
  const date = new Date('2025-06-15T14:30:00Z');
  render(FormattedDate, { date });
  const timeEl = screen.getByRole('time');
  expect(timeEl).toBeInTheDocument();
  expect(timeEl).toHaveAttribute('datetime', date.toISOString());
});

test('renders relative time when relative is true', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-06-15T15:30:00Z'));

  render(FormattedDate, { date: '2025-06-15T14:30:00Z', relative: true });
  const timeEl = screen.getByRole('time');
  expect(timeEl.textContent).toContain('ago');

  vi.useRealTimers();
});

test('handles Date object input', () => {
  const date = new Date('2025-01-01T00:00:00Z');
  render(FormattedDate, { date });
  const timeEl = screen.getByRole('time');
  expect(timeEl).toBeInTheDocument();
});

test('handles string input', () => {
  render(FormattedDate, { date: '2025-06-15T14:30:00Z' });
  const timeEl = screen.getByRole('time');
  expect(timeEl).toBeInTheDocument();
});

test('handles number (timestamp) input', () => {
  render(FormattedDate, { date: 1750000000000 });
  const timeEl = screen.getByRole('time');
  expect(timeEl).toBeInTheDocument();
});

test('shows "Invalid date" for invalid input', () => {
  render(FormattedDate, { date: 'not-a-date' });
  expect(screen.getByText('Invalid date')).toBeInTheDocument();
  expect(screen.queryByRole('time')).not.toBeInTheDocument();
});

test('shows "just now" for very recent relative dates', () => {
  vi.useFakeTimers();
  const now = new Date('2025-06-15T15:30:00Z');
  vi.setSystemTime(now);

  render(FormattedDate, { date: now, relative: true });
  expect(screen.getByText('just now')).toBeInTheDocument();

  vi.useRealTimers();
});
