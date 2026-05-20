<script lang="ts">
import { faCheckCircle, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import { router } from 'tinro';

import FeaturedExtensionDownload from '/@/lib/featured/FeaturedExtensionDownload.svelte';

import type { CatalogExtensionInfoUI } from './catalog-extension-info-ui';

export let catalogExtensionUI: CatalogExtensionInfoUI;
export let oninstall: (extensionId: string) => void = () => {};
export let ondetails: (extensionId: string) => void = () => {};

function openExtensionDetails(): void {
  ondetails(catalogExtensionUI.id);
  router.goto(`/extensions/details/${catalogExtensionUI.id}/`);
}

function stopPropagation(e: MouseEvent): void {
  e.stopPropagation();
}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="flex items-center gap-4 px-4 py-3 hover:bg-[var(--pd-content-card-bg)] cursor-pointer transition-colors {catalogExtensionUI.isFeatured ? 'border-l-2 border-l-[var(--pd-badge-purple)]' : 'border-l-2 border-l-transparent'}"
  role="group"
  aria-label={catalogExtensionUI.displayName}
  on:click={openExtensionDetails}>

  <img
    src={catalogExtensionUI.iconHref}
    alt="{catalogExtensionUI.displayName} logo"
    class="w-10 h-10 rounded-md object-contain flex-shrink-0" />

  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-2">
      <span class="font-medium text-[var(--pd-content-header)] truncate">{catalogExtensionUI.displayName}</span>
      {#if catalogExtensionUI.isFeatured}
        <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--pd-badge-purple)] text-[var(--pd-card-header-text)] uppercase tracking-wider">Featured</span>
      {/if}
    </div>
    <div class="text-sm text-[var(--pd-content-text)] truncate mt-0.5">
      <span>{catalogExtensionUI.publisherDisplayName}</span>
      <span class="mx-1.5 opacity-40">&middot;</span>
      <span>{catalogExtensionUI.shortDescription}</span>
    </div>
  </div>

  <div class="text-xs text-[var(--pd-content-text)] flex-shrink-0 text-right">
    v{catalogExtensionUI.fetchVersion}
    {#if catalogExtensionUI.installedVersion && catalogExtensionUI.installedVersion !== catalogExtensionUI.fetchVersion}
      <span>(installed: v{catalogExtensionUI.installedVersion})</span>
    {/if}
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="flex items-center gap-2 flex-shrink-0" on:click={stopPropagation}>
    {#if catalogExtensionUI.isInstalled}
      <div class="flex items-center gap-1.5 text-[var(--pd-invert-content-info-icon)]">
        <Icon size="1x" icon={faCheckCircle} />
        <span class="text-xs uppercase whitespace-nowrap">Already installed</span>
      </div>
    {:else if catalogExtensionUI.fetchable}
      <FeaturedExtensionDownload oninstall={oninstall} extension={catalogExtensionUI} />
    {/if}

    <Button
      type="link"
      icon={faChevronRight}
      aria-label="{catalogExtensionUI.displayName} details"
      on:click={openExtensionDetails} />
  </div>
</div>
