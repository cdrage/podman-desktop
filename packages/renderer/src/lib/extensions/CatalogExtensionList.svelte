<script lang="ts">
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons';
import { Button, EmptyScreen, Table, TableColumn, TableRow, TableSimpleColumn } from '@podman-desktop/ui-svelte';
import { setContext } from 'svelte';

import type { CatalogExtensionInfoUI } from './catalog-extension-info-ui';
import CatalogColumnActions from './CatalogColumnActions.svelte';
import CatalogColumnDescription from './CatalogColumnDescription.svelte';
import CatalogColumnName from './CatalogColumnName.svelte';

export let catalogExtensions: CatalogExtensionInfoUI[];
export let title: string = '';
export let showEmptyScreen: boolean = true;
export let oninstall: (extensionId: string) => void = () => {};
export let ondetails: (extensionId: string) => void = () => {};

setContext('catalogCallbacks', { oninstall, ondetails });

$: sortedExtensions = [...catalogExtensions].sort((a, b): number => {
  if (a.isInstalled !== b.isInstalled) return a.isInstalled ? -1 : 1;
  if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
  return a.displayName.localeCompare(b.displayName);
});

async function fetchCatalog(): Promise<void> {
  try {
    await window.refreshCatalogExtensions();
  } catch (error) {
    await window.showMessageBox({
      type: 'error',
      title: 'Refresh Catalog Failed',
      message: 'Failed to refresh the catalog',
      detail: String(error),
      buttons: ['Dismiss'],
    });
  }
}

const nameColumn = new TableColumn<CatalogExtensionInfoUI>('Name', {
  width: '1.5fr',
  renderer: CatalogColumnName,
  comparator: (a, b): number => a.displayName.localeCompare(b.displayName),
});

const publisherColumn = new TableColumn<CatalogExtensionInfoUI, string>('Publisher', {
  renderMapping: (object): string => object.publisherDisplayName,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.publisherDisplayName.localeCompare(b.publisherDisplayName),
});

const descriptionColumn = new TableColumn<CatalogExtensionInfoUI>('Description', {
  width: '2fr',
  renderer: CatalogColumnDescription,
  comparator: (a, b): number => a.shortDescription.localeCompare(b.shortDescription),
});

const versionColumn = new TableColumn<CatalogExtensionInfoUI, string>('Version', {
  width: '80px',
  renderMapping: (object): string => {
    let text = `v${object.fetchVersion}`;
    if (object.installedVersion && object.installedVersion !== object.fetchVersion) {
      text += ` (v${object.installedVersion})`;
    }
    return text;
  },
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.fetchVersion.localeCompare(b.fetchVersion),
});

const statusColumn = new TableColumn<CatalogExtensionInfoUI>('Status', {
  align: 'right',
  width: '120px',
  renderer: CatalogColumnActions,
  overflow: true,
  comparator: (a, b): number => {
    if (a.isInstalled !== b.isInstalled) return a.isInstalled ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  },
});

const columns = [nameColumn, publisherColumn, descriptionColumn, versionColumn, statusColumn];

const row = new TableRow<CatalogExtensionInfoUI>({});

function key(object: CatalogExtensionInfoUI): string {
  return object.id;
}

function extensionLabel(object: CatalogExtensionInfoUI): string {
  return object.displayName;
}
</script>

{#if catalogExtensions.length === 0 && showEmptyScreen}
  <EmptyScreen
    title="No extensions in the catalog"
    message="No extensions from the catalog. It seems that the internet connection was not available to download the catalog."
    icon={faPuzzlePiece}>
    <div class="flex gap-2 justify-center">
      <Button type="link" on:click={fetchCatalog}>Refresh the catalog</Button>
    </div>
  </EmptyScreen>
{/if}

{#if title && catalogExtensions.length > 0}
  <div class="mb-4 flex flex-row px-5 pt-3">
    <div class="flex items-center text-[var(--pd-content-header)]">{title}</div>
  </div>
{/if}

{#if sortedExtensions.length > 0}
  <Table
    kind="catalog-extension"
    data={sortedExtensions}
    columns={columns}
    row={row}
    key={key}
    label={extensionLabel} />
{/if}
