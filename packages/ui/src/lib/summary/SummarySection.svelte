<script lang="ts">
import type { Snippet } from 'svelte';

import ChevronExpander from '../icons/ChevronExpander.svelte';

interface Props {
  title: string;
  collapsible?: boolean;
  expanded?: boolean;
  children?: Snippet;
  class?: string;
}

let {
  title,
  collapsible = false,
  expanded = $bindable(true),
  children,
  class: className = '',
}: Props = $props();

function toggle(): void {
  if (collapsible) {
    expanded = !expanded;
  }
}
</script>

<section
  class="rounded-lg border border-[var(--pd-content-card-border)] bg-[var(--pd-content-card-bg)] {className}"
  aria-label={title}>
  <button
    class="flex w-full items-center gap-2 px-5 py-3 text-lg font-semibold text-[var(--pd-content-card-header-text)]
      {collapsible ? 'cursor-pointer' : 'cursor-default'}
      {expanded && children ? 'border-b border-[var(--pd-content-divider)]' : ''}"
    onclick={toggle}
    aria-expanded={collapsible ? expanded : undefined}
    disabled={!collapsible}
    type="button">
    {#if collapsible}
      <ChevronExpander {expanded} class="w-4" />
    {/if}
    <span>{title}</span>
  </button>
  {#if expanded}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 px-5 py-4">
      {@render children?.()}
    </div>
  {/if}
</section>
