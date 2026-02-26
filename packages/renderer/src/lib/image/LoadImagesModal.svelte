<script lang="ts">
/* eslint-disable import/no-duplicates */
// https://github.com/import-js/eslint-plugin-import/issues/1479
import { faMinusCircle, faPlusCircle, faUpload } from '@fortawesome/free-solid-svg-icons';
import type { ProviderContainerConnectionInfo, ProviderInfo } from '@podman-desktop/core-api';
import { Button, ErrorMessage, Input } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { get } from 'svelte/store';

import ContainerConnectionDropdown from '/@/lib/forms/ContainerConnectionDropdown.svelte';
import Dialog from '/@/lib/dialogs/Dialog.svelte';
import { providerInfos } from '/@/stores/providers';

interface Props {
  onClose: () => void;
}

let { onClose }: Props = $props();

let archivesToLoad = $state<string[]>([]);
let loadError = $state<string>('');

let providers: ProviderInfo[] = [];
let providerConnections = $state<ProviderContainerConnectionInfo[]>([]);
let selectedProvider = $state<ProviderContainerConnectionInfo>();
let inProgress = $state(false);

let loadDisabled = $derived(!selectedProvider || archivesToLoad.length === 0);

onMount(async () => {
  providers = get(providerInfos);
  providerConnections = providers
    .map(provider => provider.containerConnections)
    .flat()
    .filter(providerContainerConnection => providerContainerConnection.status === 'started');

  const selectedProviderConnection = providerConnections.length > 0 ? providerConnections[0] : undefined;
  selectedProvider = !selectedProvider && selectedProviderConnection ? selectedProviderConnection : selectedProvider;
});

async function addArchivesToLoad(): Promise<void> {
  const archives = await window.openDialog({
    title: 'Select Image Archive(s) to Load',
    selectors: ['multiSelections', 'openFile'],
  });

  if (!archives) {
    return;
  }

  archivesToLoad = [...archivesToLoad, ...archives];
}

function deleteImagesTarArchiveToLoad(index: number): void {
  archivesToLoad = archivesToLoad.filter((_, i) => i !== index);
}

async function loadImages(): Promise<void> {
  loadError = '';

  if (!selectedProvider) {
    throw new Error('Select a provider to load');
  }

  inProgress = true;

  for (const archive of archivesToLoad) {
    try {
      await window.loadImages({
        provider: $state.snapshot(selectedProvider),
        archives: [archive],
      });
    } catch (e) {
      loadError += `Error while loading ${archive}: ${String(e)}\n`;
    }
  }

  inProgress = false;
  if (loadError === '') {
    onClose();
  }
}
</script>

<Dialog title="Load Image from Archive" onclose={onClose}>
  {#snippet icon()}
    <i class="fas fa-upload fa-2x" aria-hidden="true"></i>
  {/snippet}

  {#snippet content()}
    <div class="space-y-5">
      <!-- Help text section -->
      <div class="text-sm text-[var(--pd-modal-text)] space-y-2">
        <p>
          Load complete container images from archive files created with <code
            class="bg-[var(--pd-content-card-bg)] px-1 rounded">docker save</code> or <code
            class="bg-[var(--pd-content-card-bg)] px-1 rounded">podman save</code>.
          All layers and metadata are preserved.
        </p>
        <p><strong>Supported formats:</strong> .tar, .tar.gz, .tgz</p>
        <div class="mt-2">
          <p class="font-semibold mb-1">Load vs Import:</p>
          <ul class="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong>Use Load</strong> — full image archive from <code class="bg-[var(--pd-content-card-bg)] px-1 rounded">docker/podman save</code>.
              Restores all layers, metadata, and tags. A single archive can contain multiple images.
            </li>
            <li>
              <strong>Use Import</strong> — container filesystem from <code class="bg-[var(--pd-content-card-bg)] px-1 rounded">docker/podman export</code>.
              Creates a single-layer image; requires specifying a new image name.
            </li>
          </ul>
        </div>
        <div class="text-xs bg-[var(--pd-content-card-bg)] p-2 rounded font-mono">
          docker save nginx:latest &gt; nginx.tar<br />
          docker save -o backup.tar nginx redis alpine
        </div>
      </div>

      <!-- Provider selector (if multiple) -->
      {#if providerConnections.length > 1}
        <div>
          <label for="providerChoice" class="block mb-2 font-semibold text-[var(--pd-modal-text)]">Container Engine</label>
          <ContainerConnectionDropdown
            id="providerChoice"
            name="providerChoice"
            bind:value={selectedProvider}
            connections={providerConnections} />
        </div>
      {/if}

      <!-- Add archive button -->
      <div>
        <Button onclick={addArchivesToLoad} icon={faPlusCircle} type="link">Add Image Archive</Button>
      </div>

      <!-- Archive file list -->
      {#if archivesToLoad.length > 0}
        <div class="space-y-2">
          <div class="font-semibold text-[var(--pd-modal-text)]">Image Archives</div>
          {#each archivesToLoad as _, index (index)}
            <div class="flex flex-row gap-2 items-center">
              <Input bind:value={archivesToLoad[index]} aria-label="archive path" readonly={true} class="flex-1" />
              <Button type="link" onclick={(): void => deleteImagesTarArchiveToLoad(index)} icon={faMinusCircle} />
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet validation()}
    {#if loadError !== ''}
      <ErrorMessage class="text-sm" error={loadError} />
    {/if}
  {/snippet}

  {#snippet buttons()}
    <Button type="link" onclick={onClose} disabled={inProgress}>Cancel</Button>
    <Button
      type="primary"
      onclick={loadImages}
      inProgress={inProgress}
      disabled={loadDisabled}
      icon={faUpload}
      aria-label="Load images">
      Load Images
    </Button>
  {/snippet}
</Dialog>
