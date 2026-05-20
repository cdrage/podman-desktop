<script lang="ts">
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import { getContext } from 'svelte';

import FeaturedExtensionDownload from '/@/lib/featured/FeaturedExtensionDownload.svelte';

import type { CatalogExtensionInfoUI } from './catalog-extension-info-ui';

export let object: CatalogExtensionInfoUI;

const { oninstall } = getContext<{ ondetails: (id: string) => void; oninstall: (id: string) => void }>(
  'catalogCallbacks',
);
</script>

<div class="flex items-center gap-2">
  {#if object.isInstalled}
    <div class="flex items-center gap-1.5 text-[var(--pd-invert-content-info-icon)]">
      <Icon size="1x" icon={faCheckCircle} />
      <span class="text-xs uppercase whitespace-nowrap">Installed</span>
    </div>
  {:else if object.fetchable}
    <FeaturedExtensionDownload oninstall={oninstall} extension={object} />
  {/if}
</div>
