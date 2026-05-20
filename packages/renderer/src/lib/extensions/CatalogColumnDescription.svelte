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

<button
  class="text-left truncate max-w-full hover:cursor-pointer group-hover:text-[var(--pd-link)]"
  on:click={openDetails}>
  {object.shortDescription}
</button>
