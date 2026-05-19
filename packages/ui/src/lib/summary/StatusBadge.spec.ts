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
import { expect, test } from 'vitest';

import StatusBadge from './StatusBadge.svelte';

test('renders capitalized status text', () => {
  render(StatusBadge, { status: 'running' });
  expect(screen.getByText('Running')).toBeInTheDocument();
});

test('renders with status role', () => {
  render(StatusBadge, { status: 'running' });
  const badge = screen.getByRole('status', { name: /Running status/i });
  expect(badge).toBeInTheDocument();
});

test('handles uppercase status input', () => {
  render(StatusBadge, { status: 'STOPPED' });
  expect(screen.getByText('Stopped')).toBeInTheDocument();
});

test('renders with filled background for running status', () => {
  render(StatusBadge, { status: 'running' });
  const badge = screen.getByRole('status');
  expect(badge.style.cssText).toContain('--pd-status-running');
});

test('renders with outline for stopped status', () => {
  render(StatusBadge, { status: 'stopped' });
  const badge = screen.getByRole('status');
  expect(badge.style.cssText).toContain('border');
  expect(badge.style.cssText).toContain('--pd-status-stopped');
});

test('renders with unknown styling for unrecognized status', () => {
  render(StatusBadge, { status: 'custom-status' });
  const badge = screen.getByRole('status');
  expect(badge.style.cssText).toContain('--pd-status-unknown');
  expect(screen.getByText('Custom-status')).toBeInTheDocument();
});

test('includes a colored dot indicator', () => {
  render(StatusBadge, { status: 'running' });
  const badge = screen.getByRole('status');
  const dot = badge.querySelector('.rounded-full.h-2');
  expect(dot).toBeInTheDocument();
});

test('applies smaller classes for sm size', () => {
  render(StatusBadge, { status: 'running', size: 'sm' });
  const badge = screen.getByRole('status');
  expect(badge).toHaveClass('px-2');
});

test('applies default classes for md size', () => {
  render(StatusBadge, { status: 'running', size: 'md' });
  const badge = screen.getByRole('status');
  expect(badge).toHaveClass('px-2.5');
});
