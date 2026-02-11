<script lang="ts">
import { faBoxOpen } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';

import type { CheckStatus, ProviderInfo } from '/@api/provider-info';

export let provider: ProviderInfo;
let updateInProgress = false;
let allowUpdates = true;

export let onPreflightChecks: (status: CheckStatus[]) => void;

onMount(async () => {
  const value = await window.getConfigurationValue<boolean>('preferences.update.allowUpdates');
  if (value === false) {
    allowUpdates = false;
  }
});

let checksStatus: CheckStatus[] = [];

let preflightChecksFailed = false;

async function performUpdate(provider: ProviderInfo): Promise<void> {
  updateInProgress = true;

  checksStatus = [];
  let checkSuccess = false;
  let currentCheck: CheckStatus;
  try {
    checkSuccess = await window.runUpdatePreflightChecks(provider.internalId, {
      endCheck: status => {
        if (currentCheck) {
          currentCheck = status;
        } else {
          return;
        }
        checksStatus.push(currentCheck);
        onPreflightChecks(checksStatus);
      },
      startCheck: status => {
        currentCheck = status;
        onPreflightChecks([...checksStatus, currentCheck]);
      },
    });
  } catch (err) {
    console.error(err);
  }
  if (checkSuccess) {
    await window.updateProvider(provider.internalId);
    // reset checks
    onPreflightChecks([]);
  } else {
    preflightChecksFailed = true;
  }

  updateInProgress = false;
}
</script>

{#if provider?.updateInfo?.version && allowUpdates}
  <Button
    inProgress={updateInProgress}
    disabled={preflightChecksFailed}
    icon={faBoxOpen}
    padding="px-3 py-0.5"
    on:click={(): Promise<void> => performUpdate(provider)}>
    Update to {provider.updateInfo.version}
  </Button>
{/if}
