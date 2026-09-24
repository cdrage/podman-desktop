<script lang="ts">
import { faCircleInfo, faRobot } from '@fortawesome/free-solid-svg-icons';
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

import { buildContextArgs, gatherAgentContext, isMcpServerRunning } from './agent-context';
import HostTerminalInstance from './HostTerminalInstance.svelte';
import HostTerminalTabs from './HostTerminalTabs.svelte';

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
let mcpAvailable = $state(false);
let showMenu = $state(false);
let menuRef = $state<HTMLDivElement>();

hostTerminalPanelHeight.subscribe(h => (panelHeight = h));
agentIncludeContext.subscribe(v => (includeContext = v));
agentFollowUI.subscribe(v => (followUI = v));

$effect(() => {
  if ($hostTerminalPanelVisible && $hostTerminalTabs.length === 0) {
    createTerminal().catch(console.error);
  }
});

async function createTerminal(agent?: DetectedAgent): Promise<void> {
  const tabId = getNextTabId();
  const cwd = $agentWorkingDirectory;
  if (agent) {
    let args: string[] | undefined;
    if (includeContext) {
      const context = await gatherAgentContext(cwd, followUI);
      args = buildContextArgs(agent.binary, context);
    }
    addTerminalTab(tabId, {
      name: agent.label,
      agentCommand: agent.path,
      agentArgs: args,
      cwd,
    });
  } else {
    addTerminalTab(tabId, { cwd });
  }
  showMenu = false;
}

async function toggleMenu(): Promise<void> {
  if (!showMenu) {
    const [agents, mcp] = await Promise.all([
      window.hostTerminalDetectAgents().catch((): DetectedAgent[] => []),
      isMcpServerRunning(),
    ]);
    detectedAgents = agents;
    mcpAvailable = mcp;

    if (!mcp && followUI) {
      followUI = false;
      agentFollowUI.set(false);
    }
  }
  showMenu = !showMenu;
}

function syncFollowUIConfig(enabled: boolean): void {
  window.updateConfigurationValue('mcp.server.followUI', enabled).catch(console.warn);
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

function newTerminal(): void {
  createTerminal().catch(console.error);
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
      <HostTerminalTabs onCreate={newTerminal} onClose={closeTab} />
      <div class="ml-auto flex items-center min-w-0 shrink-0">
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
              <div class="border-t border-[var(--pd-content-card-border)] mt-1 pt-1 px-3 py-1.5 space-y-1.5">
                <label class="flex items-center gap-2 text-[var(--pd-content-text)] whitespace-nowrap
                  {mcpAvailable ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}">
                  <input type="checkbox" bind:checked={followUI} disabled={!mcpAvailable} onchange={(): void => { agentFollowUI.set(followUI); syncFollowUIConfig(followUI); }} class="w-4 rounded" />
                  Follow UI
                  <Tooltip tip={mcpAvailable ? FOLLOW_UI_TOOLTIP : 'MCP server extension is not running'} bottom>
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
          <div
            class="h-full"
            role="tabpanel"
            id="host-terminal-panel-{tab.id}"
            aria-labelledby="host-terminal-tab-{tab.id}"
            class:hidden={tab.id !== $activeHostTerminalTabId}>
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
