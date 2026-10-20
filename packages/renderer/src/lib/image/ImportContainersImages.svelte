<script lang="ts">
/* eslint-disable import/no-duplicates */
// https://github.com/import-js/eslint-plugin-import/issues/1479
import type { ProviderContainerConnectionInfo } from '@desktop-framework/api';
import { faCircleArrowDown, faMinusCircle, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { Button, ErrorMessage, Input, Tooltip } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { get } from 'svelte/store';

import Dialog from '/@/lib/dialogs/Dialog.svelte';
import ContainerConnectionDropdown from '/@/lib/forms/ContainerConnectionDropdown.svelte';
import { providerInfos } from '/@/stores/providers';

interface Props {
  closeCallback: () => void;
}

let { closeCallback }: Props = $props();

let containersToImport: { imagePath: string; nameWhenImporting: string }[] = $state([]);
let importError: string = $state('');

let providerConnections: ProviderContainerConnectionInfo[] = $state([]);
let selectedProvider: ProviderContainerConnectionInfo | undefined = $state(undefined);
let inProgress = $state(false);

let importDisabled = $derived(inProgress || !selectedProvider || containersToImport.length === 0);

onMount(() => {
  providerConnections = get(providerInfos)
    .map(provider => provider.containerConnections)
    .flat()
    .filter(providerContainerConnection => providerContainerConnection.status === 'started');

  selectedProvider = providerConnections[0];
});

function closeModal(): void {
  // Keep import results visible until every archive finishes.
  if (inProgress) {
    return;
  }

  closeCallback();
}

async function addContainersToImport(): Promise<void> {
  const images = await window
    .openDialog({
      title: 'Select Containers Images to import',
      selectors: ['multiSelections', 'openFile'],
    })
    .catch((error: unknown) => {
      importError = String(error);
      return undefined;
    });

  if (!images) {
    return;
  }

  const imagesInfo: { imagePath: string; nameWhenImporting: string }[] = [];
  images.forEach(imgPath => {
    imgPath = imgPath.replace(/\\/g, '/');
    const lastSlashPos = imgPath.lastIndexOf('/') + 1;
    let lastDot: number | undefined = imgPath.lastIndexOf('.');
    if (lastDot === -1 || lastDot < lastSlashPos) {
      lastDot = undefined;
    }
    imagesInfo.push({
      imagePath: imgPath,
      nameWhenImporting: imgPath.substring(lastSlashPos, lastDot),
    });
  });

  containersToImport = [...containersToImport, ...imagesInfo];
}

function archiveName(path: string): string {
  return path.substring(path.lastIndexOf('/') + 1);
}

function deleteContainerToImport(index: number): void {
  containersToImport = containersToImport.filter((_, i) => i !== index);
}

async function importContainers(): Promise<void> {
  if (inProgress || !selectedProvider || containersToImport.length === 0) {
    return;
  }

  importError = '';
  inProgress = true;

  for (const containerImage of containersToImport) {
    try {
      await window.importContainer({
        provider: $state.snapshot(selectedProvider),
        archivePath: containerImage.imagePath,
        imageTag: containerImage.nameWhenImporting,
      });
    } catch (e) {
      importError += `Error while importing ${containerImage.imagePath}: ${String(e)}\n`;
    }
  }

  inProgress = false;
  if (importError === '') {
    closeCallback();
  }
}
</script>

<Dialog title="Import containers" onclose={closeModal} size="large" initialButtonFocus="first">
  {#snippet content()}
    <div class="space-y-4 text-sm">
      {#if providerConnections.length > 1}
        <div>
          <label for="providerChoice" class="block mb-2 font-medium">Container engine</label>
          <ContainerConnectionDropdown
            id="providerChoice"
            name="providerChoice"
            bind:value={selectedProvider}
            connections={providerConnections}
            disabled={inProgress} />
        </div>
      {/if}

      <div>
        <p class="mb-2 font-medium">Containers to import</p>
        <Button on:click={addContainersToImport} icon={faPlusCircle} type="link" disabled={inProgress}>
          Add images to import
        </Button>
      </div>

      {#if containersToImport.length > 0}
        <table aria-label="Containers to import" class="w-full table-fixed text-left">
          <thead class="border-b border-[var(--pd-modal-border)]">
            <tr>
              <th scope="col" class="w-2/5 pb-2 pr-4 font-medium">Archive</th>
              <th scope="col" class="pb-2 pr-2 font-medium">Image name</th>
              <th scope="col" class="w-10"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--pd-modal-border)]">
            {#each containersToImport as containerToImport, index (index)}
              <tr>
                <td class="py-2 pr-4">
                  <Tooltip tip={containerToImport.imagePath} containerClass="min-w-0">
                    <button type="button" class="block max-w-full truncate text-left">
                      {archiveName(containerToImport.imagePath)}
                    </button>
                  </Tooltip>
                </td>
                <td class="py-2 pr-2">
                  <Input
                    bind:value={containerToImport.nameWhenImporting}
                    aria-label="container importing name"
                    placeholder="e.g. quay.io/namespace/my-image-name"
                    disabled={inProgress} />
                </td>
                <td class="py-2">
                  <Button
                    type="link"
                    padding="p-1"
                    on:click={deleteContainerToImport.bind(undefined, index)}
                    icon={faMinusCircle}
                    aria-label="Remove container"
                    disabled={inProgress} />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/snippet}

  {#snippet validation()}
    {#if importError}
      <div class="max-h-32 overflow-auto" aria-label="importError">
        <ErrorMessage class="text-sm whitespace-pre-wrap" error={importError} />
      </div>
    {/if}
  {/snippet}

  {#snippet buttons()}
    <Button type="link" on:click={closeModal} disabled={inProgress}>Cancel</Button>
    <Button
      on:click={importContainers}
      inProgress={inProgress}
      icon={faCircleArrowDown}
      aria-label="Import containers"
      disabled={importDisabled}>
      Import containers
    </Button>
  {/snippet}
</Dialog>
