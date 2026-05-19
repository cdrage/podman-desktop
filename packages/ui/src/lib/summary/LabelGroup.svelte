<script lang="ts">
import ChevronExpander from '../icons/ChevronExpander.svelte';

interface Props {
  labels: Record<string, string>;
  collapsible?: boolean;
  maxVisible?: number;
  class?: string;
}

let { labels, collapsible = false, maxVisible = 5, class: className = '' }: Props = $props();

let showAll = $state(false);
let entries = $derived(Object.entries(labels));
let visibleEntries = $derived(
  collapsible && !showAll && entries.length > maxVisible ? entries.slice(0, maxVisible) : entries,
);
let hiddenCount = $derived(entries.length - maxVisible);
</script>

<div class="flex flex-col gap-1.5 {className}">
  {#each visibleEntries as [key, value] (key)}
    <div
      class="flex gap-2 rounded-md bg-[var(--pd-content-card-inset-bg)] px-2.5 py-1 text-sm text-[var(--pd-details-body-text)]"
      aria-label="{key}={value}">
      <span class="shrink-0 font-semibold">{key}</span>
      <span class="break-all opacity-70">{value}</span>
    </div>
  {/each}
  {#if collapsible && entries.length > maxVisible}
    <button
      class="inline-flex items-center gap-1 self-start rounded-md px-2.5 py-1 text-sm text-[var(--pd-link)] hover:bg-[var(--pd-link-hover-bg)]"
      onclick={(): boolean => (showAll = !showAll)}
      aria-label={showAll ? 'Show fewer labels' : `Show ${hiddenCount} more labels`}
      type="button">
      {#if showAll}
        Show less
      {:else}
        +{hiddenCount} more
      {/if}
      <ChevronExpander expanded={showAll} size="0.6x" />
    </button>
  {/if}
</div>
