<script lang="ts">
import { faPlus, faTerminal, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from '@podman-desktop/ui-svelte';
import Fa from 'svelte-fa';

import {
  activeHostTerminalTabId,
  addTerminalTab,
  getNextTabId,
  hostTerminalPanelHeight,
  hostTerminalPanelVisible,
  hostTerminalTabs,
  removeTerminalTab,
} from '/@/stores/host-terminal-store';

import HostTerminalInstance from './HostTerminalInstance.svelte';

const MIN_HEIGHT = 120;
let panelHeight = $state(300);
let dragging = $state(false);
let startY = 0;
let startHeight = 0;

hostTerminalPanelHeight.subscribe(h => (panelHeight = h));

$effect(() => {
  if ($hostTerminalPanelVisible && $hostTerminalTabs.length === 0) {
    createTerminal();
  }
});

function createTerminal(): void {
  addTerminalTab(getNextTabId());
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

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} />

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
            <Fa icon={faTerminal} size="0.75x" />
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
      <div class="ml-auto">
        <Tooltip tip="New Terminal" bottom>
          <button
            class="flex items-center justify-center w-7 h-full text-[var(--pd-global-nav-icon)] hover:bg-[var(--pd-global-nav-bg-hover)]"
            onclick={createTerminal}
            aria-label="New Terminal">
            <Fa icon={faPlus} size="0.8x" />
          </button>
        </Tooltip>
      </div>
    </div>

    <!-- Terminal content -->
    <div class="flex-1 min-h-0 overflow-hidden bg-[var(--pd-terminal-background)]">
      {#each $hostTerminalTabs as tab (tab.id)}
        {#key tab.id}
          <div class="h-full" class:hidden={tab.id !== $activeHostTerminalTabId}>
            <HostTerminalInstance tabId={tab.id} active={tab.id === $activeHostTerminalTabId} onExit={closeTab} />
          </div>
        {/key}
      {/each}
    </div>
  </div>
