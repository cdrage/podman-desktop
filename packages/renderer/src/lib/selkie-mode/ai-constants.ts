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

import type { ContextLevel } from '/@api/selkie-mode-info';

/**
 * Timing constants for AI browser automation.
 * Adjust these values to tune the responsiveness vs reliability trade-off.
 */

// =============================================================================
// DOM SETTLE DETECTION
// Used to wait for the page to stop changing after actions
// =============================================================================

/** How long the DOM must be unchanged to be considered "settled" (ms) */
export const DOM_SETTLE_TIME_MS = 300;

/** Maximum time to wait for DOM to settle (ms) */
export const DOM_SETTLE_TIMEOUT_MS = 3000;

/** Shorter settle time for quick checks (ms) */
export const DOM_SETTLE_TIME_SHORT_MS = 300;

/** Shorter timeout for non-critical waits (ms) */
export const DOM_SETTLE_TIMEOUT_SHORT_MS = 2000;

// =============================================================================
// CLICK ACTIONS
// Wait times after clicking elements
// =============================================================================

/** Initial wait after clicking before checking DOM (ms) */
export const CLICK_WAIT_MS = 500;

/** Initial wait after destructive actions like delete/remove (ms) */
export const CLICK_DESTRUCTIVE_WAIT_MS = 1000;

/** DOM settle time for destructive actions (ms) */
export const CLICK_DESTRUCTIVE_SETTLE_MS = 500;

/** DOM settle timeout for destructive actions (ms) */
export const CLICK_DESTRUCTIVE_TIMEOUT_MS = 5000;

// =============================================================================
// NAVIGATION
// Wait times for page navigation
// =============================================================================

/** Wait after navigation for DOM to settle (ms) */
export const NAVIGATION_SETTLE_MS = 300;

/** Maximum wait after navigation (ms) */
export const NAVIGATION_TIMEOUT_MS = 3000;

// =============================================================================
// INPUT INTERACTIONS
// Delays for form inputs and typing
// =============================================================================

/** Wait after focusing an element (ms) */
export const FOCUS_DELAY_MS = 50;

/** Wait after filling an input field (ms) */
export const INPUT_DELAY_MS = 50;

/** Additional wait after input for async validation (e.g., port availability checks) (ms) */
export const INPUT_VALIDATION_DELAY_MS = 800;

/** Wait after clicking an element (ms) */
export const ELEMENT_CLICK_DELAY_MS = 100;

/** Wait for checkbox toggle (ms) */
export const CHECKBOX_DELAY_MS = 50;

/** Wait for select dropdown change (ms) */
export const SELECT_DELAY_MS = 50;

// =============================================================================
// TERMINAL INTERACTIONS
// Delays for xterm terminal operations
// =============================================================================

/** Wait after focusing terminal (ms) */
export const TERMINAL_FOCUS_DELAY_MS = 100;

/** Wait after pasting text in terminal (ms) */
export const TERMINAL_PASTE_DELAY_MS = 100;

/** Wait after pressing Enter in terminal (ms) */
export const TERMINAL_ENTER_DELAY_MS = 200;

/** Wait before typing in terminal (ms) */
export const TERMINAL_PRE_TYPE_DELAY_MS = 50;

/** Wait for terminal output after executing a command (ms) */
export const TERMINAL_OUTPUT_WAIT_MS = 500;

// =============================================================================
// LOADING & OPERATIONS
// Wait times for async operations
// =============================================================================

/** Initial wait before checking loading state (ms) */
export const LOADING_INITIAL_WAIT_MS = 300;

/** Poll interval when waiting for loading to complete (ms) */
export const LOADING_POLL_INTERVAL_MS = 200;

/** Default timeout for loading complete (ms) */
export const LOADING_DEFAULT_TIMEOUT_MS = 10000;

/** Default timeout for page ready check (ms) */
export const PAGE_READY_TIMEOUT_MS = 5000;

/** Maximum timeout for loading after page ready check (ms) */
export const PAGE_READY_LOADING_TIMEOUT_MS = 3000;

// =============================================================================
// LONG-RUNNING OPERATIONS
// Wait times for operations like image pulls, builds
// =============================================================================

/** Initial wait before checking operation status (ms) */
export const OPERATION_INITIAL_WAIT_MS = 500;

/** Poll interval for operation status (ms) */
export const OPERATION_POLL_INTERVAL_MS = 500;

/** Settle time after operations complete (ms) */
export const OPERATION_SETTLE_MS = 200;

/** Settle timeout after operations (ms) */
export const OPERATION_SETTLE_TIMEOUT_MS = 1000;

// =============================================================================
// ELEMENT FINDING
// Wait times for waiting for elements to appear
// =============================================================================

/** Poll interval when waiting for element (ms) */
export const ELEMENT_WAIT_POLL_MS = 200;

/** Default timeout for waiting for element (ms) */
export const ELEMENT_WAIT_DEFAULT_TIMEOUT_MS = 5000;

// =============================================================================
// PAGE CONTENT
// Limits for page content extraction
// =============================================================================

/**
 * Maximum lines to include in page state summary after actions.
 * Set to 0 for unlimited (return full content).
 */
export const PAGE_STATE_SUMMARY_MAX_LINES = 0;

/**
 * Maximum visible text items to show. These are general page text,
 * less critical than interactive elements. Keep limited to avoid noise.
 */
export const PAGE_CONTENT_MAX_VISIBLE_TEXT = 100;

/**
 * Maximum terminal output lines to show (from the end).
 */
export const PAGE_CONTENT_MAX_TERMINAL_LINES = 50;

/**
 * Maximum Monaco editor lines to show.
 */
export const PAGE_CONTENT_MAX_EDITOR_LINES = 100;

// =============================================================================
// CONTEXT LEVEL LIMITS
// Controls how much conversation history is sent to the AI
// =============================================================================

/**
 * Number of message exchanges (assistant + tool result pairs) to keep
 * for each context level. Lower values reduce token usage but may
 * affect the AI's ability to remember earlier steps.
 *
 * - minimal: Aggressive pruning, keeps only very recent context
 * - standard: Balanced, suitable for most tasks
 * - full: No pruning, keeps entire conversation (highest token usage)
 */
export const CONTEXT_LIMITS: Record<ContextLevel, number> = {
  minimal: 2, // Keep last 2 exchanges (~4 messages) - lowest token usage
  standard: 6, // Keep last 6 exchanges (~12 messages) - balanced
  full: Infinity, // Keep everything - highest token usage
};
