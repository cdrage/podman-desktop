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

import type { ToolDefinition, ToolResult } from '/@api/selkie-mode-info';

import {
  CLICK_DESTRUCTIVE_SETTLE_MS,
  CLICK_DESTRUCTIVE_TIMEOUT_MS,
  CLICK_DESTRUCTIVE_WAIT_MS,
  CLICK_WAIT_MS,
  DOM_SETTLE_TIME_SHORT_MS,
  DOM_SETTLE_TIMEOUT_SHORT_MS,
  INPUT_VALIDATION_DELAY_MS,
  NAVIGATION_SETTLE_MS,
  NAVIGATION_TIMEOUT_MS,
  PAGE_STATE_SUMMARY_MAX_LINES,
  TERMINAL_OUTPUT_WAIT_MS,
} from './ai-constants';
import {
  clickElement,
  fillInput,
  focusTerminal,
  getConsoleErrors,
  getCurrentRoute,
  getPageContentAsText,
  getRunningTasks,
  navigateToRoute,
  selectOption,
  toggleCheckbox,
  typeInTerminal,
  waitForDomSettle,
  waitForElement,
  waitForLoadingComplete,
  waitForOperations,
} from './ai-dom-utils';

/**
 * Browser automation tools for AI - generic tools that work with any UI
 */
export const AI_BROWSER_TOOLS: ToolDefinition[] = [
  // Task completion - MUST be called when done
  {
    name: 'task_complete',
    description:
      'Call this when the task is finished. You MUST call this tool to end the task. Provide a brief summary of what was accomplished.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Brief summary of what was done (1-2 sentences)',
        },
        success: {
          type: 'boolean',
          description: 'True if task completed successfully, false if it failed',
        },
      },
      required: ['summary', 'success'],
    },
  },

  // Ask user - THE ONLY WAY to ask questions
  {
    name: 'ask_user',
    description:
      'THE ONLY WAY to ask the user a question. You MUST use this tool for ANY question - NEVER write questions as plain text. Use when you need clarification, a decision, or user input before proceeding. Calling this pauses execution until the user responds.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user. Be specific and actionable.',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Suggested choices (2-4 options). Makes it easier for user to respond quickly.',
        },
      },
      required: ['question'],
    },
  },

  // Vision - See what's on the page
  {
    name: 'get_page_content',
    description:
      'Read the current page content. Returns all interactive elements (buttons, links, inputs, dropdowns, tabs) and their values.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_current_route',
    description: 'Get the current page route/URL path like /containers or /images.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // Navigation
  {
    name: 'navigate_to_route',
    description:
      'Navigate to a route. Routes: / (Dashboard), /containers, /images, /pods, /volumes, /networks, /kubernetes, /kubernetes/pods, /kubernetes/deployments, /kubernetes/services, /extensions, /preferences/resources (Settings)',
    parameters: {
      type: 'object',
      properties: {
        route: {
          type: 'string',
          description: 'The route path like /containers or /images',
        },
      },
      required: ['route'],
    },
  },

  // Interaction - Click things
  {
    name: 'click_element',
    description:
      'Click a button, link, tab, or menu item by its visible text, aria-label, or CSS selector. Case-insensitive partial match.',
    parameters: {
      type: 'object',
      properties: {
        element: {
          type: 'string',
          description: 'The text, label, or selector of the element to click',
        },
      },
      required: ['element'],
    },
  },

  // Interaction - Fill inputs
  {
    name: 'fill_input',
    description: 'Type text into an input field found by its label, placeholder, or name.',
    parameters: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'The label, placeholder, or name of the input field',
        },
        value: {
          type: 'string',
          description: 'The text to type',
        },
      },
      required: ['label', 'value'],
    },
  },

  // Interaction - Select dropdown options
  {
    name: 'select_option',
    description: 'Select an option from a dropdown by the dropdown label and option text.',
    parameters: {
      type: 'object',
      properties: {
        dropdown: {
          type: 'string',
          description: 'The label of the dropdown',
        },
        option: {
          type: 'string',
          description: 'The option text to select',
        },
      },
      required: ['dropdown', 'option'],
    },
  },

  // Interaction - Toggle checkbox
  {
    name: 'toggle_checkbox',
    description: 'Toggle a checkbox by its label.',
    parameters: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'The label of the checkbox',
        },
        checked: {
          type: 'boolean',
          description: 'True to check, false to uncheck, omit to toggle',
        },
      },
      required: ['label'],
    },
  },

  // Waiting
  {
    name: 'wait_for_element',
    description: 'Wait for an element to appear on the page.',
    parameters: {
      type: 'object',
      properties: {
        element: {
          type: 'string',
          description: 'The text, label, or selector to wait for',
        },
        timeout_seconds: {
          type: 'number',
          description: 'Max wait time in seconds (default: 5)',
        },
      },
      required: ['element'],
    },
  },
  {
    name: 'wait_for_loading',
    description: 'Wait for loading indicators to disappear.',
    parameters: {
      type: 'object',
      properties: {
        timeout_seconds: {
          type: 'number',
          description: 'Max wait time in seconds (default: 10)',
        },
      },
      required: [],
    },
  },

  // Feedback - Check for errors
  {
    name: 'get_console_errors',
    description: 'Get recent console error messages to check for failures.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // Long operations
  {
    name: 'get_task_status',
    description: 'Check for running tasks like image pulls or container creation.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'wait_for_operation',
    description: 'Wait for long-running operations to complete (image pulls, builds). Use after triggering operations.',
    parameters: {
      type: 'object',
      properties: {
        timeout_seconds: {
          type: 'number',
          description: 'Max wait time in seconds (default: 120, max: 300)',
        },
      },
      required: [],
    },
  },

  // Terminal interaction
  {
    name: 'focus_terminal',
    description:
      'Click/focus on a terminal (xterm) to make it active. MUST be called before typing in a terminal. Terminals are canvas-based and need explicit focus.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'type_in_terminal',
    description:
      'Type text into a focused terminal and press Enter to execute. The terminal must be focused first using focus_terminal. Use this for container shells, exec sessions, etc.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The command or text to type in the terminal',
        },
        pressEnter: {
          type: 'boolean',
          description: 'Whether to press Enter after typing (default: true)',
        },
      },
      required: ['text'],
    },
  },
];

/**
 * Get a brief summary of the current page state after a DOM-changing action.
 * This helps the AI understand what changed without requiring a separate get_page_content call.
 */
function getPageStateSummary(): string {
  const content = getPageContentAsText();
  // Return full content if limit is 0, otherwise truncate to limit
  if (PAGE_STATE_SUMMARY_MAX_LINES === 0) {
    return content;
  }
  const lines = content.split('\n').slice(0, PAGE_STATE_SUMMARY_MAX_LINES);
  return lines.join('\n');
}

/**
 * Execute a browser automation tool
 */
export async function executeBrowserTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'task_complete': {
        // Special tool - signals task completion
        // The actual handling is done in SelkieMode.svelte
        return {
          success: args.success as boolean,
          data: args.summary as string,
        };
      }

      case 'ask_user': {
        // Special tool - asks user a question
        // The actual handling (showing UI, waiting for response) is done in SelkieMode.svelte
        // This just returns the question/options for the UI to display
        return {
          success: true,
          data: {
            question: args.question as string,
            options: (args.options as string[]) || [],
          },
        };
      }

      case 'get_page_content': {
        const content = getPageContentAsText();
        return { success: true, data: content };
      }

      case 'get_current_route': {
        const route = getCurrentRoute();
        return { success: true, data: route };
      }

      case 'navigate_to_route': {
        const result = await navigateToRoute(args.route as string);
        if (result.success) {
          // Wait for DOM to settle (more reliable than arbitrary timeout)
          await waitForDomSettle(NAVIGATION_SETTLE_MS, NAVIGATION_TIMEOUT_MS);
          const actualRoute = getCurrentRoute();
          const pageState = getPageStateSummary();
          return {
            success: true,
            data: `Navigated to ${args.route}\nActual route: ${actualRoute}\n\nCurrent page state:\n${pageState}`,
          };
        }
        console.error(`[Selkie Mode] Failed to navigate to "${args.route}": ${result.error}`);
        return { success: false, error: result.error };
      }

      case 'click_element': {
        const result = await clickElement(args.element as string);
        if (result.success) {
          const elementText = (args.element as string).toLowerCase();

          // Check if this is a destructive or state-changing action that needs more wait time
          const isDestructive = ['delete', 'remove', 'stop', 'kill', 'prune', 'yes', 'confirm'].some(word =>
            elementText.includes(word),
          );

          if (isDestructive) {
            // Wait longer for destructive actions - API call + page refresh
            await new Promise(resolve => setTimeout(resolve, CLICK_DESTRUCTIVE_WAIT_MS));
            // Then wait for DOM to settle (stop changing)
            await waitForDomSettle(CLICK_DESTRUCTIVE_SETTLE_MS, CLICK_DESTRUCTIVE_TIMEOUT_MS);
          } else {
            // Standard wait for non-destructive actions
            await new Promise(resolve => setTimeout(resolve, CLICK_WAIT_MS));
            await waitForDomSettle(DOM_SETTLE_TIME_SHORT_MS, DOM_SETTLE_TIMEOUT_SHORT_MS);
          }

          const actualRoute = getCurrentRoute();
          const pageState = getPageStateSummary();
          return {
            success: true,
            data: `Clicked "${args.element}"\nCurrent route: ${actualRoute}\n\nCurrent page state:\n${pageState}`,
          };
        }
        console.error(`[Selkie Mode] Failed to click element "${args.element}": ${result.error}`);
        // Include fresh page content on failure so AI knows what's actually available
        const pageState = getPageStateSummary();
        return { success: false, error: `${result.error}\n\nCurrent page state:\n${pageState}` };
      }

      case 'fill_input': {
        const result = await fillInput(args.label as string, args.value as string);
        if (result.success) {
          // Wait for validation to run and DOM to update with any error messages
          await waitForDomSettle(DOM_SETTLE_TIME_SHORT_MS, DOM_SETTLE_TIMEOUT_SHORT_MS);
          // Additional wait for async validation (e.g., port availability checks via IPC)
          await new Promise(resolve => setTimeout(resolve, INPUT_VALIDATION_DELAY_MS));
          const pageState = getPageStateSummary();
          return {
            success: true,
            data: `Filled "${args.label}" with "${args.value}"\n\nCurrent page state:\n${pageState}`,
          };
        }
        console.error(`[Selkie Mode] Failed to fill input "${args.label}": ${result.error}`);
        return { success: false, error: result.error };
      }

      case 'select_option': {
        const result = await selectOption(args.dropdown as string, args.option as string);
        if (result.success) {
          // Wait for validation to run and DOM to update with any error messages
          await waitForDomSettle(DOM_SETTLE_TIME_SHORT_MS, DOM_SETTLE_TIMEOUT_SHORT_MS);
          const pageState = getPageStateSummary();
          return {
            success: true,
            data: `Selected "${args.option}" from "${args.dropdown}"\n\nCurrent page state:\n${pageState}`,
          };
        }
        console.error(
          `[Selkie Mode] Failed to select option "${args.option}" from "${args.dropdown}": ${result.error}`,
        );
        return { success: false, error: result.error };
      }

      case 'toggle_checkbox': {
        const result = await toggleCheckbox(args.label as string, args.checked as boolean | undefined);
        if (result.success) {
          // Wait for validation to run and DOM to update with any error messages
          await waitForDomSettle(DOM_SETTLE_TIME_SHORT_MS, DOM_SETTLE_TIMEOUT_SHORT_MS);
          const pageState = getPageStateSummary();
          return { success: true, data: `Toggled checkbox "${args.label}"\n\nCurrent page state:\n${pageState}` };
        }
        console.error(`[Selkie Mode] Failed to toggle checkbox "${args.label}": ${result.error}`);
        return { success: false, error: result.error };
      }

      case 'wait_for_element': {
        const timeout = ((args.timeout_seconds as number) || 5) * 1000;
        const result = await waitForElement(args.element as string, timeout);
        if (result.success) {
          const pageState = getPageStateSummary();
          return { success: true, data: `Found "${args.element}"\n\nCurrent page state:\n${pageState}` };
        }
        console.error(`[Selkie Mode] Failed to find element "${args.element}": ${result.error}`);
        return { success: false, error: result.error };
      }

      case 'wait_for_loading': {
        const timeout = ((args.timeout_seconds as number) || 10) * 1000;
        const result = await waitForLoadingComplete(timeout);
        if (result.success) {
          const pageState = getPageStateSummary();
          return { success: true, data: `Loading complete\n\nCurrent page state:\n${pageState}` };
        }
        console.error(`[Selkie Mode] Loading did not complete: ${result.error}`);
        return { success: false, error: result.error };
      }

      case 'get_console_errors': {
        const errors = await getConsoleErrors();
        if (errors.length === 0) {
          return { success: true, data: 'No errors' };
        }
        return { success: true, data: errors.join('\n') };
      }

      case 'get_task_status': {
        const tasks = getRunningTasks();
        if (tasks.length === 0) {
          return { success: true, data: 'No operations running' };
        }
        const taskList = tasks
          .map(t => {
            const progress = t.progress ? ' (' + t.progress + ')' : '';
            return '- ' + t.name + progress;
          })
          .join('\n');
        return { success: true, data: 'Running operations:\n' + taskList };
      }

      case 'wait_for_operation': {
        const timeout = Math.min(((args.timeout_seconds as number) || 120) * 1000, 300000);
        const result = await waitForOperations(timeout);
        if (result.success) {
          const pageState = getPageStateSummary();
          return { success: true, data: `All operations completed successfully\n\nCurrent page state:\n${pageState}` };
        }
        console.error(`[Selkie Mode] Operation wait failed: ${result.error}`);
        return {
          success: false,
          error: result.error,
          data: result.tasks ? `Still running: ${result.tasks.join(', ')}` : undefined,
        };
      }

      case 'focus_terminal': {
        const result = await focusTerminal();
        if (result.success) {
          const pageState = getPageStateSummary();
          return { success: true, data: `Terminal focused and ready for input\n\nCurrent page state:\n${pageState}` };
        }
        console.error(`[Selkie Mode] Failed to focus terminal: ${result.error}`);
        return { success: false, error: result.error };
      }

      case 'type_in_terminal': {
        const pressEnter = args.pressEnter !== false; // Default to true
        const result = await typeInTerminal(args.text as string, pressEnter);
        if (result.success) {
          const action = pressEnter ? 'Executed' : 'Typed';
          // Wait a moment for terminal output to appear after command execution
          if (pressEnter) {
            await new Promise(resolve => setTimeout(resolve, TERMINAL_OUTPUT_WAIT_MS));
          }
          const pageState = getPageStateSummary();
          return { success: true, data: `${action} "${args.text}" in terminal\n\nCurrent page state:\n${pageState}` };
        }
        console.error(`[Selkie Mode] Failed to type in terminal: ${result.error}`);
        return { success: false, error: result.error };
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get action description for UI display (both active and completed forms)
 */
export function getBrowserActionDescription(
  toolName: string,
  args: Record<string, unknown>,
): { active: string; completed: string } {
  switch (toolName) {
    case 'task_complete':
      return args.success
        ? { active: 'Completing task', completed: 'Task completed' }
        : { active: 'Task failing', completed: 'Task failed' };
    case 'ask_user':
      return { active: 'Asking for your input', completed: 'Asked for input' };
    case 'get_page_content':
      return { active: 'Reading page content', completed: 'Read page content' };
    case 'get_current_route':
      return { active: 'Checking current location', completed: 'Checked location' };
    case 'navigate_to_route':
      return { active: `Navigating to ${args.route}`, completed: `Navigated to ${args.route}` };
    case 'click_element':
      return { active: `Clicking "${args.element}"`, completed: `Clicked "${args.element}"` };
    case 'fill_input':
      return { active: `Typing in "${args.label}"`, completed: `Typed in "${args.label}"` };
    case 'select_option':
      return { active: `Selecting "${args.option}"`, completed: `Selected "${args.option}"` };
    case 'toggle_checkbox':
      return { active: `Toggling "${args.label}"`, completed: `Toggled "${args.label}"` };
    case 'wait_for_element':
      return { active: `Waiting for "${args.element}"`, completed: `Found "${args.element}"` };
    case 'wait_for_loading':
      return { active: 'Waiting for loading', completed: 'Loading complete' };
    case 'get_console_errors':
      return { active: 'Checking for errors', completed: 'Checked for errors' };
    case 'get_task_status':
      return { active: 'Checking task status', completed: 'Checked task status' };
    case 'wait_for_operation':
      return { active: 'Waiting for operation to complete', completed: 'Operation complete' };
    case 'focus_terminal':
      return { active: 'Focusing on terminal', completed: 'Focused on terminal' };
    case 'type_in_terminal':
      return { active: `Typing in terminal: "${args.text}"`, completed: `Typed in terminal: "${args.text}"` };
    default:
      return { active: toolName, completed: toolName };
  }
}

/**
 * Get a more detailed description for confirmation dialogs
 */
export function getConfirmationDescription(
  toolName: string,
  args: Record<string, unknown>,
  type: 'destructive' | 'file-picker' | 'external-browser' = 'destructive',
): string {
  if (toolName === 'click_element') {
    const element = (args.element as string)?.toLowerCase() || '';

    const buttonName = args.element as string;

    // File picker descriptions - include button name
    if (type === 'file-picker') {
      if (element.includes('folder') || element.includes('directory')) {
        return `Click "${buttonName}"\n\nThis will open a folder picker dialog.`;
      }
      return `Click "${buttonName}"\n\nThis will open a file picker dialog.`;
    }

    // External browser descriptions - include button name
    if (type === 'external-browser') {
      return `Click "${buttonName}"\n\nThis will open your web browser.`;
    }

    // Destructive action descriptions - include button name
    if (element.includes('delete')) {
      return `Click "${buttonName}"\n\nThis will permanently delete the selected resource. This action cannot be undone.`;
    }
    if (element.includes('remove')) {
      return `Click "${buttonName}"\n\nThis will remove the selected resource from Podman Desktop.`;
    }
    if (element.includes('stop')) {
      return `Click "${buttonName}"\n\nThis will stop the running container. Any unsaved data may be lost.`;
    }
    if (element.includes('kill')) {
      return `Click "${buttonName}"\n\nThis will forcefully terminate the container immediately without graceful shutdown.`;
    }
    if (element.includes('prune')) {
      return `Click "${buttonName}"\n\nThis will remove all unused resources to free up space. This may affect multiple items.`;
    }

    return `Click "${buttonName}"\n\nPlease confirm this action.`;
  }

  return getBrowserActionDescription(toolName, args).active;
}
