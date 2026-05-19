<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  children?: Snippet;
  class?: string;
}

let { children, class: className = '' }: Props = $props();
</script>

<div
  class="h-full overflow-auto p-6 text-[var(--pd-details-body-text)] {className}"
  role="region"
  aria-label="Summary">
  <div class="max-w-5xl w-full flex flex-col gap-5">
    {@render children?.()}
  </div>
</div>
