<script lang="ts">
import { faCircleInfo, faFolderOpen, faPlus, faRobot, faTerminal, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from '@podman-desktop/ui-svelte';
import Fa from 'svelte-fa';

import {
  activeHostTerminalTabId,
  addTerminalTab,
  agentFollowUI,
  agentIncludeContext,
  agentWorkingDirectory,
  getNextTabId,
  hostTerminalPanelHeight,
  hostTerminalPanelVisible,
  hostTerminalTabs,
  removeTerminalTab,
} from '/@/stores/host-terminal-store';

import { buildContextArgs, gatherAgentContext } from './agent-context';
import HostTerminalInstance from './HostTerminalInstance.svelte';

interface DetectedAgent {
  binary: string;
  path: string;
  label: string;
}

const MIN_HEIGHT = 120;
const CONTEXT_TOOLTIP =
  'Injects Podman Desktop state into the agent system prompt: running containers, pods, images, volumes, active extensions, and current page.';
const FOLLOW_UI_TOOLTIP =
  'Podman Desktop auto-navigates to follow agent actions. Agents are instructed to prefer the MCP server over CLI when available.';

let panelHeight = $state(300);
let dragging = $state(false);
let startY = 0;
let startHeight = 0;

let detectedAgents = $state<DetectedAgent[]>([]);
let includeContext = $state(false);
let followUI = $state(false);
let showMenu = $state(false);
let menuRef = $state<HTMLDivElement>();
let selectedDir = $state<string | undefined>(undefined);

hostTerminalPanelHeight.subscribe(h => (panelHeight = h));
agentWorkingDirectory.subscribe(d => (selectedDir = d));
agentIncludeContext.subscribe(v => (includeContext = v));
agentFollowUI.subscribe(v => (followUI = v));

$effect(() => {
  if ($hostTerminalPanelVisible && $hostTerminalTabs.length === 0) {
    createTerminal().catch(console.error);
  }
});

async function createTerminal(agent?: DetectedAgent): Promise<void> {
  const tabId = getNextTabId();
  if (agent) {
    let args: string[] | undefined;
    if (includeContext) {
      const context = await gatherAgentContext(selectedDir, followUI);
      args = buildContextArgs(agent.binary, context);
    }
    addTerminalTab(tabId, {
      name: agent.label,
      agentCommand: agent.path,
      agentArgs: args,
      cwd: selectedDir,
    });
  } else {
    addTerminalTab(tabId, selectedDir ? { cwd: selectedDir } : undefined);
  }
  showMenu = false;
}

async function toggleMenu(): Promise<void> {
  if (!showMenu) {
    try {
      detectedAgents = await window.hostTerminalDetectAgents();
    } catch {
      detectedAgents = [];
    }
  }
  showMenu = !showMenu;
}

async function browseDirectory(): Promise<void> {
  const result = await window.openDialog({
    title: 'Select working directory',
    selectors: ['openDirectory'],
  });
  if (result?.[0]) {
    selectedDir = result[0];
    agentWorkingDirectory.set(result[0]);
  }
}

function clearDirectory(): void {
  selectedDir = undefined;
  agentWorkingDirectory.set(undefined);
}

function syncFollowUIConfig(enabled: boolean): void {
  window.updateConfigurationValue('mcp.server.followUI', enabled).catch(console.warn);
}

function displayPath(fullPath: string): string {
  if (fullPath.length <= 30) return fullPath;
  const parts = fullPath.split(/[/\\]/);
  return '.../' + (parts.pop() ?? fullPath);
}

function handleWindowClick(e: MouseEvent): void {
  if (showMenu && menuRef && !menuRef.contains(e.target as Node)) {
    showMenu = false;
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && showMenu) {
    showMenu = false;
  }
}

function closeTab(id: number): void {
  removeTerminalTab(id);
  if ($hostTerminalTabs.length === 0) {
    hostTerminalPanelVisible.set(false);
  }
}

function selectTab(id: number): void {
  activeHostTerminalTabId.set(id);
}

function startResize(e: MouseEvent): void {
  dragging = true;
  startY = e.clientY;
  startHeight = panelHeight;
  e.preventDefault();
}

function onMouseMove(e: MouseEvent): void {
  if (!dragging) return;
  const maxHeight = window.innerHeight - 120;
  const delta = startY - e.clientY;
  const newHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight + delta));
  panelHeight = newHeight;
  hostTerminalPanelHeight.set(newHeight);
  window.dispatchEvent(new Event('host-terminal-resize'));
}

function onMouseUp(): void {
  dragging = false;
}
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} onclick={handleWindowClick} onkeydown={handleKeydown} />

  <div
    class="relative flex flex-col shrink-0 border-y border-[var(--pd-global-nav-bg-border)]"
    class:hidden={!$hostTerminalPanelVisible}
    style="height: {panelHeight}px; min-height: {MIN_HEIGHT}px;">
    <!-- Resize handle -->
    <div
      class="absolute top-0 left-0 w-full h-1.5 -translate-y-1/2 cursor-row-resize z-50 hover:bg-[var(--pd-button-primary-bg)] transition-colors duration-150"
      role="separator"
      aria-orientation="horizontal"
      onmousedown={startResize}>
    </div>

    <!-- Tab bar -->
    <div
      class="flex items-center h-7 shrink-0 bg-[var(--pd-global-nav-bg)] border-b border-[var(--pd-global-nav-bg-border)] text-xs select-none">
      <div class="flex items-center h-full overflow-x-auto">
        {#each $hostTerminalTabs as tab (tab.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="group flex items-center gap-1.5 h-full px-3 border-r border-[var(--pd-global-nav-bg-border)] whitespace-nowrap cursor-pointer
              {tab.id === $activeHostTerminalTabId
              ? 'bg-[var(--pd-content-bg)] text-[var(--pd-content-text)] border-t-2 border-t-[var(--pd-button-primary-bg)]'
              : 'text-[var(--pd-global-nav-icon)] hover:bg-[var(--pd-global-nav-bg-hover)] border-t-2 border-t-transparent'}"
            onclick={(): void => selectTab(tab.id)}>
            <Fa icon={tab.agentCommand ? faRobot : faTerminal} size="0.75x" />
            <span class="max-w-[120px] truncate">{tab.name}</span>
            <button
              class="ml-1 rounded hover:bg-[var(--pd-global-nav-bg-hover)] p-0.5
                {tab.id === $activeHostTerminalTabId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}"
              onclick={(e: MouseEvent): void => { e.stopPropagation(); closeTab(tab.id); }}
              aria-label="Close {tab.name}">
              <Fa icon={faXmark} size="0.7x" />
            </button>
          </div>
        {/each}
      </div>
      <div class="ml-auto flex items-center">
        {#if selectedDir}
          <span
            class="px-2 text-[10px] text-[var(--pd-global-nav-icon)] opacity-60 truncate max-w-[200px] select-text cursor-default"
            title={selectedDir}>
            {displayPath(selectedDir)}
          </span>
        {/if}
        <Tooltip tip="New Terminal" top>
          <button
            class="flex items-center justify-center w-7 h-full text-[var(--pd-global-nav-icon)] hover:bg-[var(--pd-global-nav-bg-hover)]"
            onclick={(): void => { createTerminal().catch(console.error); }}
            aria-label="New Terminal">
            <Fa icon={faPlus} size="0.8x" />
          </button>
        </Tooltip>
        <div class="relative" bind:this={menuRef}>
          <Tooltip tip="Launch AI Agent" top>
            <button
              class="flex items-center justify-center w-7 h-full text-[var(--pd-global-nav-icon)] hover:bg-[var(--pd-global-nav-bg-hover)]"
              onclick={(): void => { toggleMenu().catch(console.error); }}
              aria-label="Launch AI Agent">
              <Fa icon={faRobot} size="0.8x" />
            </button>
          </Tooltip>
          {#if showMenu}
            <div class="absolute top-full right-1 mt-1 z-50 min-w-[220px] py-1 rounded-md shadow-lg
              bg-[var(--pd-content-bg)] border border-[var(--pd-content-card-border)] text-xs">
              {#each detectedAgents as agent (agent.binary)}
                <button
                  class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-[var(--pd-content-text)]
                    hover:bg-[var(--pd-button-primary-bg)] hover:text-[var(--pd-button-primary-text)] cursor-pointer"
                  onclick={(): void => { createTerminal(agent).catch(console.error); }}>
                  <Fa icon={faRobot} size="0.8x" class="w-4 text-center" />
                  {agent.label}
                </button>
              {/each}
              {#if detectedAgents.length === 0}
                <div class="px-3 py-1.5 text-[var(--pd-content-text)] opacity-50">No agents detected</div>
              {/if}
              <div class="border-t border-[var(--pd-content-card-border)] mt-1 pt-1 px-3 py-1.5">
                <div class="flex items-center gap-2 text-[var(--pd-content-text)]">
                  <button
                    class="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer
                      hover:text-[var(--pd-button-primary-bg)] whitespace-nowrap"
                    onclick={(): void => { browseDirectory().catch(console.error); }}
                    aria-label="Select working directory">
                    <Fa icon={faFolderOpen} size="0.8x" class="w-4 text-center shrink-0" />
                    <span class="truncate" title={selectedDir ?? ''}>
                      {selectedDir ? displayPath(selectedDir) : 'Working directory...'}
                    </span>
                  </button>
                  {#if selectedDir}
                    <button
                      class="shrink-0 rounded hover:bg-[var(--pd-global-nav-bg-hover)] p-0.5"
                      onclick={(e: MouseEvent): void => { e.stopPropagation(); clearDirectory(); }}
                      aria-label="Clear working directory">
                      <Fa icon={faXmark} size="0.7x" />
                    </button>
                  {/if}
                </div>
              </div>
              <div class="border-t border-[var(--pd-content-card-border)] mt-1 pt-1 px-3 py-1.5 space-y-1.5">
                <label class="flex items-center gap-2 text-[var(--pd-content-text)] cursor-pointer whitespace-nowrap">
                  <input type="checkbox" bind:checked={followUI} onchange={(): void => { agentFollowUI.set(followUI); syncFollowUIConfig(followUI); }} class="w-4 rounded" />
                  Follow UI
                  <Tooltip tip={FOLLOW_UI_TOOLTIP} bottom>
                    <span class="ml-auto text-[var(--pd-global-nav-icon)] opacity-60 hover:opacity-100">
                      <Fa icon={faCircleInfo} size="0.75x" />
                    </span>
                  </Tooltip>
                </label>
                <label class="flex items-center gap-2 text-[var(--pd-content-text)] cursor-pointer whitespace-nowrap">
                  <input type="checkbox" bind:checked={includeContext} onchange={(): void => { agentIncludeContext.set(includeContext); }} class="w-4 rounded" />
                  Include context
                  <Tooltip tip={CONTEXT_TOOLTIP} bottom>
                    <span class="ml-auto text-[var(--pd-global-nav-icon)] opacity-60 hover:opacity-100">
                      <Fa icon={faCircleInfo} size="0.75x" />
                    </span>
                  </Tooltip>
                </label>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Terminal content -->
    <div class="flex-1 min-h-0 overflow-hidden bg-[var(--pd-terminal-background)]">
      {#each $hostTerminalTabs as tab (tab.id)}
        {#key tab.id}
          <div class="h-full" class:hidden={tab.id !== $activeHostTerminalTabId}>
            <HostTerminalInstance
              tabId={tab.id}
              active={tab.id === $activeHostTerminalTabId}
              onExit={closeTab}
              agentCommand={tab.agentCommand}
              agentArgs={tab.agentArgs}
              cwd={tab.cwd} />
          </div>
        {/key}
      {/each}
    </div>
  </div>
