<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  label: string;
  title?: string;
  triggerClass?: string;
  trigger: Snippet;
  children: Snippet;
}

let { label, title, triggerClass = '', trigger, children }: Props = $props();
const menuId = $props.id();
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

let open = $state(false);
let root = $state<HTMLDivElement>();
let button = $state<HTMLButtonElement>();
let panel = $state<HTMLDivElement>();
let left = $state(0);
let top = $state(0);
let maxHeight = $state(0);

function placeMenu(): void {
  if (!button || !panel) {
    return;
  }

  // Always open downward and scroll the menu when space below is limited.
  const bounds = button.getBoundingClientRect();
  left = Math.max(VIEWPORT_MARGIN, Math.min(bounds.left, window.innerWidth - panel.offsetWidth - VIEWPORT_MARGIN));
  top = bounds.bottom + MENU_GAP;
  maxHeight = Math.max(0, window.innerHeight - top - VIEWPORT_MARGIN);
}

$effect(() => {
  if (!panel) {
    return;
  }

  placeMenu();
  panel.querySelector<HTMLButtonElement>('button')?.focus();
  const observer = new ResizeObserver(placeMenu);
  observer.observe(panel);
  return (): void => observer.disconnect();
});

function toggleMenu(): void {
  open = !open;
}

function closeMenu(): void {
  open = false;
  button?.focus();
}

function onOutside(event: Event): void {
  if (open && event.target instanceof Node && !root?.contains(event.target)) {
    open = false;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (open && event.key === 'Escape') {
    event.preventDefault();
    closeMenu();
  }
}

function onPanelClick(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('button')) {
    closeMenu();
  }
}
</script>

<svelte:window onclick={onOutside} onfocusin={onOutside} onkeydown={onKeydown} onresize={placeMenu} />

<div class="flex h-full shrink-0" bind:this={root}>
  <button
    bind:this={button}
    class="flex items-center justify-center gap-1.5 h-full text-[var(--pd-content-text)] hover:bg-[var(--pd-global-nav-bg-hover)] {triggerClass}"
    aria-label={label}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-controls={menuId}
    {title}
    onclick={toggleMenu}>
    {@render trigger()}
  </button>
  {#if open}
    <div
      bind:this={panel}
      id={menuId}
      role="dialog"
      aria-label={label}
      tabindex="-1"
      class="fixed z-50 w-80 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md shadow-lg border border-[var(--pd-content-card-border)] bg-[var(--pd-content-bg)] text-[var(--pd-content-text)] text-xs py-1"
      style:left="{left}px"
      style:top="{top}px"
      style:max-height="{maxHeight}px"
      onkeydown={onKeydown}
      onclick={onPanelClick}>
      {@render children()}
    </div>
  {/if}
</div>
