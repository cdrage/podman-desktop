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

import { get } from 'svelte/store';
import { router } from 'tinro';

import {
  CHECKBOX_DELAY_MS,
  DOM_SETTLE_TIME_MS,
  ELEMENT_CLICK_DELAY_MS,
  ELEMENT_WAIT_DEFAULT_TIMEOUT_MS,
  ELEMENT_WAIT_POLL_MS,
  INPUT_DELAY_MS,
  LOADING_DEFAULT_TIMEOUT_MS,
  LOADING_INITIAL_WAIT_MS,
  LOADING_POLL_INTERVAL_MS,
  OPERATION_INITIAL_WAIT_MS,
  OPERATION_POLL_INTERVAL_MS,
  OPERATION_SETTLE_MS,
  OPERATION_SETTLE_TIMEOUT_MS,
  PAGE_CONTENT_MAX_EDITOR_LINES,
  PAGE_CONTENT_MAX_TERMINAL_LINES,
  PAGE_CONTENT_MAX_VISIBLE_TEXT,
  PAGE_READY_LOADING_TIMEOUT_MS,
  PAGE_READY_TIMEOUT_MS,
  SELECT_DELAY_MS,
  TERMINAL_ENTER_DELAY_MS,
  TERMINAL_FOCUS_DELAY_MS,
  TERMINAL_PASTE_DELAY_MS,
  TERMINAL_PRE_TYPE_DELAY_MS,
} from './ai-constants';

/**
 * Represents a simplified view of an interactive element on the page
 */
export interface PageElement {
  type: 'button' | 'link' | 'input' | 'select' | 'checkbox' | 'text' | 'heading' | 'tab' | 'menu-item' | 'option';
  text: string;
  selector: string;
  enabled: boolean;
  visible: boolean;
  value?: string;
  placeholder?: string;
  options?: string[]; // For select elements
  checked?: boolean; // For checkboxes
  ariaLabel?: string;
}

/**
 * Represents the current page state
 */
export interface PageState {
  route: string;
  title: string;
  elements: PageElement[];
  notifications: string[];
  loadingIndicators: string[];
  validationErrors: string[]; // Form validation errors
  visibleText: string[]; // All visible text on the page
}

/**
 * Get a unique CSS selector for an element
 */
function getSelector(element: Element): string {
  // Try ID first
  if (element.id) {
    return `#${element.id}`;
  }

  // Try data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  // Try aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return `[aria-label="${ariaLabel}"]`;
  }

  // Build a path using tag name and position
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    // Add class if available
    if (current.className && typeof current.className === 'string') {
      const mainClass = current.className.split(' ').find(c => c && !c.startsWith('svelte-'));
      if (mainClass) {
        selector += `.${mainClass}`;
      }
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Check if an element should be ignored by AI (e.g., the Selkie Mode UI itself)
 */
function shouldIgnoreElement(element: Element): boolean {
  // Ignore elements within the Selkie Mode modal
  if (element.closest('[data-ai-ignore]')) {
    return true;
  }
  // Ignore the Selkie Mode modal itself
  if (element.closest('.selkie-mode-modal') || element.closest('.selkie-mode-steps')) {
    return true;
  }
  return false;
}

/**
 * Check if an element is visible
 */
function isVisible(element: Element): boolean {
  // First check if we should ignore this element
  if (shouldIgnoreElement(element)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/**
 * Get the visible text content of an element
 */
function getVisibleText(element: Element): string {
  // For input elements, get value or placeholder
  if (element instanceof HTMLInputElement) {
    return element.value ? element.value : (element.placeholder ?? '');
  }
  if (element instanceof HTMLSelectElement) {
    return element.options[element.selectedIndex]?.text ?? '';
  }

  // Get text content, but only direct text (not nested)
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent?.trim() ?? '';
    }
  }

  // If no direct text, try innerText (limited)
  if (!text) {
    text = (element as HTMLElement).innerText?.substring(0, 100) ?? '';
  }

  return text.trim();
}

/**
 * Get first non-empty string from args, or empty string
 */
function firstNonEmpty(...args: string[]): string {
  for (const arg of args) {
    if (arg) return arg;
  }
  return '';
}

/**
 * Extract interactive elements from the page
 */
function extractElements(): PageElement[] {
  const elements: PageElement[] = [];
  const seen = new Set<string>();

  // Helper to add element if not duplicate
  const addElement = (el: PageElement): void => {
    const key = `${el.type}:${el.text}:${el.selector}`;
    if (!seen.has(key) && el.text) {
      seen.add(key);
      elements.push(el);
    }
  };

  // Buttons
  document.querySelectorAll('button').forEach(btn => {
    if (!isVisible(btn)) return;
    const text = firstNonEmpty(
      getVisibleText(btn),
      btn.getAttribute('aria-label') ?? '',
      btn.getAttribute('title') ?? '',
    );
    addElement({
      type: 'button',
      text: text.substring(0, 50),
      selector: getSelector(btn),
      enabled: !btn.disabled,
      visible: true,
      ariaLabel: btn.getAttribute('aria-label') ?? undefined,
    });
  });

  // Links
  document.querySelectorAll('a[href]').forEach(link => {
    if (!isVisible(link)) return;
    const text = firstNonEmpty(getVisibleText(link), link.getAttribute('aria-label') ?? '');
    addElement({
      type: 'link',
      text: text.substring(0, 50),
      selector: getSelector(link),
      enabled: true,
      visible: true,
      ariaLabel: link.getAttribute('aria-label') ?? undefined,
    });
  });

  // Input fields (non-checkbox)
  document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"])').forEach(input => {
    if (!isVisible(input)) return;
    const inp = input as HTMLInputElement;
    const label = document.querySelector(`label[for="${inp.id}"]`)?.textContent?.trim() ?? '';
    const placeholder = inp.placeholder ?? '';
    const ariaLabel = inp.getAttribute('aria-label') ?? '';

    addElement({
      type: 'input',
      text: firstNonEmpty(label, ariaLabel, placeholder, inp.name),
      selector: getSelector(inp),
      enabled: !inp.disabled,
      visible: true,
      value: inp.value,
      placeholder: placeholder,
    });
  });

  // Checkboxes - handle separately because custom checkboxes often hide the actual input
  // (e.g., opacity-0, 1px size) while still being interactable via aria-label
  document.querySelectorAll('input[type="checkbox"]').forEach(input => {
    const inp = input as HTMLInputElement;
    // Skip if truly hidden (display:none) or in ignored container
    const style = window.getComputedStyle(inp);
    if (style.display === 'none' || shouldIgnoreElement(inp)) return;

    const label = document.querySelector(`label[for="${inp.id}"]`)?.textContent?.trim() ?? '';
    const ariaLabel = inp.getAttribute('aria-label') ?? '';
    const placeholder = inp.placeholder ?? '';
    const text = firstNonEmpty(label, ariaLabel, placeholder);

    // Skip checkboxes with no identifiable label
    if (!text) return;

    addElement({
      type: 'checkbox',
      text,
      selector: getSelector(inp),
      enabled: !inp.disabled,
      visible: true,
      checked: inp.checked,
    });
  });

  // Select dropdowns
  document.querySelectorAll('select').forEach(select => {
    if (!isVisible(select)) return;
    const sel = select as HTMLSelectElement;
    const label = document.querySelector(`label[for="${sel.id}"]`)?.textContent?.trim() ?? '';
    const options = Array.from(sel.options).map(o => o.text);

    addElement({
      type: 'select',
      text: firstNonEmpty(label, sel.name),
      selector: getSelector(sel),
      enabled: !sel.disabled,
      visible: true,
      value: sel.value,
      options: options,
    });
  });

  // Headings (for context)
  document.querySelectorAll('h1, h2, h3').forEach(heading => {
    if (!isVisible(heading)) return;
    const text = getVisibleText(heading);
    if (text) {
      addElement({
        type: 'heading',
        text: text.substring(0, 100),
        selector: getSelector(heading),
        enabled: true,
        visible: true,
      });
    }
  });

  // Navigation/sidebar items - look for nav items
  document.querySelectorAll('[role="menuitem"], [role="tab"], .nav-item, nav a, nav button').forEach(item => {
    if (!isVisible(item)) return;
    const text = firstNonEmpty(getVisibleText(item), item.getAttribute('aria-label') ?? '');
    if (text) {
      addElement({
        type: 'menu-item',
        text: text.substring(0, 50),
        selector: getSelector(item),
        enabled: !(item as HTMLButtonElement).disabled,
        visible: true,
      });
    }
  });

  // Tabs
  document.querySelectorAll('[role="tab"]').forEach(tab => {
    if (!isVisible(tab)) return;
    const text = firstNonEmpty(getVisibleText(tab), tab.getAttribute('aria-label') ?? '');
    addElement({
      type: 'tab',
      text: text.substring(0, 50),
      selector: getSelector(tab),
      enabled: true,
      visible: true,
    });
  });

  // Dropdown options (custom dropdowns with role="option")
  document.querySelectorAll('[role="option"]').forEach(option => {
    if (!isVisible(option)) return;
    const text = firstNonEmpty(getVisibleText(option), option.getAttribute('aria-label') ?? '');
    const isSelected = option.getAttribute('aria-selected') === 'true';
    if (text) {
      addElement({
        type: 'option',
        text: text.substring(0, 50),
        selector: getSelector(option),
        enabled: !(option as HTMLButtonElement).disabled,
        visible: true,
        checked: isSelected,
      });
    }
  });

  return elements;
}

/**
 * Extract text content from Monaco editor if present
 */
function getMonacoEditorContent(): string | null {
  try {
    // Monaco editors have a data attribute or class we can look for
    const monacoContainer = document.querySelector('.monaco-editor');
    if (!monacoContainer || !isVisible(monacoContainer)) return null;

    // Try to get content from Monaco's view lines
    const viewLines = monacoContainer.querySelectorAll('.view-line');
    if (viewLines.length > 0) {
      const lines: string[] = [];
      viewLines.forEach(line => {
        const text = (line as HTMLElement).textContent?.trim();
        if (text) {
          lines.push(text);
        }
      });
      if (lines.length > 0) {
        // Limit to first N lines (0 = unlimited)
        const output = PAGE_CONTENT_MAX_EDITOR_LINES > 0 ? lines.slice(0, PAGE_CONTENT_MAX_EDITOR_LINES) : lines;
        return output.join('\n');
      }
    }

    // Alternative: try to find the model content via Monaco's internal API
    // Monaco stores instances on the container element
    const editorElement = monacoContainer.closest('[data-mode-id]') ?? monacoContainer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monacoInstance = (editorElement as any)._modelData?.model;
    if (monacoInstance?.getValue) {
      const content = monacoInstance.getValue();
      // Limit content (0 = unlimited). Convert line limit to approximate char limit (80 chars/line)
      if (PAGE_CONTENT_MAX_EDITOR_LINES > 0) {
        const maxChars = PAGE_CONTENT_MAX_EDITOR_LINES * 80;
        return content.substring(0, maxChars);
      }
      return content;
    }
  } catch {
    // Monaco access failed, continue without it
  }
  return null;
}

/**
 * Extract text content from xterm terminal if present
 */
function getXtermContent(): string | null {
  try {
    const xtermContainer = document.querySelector('.xterm');
    if (!xtermContainer || !isVisible(xtermContainer)) return null;

    // xterm renders to canvas, but also maintains a buffer we can try to access
    // The Terminal instance might be stored on the element
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const terminalInstance = (xtermContainer as any)._terminal ?? (xtermContainer as any).terminal;
    if (terminalInstance?.buffer?.active) {
      const buffer = terminalInstance.buffer.active;
      const lines: string[] = [];
      // Get the last N lines of terminal output (0 = unlimited, get all)
      const linesToGet =
        PAGE_CONTENT_MAX_TERMINAL_LINES > 0 ? PAGE_CONTENT_MAX_TERMINAL_LINES : buffer.baseY + buffer.cursorY + 1;
      const startLine = Math.max(0, buffer.baseY + buffer.cursorY - linesToGet + 1);
      for (let i = startLine; i <= buffer.baseY + buffer.cursorY; i++) {
        const line = buffer.getLine(i);
        if (line) {
          const text = line.translateToString(true).trim();
          if (text) {
            lines.push(text);
          }
        }
      }
      if (lines.length > 0) {
        return lines.join('\n');
      }
    }

    // Fallback: try to get text from xterm's screen element
    // xterm renders spans for each row
    const rows = xtermContainer.querySelectorAll('.xterm-rows > div');
    if (rows.length > 0) {
      const lines: string[] = [];
      rows.forEach(row => {
        const text = (row as HTMLElement).textContent?.trim();
        if (text) {
          lines.push(text);
        }
      });
      if (lines.length > 0) {
        // Get last N lines (0 = unlimited)
        const output = PAGE_CONTENT_MAX_TERMINAL_LINES > 0 ? lines.slice(-PAGE_CONTENT_MAX_TERMINAL_LINES) : lines;
        return output.join('\n');
      }
    }
  } catch {
    // xterm access failed, continue without it
  }
  return null;
}

/**
 * Check if text is dynamic content that changes frequently (timestamps, ages, etc.)
 * These should be filtered out to prevent unnecessary AI confusion about "changes"
 */
function isDynamicContent(text: string): boolean {
  const trimmed = text.trim();

  // Short time patterns: "2m", "5s", "1h", "3d"
  if (/^\d+[smhdwy]$/i.test(trimmed)) return true;

  // Time ago with time units: "5 seconds ago", "2 minutes ago", "3 hours ago"
  if (/^\d+\s*(seconds?|minutes?|hours?)\s*(ago)?$/i.test(trimmed)) return true;

  // Time ago with date units: "2 days ago", "3 weeks ago", "1 year ago"
  if (/^\d+\s*(days?|weeks?|months?|years?)\s*(ago)?$/i.test(trimmed)) return true;

  // Time ago with short units: "5s ago", "2m ago"
  if (/^\d+\s*(secs?|mins?|hrs?)\s*(ago)?$/i.test(trimmed)) return true;

  // Relative time: "just now", "a moment ago", "recently"
  if (/^(just now|a moment ago|recently|a few .* ago)$/i.test(trimmed)) return true;

  // Timestamps: "12:34:56", "12:34 AM"
  if (/^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i.test(trimmed)) return true;

  // ISO dates: "2024-01-15"
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return true;

  // Age format: "Age: 5m", "Created 2h ago"
  if (/^(age|created|updated|started|running):\s*\d+/i.test(trimmed)) return true;

  // Duration: "00:05:23"
  if (/^\d+:\d{2}:\d{2}$/.test(trimmed)) return true;

  // Duration: "5m 23s", "1h 30m"
  if (/^\d+[hm]\s*\d+[ms]$/i.test(trimmed)) return true;

  // Pure numbers that are likely counters/stats
  if (/^[\d,]+$/.test(trimmed)) return true;

  return false;
}

/**
 * Get all visible text content on the page (for context)
 */
function getVisiblePageText(): string[] {
  const texts: string[] = [];
  const seen = new Set<string>();

  // Get the main content area (skip nav, header, footer if possible)
  const mainContent = document.querySelector('main, [role="main"], .main-content') ?? document.body;

  // Walk through all text-containing elements
  const walker = document.createTreeWalker(mainContent, NodeFilter.SHOW_TEXT, {
    acceptNode: (node): number => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;

      // Skip hidden elements and AI modal
      if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
      if (shouldIgnoreElement(parent)) return NodeFilter.FILTER_REJECT;

      // Skip script, style, etc.
      const tag = parent.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'svg', 'path'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }

      // Skip Monaco editor elements (we handle these separately)
      if (parent.closest('.monaco-editor')) {
        return NodeFilter.FILTER_REJECT;
      }

      // Skip xterm elements (we handle these separately)
      if (parent.closest('.xterm')) {
        return NodeFilter.FILTER_REJECT;
      }

      const text = node.textContent?.trim();
      if (!text || text.length < 3) return NodeFilter.FILTER_REJECT;

      // Skip dynamic content like timestamps
      if (isDynamicContent(text)) return NodeFilter.FILTER_REJECT;

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text && !seen.has(text) && text.length >= 3 && text.length <= 200 && !isDynamicContent(text)) {
      seen.add(text);
      texts.push(text);
    }
  }

  return PAGE_CONTENT_MAX_VISIBLE_TEXT > 0 ? texts.slice(0, PAGE_CONTENT_MAX_VISIBLE_TEXT) : texts;
}

/**
 * Get current notifications/toasts
 */
function getNotifications(): string[] {
  const notifications: string[] = [];

  // Look for alert elements
  document.querySelectorAll('[role="alert"], .toast, .notification, .snackbar').forEach(notif => {
    if (!isVisible(notif)) return;
    const text = (notif as HTMLElement).innerText?.trim();
    if (text) {
      notifications.push(text.substring(0, 200));
    }
  });

  return notifications;
}

/**
 * Get loading indicators - be careful to avoid false positives
 */
function getLoadingIndicators(): string[] {
  const indicators: string[] = [];

  // Only look for explicit loading states, not just any spinning icon
  // Check for aria-busy which is a reliable loading indicator
  document.querySelectorAll('[aria-busy="true"]').forEach(el => {
    if (!isVisible(el)) return;
    const text = (el as HTMLElement).innerText?.trim();
    if (text) {
      indicators.push(text.substring(0, 100));
    }
  });

  // Check for elements with "loading" class that are visible and have content
  document.querySelectorAll('.loading').forEach(el => {
    if (!isVisible(el)) return;
    const text = (el as HTMLElement).innerText?.trim();
    if (text?.toLowerCase().includes('loading')) {
      indicators.push(text.substring(0, 100));
    }
  });

  // Check for progress elements
  document.querySelectorAll('progress:not([value="100"])').forEach(el => {
    if (!isVisible(el)) return;
    indicators.push('Progress bar active');
  });

  return indicators;
}

/**
 * Get validation errors from form inputs
 */
function getValidationErrors(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  // Look for error text spans from Input components
  // These use Tailwind classes with CSS variables like text-[color:var(--pd-input-field-error-text)]
  // The class string contains "error-text" or "state-error"
  document
    .querySelectorAll('[class*="error-text"], [class*="state-error"], [class*="input-field-error"]')
    .forEach(el => {
      if (!isVisible(el)) return;
      const text = (el as HTMLElement).innerText?.trim();
      if (text && text.length > 2 && !seen.has(text)) {
        seen.add(text);
        errors.push(text);
      }
    });

  // Look for sibling error spans after input wrapper divs (Input.svelte pattern)
  // Input.svelte structure: div.flex.flex-col > div (input wrapper) + span (error text)
  document.querySelectorAll('div.flex.flex-col > span').forEach(span => {
    if (!isVisible(span)) return;
    // Check if this span has error styling (red text)
    const computedColor = window.getComputedStyle(span).color;
    // Red colors typically have high R, low G and B
    const isRed =
      computedColor.includes('rgb') &&
      ((): boolean => {
        const rgbRegex = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/;
        const match = rgbRegex.exec(computedColor);
        if (match) {
          const [, r, g, b] = match.map(Number);
          return r > 150 && g < 100 && b < 100;
        }
        return false;
      })();

    if (isRed) {
      const text = (span as HTMLElement).innerText?.trim();
      if (text && text.length > 2 && !seen.has(text)) {
        seen.add(text);
        // Try to find the associated input label
        const wrapper = span.previousElementSibling;
        const input = wrapper?.querySelector('input, textarea');
        const label = input?.getAttribute('aria-label') ?? input?.getAttribute('placeholder') ?? '';
        errors.push(label ? `${label}: ${text}` : text);
      }
    }
  });

  // Look for inputs with aria-invalid="true" and find their associated error messages
  document.querySelectorAll('[aria-invalid="true"], input:invalid').forEach(input => {
    if (!isVisible(input)) return;
    const parent = input.closest('div, label, fieldset');
    if (parent) {
      // Look for error text near the input
      const errorSpan = parent.querySelector('[class*="error"], [role="alert"]');
      if (errorSpan) {
        const text = (errorSpan as HTMLElement).innerText?.trim();
        if (text && text.length > 2 && !seen.has(text)) {
          seen.add(text);
          // Try to get the input label for context
          const label =
            input.getAttribute('aria-label') ??
            parent.querySelector('label')?.innerText?.trim() ??
            input.getAttribute('placeholder') ??
            '';
          errors.push(label ? `${label}: ${text}` : text);
        }
      }
    }
  });

  // Look for ErrorMessage components (role="alert" with aria-label containing "error")
  document.querySelectorAll('[role="alert"]').forEach(el => {
    if (!isVisible(el)) return;
    // Skip notifications/toasts - they're usually in a different container
    if (el.closest('.toast, .notification, .snackbar, [class*="toast"], [class*="notification"]')) return;

    const text = (el as HTMLElement).innerText?.trim();
    if (text && text.length > 2 && !seen.has(text)) {
      seen.add(text);
      errors.push(text);
    }
  });

  return errors;
}

/**
 * Get the current page state - simplified view for AI
 */
export function getPageContent(): PageState {
  const title =
    document.querySelector('h1')?.innerText ??
    document.querySelector('h2')?.innerText ??
    document.title ??
    'Unknown Page';

  return {
    route: get(router).path ?? window.location.pathname,
    title: title.substring(0, 100),
    elements: extractElements(),
    notifications: getNotifications(),
    loadingIndicators: getLoadingIndicators(),
    validationErrors: getValidationErrors(),
    visibleText: getVisiblePageText(),
  };
}

/**
 * Get a simplified text representation of the page for AI
 */
export function getPageContentAsText(): string {
  const state = getPageContent();
  const lines: string[] = [];

  lines.push(`📍 Current Route: ${state.route}`);
  lines.push(`📄 Page Title: ${state.title}`);
  lines.push('');

  // Show validation errors prominently at the top so AI sees them
  if (state.validationErrors.length > 0) {
    lines.push('⚠️ VALIDATION ERRORS:');
    state.validationErrors.forEach(e => lines.push(`  ❌ ${e}`));
    lines.push('');
  }

  // Notifications near top - these are important feedback after actions
  if (state.notifications.length > 0) {
    lines.push('🔔 Notifications:');
    state.notifications.forEach(n => lines.push(`  - ${n}`));
    lines.push('');
  }

  // Loading indicators near top - important to know if operations are in progress
  if (state.loadingIndicators.length > 0) {
    lines.push('⏳ Loading:');
    state.loadingIndicators.forEach(l => lines.push(`  - ${l}`));
    lines.push('');
  }

  // Group elements by type
  const byType = new Map<string, PageElement[]>();
  for (const el of state.elements) {
    const arr = byType.get(el.type) ?? [];
    arr.push(el);
    byType.set(el.type, arr);
  }

  // Headings first for context
  const headings = byType.get('heading') ?? [];
  if (headings.length > 0) {
    lines.push('📋 Sections:');
    headings.forEach(h => lines.push(`  - ${h.text}`));
    lines.push('');
  }

  // Navigation/menu items
  const menuItems = byType.get('menu-item') ?? [];
  if (menuItems.length > 0) {
    lines.push('🧭 Navigation:');
    menuItems.forEach(m => lines.push(`  - "${m.text}"`));
    lines.push('');
  }

  // Buttons
  const buttons = byType.get('button') ?? [];
  if (buttons.length > 0) {
    lines.push('🔘 Buttons:');
    buttons.forEach(b => {
      const status = b.enabled ? '' : ' (disabled)';
      // Show aria-label if different from text (helps distinguish similar buttons)
      const ariaInfo = b.ariaLabel && b.ariaLabel !== b.text ? ` [aria-label: "${b.ariaLabel}"]` : '';
      lines.push(`  - "${b.text}"${ariaInfo}${status}`);
    });
    lines.push('');
  }

  // Input fields
  const inputs = byType.get('input') ?? [];
  if (inputs.length > 0) {
    lines.push('📝 Input Fields:');
    inputs.forEach(i => {
      const value = i.value ? ` = "${i.value}"` : '';
      const placeholder = i.placeholder ? ` (placeholder: "${i.placeholder}")` : '';
      lines.push(`  - "${i.text}"${value}${placeholder}`);
    });
    lines.push('');
  }

  // Checkboxes
  const checkboxes = byType.get('checkbox') ?? [];
  if (checkboxes.length > 0) {
    lines.push('☑️ Checkboxes:');
    checkboxes.forEach(c => {
      const checked = c.checked ? ' ✓' : ' ○';
      lines.push(`  - "${c.text}"${checked}`);
    });
    lines.push('');
  }

  // Select dropdowns
  const selects = byType.get('select') ?? [];
  if (selects.length > 0) {
    lines.push('📋 Dropdowns:');
    selects.forEach(s => {
      const options = s.options?.join(', ') ?? '';
      lines.push(`  - "${s.text}" = "${s.value}" [${options}]`);
    });
    lines.push('');
  }

  // Tabs
  const tabs = byType.get('tab') ?? [];
  if (tabs.length > 0) {
    lines.push('📑 Tabs:');
    tabs.forEach(t => lines.push(`  - "${t.text}"`));
    lines.push('');
  }

  // Dropdown options (when a dropdown is open)
  const options = byType.get('option') ?? [];
  if (options.length > 0) {
    lines.push('📋 Dropdown Options:');
    options.forEach(o => {
      const selected = o.checked ? ' ✓' : '';
      lines.push(`  - "${o.text}"${selected}`);
    });
    lines.push('');
  }

  // Links
  const links = byType.get('link') ?? [];
  if (links.length > 0) {
    lines.push('🔗 Links:');
    links.forEach(l => lines.push(`  - "${l.text}"`));
    lines.push('');
  }

  // All visible text on page (includes error messages, labels, etc.)
  if (state.visibleText.length > 0) {
    lines.push('📄 Page Text:');
    state.visibleText.forEach(t => lines.push(`  - ${t}`));
    lines.push('');
  }

  // Monaco editor content (YAML, JSON, code)
  const monacoContent = getMonacoEditorContent();
  if (monacoContent) {
    lines.push('Editor Content (YAML/JSON/Code):');
    lines.push('```');
    lines.push(monacoContent);
    lines.push('```');
    lines.push('');
  }

  // Terminal output
  const terminalContent = getXtermContent();
  if (terminalContent) {
    lines.push('Terminal Output:');
    lines.push('```');
    lines.push(terminalContent);
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check if searchText matches an element's text/aria-label
 * Handles cases where AI combines visible text + aria-label like "Create new ... Kind cluster"
 */
function matchesElement(searchText: string, visibleText: string, ariaLabel: string): boolean {
  const search = searchText.toLowerCase();
  const text = visibleText.toLowerCase();
  const aria = ariaLabel.toLowerCase();

  // Exact matches (highest priority)
  if (text === search || aria === search) {
    return true;
  }

  // Standard includes matching
  if (text.includes(search) || aria.includes(search)) {
    return true;
  }

  // Check if search includes the aria-label (e.g., search="Create new ... Kind cluster" includes aria="Create new Kind cluster")
  if (aria && search.includes(aria)) {
    return true;
  }

  // Handle combined format: "visible text ... aria-label" or "visible text aria-label"
  // Extract potential aria-label from search by removing visible text prefix
  if (text && aria && text !== aria) {
    // Remove visible text from search and check if remainder matches aria-label
    const textEscaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const combinedPattern = new RegExp(`^${textEscaped}\\s*\\.{0,3}\\s*(.+)$`, 'i');
    const match = combinedPattern.exec(search);
    if (match) {
      const remainder = match[1].toLowerCase().trim();
      // Check if remainder matches or is contained in aria-label
      if (aria.includes(remainder) || remainder.includes(aria)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find an element by text content or selector
 */
export function findElement(textOrSelector: string): HTMLElement | null {
  // Try as selector first
  try {
    const el = document.querySelector(textOrSelector);
    if (el) return el as HTMLElement;
  } catch {
    // Not a valid selector, continue
  }

  const searchText = textOrSelector.toLowerCase();

  // PRIORITY 1: Exact aria-label match (most specific)
  // This handles cases like clicking "Create new Kind cluster" when multiple "Create new..." buttons exist
  const exactAriaMatch = document.querySelector(`[aria-label="${textOrSelector}" i]`);
  if (exactAriaMatch && isVisible(exactAriaMatch)) {
    return exactAriaMatch as HTMLElement;
  }

  // PRIORITY 2: Search buttons with smart matching
  for (const btn of document.querySelectorAll('button')) {
    if (!isVisible(btn)) continue;
    const text = getVisibleText(btn);
    const ariaLabel = btn.getAttribute('aria-label') ?? '';
    if (matchesElement(searchText, text, ariaLabel)) {
      return btn as HTMLElement;
    }
  }

  // Search links
  for (const link of document.querySelectorAll('a')) {
    if (!isVisible(link)) continue;
    const text = getVisibleText(link);
    const ariaLabel = link.getAttribute('aria-label') ?? '';
    if (matchesElement(searchText, text, ariaLabel)) {
      return link as HTMLElement;
    }
  }

  // Search menu items
  for (const item of document.querySelectorAll('[role="menuitem"], [role="tab"], nav a, nav button')) {
    if (!isVisible(item)) continue;
    const text = getVisibleText(item);
    const ariaLabel = item.getAttribute('aria-label') ?? '';
    if (matchesElement(searchText, text, ariaLabel)) {
      return item as HTMLElement;
    }
  }

  // Search dropdown options
  for (const option of document.querySelectorAll('[role="option"]')) {
    if (!isVisible(option)) continue;
    const text = getVisibleText(option);
    const ariaLabel = option.getAttribute('aria-label') ?? '';
    if (matchesElement(searchText, text, ariaLabel)) {
      return option as HTMLElement;
    }
  }

  // Search clickable elements with role="button" or onclick handlers
  for (const el of document.querySelectorAll('[role="button"], [onclick]')) {
    if (!isVisible(el)) continue;
    const text = getVisibleText(el);
    const ariaLabel = el.getAttribute('aria-label') ?? '';
    if (matchesElement(searchText, text, ariaLabel)) {
      return el as HTMLElement;
    }
  }

  // Search by aria-label attribute anywhere (partial match)
  const byAriaLabel = document.querySelector(`[aria-label*="${textOrSelector}" i]`);
  if (byAriaLabel && isVisible(byAriaLabel)) return byAriaLabel as HTMLElement;

  // Search by title attribute
  const byTitle = document.querySelector(`[title*="${textOrSelector}" i]`);
  if (byTitle && isVisible(byTitle)) return byTitle as HTMLElement;

  // Log available elements for debugging
  console.warn(
    `[Selkie Mode] Could not find element "${textOrSelector}". Available buttons:`,
    Array.from(document.querySelectorAll('button'))
      .filter(b => isVisible(b))
      .map(b => {
        const text = getVisibleText(b);
        const aria = b.getAttribute('aria-label');
        return aria && aria !== text ? `${text} [aria-label: ${aria}]` : text;
      })
      .filter(t => t)
      .slice(0, 15),
  );

  return null;
}

/**
 * Find an input element by label text or name
 */
export function findInput(labelOrName: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  const searchText = labelOrName.toLowerCase();

  // Search by label with for attribute
  for (const label of document.querySelectorAll('label')) {
    const labelText = label.textContent?.toLowerCase() ?? '';
    if (labelText.includes(searchText)) {
      const forId = label.getAttribute('for');
      if (forId) {
        const input = document.getElementById(forId);
        if (input) return input as HTMLInputElement;
      }
      // Check for nested input
      const nestedInput = label.querySelector('input, select, textarea');
      if (nestedInput) return nestedInput as HTMLInputElement;

      // Check for sibling input (label followed by input)
      const nextSibling = label.nextElementSibling;
      if (nextSibling?.matches('input, select, textarea')) {
        return nextSibling as HTMLInputElement;
      }

      // Check for input in same parent container
      const parent = label.parentElement;
      if (parent) {
        const siblingInput = parent.querySelector('input, select, textarea');
        if (siblingInput) return siblingInput as HTMLInputElement;
      }
    }
  }

  // Search by any text element (span, div, p) that might be a label
  for (const el of document.querySelectorAll('span, p')) {
    if (!isVisible(el)) continue;
    const text = el.textContent?.toLowerCase() ?? '';
    // Match if text includes search OR search includes text (for partial matches)
    if (text.includes(searchText) && text.length < 100) {
      // Check for sibling input (direct sibling)
      const nextSibling = el.nextElementSibling;
      if (nextSibling?.matches('input, select, textarea')) {
        return nextSibling as HTMLInputElement;
      }
      // Check if sibling contains an input (for wrapped components like Input.svelte)
      if (nextSibling) {
        const nestedInput = nextSibling.querySelector('input, select, textarea');
        if (nestedInput) return nestedInput as HTMLInputElement;
      }
      // Check in parent container (but only immediate inputs, not too deep)
      const parent = el.parentElement;
      if (parent) {
        const siblingInput = parent.querySelector(
          ':scope > input, :scope > select, :scope > textarea, :scope > div input, :scope > div select, :scope > div textarea',
        );
        if (siblingInput && siblingInput !== el) return siblingInput as HTMLInputElement;
      }
    }
  }

  // Search by placeholder
  const byPlaceholder = document.querySelector(
    `input[placeholder*="${labelOrName}" i], textarea[placeholder*="${labelOrName}" i]`,
  );
  if (byPlaceholder) return byPlaceholder as HTMLInputElement;

  // Search by name
  const byName = document.querySelector(`input[name*="${labelOrName}" i], select[name*="${labelOrName}" i]`);
  if (byName) return byName as HTMLInputElement;

  // Search by aria-label
  const byAriaLabel = document.querySelector(`input[aria-label*="${labelOrName}" i]`);
  if (byAriaLabel) return byAriaLabel as HTMLInputElement;

  // Log for debugging
  console.warn(
    `[Selkie Mode] Could not find input for "${labelOrName}". Available inputs:`,
    Array.from(document.querySelectorAll('input'))
      .map(i => ({
        placeholder: i.placeholder,
        name: i.name,
        ariaLabel: i.getAttribute('aria-label'),
        id: i.id,
      }))
      .slice(0, 10),
  );

  return null;
}

/**
 * Click an element by text or selector
 */
export async function clickElement(textOrSelector: string): Promise<{ success: boolean; error?: string }> {
  const element = findElement(textOrSelector);

  if (!element) {
    return { success: false, error: `Could not find element: "${textOrSelector}"` };
  }

  if (!isVisible(element)) {
    return { success: false, error: `Element "${textOrSelector}" is not visible` };
  }

  if (element instanceof HTMLButtonElement && element.disabled) {
    return { success: false, error: `Button "${textOrSelector}" is disabled` };
  }

  try {
    element.click();
    // Wait a bit for any navigation/updates
    await new Promise(resolve => setTimeout(resolve, ELEMENT_CLICK_DELAY_MS));
    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to click: ${e}` };
  }
}

/**
 * Fill an input field
 */
export async function fillInput(labelOrSelector: string, value: string): Promise<{ success: boolean; error?: string }> {
  // First try to find input specifically
  let input = findInput(labelOrSelector);

  // If not found, try findElement but only accept actual inputs
  if (!input) {
    const element = findElement(labelOrSelector);
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      input = element;
    } else if (element) {
      // Found an element but it's not an input - log what we found for debugging
      console.warn(`[Selkie Mode] Found element for "${labelOrSelector}" but it's not an input:`, {
        tagName: element.tagName,
        className: element.className,
        textContent: element.textContent?.substring(0, 50),
      });
      return {
        success: false,
        error: `Element "${labelOrSelector}" is not an input field (found ${element.tagName.toLowerCase()})`,
      };
    }
  }

  if (!input) {
    return { success: false, error: `Could not find input: "${labelOrSelector}"` };
  }

  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
    return { success: false, error: `Element "${labelOrSelector}" is not an input field` };
  }

  if (input.disabled) {
    return { success: false, error: `Input "${labelOrSelector}" is disabled` };
  }

  try {
    input.focus();
    input.value = value;
    // Dispatch events to trigger Svelte reactivity
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, INPUT_DELAY_MS));
    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to fill input: ${e}` };
  }
}

/**
 * Select an option from a dropdown
 */
export async function selectOption(
  labelOrSelector: string,
  optionText: string,
): Promise<{ success: boolean; error?: string }> {
  const select = findInput(labelOrSelector) ?? (findElement(labelOrSelector) as HTMLSelectElement | null);

  if (!select) {
    return { success: false, error: `Could not find select: "${labelOrSelector}"` };
  }

  if (!(select instanceof HTMLSelectElement)) {
    return { success: false, error: `Element "${labelOrSelector}" is not a select dropdown` };
  }

  // Find the option
  const options = Array.from(select.options);
  const option = options.find(
    o => o.text.toLowerCase().includes(optionText.toLowerCase()) || o.value.toLowerCase() === optionText.toLowerCase(),
  );

  if (!option) {
    const available = options.map(o => o.text).join(', ');
    return { success: false, error: `Option "${optionText}" not found. Available: ${available}` };
  }

  try {
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, SELECT_DELAY_MS));
    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to select option: ${e}` };
  }
}

/**
 * Toggle a checkbox
 */
export async function toggleCheckbox(
  labelOrSelector: string,
  checked?: boolean,
): Promise<{ success: boolean; error?: string }> {
  const input = findInput(labelOrSelector) ?? (findElement(labelOrSelector) as HTMLInputElement | null);

  if (!input) {
    return { success: false, error: `Could not find checkbox: "${labelOrSelector}"` };
  }

  if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') {
    return { success: false, error: `Element "${labelOrSelector}" is not a checkbox` };
  }

  try {
    if (checked === undefined || input.checked !== checked) {
      input.click();
    }
    await new Promise(resolve => setTimeout(resolve, CHECKBOX_DELAY_MS));
    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to toggle checkbox: ${e}` };
  }
}

/**
 * Wait for an element to appear
 */
export async function waitForElement(
  textOrSelector: string,
  timeoutMs: number = ELEMENT_WAIT_DEFAULT_TIMEOUT_MS,
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const element = findElement(textOrSelector);
    if (element && isVisible(element)) {
      return { success: true };
    }
    await new Promise(resolve => setTimeout(resolve, ELEMENT_WAIT_POLL_MS));
  }

  return { success: false, error: `Timed out waiting for "${textOrSelector}"` };
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingComplete(
  timeoutMs: number = LOADING_DEFAULT_TIMEOUT_MS,
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();

  // Wait a bit first for loading to start
  await new Promise(resolve => setTimeout(resolve, LOADING_INITIAL_WAIT_MS));

  while (Date.now() - startTime < timeoutMs) {
    const indicators = getLoadingIndicators();
    if (indicators.length === 0) {
      return { success: true };
    }
    await new Promise(resolve => setTimeout(resolve, LOADING_POLL_INTERVAL_MS));
  }

  return { success: false, error: 'Loading did not complete in time' };
}

/**
 * Wait for the DOM to settle (no mutations for a period)
 * This is more reliable than arbitrary timeouts
 */
export async function waitForDomSettle(
  settleTimeMs: number = DOM_SETTLE_TIME_MS,
  timeoutMs: number = PAGE_READY_TIMEOUT_MS,
): Promise<{ success: boolean; settled: boolean }> {
  return new Promise(resolve => {
    let lastMutationTime = Date.now();
    const startTime = Date.now();

    const observer = new MutationObserver(() => {
      lastMutationTime = Date.now();
    });

    // Observe the entire document for any changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    // Check periodically if DOM has settled
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastMutation = now - lastMutationTime;
      const totalTime = now - startTime;

      // DOM has settled (no mutations for settleTimeMs)
      if (timeSinceLastMutation >= settleTimeMs) {
        observer.disconnect();
        clearInterval(checkInterval);
        resolve({ success: true, settled: true });
      } else if (totalTime >= timeoutMs) {
        // Timeout
        observer.disconnect();
        clearInterval(checkInterval);
        resolve({ success: true, settled: false }); // Still return success, just note it didn't fully settle
      }
    }, 50);
  });
}

/**
 * Wait for page to be ready - combines DOM settle with content check
 */
export async function waitForPageReady(
  timeoutMs: number = PAGE_READY_TIMEOUT_MS,
): Promise<{ success: boolean; error?: string }> {
  // First wait for DOM to settle
  await waitForDomSettle(DOM_SETTLE_TIME_MS, timeoutMs);

  // Then check there are no loading indicators
  const indicators = getLoadingIndicators();
  if (indicators.length > 0) {
    // Wait a bit more for loading to complete
    await waitForLoadingComplete(Math.min(timeoutMs, PAGE_READY_LOADING_TIMEOUT_MS));
  }

  return { success: true };
}

/**
 * Get status of running tasks/operations (like image pulls)
 * Be VERY conservative to avoid false positives
 */
export function getRunningTasks(): { name: string; status: string; progress?: string }[] {
  const tasks: { name: string; status: string; progress?: string }[] = [];

  // Only check for ACTIVE progress bars (not completed ones)
  document.querySelectorAll('progress').forEach(el => {
    if (!isVisible(el)) return;
    const prog = el as HTMLProgressElement;
    // Only count if progress is between 0 and max (not complete)
    if (prog.value > 0 && prog.value < prog.max) {
      const parent = el.closest('div');
      const label = parent?.textContent?.trim().substring(0, 50) ?? 'Operation in progress';
      const percent = Math.round((prog.value / prog.max) * 100);
      tasks.push({ name: label, status: 'in-progress', progress: percent + '%' });
    }
  });

  // Check for aria progressbar that's actively progressing
  document.querySelectorAll('[role="progressbar"]').forEach(el => {
    if (!isVisible(el)) return;
    const value = parseInt(el.getAttribute('aria-valuenow') ?? '0', 10);
    const max = parseInt(el.getAttribute('aria-valuemax') ?? '100', 10);
    if (value > 0 && value < max) {
      tasks.push({ name: 'Operation in progress', status: 'in-progress', progress: value + '%' });
    }
  });

  // Check for task manager panel if it exists and has active tasks
  const taskManager = document.querySelector('[data-testid="task-manager"], .task-manager');
  if (taskManager && isVisible(taskManager)) {
    const activeItems = taskManager.querySelectorAll('[class*="running"], [class*="active"], .animate-spin');
    activeItems.forEach(item => {
      if (!isVisible(item)) return;
      const text = (item as HTMLElement).innerText?.trim();
      if (text && text.length < 100) {
        tasks.push({ name: text, status: 'running' });
      }
    });
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return tasks.filter(t => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });
}

/**
 * Check if any operations are currently running
 */
export function hasRunningOperations(): boolean {
  const tasks = getRunningTasks();
  const loading = getLoadingIndicators();
  return tasks.length > 0 || loading.length > 0;
}

/**
 * Wait for all operations to complete (for long operations like image pulls)
 * Uses DOM settle detection combined with task checking
 */
export async function waitForOperations(
  timeoutMs: number = 300000,
  onProgress?: (status: string) => void,
): Promise<{ success: boolean; error?: string; tasks?: string[] }> {
  const startTime = Date.now();
  let consecutiveIdleChecks = 0;
  const requiredIdleChecks = 3; // Need 3 consecutive checks with no activity

  // Wait a bit first for operations to start
  await new Promise(resolve => setTimeout(resolve, OPERATION_INITIAL_WAIT_MS));

  while (Date.now() - startTime < timeoutMs) {
    const tasks = getRunningTasks();
    const loading = getLoadingIndicators();

    // Check if there's any activity
    const hasActivity = tasks.length > 0 || loading.length > 0;

    if (!hasActivity) {
      consecutiveIdleChecks++;
      if (onProgress) {
        onProgress('Checking if complete...');
      }

      // If we've had multiple consecutive idle checks, we're done
      if (consecutiveIdleChecks >= requiredIdleChecks) {
        // One final DOM settle check
        await waitForDomSettle(OPERATION_SETTLE_MS, OPERATION_SETTLE_TIMEOUT_MS);
        return { success: true };
      }
    } else {
      consecutiveIdleChecks = 0; // Reset if there's activity

      // Report progress
      let status = '';
      if (tasks.length > 0) {
        status = tasks
          .map(t => {
            const progress = t.progress ? ' (' + t.progress + ')' : '';
            return t.name + progress;
          })
          .join(', ');
      } else if (loading.length > 0) {
        status = loading.join(', ');
      }

      if (onProgress) {
        onProgress(status ? 'Waiting: ' + status : 'Processing...');
      }
    }

    await new Promise(resolve => setTimeout(resolve, OPERATION_POLL_INTERVAL_MS));
  }

  const remainingTasks = getRunningTasks();
  return {
    success: false,
    error: 'Timed out after ' + Math.round(timeoutMs / 1000) + 's',
    tasks: remainingTasks.map(t => t.name),
  };
}

/**
 * Get current route
 */
export function getCurrentRoute(): string {
  return get(router).path ?? window.location.pathname;
}

/**
 * Navigate to a route
 */
export async function navigateToRoute(route: string): Promise<{ success: boolean; error?: string }> {
  try {
    router.goto(route);
    await new Promise(resolve => setTimeout(resolve, 200));
    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to navigate: ${e}` };
  }
}

/**
 * Get console logs (from preload)
 */
export async function getConsoleLogs(): Promise<{ logType: string; date: Date; message: string }[]> {
  try {
    return await window.getDevtoolsConsoleLogs();
  } catch {
    return [];
  }
}

/**
 * Get recent console errors
 */
export async function getConsoleErrors(): Promise<string[]> {
  const logs = await getConsoleLogs();
  return logs
    .filter(l => l.logType === 'error')
    .slice(-10)
    .map(l => l.message);
}

/**
 * Find the xterm terminal element on the page
 */
function findTerminalElement(): HTMLElement | null {
  // xterm.js creates a container with class 'xterm'
  const xtermContainer = document.querySelector('.xterm');
  if (xtermContainer && isVisible(xtermContainer)) {
    return xtermContainer as HTMLElement;
  }

  // Also try finding by the textarea that xterm uses for input
  const xtermTextarea = document.querySelector('.xterm-helper-textarea');
  if (xtermTextarea) {
    return xtermTextarea.closest('.xterm') as HTMLElement;
  }

  // Try finding canvas element that xterm renders to
  const xtermCanvas = document.querySelector('.xterm-screen canvas');
  if (xtermCanvas) {
    return xtermCanvas.closest('.xterm') as HTMLElement;
  }

  return null;
}

/**
 * Focus on a terminal (xterm) element to make it active for typing
 */
export async function focusTerminal(): Promise<{ success: boolean; error?: string }> {
  const terminal = findTerminalElement();

  if (!terminal) {
    return {
      success: false,
      error: 'No terminal found on the page. Navigate to a container shell or exec session first.',
    };
  }

  try {
    // Click on the terminal to focus it
    terminal.click();

    // Also try to focus the hidden textarea that xterm uses for input
    const textarea = terminal.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.focus();
    }

    // Wait a moment for focus to take effect
    await new Promise(resolve => setTimeout(resolve, TERMINAL_FOCUS_DELAY_MS));

    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to focus terminal: ${e}` };
  }
}

/**
 * Type text into a focused terminal and optionally press Enter
 * The terminal must be focused first using focusTerminal()
 *
 * xterm.js uses a hidden textarea to capture input. We simulate typing by
 * dispatching a paste event with the text content. For Enter, we include
 * a carriage return (\r) in the paste data which xterm interprets as Enter.
 *
 * @param text - The text/command to type
 * @param pressEnter - Whether to press Enter after typing (default: true)
 */
export async function typeInTerminal(
  text: string,
  pressEnter: boolean = true,
): Promise<{ success: boolean; error?: string }> {
  const terminal = findTerminalElement();

  if (!terminal) {
    return { success: false, error: 'No terminal found on the page.' };
  }

  // Find the xterm textarea which captures keyboard input
  const textarea = terminal.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null;

  if (!textarea) {
    return { success: false, error: 'Terminal input element not found. Try focusing the terminal first.' };
  }

  try {
    // Clean the text - remove any trailing newlines since we handle Enter separately
    const cleanText = text.replace(/\n+$/, '');

    // Make sure textarea is focused
    textarea.focus();
    await new Promise(resolve => setTimeout(resolve, TERMINAL_PRE_TYPE_DELAY_MS));

    // Paste the text using clipboard event
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', cleanText);

    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboardData,
    });

    textarea.dispatchEvent(pasteEvent);

    // Wait for paste to complete
    await new Promise(resolve => setTimeout(resolve, TERMINAL_PASTE_DELAY_MS));

    // Press Enter key
    if (pressEnter) {
      textarea.focus();

      // Dispatch keydown event for Enter (xterm.js listens to keydown)
      const keydownEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
      } as KeyboardEventInit);
      textarea.dispatchEvent(keydownEvent);

      // Dispatch keyup event for Enter
      const keyupEvent = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
      } as KeyboardEventInit);
      textarea.dispatchEvent(keyupEvent);

      // Wait for command to process
      await new Promise(resolve => setTimeout(resolve, TERMINAL_ENTER_DELAY_MS));
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: `Failed to type in terminal: ${e}` };
  }
}
