<script lang="ts">
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
import HostTerminalTabs from './HostTerminalTabs.svelte';

const MIN_HEIGHT = 120;
const MIN_CONTENT_HEIGHT = 120;

let dragging = $state(false);
let startY = 0;
let startHeight = 0;

$effect(() => {
  if ($hostTerminalPanelVisible && $hostTerminalTabs.length === 0) {
    newTerminal();
  }
});

function closeTab(id: number): void {
  removeTerminalTab(id);
  if ($hostTerminalTabs.length === 0) {
    hostTerminalPanelVisible.set(false);
  }
}

function newTerminal(): void {
  addTerminalTab(getNextTabId());
}

function startResize(event: MouseEvent): void {
  dragging = true;
  startY = event.clientY;
  startHeight = $hostTerminalPanelHeight;
  event.preventDefault();
}

function onMouseMove(event: MouseEvent): void {
  if (!dragging) {
    return;
  }

  const maxHeight = window.innerHeight - MIN_CONTENT_HEIGHT;
  const height = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight + startY - event.clientY));
  hostTerminalPanelHeight.set(height);
}

function onMouseUp(): void {
  dragging = false;
}
</script>

<svelte:window onmousemove={onMouseMove} onmouseup={onMouseUp} />

<div
  class="relative flex flex-col shrink-0 border-y border-[var(--pd-global-nav-bg-border)]"
  class:hidden={!$hostTerminalPanelVisible}
  style="height: {$hostTerminalPanelHeight}px; min-height: {MIN_HEIGHT}px;">
  <!-- Resize the panel without a restart of its sessions. -->
  <div
    class="absolute top-0 left-0 w-full h-1.5 -translate-y-1/2 cursor-row-resize z-50 hover:bg-[var(--pd-button-primary-bg)]"
    role="separator"
    aria-orientation="horizontal"
    onmousedown={startResize}>
  </div>

  <div
    class="flex items-center h-7 shrink-0 bg-[var(--pd-global-nav-bg)] border-b border-[var(--pd-global-nav-bg-border)] text-xs select-none">
    <HostTerminalTabs onCreate={newTerminal} onClose={closeTab} />
  </div>

  <div class="flex-1 min-h-0 overflow-hidden bg-[var(--pd-terminal-background)]">
    {#each $hostTerminalTabs as tab (tab.id)}
      <div
        class="h-full"
        role="tabpanel"
        id="host-terminal-panel-{tab.id}"
        aria-labelledby="host-terminal-tab-{tab.id}"
        class:hidden={tab.id !== $activeHostTerminalTabId}>
        <HostTerminalInstance
          tabId={tab.id}
          active={$hostTerminalPanelVisible && tab.id === $activeHostTerminalTabId}
          onExit={closeTab}
          cwd={tab.cwd} />
      </div>
    {/each}
  </div>
</div>
