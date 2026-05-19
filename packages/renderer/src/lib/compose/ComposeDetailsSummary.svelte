<script lang="ts">
import { NavigationPage } from '@podman-desktop/core-api';
import { Link, StatusBadge, SummaryField, SummaryGrid, SummarySection } from '@podman-desktop/ui-svelte';

import { handleNavigation } from '/@/navigation';

import type { ComposeInfoUI } from './ComposeInfoUI';

interface Props {
  compose: ComposeInfoUI;
}

let { compose }: Props = $props();

function openContainer(containerID: string): void {
  handleNavigation({
    page: NavigationPage.CONTAINER_LOGS,
    parameters: {
      id: containerID,
    },
  });
}
</script>

<SummaryGrid>
  <SummarySection title="Details">
    <SummaryField label="Name" value={compose.name} />
    <SummaryField label="Engine ID" value={compose.engineId} copyable mono />
    <SummaryField label="Engine type" value={compose.engineType} />
    <SummaryField label="Status">
      <StatusBadge status={compose.status} />
    </SummaryField>
  </SummarySection>

  {#if compose.containers.length > 0}
    <SummarySection title="Containers in compose group">
      {#each compose.containers as container (container.id)}
        <SummaryField label={container.id} mono>
          <Link on:click={(): void => openContainer(container.id)}
            >{container.name}</Link>
        </SummaryField>
      {/each}
    </SummarySection>
  {/if}
</SummaryGrid>
