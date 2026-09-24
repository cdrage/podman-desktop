<script lang="ts">
import {
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faPlus,
  faRobot,
  faTerminal,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import { onDestroy, untrack } from 'svelte';

import {
  activeHostTerminalTabId,
  agentWorkingDirectory,
  hostTerminalPanelVisible,
  type HostTerminalTab,
  hostTerminalTabs,
  moveTerminalTab,
  TerminalTabPlacement,
} from '/@/stores/host-terminal-store';

import HostTerminalFolder from './HostTerminalFolder.svelte';
import HostTerminalMenu from './HostTerminalMenu.svelte';

interface Props {
  onCreate: () => void;
  onClose: (id: number) => void;
}

interface DropTarget {
  id: number;
  placement: TerminalTabPlacement;
}

const DRAG_EDGE_WIDTH = 32;
const DRAG_SCROLL_STEP = 8;
const SCROLL_TOLERANCE = 1;

let { onCreate, onClose }: Props = $props();
let viewport = $state<HTMLDivElement>();
let canScrollLeft = $state(false);
let canScrollRight = $state(false);
let draggedId = $state<number>();
let dropTarget = $state<DropTarget>();
let dragX = 0;
let scrollFrame: number | undefined;

function updateOverflow(): void {
  if (!viewport) {
    return;
  }

  canScrollLeft = viewport.scrollLeft > SCROLL_TOLERANCE;
  canScrollRight = viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - SCROLL_TOLERANCE;
}

function revealTab(id: number | undefined): void {
  viewport
    ?.querySelector<HTMLElement>(`[data-tab-id="${id}"]`)
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  updateOverflow();
}

$effect(() => {
  const id = $activeHostTerminalTabId;
  const tabs = $hostTerminalTabs;
  if ($hostTerminalPanelVisible && viewport && tabs.length) {
    // Reveal the active tab after creation, selection, or a change to the tab order.
    untrack(() => revealTab(id));
  }
});

$effect(() => {
  if (!viewport) {
    return;
  }

  const observer = new ResizeObserver(() => revealTab($activeHostTerminalTabId));
  observer.observe(viewport);
  return (): void => observer.disconnect();
});

function scrollTabs(direction: number): void {
  viewport?.scrollBy({ left: direction * viewport.clientWidth, behavior: 'smooth' });
}

function selectTab(id: number): void {
  activeHostTerminalTabId.set(id);
}

function tabTooltip(tab: HostTerminalTab): string {
  return `${tab.name}\nLaunch folder: ${tab.cwd ?? 'Home folder'}\nDrag to reorder, or use Alt+Left/Right`;
}

function onTabKeydown(id: number, event: KeyboardEvent): void {
  const index = $hostTerminalTabs.findIndex(tab => tab.id === id);
  const direction = event.key === 'ArrowLeft' || event.key === 'Home' ? -1 : 1;
  let targetIndex: number;
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
      targetIndex = index + direction;
      break;
    case 'Home':
      targetIndex = 0;
      break;
    case 'End':
      targetIndex = $hostTerminalTabs.length - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  const target = $hostTerminalTabs[targetIndex];
  if (!target) {
    return;
  }

  if (event.altKey) {
    moveTerminalTab(id, target.id, direction < 0 ? TerminalTabPlacement.Before : TerminalTabPlacement.After);
    return;
  }

  selectTab(target.id);
  viewport?.querySelector<HTMLButtonElement>(`[data-tab-id="${target.id}"] [role="tab"]`)?.focus();
}

function startDrag(id: number, event: DragEvent): void {
  if (!event.dataTransfer) {
    return;
  }

  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(id));
  draggedId = id;
}

function updateDropTarget(): void {
  const tabs = viewport?.querySelectorAll<HTMLElement>('[data-tab-id]');
  dropTarget = undefined;
  if (!tabs) {
    return;
  }

  // Use tab midpoints so either side of a tab accepts a drop.
  for (const tab of tabs) {
    const bounds = tab.getBoundingClientRect();
    const placement = dragX < bounds.left + bounds.width / 2 ? TerminalTabPlacement.Before : TerminalTabPlacement.After;
    dropTarget = { id: Number(tab.dataset.tabId), placement };
    if (dragX < bounds.right) {
      return;
    }
  }
}

function stopScroll(): void {
  if (scrollFrame !== undefined) {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = undefined;
  }
}

function scrollDuringDrag(): void {
  scrollFrame = undefined;
  if (!viewport || draggedId === undefined) {
    return;
  }

  const bounds = viewport.getBoundingClientRect();
  const direction = dragX < bounds.left + DRAG_EDGE_WIDTH ? -1 : dragX > bounds.right - DRAG_EDGE_WIDTH ? 1 : 0;
  const previous = viewport.scrollLeft;
  viewport.scrollLeft += direction * DRAG_SCROLL_STEP;
  updateOverflow();
  updateDropTarget();
  if (viewport.scrollLeft !== previous) {
    scrollFrame = requestAnimationFrame(scrollDuringDrag);
  }
}

function onDragOver(event: DragEvent): void {
  if (draggedId === undefined) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  dragX = event.clientX;
  updateDropTarget();
  scrollFrame ??= requestAnimationFrame(scrollDuringDrag);
}

function endDrag(): void {
  stopScroll();
  draggedId = undefined;
  dropTarget = undefined;
}

function onDrop(event: DragEvent): void {
  if (draggedId === undefined) {
    return;
  }

  event.preventDefault();
  dragX = event.clientX;
  updateDropTarget();
  if (dropTarget) {
    moveTerminalTab(draggedId, dropTarget.id, dropTarget.placement);
  }
  endDrag();
}

function onDragLeave(event: DragEvent): void {
  if (event.relatedTarget instanceof Node && viewport?.contains(event.relatedTarget)) {
    return;
  }

  stopScroll();
  dropTarget = undefined;
}

onDestroy(stopScroll);
</script>

<div class="flex items-center min-w-0 h-full">
  {#if canScrollLeft || canScrollRight}
    <button
      class="shrink-0 w-6 h-full text-[var(--pd-global-nav-icon)] hover:bg-[var(--pd-global-nav-bg-hover)] disabled:opacity-30"
      aria-label="Scroll terminals left"
      disabled={!canScrollLeft}
      onclick={scrollTabs.bind(undefined, -1)}>
      <Icon icon={faChevronLeft} size="xs" />
    </button>
  {/if}
  <div
    class="flex items-center min-w-0 h-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    role="tablist"
    aria-label="Terminals"
    tabindex="-1"
    bind:this={viewport}
    onscroll={updateOverflow}
    ondragover={onDragOver}
    ondrop={onDrop}
    ondragleave={onDragLeave}>
    {#each $hostTerminalTabs as tab (tab.id)}
      <div
        role="presentation"
        data-tab-id={tab.id}
        class="group relative flex items-center shrink-0 h-full border-r border-t-2 border-r-[var(--pd-global-nav-bg-border)]
          {tab.id === $activeHostTerminalTabId
            ? 'bg-[var(--pd-content-bg)] text-[var(--pd-content-text)] border-t-[var(--pd-button-primary-bg)]'
            : 'text-[var(--pd-global-nav-icon)] hover:bg-[var(--pd-global-nav-bg-hover)] border-t-transparent'}"
        class:opacity-50={draggedId === tab.id}>
        {#if dropTarget?.id === tab.id && draggedId !== tab.id}
          <span
            class="absolute inset-y-0 w-0.5 bg-[var(--pd-button-primary-bg)] pointer-events-none"
            class:left-0={dropTarget.placement === TerminalTabPlacement.Before}
            class:right-0={dropTarget.placement === TerminalTabPlacement.After}>
          </span>
        {/if}
        <button
          class="flex items-center gap-1.5 h-full pl-3 pr-1 whitespace-nowrap cursor-grab active:cursor-grabbing"
          role="tab"
          aria-selected={tab.id === $activeHostTerminalTabId}
          aria-controls="host-terminal-panel-{tab.id}"
          id="host-terminal-tab-{tab.id}"
          tabindex={tab.id === $activeHostTerminalTabId ? 0 : -1}
          title={tabTooltip(tab)}
          draggable="true"
          onclick={selectTab.bind(undefined, tab.id)}
          onkeydown={onTabKeydown.bind(undefined, tab.id)}
          ondragstart={startDrag.bind(undefined, tab.id)}
          ondragend={endDrag}>
          <Icon icon={tab.agentCommand ? faRobot : faTerminal} size="xs" />
          <span class="max-w-[120px] truncate">{tab.name}</span>
        </button>
        <button
          class="mr-2 rounded hover:bg-[var(--pd-global-nav-bg-hover)] p-0.5
            {tab.id === $activeHostTerminalTabId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}"
          onclick={onClose.bind(undefined, tab.id)}
          aria-label="Close {tab.name}">
          <Icon icon={faXmark} size="xs" />
        </button>
      </div>
    {/each}
  </div>
  {#if canScrollLeft || canScrollRight}
    <button
      class="shrink-0 w-6 h-full text-[var(--pd-global-nav-icon)] hover:bg-[var(--pd-global-nav-bg-hover)] disabled:opacity-30"
      aria-label="Scroll terminals right"
      disabled={!canScrollRight}
      onclick={scrollTabs.bind(undefined, 1)}>
      <Icon icon={faChevronRight} size="xs" />
    </button>
  {/if}
  <!-- Keep creation beside the tabs and outside the scrollable area. -->
  <Tooltip tip="New Terminal" top containerClass="shrink-0 h-full">
    <button
      class="flex items-center justify-center w-7 h-full text-[var(--pd-global-nav-icon)] hover:bg-[var(--pd-global-nav-bg-hover)]"
      onclick={onCreate}
      aria-label="New Terminal">
      <Icon icon={faPlus} size="xs" />
    </button>
  </Tooltip>
  <HostTerminalMenu
    label="New terminal options"
    title="Default folder: {$agentWorkingDirectory ?? 'Home folder'}"
    triggerClass="w-5">
    {#snippet trigger()}
      <Icon icon={faChevronDown} size="xs" />
    {/snippet}
    <HostTerminalFolder />
  </HostTerminalMenu>
</div>
