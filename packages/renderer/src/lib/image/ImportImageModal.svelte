<script lang="ts">
import { faMinusCircle, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import type { ProviderContainerConnectionInfo, ProviderInfo } from '@podman-desktop/core-api';
import { Button, ErrorMessage, Input } from '@podman-desktop/ui-svelte';
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

let providers: ProviderInfo[] = [];
let providerConnections: ProviderContainerConnectionInfo[] = $state([]);
let selectedProvider: ProviderContainerConnectionInfo | undefined = $state(undefined);
let inProgress = $state(false);

let importDisabled = $derived(
  !selectedProvider || containersToImport.length === 0 || containersToImport.some(c => !c.nameWhenImporting.trim()),
);

onMount(async () => {
  providers = get(providerInfos);
  providerConnections = providers
    .map(provider => provider.containerConnections)
    .flat()
    .filter(providerContainerConnection => providerContainerConnection.status === 'started');

  const selectedProviderConnection = providerConnections.length > 0 ? providerConnections[0] : undefined;
  selectedProvider = !selectedProvider && selectedProviderConnection ? selectedProviderConnection : selectedProvider;
});

async function addContainersToImport(): Promise<void> {
  const images = await window.openDialog({
    title: 'Select container tarballs to import',
    selectors: ['multiSelections', 'openFile'],
    filters: [
      {
        name: 'Container Tarballs',
        extensions: ['tar', 'gz', 'tgz', 'bz2', 'xz'],
      },
    ],
  });

  if (!images) {
    return;
  }

  const imagesInfo: { imagePath: string; nameWhenImporting: string }[] = [];
  images.forEach(imgPath => {
    imgPath = imgPath.replace(/\\/g, '/');
    let lastSlashPos = imgPath.lastIndexOf('/') + 1;
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

function updateImageName(event: Event, index: number): void {
  const target = event.currentTarget as HTMLInputElement;
  containersToImport[index].nameWhenImporting = target.value;
  containersToImport = containersToImport;
}

function deleteContainerToImport(index: number): void {
  containersToImport = containersToImport.filter((_, i) => i !== index);
}

async function importContainers(): Promise<void> {
  importError = '';

  if (!selectedProvider) {
    throw new Error('Select a provider to import');
  }

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

<Dialog title="Import Container Image from Tarball" onclose={closeCallback}>
  {#snippet content()}
    <div class="space-y-5">
      <!-- Help text section -->
      <div class="text-sm text-[var(--pd-modal-text)] space-y-2">
        <p>Import a container filesystem tarball to create a new image.</p>
        <p>
          <strong>Supported formats:</strong>
          <span class="font-mono">.tar</span>,
          <span class="font-mono">.tar.gz</span>,
          <span class="font-mono">.tgz</span>,
          <span class="font-mono">.tar.bz2</span>,
          <span class="font-mono">.tar.xz</span>
        </p>
        <p>
          <strong>Use Import when</strong> you have a container filesystem exported as a tarball
          (<span class="font-mono">podman export</span> / <span class="font-mono">docker export</span>).
        </p>
        <p>
          <strong>Use Load instead when</strong> you have a complete image saved with
          <span class="font-mono">podman save</span> / <span class="font-mono">docker save</span>.
        </p>
      </div>

      <!-- Provider selector (only when multiple engines available) -->
      {#if providerConnections.length > 1}
        <div>
          <label for="providerChoice" class="block mb-2 text-sm font-semibold text-[var(--pd-content-card-header-text)]">
            Container engine
          </label>
          <ContainerConnectionDropdown
            id="providerChoice"
            name="providerChoice"
            bind:value={selectedProvider}
            connections={providerConnections} />
        </div>
      {/if}

      <!-- File list -->
      <div>
        <label class="block mb-2 text-sm font-semibold text-[var(--pd-content-card-header-text)]">
          Container tarballs
        </label>
        <Button on:click={addContainersToImport} icon={faPlusCircle} type="link">Add container tarball</Button>

        {#if containersToImport.length > 0}
          <div class="flex flex-row w-full mt-2 py-1 text-xs font-semibold text-[var(--pd-content-card-text)]">
            <div class="flex flex-col grow pl-2">Tarball path</div>
            <div class="flex flex-col w-2/4 mr-8">Image name (e.g. quay.io/namespace/my-image:tag)</div>
          </div>
          {#each containersToImport as containerToImport, index (index)}
            <div class="flex flex-row items-center w-full py-1 gap-2">
              <Input
                bind:value={containerToImport.imagePath}
                aria-label="container tarball path"
                readonly={true} />
              <Input
                bind:value={containerToImport.nameWhenImporting}
                on:input={(event): void => updateImageName(event, index)}
                aria-label="image name when importing"
                placeholder="quay.io/namespace/my-image:tag" />
              <Button type="link" on:click={(): void => deleteContainerToImport(index)} icon={faMinusCircle} />
            </div>
          {/each}
        {/if}
      </div>

      <!-- Error display -->
      {#if importError !== ''}
        <div aria-label="importError">
          <ErrorMessage class="py-2 text-sm" error={importError} />
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet buttons()}
    <Button type="link" on:click={closeCallback} disabled={inProgress}>Cancel</Button>
    <Button
      type="primary"
      on:click={importContainers}
      inProgress={inProgress}
      disabled={importDisabled}
      aria-label="Import">
      Import
    </Button>
  {/snippet}
</Dialog>
