<script lang="ts">
/* eslint-disable import/no-duplicates */
// https://github.com/import-js/eslint-plugin-import/issues/1479
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
/* eslint-enable import/no-duplicates */
import type { ProviderContainerConnectionInfo, ProviderInfo } from '@podman-desktop/core-api';
import { Button, ErrorMessage, Input } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { get } from 'svelte/store';

import Dialog from '/@/lib/dialogs/Dialog.svelte';
import { providerInfos } from '/@/stores/providers';

interface Props {
  onClose: () => void;
}

let { onClose = (): void => {} }: Props = $props();

let providers: ProviderInfo[] = [];
let providerConnections = $state<ProviderContainerConnectionInfo[]>([]);
let selectedProvider = $state<ProviderContainerConnectionInfo | undefined>(undefined);

let volumeName = $state('');
let createInProgress = $state(false);
let errorMessage = $state('');

// Derive whether the Create button should be disabled
let disableCreate = $derived(volumeName.trim() === '' || createInProgress || !selectedProvider);

onMount(async () => {
  providers = get(providerInfos);
  providerConnections = providers
    .map(provider => provider.containerConnections)
    .flat()
    .filter(providerContainerConnection => providerContainerConnection.status === 'started');

  const selectedProviderConnection = providerConnections.length > 0 ? providerConnections[0] : undefined;
  selectedProvider = !selectedProvider && selectedProviderConnection ? selectedProviderConnection : selectedProvider;
});

async function createVolume(): Promise<void> {
  if (!selectedProvider) return;

  createInProgress = true;
  errorMessage = '';

  try {
    await window.createVolume($state.snapshot(selectedProvider), { Name: volumeName });
    onClose();
  } catch (error: unknown) {
    errorMessage =
      error && typeof error === 'object' && 'message' in error && error.message ? String(error.message) : String(error);
  } finally {
    createInProgress = false;
  }
}
</script>

<Dialog title="Create a volume" onclose={onClose}>
  {#snippet content()}
    <div class="flex flex-col text-[var(--pd-modal-text)] space-y-5">
      <div>
        <label for="volumeName" class="block mb-2 text-sm font-bold text-[var(--pd-modal-text)]">
          Volume name:
        </label>
        <Input
          id="volumeName"
          bind:value={volumeName}
          placeholder="Enter volume name"
          aria-label="Volume Name"
          disabled={createInProgress}
          required />
      </div>

      {#if providerConnections.length > 1}
        <div>
          <label for="providerChoice" class="block mb-2 text-sm font-bold text-[var(--pd-modal-text)]">
            Container Engine:
          </label>
          <select
            id="providerChoice"
            class="w-full p-2 outline-hidden bg-[var(--pd-select-bg)] rounded-xs text-[var(--pd-content-card-text)]"
            aria-label="Provider Choice"
            disabled={createInProgress}
            bind:value={selectedProvider}>
            {#each providerConnections as providerConnection, index (index)}
              <option value={providerConnection}>{providerConnection.name}</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if errorMessage}
        <ErrorMessage error={errorMessage} />
      {/if}
    </div>
  {/snippet}

  {#snippet buttons()}
    <Button type="link" onclick={onClose}>Cancel</Button>
    <Button
      type="primary"
      disabled={disableCreate}
      inProgress={createInProgress}
      icon={faPlusCircle}
      onclick={createVolume}>
      Create
    </Button>
  {/snippet}
</Dialog>
