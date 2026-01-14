<script lang="ts">
import { onMount, tick } from 'svelte';
import { get } from 'svelte/store';
import { router } from 'tinro';

import { containersInfos } from '/@/stores/containers';
import { imagesInfos } from '/@/stores/images';
import { providerInfos } from '/@/stores/providers';
import { clearMessages, generateMessageId, selkieModeConfig, selkieModeMessages } from '/@/stores/selkie-mode-store';
import type { ChatMessage, ContextLevel, SelkieModeConfig, ToolCall } from '/@api/selkie-mode-info';

import {
  AI_BROWSER_TOOLS,
  executeBrowserTool,
  getBrowserActionDescription,
  getConfirmationDescription,
} from './ai-browser-tools';
import { CONTEXT_LIMITS } from './ai-constants';
import { AIService, AIServiceError, loadAIConfig } from './ai-service';

interface Props {
  display?: boolean;
  onclose?: () => void;
}

interface ActionStep {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  action: string;
  completedAction?: string; // Past tense version for when step is complete
  detail?: string;
  timestamp: number;
  duration?: number; // Duration in ms
  icon?: 'thinking' | 'looking' | 'clicking' | 'typing';
}

// Tools that require confirmation (destructive clicks)
const DESTRUCTIVE_PATTERNS = ['delete', 'remove', 'stop', 'kill', 'prune'];

// Tools that mutate page state - after these, we should return to AI to reassess
const MUTATING_TOOLS = ['click_element', 'fill_input', 'toggle_checkbox', 'select_option', 'navigate_to_route'];

// File picker patterns - these open native dialogs that AI can't interact with
const FILE_PICKER_PATTERNS = [
  'browse',
  'select file',
  'select a ',
  'choose file',
  'choose a ',
  'select folder',
  'choose folder',
  'open file',
  'pick file',
  'upload',
  '.yaml',
  '.yml',
  '.json',
  '.tar',
  '.gz',
];

// External browser patterns - actions that will open the user's web browser
const EXTERNAL_BROWSER_PATTERNS = [
  'open browser',
  'open in browser',
  'open documentation',
  'open docs',
  'open website',
  'open link',
  'open url',
  'visit website',
  'go to website',
];

// Default max steps (can be overridden in config)
const DEFAULT_MAX_STEPS = 30;

/**
 * Prunes conversation history based on context level to reduce token usage.
 * Always keeps: the original user message (first message)
 * Then keeps the N most recent message pairs based on context level.
 */
function pruneMessages(messages: ChatMessage[], contextLevel: ContextLevel): ChatMessage[] {
  const limit = CONTEXT_LIMITS[contextLevel];

  // Full context: return everything
  if (limit === Infinity) {
    return messages;
  }

  // Always keep the first user message
  const userMessage = messages.find(m => m.role === 'user');
  if (!userMessage) {
    return messages;
  }

  // Get messages after the user message
  const userIndex = messages.indexOf(userMessage);
  const conversationMessages = messages.slice(userIndex + 1);

  // Count assistant messages (each one typically has a following tool result)
  // We want to keep the last N "exchanges"
  const assistantIndices: number[] = [];
  conversationMessages.forEach((msg, idx) => {
    if (msg.role === 'assistant') {
      assistantIndices.push(idx);
    }
  });

  // If we have fewer exchanges than the limit, keep everything
  if (assistantIndices.length <= limit) {
    return messages;
  }

  // Find the cutoff point - keep messages from the (limit)th-to-last assistant message onwards
  const cutoffAssistantIndex = assistantIndices[assistantIndices.length - limit];
  const prunedConversation = conversationMessages.slice(cutoffAssistantIndex);

  return [userMessage, ...prunedConversation];
}

let { display = false, onclose }: Props = $props();

let inputElement: HTMLTextAreaElement | undefined = $state(undefined);
let inputValue: string = $state('');
let config: SelkieModeConfig | null = $state(null);
let aiService: AIService | null = $state(null);
let pendingConfirmation: {
  toolName: string;
  args: Record<string, unknown>;
  toolCallId: string;
  type: 'destructive' | 'file-picker' | 'external-browser';
} | null = $state(null);
let pendingQuestion: {
  question: string;
  options: string[];
  toolCallId: string;
} | null = $state(null);
let questionInputValue: string = $state('');
let actionSteps: ActionStep[] = $state([]);
let isProcessing: boolean = $state(false);
let lastResult: string = $state('');
let showMainPrompt: boolean = $state(true);
let commandHistory: string[] = $state([]);
let historyIndex: number = $state(-1);
let tempInput: string = $state(''); // Store current input when navigating history
let turnCount: number = $state(0); // Track conversation turns to prevent infinite loops
let stepsScrollContainer: HTMLDivElement | undefined = $state(undefined);
let completionState: 'none' | 'success' | 'error' = $state('none');
let actionsCollapsed: boolean = $state(false);
let taskStartTime: number = $state(0);
let isPaused: boolean = $state(false);
let pauseResolver: ((resume: boolean) => void) | null = $state(null);
let recentActions: string[] = $state([]); // Track recent actions for loop detection
let totalTokens: number = $state(0); // Track total tokens used in this task
let displayedTokens: number = $state(0); // Animated display value for smooth ticker

// Format tokens as "2.8k" style
function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${Math.round(tokens / 1000)}k`;
}

// Animate displayed tokens toward actual total
$effect(() => {
  if (totalTokens === displayedTokens) return;

  const diff = totalTokens - displayedTokens;
  const step = Math.max(1, Math.ceil(Math.abs(diff) / 20)); // Animate in ~20 frames
  const direction = diff > 0 ? 1 : -1;

  const timer = setInterval(() => {
    displayedTokens += step * direction;
    if ((direction > 0 && displayedTokens >= totalTokens) || (direction < 0 && displayedTokens <= totalTokens)) {
      displayedTokens = totalTokens;
      clearInterval(timer);
    }
  }, 16); // ~60fps

  return (): void => clearInterval(timer);
});

// Get the current status based on what's actually happening
const currentStatus = $derived(() => {
  // Find the current running step
  const runningStep = actionSteps.find(s => s.status === 'running');
  if (runningStep) {
    return runningStep.action;
  }

  // If no running step, show last completed or a default
  const lastStep = actionSteps[actionSteps.length - 1];
  if (lastStep?.status === 'complete') {
    return 'Thinking...';
  }

  return 'Starting...';
});

// Calculate total elapsed time
const totalElapsedTime = $derived(taskStartTime > 0 && !isProcessing ? Date.now() - taskStartTime : 0);

function addStep(
  action: string,
  detail?: string,
  icon?: ActionStep['icon'],
  completedAction?: string,
): ActionStep {
  const step: ActionStep = {
    // eslint-disable-next-line sonarjs/pseudo-random -- safe for UI IDs
    id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    status: 'running',
    action,
    completedAction,
    detail,
    timestamp: Date.now(),
    icon,
  };
  actionSteps = [...actionSteps, step];
  return step;
}

function updateStep(id: string, status: ActionStep['status'], detail?: string): void {
  actionSteps = actionSteps.map(s => {
    if (s.id !== id) return s;
    const duration = status !== 'running' ? Date.now() - s.timestamp : undefined;
    return { ...s, status, detail: detail ?? s.detail, duration };
  });
}

function clearSteps(): void {
  actionSteps = [];
  lastResult = '';
  completionState = 'none';
  actionsCollapsed = false;
  taskStartTime = 0;
  isPaused = false;
  pauseResolver = null;
  pendingConfirmation = null;
  pendingQuestion = null;
  questionInputValue = '';
  recentActions = [];
  totalTokens = 0;
  displayedTokens = 0;
}

// Detect if we're in a loop (same action repeated multiple times)
function detectLoop(toolName: string, args: Record<string, unknown>): boolean {
  // These tools are OK to repeat - they're meant to be called multiple times
  const repeatableTools = ['wait_for_operation', 'get_page_content', 'get_current_route'];
  if (repeatableTools.includes(toolName)) {
    return false;
  }

  const actionKey = `${toolName}:${JSON.stringify(args)}`;

  // Check for navigation ping-pong (A -> B -> A -> B pattern)
  if (toolName === 'navigate_to_route') {
    const navActions = recentActions.filter(a => a.startsWith('navigate_to_route:'));
    if (navActions.length >= 3) {
      const lastThree = navActions.slice(-3);
      // Detect A -> B -> A pattern
      if (lastThree[0] === actionKey && lastThree[2] === actionKey) {
        return true;
      }
    }
  }

  // Check for same click action repeated 4+ times (more lenient)
  if (toolName === 'click_element') {
    const clickCount = recentActions.filter(a => a === actionKey).length;
    if (clickCount >= 3) {
      return true;
    }
  }

  // Track this action
  recentActions = [...recentActions.slice(-14), actionKey]; // Keep last 15
  return false;
}

onMount(async () => {
  config = await loadAIConfig();
  selkieModeConfig.set(config);
  if (config) {
    aiService = new AIService(config);
  }
});

$effect(() => {
  if (display && inputElement) {
    tick()
      .then(() => inputElement?.focus())
      .catch((e: unknown) => console.error('Failed to focus input', e));
  }
});

// Auto-scroll action steps to bottom when new steps appear
$effect(() => {
  // Trigger on actionSteps changes
  const _stepsCount = actionSteps.length;
  if (stepsScrollContainer && _stepsCount > 0) {
    tick()
      .then(() => {
        if (stepsScrollContainer) {
          stepsScrollContainer.scrollTo({
            top: stepsScrollContainer.scrollHeight,
            behavior: 'smooth',
          });
        }
      })
      .catch((e: unknown) => console.error('Failed to scroll', e));
  }
});

// Auto-resize textarea based on content
$effect(() => {
  // Reference inputValue to trigger on changes
  const _value = inputValue;
  if (inputElement && _value !== undefined) {
    // Reset height to auto to get the correct scrollHeight
    inputElement.style.height = 'auto';
    // Set height to scrollHeight, capped by max-h-32 (8rem = 128px)
    inputElement.style.height = `${Math.min(inputElement.scrollHeight, 128)}px`;
  }
});

async function handleKeydown(e: KeyboardEvent): Promise<void> {
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'x') {
    if (!display) {
      // Opening - load config
      config = await loadAIConfig();
      selkieModeConfig.set(config);
      if (config) {
        aiService = new AIService(config);
      }
      // Only reset to fresh state if not currently processing or showing results
      if (!isProcessing && !isPaused && completionState === 'none') {
        clearSteps();
        showMainPrompt = true;
      }
      // If processing/paused/completed, just show the current state
    }
    display = !display;
    e.preventDefault();
    return;
  }

  if (e.key === 'Escape' && display) {
    if (pendingConfirmation) {
      pendingConfirmation = null;
    } else {
      hideModal();
    }
    e.preventDefault();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey && display && document.activeElement === inputElement) {
    e.preventDefault();
    executeCommand().catch((err: unknown) => console.error('Failed to execute command', err));
  }

  // Arrow up - previous command in history
  if (e.key === 'ArrowUp' && display && document.activeElement === inputElement && commandHistory.length > 0) {
    e.preventDefault();
    if (historyIndex === -1) {
      // Save current input before navigating
      tempInput = inputValue;
      historyIndex = commandHistory.length - 1;
    } else if (historyIndex > 0) {
      historyIndex--;
    }
    inputValue = commandHistory[historyIndex] ?? '';
  }

  // Arrow down - next command in history
  if (e.key === 'ArrowDown' && display && document.activeElement === inputElement) {
    e.preventDefault();
    if (historyIndex === -1) {
      // Already at the end, do nothing
    } else if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      inputValue = commandHistory[historyIndex] ?? '';
    } else {
      // Return to current input
      historyIndex = -1;
      inputValue = tempInput;
    }
  }
}

function hideModal(): void {
  display = false;
  onclose?.();
}

function handleMousedown(e: MouseEvent): void {
  if (!display) return;
  const target = e.target as HTMLElement;
  if (target.closest('.selkie-mode-modal')) return;
  if (target.closest('.selkie-mode-steps')) return;
  if (target.closest('.selkie-mode-pause')) return;
  if (target.closest('.selkie-mode-confirmation')) return;

  // Don't hide if there's a pending confirmation
  if (pendingConfirmation) return;

  // Pause automation if clicking during processing
  if (isProcessing && !isPaused) {
    e.preventDefault();
    e.stopPropagation();
    pauseAutomation();
    return;
  }

  // Don't hide if paused - user needs to choose resume/stop
  if (isPaused) return;

  hideModal();
}

function pauseAutomation(): void {
  isPaused = true;
}

function resumeAutomation(): void {
  isPaused = false;
  if (pauseResolver) {
    pauseResolver(true);
    pauseResolver = null;
  }
}

function stopAutomation(): void {
  isPaused = false;
  if (pauseResolver) {
    pauseResolver(false);
    pauseResolver = null;
  }
  aiService?.abort();
  isProcessing = false;
  lastResult = 'Automation stopped by user.';
  completionState = 'error';
}

// Call this before each tool execution to check if paused
async function checkPauseState(): Promise<boolean> {
  if (!isPaused) return true; // Continue

  // Wait for user to resume or stop
  return new Promise<boolean>(resolve => {
    pauseResolver = resolve;
  });
}

function buildSystemPrompt(): string {
  const providers = get(providerInfos);
  const containers = get(containersInfos);
  const images = get(imagesInfos);

  const runningContainers = containers.filter(c => c.State === 'running').length;
  const totalContainers = containers.length;
  const totalImages = images.length;

  const engineStatus = providers
    .map(p => {
      const connections = p.containerConnections || [];
      const running = connections.filter(c => c.status === 'started').length;
      return `${p.name}: ${running}/${connections.length} connections`;
    })
    .join(', ');

  // Log the full prompt for debugging
  const prompt = `You are a Podman Desktop UI automation agent. Communicate ONLY via tool calls.

# RULES
1. ONLY use tool calls - never plain text output
2. Questions → ask_user(question, options[]) - NEVER as text
3. Done → task_complete(summary, success) - REQUIRED
4. navigate/click return page state - don't call get_page_content after

# STATE
Route: ${get(router).path ?? '/'} | Engines: ${engineStatus || 'none'} | Containers: ${runningContainers}/${totalContainers} | Images: ${totalImages}

# ROUTES
/ = Dashboard (overview)
/containers = Container list (start/stop/delete/logs)
/images = Image list (pull/run/delete) - START HERE to create containers
/pods = Pod management (Podman only)
/volumes = Volume management
/networks = Network management
/kubernetes = K8s resources (pods/deployments/services)
/preferences/resources = Create Podman machines, Kubernetes (Kind, Minikube) clusters
/preferences/registries = Registry authentication

# KEY WORKFLOWS
Create container: /images → pull if needed → "Run Image" on row → configure → "Start Container"
  (NOT /containers - no create button there)
Pull image: /images → "Pull" → fill "Image to Pull" → "Pull image" → wait_for_operation()
Image names: use full names (docker.io/library/nginx:latest, NOT nginx)
Create pod: /containers → select multiple containers using checkboxes → "Create Pod" button appears → click it
Terminal commands: Click "Terminal" tab FIRST (never use "Tty" tab) → focus_terminal() → type_in_terminal()

# BULK OPERATIONS (use for multiple items)
Lists have checkboxes for bulk actions. ALWAYS prefer bulk operations over one-by-one actions.
1. Click "Toggle all" to select all, OR use toggle_checkbox with "Select {name}" for individual items (e.g., "Select redis-container")
2. After selection, new bulk action buttons appear (e.g., "Delete selected containers and pods", "Delete N selected items", "Create Pod")
3. Click the bulk action button shown in the page state

# ELEMENT MATCHING
Match by: visible text, aria-label, placeholder (case-insensitive partial match)
Use EXACT text from page state. For duplicate buttons, use aria-label.

# DECISION
Ambiguous task → ask_user() with options | Clear completion → task_complete(summary, true) | Failed → task_complete(reason, false)
NEVER: task_complete with a question | NEVER: plain text questions`;

  console.log('%c[Selkie Mode] System Prompt', 'color: #f59e0b; font-weight: bold');
  console.log(prompt);

  return prompt;
}

async function executeCommand(): Promise<void> {
  if (!inputValue.trim() || isProcessing || !aiService || !config?.apiKey) {
    if (!config?.apiKey) {
      lastResult = 'Please configure your API key in Settings → Selkie Mode';
    }
    return;
  }

  const command = inputValue.trim();
  inputValue = '';
  clearSteps();
  isProcessing = true;
  showMainPrompt = false; // Hide main prompt when processing
  clearMessages();
  turnCount = 0; // Reset turn counter for new command
  taskStartTime = Date.now(); // Track when task started

  // Add to history (avoid duplicates of last command)
  if (command && (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== command)) {
    commandHistory = [...commandHistory, command];
  }
  historyIndex = -1; // Reset history navigation
  tempInput = '';

  const thinkingStep = addStep('Understanding command', command, 'thinking');

  const userMessage: ChatMessage = {
    id: generateMessageId(),
    role: 'user',
    content: command,
    timestamp: Date.now(),
  };

  const systemMessage: ChatMessage = {
    id: 'system',
    role: 'system',
    content: buildSystemPrompt(),
    timestamp: Date.now(),
  };

  selkieModeMessages.update(msgs => [...msgs, userMessage]);

  try {
    const response = await aiService.chat([systemMessage, userMessage], AI_BROWSER_TOOLS);
    if (response.usage) {
      totalTokens += response.usage.totalTokens;
    }
    updateStep(thinkingStep.id, 'complete');

    // Check if paused while waiting for initial API response
    if (isPaused) {
      const continueAfterApi = await checkPauseState();
      if (!continueAfterApi) {
        return;
      }
    }

    if (response.toolCalls && response.toolCalls.length > 0) {
      // Add the assistant message with tool_calls to conversation history
      // This is required - message order must be: user → assistant (with tool_calls) → tool
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
        timestamp: Date.now(),
      };
      selkieModeMessages.update(msgs => [...msgs, assistantMessage]);

      // Don't set lastResult here - wait for final response
      await handleToolCalls(response.toolCalls);
    } else if (response.content) {
      // AI returned text instead of tool calls - this is a protocol violation
      // Check if it looks like a question (the AI should have used ask_user)
      const looksLikeQuestion =
        response.content.includes('?') ||
        /\b(which|what|how|would you|do you|should|prefer|want|like)\b/i.test(response.content);

      if (looksLikeQuestion) {
        // AI asked a question in text instead of using ask_user - mark as error
        lastResult = `Model error: This model output a question as text instead of using the ask_user tool. Try a model with better tool-use support (Claude, GPT-4, Gemini Pro).\n\nAI said: "${response.content.substring(0, 200)}${response.content.length > 200 ? '...' : ''}"`;
        completionState = 'error';
        actionsCollapsed = true;
      } else {
        // AI returned a statement - treat as implicit completion but warn
        console.warn('[Selkie Mode] AI returned text instead of tool calls:', response.content);
        lastResult = response.content;
      }
    }

    // Mark as success if we got here without errors
    if (completionState === 'none') {
      completionState = 'success';
      actionsCollapsed = true; // Collapse actions on success
    }
  } catch (error) {
    updateStep(thinkingStep.id, 'error');
    completionState = 'error';
    if (error instanceof AIServiceError) {
      lastResult = `${error.message}`;
    } else {
      lastResult = `${error}`;
    }
  } finally {
    // Only set isProcessing to false if not waiting for confirmation or question
    // (those flows will manage their own state)
    if (!pendingConfirmation && !pendingQuestion) {
      isProcessing = false;
    }
    // Don't auto-show main prompt - let user dismiss the results first
  }
}

function isDestructiveAction(toolName: string, args: Record<string, unknown>): boolean {
  if (toolName === 'click_element') {
    const element = (args.element as string)?.toLowerCase() || '';
    return DESTRUCTIVE_PATTERNS.some(pattern => element.includes(pattern));
  }
  return false;
}

function isFilePickerAction(toolName: string, args: Record<string, unknown>): boolean {
  if (toolName === 'click_element') {
    const element = (args.element as string)?.toLowerCase() || '';
    return FILE_PICKER_PATTERNS.some(pattern => element.includes(pattern));
  }
  return false;
}

function isExternalBrowserAction(toolName: string, args: Record<string, unknown>): boolean {
  if (toolName === 'click_element') {
    const element = (args.element as string)?.toLowerCase() || '';
    return EXTERNAL_BROWSER_PATTERNS.some(pattern => element.includes(pattern));
  }
  return false;
}

async function handleToolCalls(toolCalls: ToolCall[]): Promise<void> {
  // Execute tool calls, but stop after mutating actions to let AI reassess page state
  const toolResults: {
    toolCallId: string;
    toolName: string;
    result: { success: boolean; data?: unknown; error?: string };
  }[] = [];
  let hasDestructiveAction = false;
  let taskCompleted = false;
  let hadMutatingAction = false;

  for (const toolCall of toolCalls) {
    // Check if paused/stopped before each tool
    const shouldContinue = await checkPauseState();
    if (!shouldContinue) {
      return; // User stopped
    }

    const args = JSON.parse(toolCall.function.arguments);
    const toolName = toolCall.function.name;
    const description = getBrowserActionDescription(toolName, args);

    // If we already had a mutating action, skip remaining tool calls
    // The AI planned these based on old page state - need to reassess first
    if (hadMutatingAction) {
      console.log(`[Selkie Mode] Skipping ${toolName} - need to reassess after page mutation`);
      break;
    }

    // Check for loops (skip for task_complete and get_page_content)
    if (toolName !== 'task_complete' && toolName !== 'get_page_content') {
      if (detectLoop(toolName, args)) {
        console.warn(`[Selkie Mode] Loop detected: ${toolName}`, args);
        addStep('Loop detected - stopping', 'AI was repeating the same actions');
        lastResult =
          'Stopped: AI was stuck in a loop repeating the same actions. Try rephrasing your request or breaking it into smaller steps.';
        completionState = 'error';
        return;
      }
    }

    // Check if this is a destructive action that needs confirmation
    if (config?.confirmDestructive && isDestructiveAction(toolName, args)) {
      pendingConfirmation = { toolName, args, toolCallId: toolCall.id, type: 'destructive' };
      hasDestructiveAction = true;
      break; // Stop here and wait for confirmation
    }

    // Check if this is an external browser action (let user know we're opening their browser)
    // NOTE: Must check BEFORE file picker since "browser" contains "browse"
    if (isExternalBrowserAction(toolName, args)) {
      pendingConfirmation = { toolName, args, toolCallId: toolCall.id, type: 'external-browser' };
      hasDestructiveAction = true; // Reuse the same flow
      break; // Stop here and wait for confirmation
    }

    // Check if this is a file picker action (always needs confirmation since AI can't interact with native dialogs)
    if (isFilePickerAction(toolName, args)) {
      pendingConfirmation = { toolName, args, toolCallId: toolCall.id, type: 'file-picker' };
      hasDestructiveAction = true; // Reuse the same flow
      break; // Stop here and wait for user to select file
    }

    // Check if AI is asking a question - needs user input before continuing
    if (toolName === 'ask_user') {
      const questionData = args as { question: string; options?: string[] };
      pendingQuestion = {
        question: questionData.question,
        options: questionData.options ?? [],
        toolCallId: toolCall.id,
      };
      // Don't add a step here - the question UI is already visible
      break; // Stop here and wait for user response
    }

    // Execute the tool and collect results
    const result = await executeToolWithVisualization(toolName, args, description);
    if (!result.success && result.error === 'Stopped by user') {
      return; // User stopped during tool execution
    }
    toolResults.push({ toolCallId: toolCall.id, toolName, result });

    // Check again after tool execution
    if (isPaused) {
      const continueAfterTool = await checkPauseState();
      if (!continueAfterTool) {
        return;
      }
    }

    // Check if this is the task_complete tool
    if (toolName === 'task_complete') {
      taskCompleted = true;
      lastResult = String(args.summary ?? result.data ?? 'Task completed');
      completionState = args.success ? 'success' : 'error';
      actionsCollapsed = true;
    }

    // If a tool failed, we can still continue but log it
    if (!result.success && toolName !== 'task_complete') {
      console.warn(`[Selkie Mode] Tool ${toolName} failed:`, result.error);
    }

    // Track if this was a mutating action - we'll stop after this iteration
    // to let the AI reassess the page state before further actions
    if (MUTATING_TOOLS.includes(toolName)) {
      hadMutatingAction = true;
    }
  }

  // Add "skipped" results for tool calls we didn't execute (required by some APIs like Mistral)
  const processedToolCallIds = new Set(toolResults.map(r => r.toolCallId));
  for (const toolCall of toolCalls) {
    if (!processedToolCallIds.has(toolCall.id)) {
      toolResults.push({
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        result: {
          success: false,
          error: 'Skipped: executing tool calls sequentially to assess page state after each action',
        },
      });
    }
  }

  // If we hit a destructive action, don't continue yet
  if (hasDestructiveAction) {
    return;
  }

  // If AI asked a question, don't continue yet - wait for user response
  if (pendingQuestion) {
    return;
  }

  // If task_complete was called, we're done - don't continue the conversation
  if (taskCompleted) {
    return;
  }

  // Add ALL tool results to messages
  for (const { toolCallId, toolName: resultToolName, result } of toolResults) {
    const toolResultMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'tool',
      content: JSON.stringify(result),
      toolCallId,
      toolName: resultToolName, // Required by Gemini API
      timestamp: Date.now(),
    };
    selkieModeMessages.update(msgs => [...msgs, toolResultMessage]);
  }

  // Now continue the conversation with all results
  await continueConversation();
}

async function continueConversation(): Promise<void> {
  if (!aiService) return;

  // Check if paused before continuing
  const shouldContinue = await checkPauseState();
  if (!shouldContinue) {
    return;
  }

  // Check turn limit to prevent infinite loops
  turnCount++;
  const maxSteps = config?.maxSteps ?? DEFAULT_MAX_STEPS;
  if (turnCount > maxSteps) {
    console.warn(`[Selkie Mode] Reached max steps (${maxSteps}), stopping`);
    lastResult = `Reached maximum steps (${maxSteps}). Task may be incomplete.`;
    completionState = 'error';
    return;
  }

  const systemMessage: ChatMessage = {
    id: 'system',
    role: 'system',
    content: buildSystemPrompt(),
    timestamp: Date.now(),
  };

  // Track timing for AI response (but don't add as a visible step - currentStatus shows "Thinking...")
  const thinkingStartTime = Date.now();

  try {
    // Prune messages based on context level to reduce token usage
    const contextLevel = config?.contextLevel ?? 'standard';
    const allMessages = get(selkieModeMessages);
    const prunedMessages = pruneMessages(allMessages, contextLevel);

    if (prunedMessages.length < allMessages.length) {
      console.log(
        `[Selkie Mode] Pruned messages: ${allMessages.length} → ${prunedMessages.length} (context: ${contextLevel})`,
      );
    }

    const response = await aiService.chat([systemMessage, ...prunedMessages], AI_BROWSER_TOOLS);
    if (response.usage) {
      totalTokens += response.usage.totalTokens;
    }
    const thinkingDuration = Date.now() - thinkingStartTime;
    console.log(`[Selkie Mode] AI response took ${thinkingDuration}ms`);

    // Check if paused while waiting for API response
    if (isPaused) {
      const continueAfterApi = await checkPauseState();
      if (!continueAfterApi) {
        return;
      }
    }

    if (response.toolCalls && response.toolCalls.length > 0) {
      // Add the assistant message with tool_calls to conversation history
      // This is required - message order must be: user → assistant (with tool_calls) → tool
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
        timestamp: Date.now(),
      };
      selkieModeMessages.update(msgs => [...msgs, assistantMessage]);

      // AI wants to do more - continue the loop
      await handleToolCalls(response.toolCalls);
    } else if (response.content) {
      // AI returned text instead of tool calls - this is a protocol violation
      // Check if it looks like a question (the AI should have used ask_user)
      const looksLikeQuestion =
        response.content.includes('?') ||
        /\b(which|what|how|would you|do you|should|prefer|want|like)\b/i.test(response.content);

      if (looksLikeQuestion) {
        // AI asked a question in text instead of using ask_user - mark as error
        lastResult = `Model error: This model output a question as text instead of using the ask_user tool. Try a model with better tool-use support (Claude, GPT-4, Gemini Pro).\n\nAI said: "${response.content.substring(0, 200)}${response.content.length > 200 ? '...' : ''}"`;
        completionState = 'error';
      } else {
        // AI returned a statement - treat as implicit completion but warn
        console.warn('[Selkie Mode] AI returned text instead of tool calls:', response.content);
        lastResult = response.content;
        completionState = 'success';
      }
      actionsCollapsed = true;
    }
  } catch (error) {
    completionState = 'error';
    if (error instanceof AIServiceError) {
      lastResult = error.message;
    } else {
      lastResult = String(error);
    }
  }
}

function getStepIcon(toolName: string): ActionStep['icon'] {
  switch (toolName) {
    case 'get_page_content':
    case 'get_current_route':
    case 'get_console_errors':
      return 'looking';
    case 'click_element':
    case 'toggle_checkbox':
      return 'clicking';
    case 'fill_input':
    case 'select_option':
      return 'typing';
    default:
      return undefined;
  }
}

async function executeToolWithVisualization(
  toolName: string,
  args: Record<string, unknown>,
  description: { active: string; completed: string },
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Check if paused before executing
  const shouldContinue = await checkPauseState();
  if (!shouldContinue) {
    return { success: false, error: 'Stopped by user' };
  }

  const icon = getStepIcon(toolName);
  const step = addStep(description.active, undefined, icon, description.completed);

  // Small delay to show the step visually
  await new Promise(resolve => setTimeout(resolve, 200));

  const result = await executeBrowserTool(toolName, args);

  if (result.success) {
    // For page content, show a truncated preview
    let detail = formatResult(result.data);
    if (toolName === 'get_page_content' && typeof result.data === 'string') {
      const lines = result.data.split('\n').slice(0, 3);
      detail = lines.join(' ').substring(0, 100) + '...';
    }
    updateStep(step.id, 'complete', detail);
  } else {
    updateStep(step.id, 'error', result.error);
  }

  return result;
}

function formatResult(data: unknown): string {
  if (typeof data === 'string') {
    if (data.length > 100) {
      return data.substring(0, 100) + '...';
    }
    return data;
  }
  if (Array.isArray(data)) return `Found ${data.length} items`;
  return 'Done';
}

async function handleConfirmation(confirmed: boolean): Promise<void> {
  if (!pendingConfirmation) return;

  const { toolName, args, toolCallId } = pendingConfirmation;
  const description = getBrowserActionDescription(toolName, args);
  pendingConfirmation = null;

  if (confirmed) {
    // isProcessing should already be true, but ensure it is
    isProcessing = true;

    const result = await executeToolWithVisualization(toolName, args, description);

    // Add the result to messages
    const toolResultMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'tool',
      content: JSON.stringify(result),
      toolCallId,
      toolName, // Required by Gemini API
      timestamp: Date.now(),
    };
    selkieModeMessages.update(msgs => [...msgs, toolResultMessage]);

    // Continue the conversation after confirmed action
    await continueConversation();

    // Set isProcessing to false when done (unless another confirmation popped up)
    if (!pendingConfirmation) {
      isProcessing = false;
    }
  } else {
    addStep('Cancelled by user', description);
    lastResult = 'Action cancelled.';
    isProcessing = false;
    showMainPrompt = true; // Show prompt again after cancellation
  }
}

async function handleQuestionResponse(response: string | null): Promise<void> {
  if (!pendingQuestion) return;

  const { toolCallId } = pendingQuestion;
  pendingQuestion = null;
  questionInputValue = '';

  if (response) {
    // User provided a response - continue the conversation with it
    isProcessing = true;

    // Add the user's response as the tool result
    const toolResultMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'tool',
      content: JSON.stringify({ success: true, data: `User response: ${response}` }),
      toolCallId,
      toolName: 'ask_user',
      timestamp: Date.now(),
    };
    selkieModeMessages.update(msgs => [...msgs, toolResultMessage]);

    // Continue the conversation with the user's response
    await continueConversation();

    // Set isProcessing to false when done
    if (!pendingConfirmation && !pendingQuestion) {
      isProcessing = false;
    }
  } else {
    // User cancelled - stop the task
    addStep('Question cancelled', 'User chose not to respond');
    lastResult = 'Task stopped - question was not answered.';
    completionState = 'error';
    isProcessing = false;
  }
}
</script>

<svelte:window onkeydown={handleKeydown} onmousedown={handleMousedown} />

{#if display}
  <!-- Backdrop - only show when main prompt is visible -->
  {#if showMainPrompt}
    <div
      class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
      style="-webkit-app-region: none;"
      onclick={hideModal}
      onkeydown={(e): void => { if (e.key === 'Escape') hideModal(); }}
      role="button"
      tabindex="-1"
      aria-label="Close AI prompt"></div>
  {/if}

  <!-- Automation indicator - shows when AI is working, asking question, or needs confirmation -->
  {#if isProcessing && !showMainPrompt && !isPaused}
    <!-- Backdrop overlay -->
    <div
      class="fixed inset-0 z-40 {pendingQuestion || pendingConfirmation ? 'bg-amber-500/8' : 'bg-purple-500/5'} transition-opacity duration-300"
      style="-webkit-app-region: none;"></div>
    <div
      class="fixed inset-0 z-100 flex items-center justify-center pointer-events-auto"
      style="-webkit-app-region: none;"
      data-ai-ignore>
      <div class="selkie-mode-steps bg-[var(--pd-content-bg)] rounded-lg shadow-xl border border-[var(--pd-content-card-border)] {pendingQuestion ? 'w-96' : 'w-80'} max-w-[90vw]">

        <!-- Header -->
        <div class="p-5">
          <div class="flex items-start gap-4">
            <pre class="text-[var(--pd-content-card-text)] opacity-30 text-[10px] leading-tight font-mono select-none shrink-0">{pendingQuestion ? `  .---.
 / ?_? \\
>(     )
  '---'` : pendingConfirmation ? `  .---.
 / O_O \\
>(  !  )
  '---'` : `  .---.
 / ᵔᴥᵔ \\
>(     )
  '---'`}</pre>
            <div class="flex-1 min-w-0 pt-1 overflow-hidden">
              <div class="text-[var(--pd-content-card-text)] text-sm font-mono mb-2 truncate {pendingQuestion || pendingConfirmation ? 'text-amber-500' : ''}">
                {#if pendingQuestion}
                  <span>Question</span>
                {:else if pendingConfirmation}
                  <span>{pendingConfirmation.type === 'file-picker' ? 'Select File' : pendingConfirmation.type === 'external-browser' ? 'Open Browser' : 'Confirm Action'}</span>
                {:else}
                  <span class="animated-dots">{currentStatus()}</span>
                {/if}
              </div>
              <div class="text-[10px] text-[var(--pd-content-card-text)] opacity-40 font-mono tracking-wide whitespace-nowrap">
                {#if pendingQuestion ?? pendingConfirmation}
                  REQUIRES YOUR INPUT
                {:else}
                  STEP {actionSteps.length} · TURN {turnCount}{#if displayedTokens > 0} · <span class="tabular-nums">{formatTokens(displayedTokens)}</span> TOKENS{/if}
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Question content -->
        {#if pendingQuestion}
          <div class="border-t border-[var(--pd-content-card-border)] px-5 py-4">
            <div class="text-sm text-[var(--pd-content-card-text)] font-mono leading-relaxed">
              {pendingQuestion.question}
            </div>
          </div>
          {#if pendingQuestion.options.length > 0}
            <div class="border-t border-[var(--pd-content-card-border)] px-5 py-3">
              <div class="flex flex-wrap gap-2">
                {#each pendingQuestion.options as option (option)}
                  <button
                    onclick={(): void => { handleQuestionResponse(option).catch((e: unknown) => console.error('Question response failed', e)); }}
                    aria-label="Select option: {option}"
                    class="px-3 py-1.5 text-xs font-mono bg-purple-500/10 text-purple-500 rounded hover:bg-purple-500/20 transition-colors">
                    {option}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
          <div class="border-t border-[var(--pd-content-card-border)] px-5 py-3">
            <div class="flex gap-2">
              <input
                bind:value={questionInputValue}
                onkeydown={(e: KeyboardEvent): void => { if (e.key === 'Enter' && questionInputValue.trim()) { handleQuestionResponse(questionInputValue.trim()).catch((err: unknown) => console.error('Question response failed', err)); } }}
                placeholder={pendingQuestion.options.length > 0 ? 'Or type a response...' : 'Type your response...'}
                aria-label="Type your response to the AI question"
                class="flex-1 bg-[var(--pd-content-card-bg)] border border-[var(--pd-content-card-border)] rounded px-3 py-2 text-sm font-mono text-[var(--pd-content-card-text)] placeholder:opacity-40 outline-none focus:border-purple-500/50" />
              <button
                onclick={(): void => { if (questionInputValue.trim()) handleQuestionResponse(questionInputValue.trim()).catch((e: unknown) => console.error('Question response failed', e)); }}
                disabled={!questionInputValue.trim()}
                aria-label="Send response to AI"
                class="px-3 py-2 text-xs font-mono text-purple-500 opacity-80 hover:opacity-100 disabled:opacity-30 transition-opacity tracking-wide">
                SEND
              </button>
            </div>
          </div>
        {/if}

        <!-- Confirmation content -->
        {#if pendingConfirmation}
          <div class="border-t border-[var(--pd-content-card-border)] px-5 py-4">
            <div class="text-xs text-[var(--pd-content-card-text)] font-mono leading-relaxed">
              {getConfirmationDescription(pendingConfirmation.toolName, pendingConfirmation.args, pendingConfirmation.type)}
            </div>
            {#if pendingConfirmation.type === 'file-picker'}
              <div class="text-[10px] text-[var(--pd-content-card-text)] opacity-70 mt-3 font-mono tracking-wide">
                A FILE PICKER WILL OPEN
              </div>
            {:else if pendingConfirmation.type === 'external-browser'}
              <div class="text-[10px] text-[var(--pd-content-card-text)] opacity-70 mt-3 font-mono tracking-wide">
                OPENS IN DEFAULT BROWSER
              </div>
            {/if}
          </div>
        {/if}

        <!-- Steps history (only show when not asking question/confirmation) -->
        {#if !pendingQuestion && !pendingConfirmation && actionSteps.filter(s => s.status === 'complete').length > 0}
          <div bind:this={stepsScrollContainer} class="border-t border-[var(--pd-content-card-border)] px-5 py-3 max-h-32 overflow-y-auto">
            {#each actionSteps.slice(-5) as step (step.id)}
              <div class="flex items-center gap-3 py-1 text-xs font-mono">
                <span class="w-4 text-center shrink-0 {step.status === 'running' ? 'text-purple-500 pulse-slow' : step.status === 'complete' ? 'text-green-600' : 'text-red-500'}">
                  {step.status === 'running' ? '○' : step.status === 'complete' ? '●' : '✕'}
                </span>
                <span class="flex-1 min-w-0 text-[var(--pd-content-card-text)] opacity-60 truncate {step.status === 'running' ? 'animated-dots' : ''}">{step.status === 'complete' && step.completedAction ? step.completedAction : step.action}</span>
                {#if step.duration !== undefined}
                  <span class="text-[10px] text-[var(--pd-content-card-text)] opacity-30 tabular-nums">{step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <!-- Footer -->
        <div class="px-5 py-3 flex items-center justify-between text-xs font-mono border-t border-[var(--pd-content-card-border)]">
          {#if pendingQuestion}
            <button onclick={(): void => { handleQuestionResponse(null).catch((e: unknown) => console.error('Question cancel failed', e)); }} aria-label="Cancel AI question" class="text-[var(--pd-content-card-text)] opacity-40 hover:opacity-100 hover:text-red-500 transition-all tracking-wide">CANCEL</button>
            <span></span>
          {:else if pendingConfirmation}
            <button onclick={(): void => { handleConfirmation(false).catch((e: unknown) => console.error('Cancel failed', e)); }} aria-label="Cancel pending action" class="text-[var(--pd-content-card-text)] opacity-40 hover:opacity-100 transition-opacity tracking-wide">CANCEL</button>
            <button
              onclick={(): void => { handleConfirmation(true).catch((e: unknown) => console.error('Confirmation failed', e)); }}
              aria-label="{pendingConfirmation.type === 'file-picker' ? 'Continue with file picker' : pendingConfirmation.type === 'external-browser' ? 'Open in browser' : 'Confirm action'}"
              class="opacity-80 hover:opacity-100 transition-opacity tracking-wide {pendingConfirmation.type === 'file-picker' ? 'text-purple-500' : pendingConfirmation.type === 'external-browser' ? 'text-blue-500' : 'text-red-500'}">
              {pendingConfirmation.type === 'file-picker' ? 'CONTINUE' : pendingConfirmation.type === 'external-browser' ? 'OPEN' : 'CONFIRM'}
            </button>
          {:else}
            <button onclick={stopAutomation} aria-label="Stop AI automation" class="text-[var(--pd-content-card-text)] opacity-40 hover:opacity-100 hover:text-red-500 transition-all tracking-wide">STOP</button>
            <button onclick={pauseAutomation} aria-label="Pause AI automation" class="text-[var(--pd-content-card-text)] opacity-40 hover:opacity-100 transition-opacity tracking-wide">PAUSE</button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Paused state -->
  {#if isPaused}
    <!-- Backdrop overlay - amber tint to signal attention needed -->
    <div
      class="fixed inset-0 z-40 bg-amber-500/8 transition-opacity duration-300"
      style="-webkit-app-region: none;"></div>
    <div
      class="selkie-mode-pause fixed inset-0 z-100 flex items-center justify-center"
      style="-webkit-app-region: none;"
      data-ai-ignore>
      <div class="selkie-mode-steps bg-[var(--pd-content-bg)] rounded-lg shadow-xl border border-[var(--pd-content-card-border)] w-80 max-w-[90vw]">

        <!-- Header -->
        <div class="p-5">
          <div class="flex items-start gap-4">
            <pre class="text-[var(--pd-content-card-text)] opacity-30 text-[10px] leading-tight font-mono select-none shrink-0">{`  .---.
 / -_- \\
>(     )
  '---'`}</pre>
            <div class="flex-1 min-w-0 pt-1 overflow-hidden">
              <div class="text-amber-500 text-sm font-mono mb-2 pulse-slow truncate">
                Paused
              </div>
              <div class="text-[10px] text-[var(--pd-content-card-text)] opacity-40 font-mono tracking-wide whitespace-nowrap">
                STEP {actionSteps.length} · TURN {turnCount}{#if displayedTokens > 0} · <span class="tabular-nums">{formatTokens(displayedTokens)}</span> TOKENS{/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Steps history -->
        {#if actionSteps.length > 0}
          <div class="border-t border-[var(--pd-content-card-border)] px-5 py-3 max-h-32 overflow-y-auto">
            {#each actionSteps.slice(-5) as step (step.id)}
              <div class="flex items-center gap-3 py-1 text-xs font-mono">
                <span class="w-4 text-center shrink-0 {step.status === 'running' ? 'text-purple-500' : step.status === 'complete' ? 'text-green-600' : 'text-red-500'}">
                  {step.status === 'running' ? '○' : step.status === 'complete' ? '●' : '✕'}
                </span>
                <span class="flex-1 min-w-0 text-[var(--pd-content-card-text)] opacity-60 truncate">{step.status === 'complete' && step.completedAction ? step.completedAction : step.action}</span>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Footer -->
        <div class="px-5 py-3 flex items-center justify-between text-xs font-mono border-t border-[var(--pd-content-card-border)]">
          <button onclick={stopAutomation} aria-label="Stop AI automation" class="text-[var(--pd-content-card-text)] opacity-40 hover:opacity-100 hover:text-red-500 transition-all tracking-wide">STOP</button>
          <button onclick={resumeAutomation} aria-label="Resume AI automation" class="text-purple-500 opacity-80 hover:opacity-100 transition-opacity tracking-wide">RESUME</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main input prompt -->
  {#if showMainPrompt}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style="-webkit-app-region: none;">
      <div
        class="selkie-mode-modal pointer-events-auto w-full max-w-sm mx-6"
        data-ai-ignore>

        <!-- ASCII mascot -->
        <div class="flex justify-center mb-3">
          <pre class="text-white text-xs leading-tight font-mono select-none drop-shadow-md">{`    .---.
   / ᵔᴥᵔ \\
 >(       )
   '-----'`}</pre>
        </div>

        <!-- Title and AI Disclaimer -->
        <div class="flex flex-col items-center mb-5">
          <div class="text-white text-sm font-mono tracking-widest drop-shadow-md mb-3">
            SELKIE MODE
          </div>
          <div class="text-white/80 text-[10px] font-mono tracking-wide text-center leading-relaxed max-w-[280px] drop-shadow">
          </div>
          <div class="text-white/70 text-[9px] font-mono tracking-wide text-center leading-relaxed max-w-[280px] mt-1 drop-shadow">
            Commands are executed by an LLM. Here be dragons.
          </div>
        </div>

        <!-- Input container -->
        <div class="bg-[var(--pd-content-bg)] rounded-lg shadow-2xl border border-[var(--pd-content-card-border)] overflow-hidden">
          <div class="px-4 py-3">
            <textarea
              bind:this={inputElement}
              bind:value={inputValue}
              placeholder={config?.apiKey ? 'Ask anything...' : 'Configure API key in Settings'}
              disabled={isProcessing || !config?.apiKey}
              rows="1"
              aria-label="Enter task for AI to perform"
              class="w-full bg-transparent border-none outline-none text-[var(--pd-content-card-text)] placeholder:text-[var(--pd-content-card-text)] placeholder:opacity-40 text-base font-mono resize-none min-h-6 max-h-32 leading-normal"></textarea>
          </div>
          <div class="px-4 py-2 border-t border-[var(--pd-content-card-border)] flex items-center justify-end">
            <span class="text-[10px] text-[var(--pd-content-card-text)] opacity-40 font-mono truncate max-w-48">{config?.model ?? ''}</span>
          </div>
        </div>

        <!-- Help text -->
        <div class="mt-4 flex items-center justify-center gap-4">
          <span class="text-white/80 text-xs font-mono tracking-wide drop-shadow">
            esc to close
          </span>
          {#if commandHistory.length > 0}
            <span class="text-white/80 text-xs font-mono tracking-wide drop-shadow">
              ↑↓ history
            </span>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Completion state -->
  {#if !isProcessing && !isPaused && completionState !== 'none' && !showMainPrompt}
    <div
      class="fixed inset-0 z-100 flex items-center justify-center pointer-events-auto"
      style="-webkit-app-region: none;"
      data-ai-ignore>
      <div class="selkie-mode-steps bg-[var(--pd-content-bg)] rounded-lg shadow-xl border border-[var(--pd-content-card-border)] w-80 max-w-[90vw]">

        <!-- Header -->
        <div class="p-5">
          <div class="flex items-start gap-4">
            <pre class="text-[var(--pd-content-card-text)] opacity-30 text-[10px] leading-tight font-mono select-none shrink-0">{completionState === 'success' ? `  .---.
 / ^_^ \\
>(     )
  '---'` : `  .---.
 / x_x \\
>(     )
  '---'`}</pre>
            <div class="flex-1 min-w-0 pt-1 overflow-hidden">
              <div class="text-[var(--pd-content-card-text)] text-sm font-mono mb-2 truncate {completionState === 'error' ? 'text-red-500' : ''}">
                {completionState === 'success' ? 'Complete' : 'Failed'}
              </div>
              <div class="text-[10px] text-[var(--pd-content-card-text)] opacity-40 font-mono tracking-wide whitespace-nowrap">
                {actionSteps.length} STEPS · {turnCount} TURNS
                <br>
                {#if totalElapsedTime > 0}
                  {totalElapsedTime < 1000 ? `${totalElapsedTime}ms` : `${(totalElapsedTime / 1000).toFixed(1)}s`}
                {/if}
                {#if displayedTokens > 0} · <span class="tabular-nums">{formatTokens(displayedTokens)}</span> TOKENS{/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Result message -->
        {#if lastResult}
          <div class="border-t border-[var(--pd-content-card-border)] px-5 py-4">
            <div class="text-xs text-[var(--pd-content-card-text)] opacity-70 font-mono leading-relaxed max-h-28 overflow-y-auto">
              {lastResult}
            </div>
          </div>
        {/if}

        <!-- Steps history (collapsible) -->
        {#if actionSteps.length > 0}
          {#if actionsCollapsed}
            <button
              onclick={(): void => { actionsCollapsed = false; }}
              aria-label="Show completed steps"
              class="w-full px-5 py-2 text-left text-[10px] font-mono text-[var(--pd-content-card-text)] opacity-30 hover:opacity-60 border-t border-[var(--pd-content-card-border)] tracking-wide">
              SHOW STEPS
            </button>
          {:else}
            <div class="border-t border-[var(--pd-content-card-border)]">
              <button
                onclick={(): void => { actionsCollapsed = true; }}
                aria-label="Hide completed steps"
                class="w-full px-5 py-2 text-left text-[10px] font-mono text-[var(--pd-content-card-text)] opacity-30 hover:opacity-60 tracking-wide">
                HIDE STEPS
              </button>
              <div class="px-5 pb-3 max-h-64 overflow-y-auto">
                {#each actionSteps as step (step.id)}
                  <div class="flex items-center gap-3 py-1 text-xs font-mono">
                    <span class="w-4 text-center shrink-0 {step.status === 'complete' ? 'text-green-600' : 'text-red-500'}">
                      {step.status === 'complete' ? '●' : '✕'}
                    </span>
                    <span class="flex-1 min-w-0 text-[var(--pd-content-card-text)] opacity-60 truncate">{step.status === 'complete' && step.completedAction ? step.completedAction : step.action}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        <!-- Footer -->
        <div class="px-5 py-3 flex items-center justify-between text-xs font-mono border-t border-[var(--pd-content-card-border)]">
          <button onclick={(): void => { clearSteps(); display = false; }} aria-label="Close Selkie Mode" class="text-[var(--pd-content-card-text)] opacity-40 hover:opacity-100 transition-opacity tracking-wide">CLOSE</button>
          <button onclick={(): void => { clearSteps(); showMainPrompt = true; }} aria-label="Start new AI task" class="text-purple-500 opacity-80 hover:opacity-100 transition-opacity tracking-wide">NEW TASK</button>
        </div>
      </div>
    </div>
  {/if}

{/if}

<style>
  .animated-dots::after {
    content: '';
    animation: dots 1.5s steps(4, end) infinite;
  }

  @keyframes dots {
    0%, 20% { content: ''; }
    40% { content: '.'; }
    60% { content: '..'; }
    80%, 100% { content: '...'; }
  }

  .pulse-slow {
    animation: pulse-opacity 2s ease-in-out infinite;
  }

  @keyframes pulse-opacity {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
