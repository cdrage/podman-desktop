<script lang="ts">
import { getContext } from 'svelte';
import { router } from 'tinro';

import type { CatalogExtensionInfoUI } from './catalog-extension-info-ui';

export let object: CatalogExtensionInfoUI;

const { ondetails } = getContext<{ ondetails: (id: string) => void; oninstall: (id: string) => void }>(
  'catalogCallbacks',
);

function openDetails(): void {
  ondetails(object.id);
  router.goto(`/extensions/details/${object.id}/`);
}
</script>

<button class="flex items-center gap-2 max-w-full overflow-hidden hover:cursor-pointer" on:click={openDetails}>
  {#if object.iconHref}
    <img
      src={object.iconHref}
      alt="{object.displayName} logo"
      class="w-6 h-6 rounded object-contain flex-shrink-0" />
  {/if}
  <div
    class="text-[var(--pd-table-body-text-highlight)] truncate group-hover:text-[var(--pd-link)]"
    aria-label="{object.displayName} details">
    {object.displayName}
  </div>
  {#if object.isFeatured}
    <span
      class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--pd-badge-purple)] text-[var(--pd-card-header-text)] uppercase tracking-wider flex-shrink-0">
      Featured
    </span>
  {/if}
</button>
