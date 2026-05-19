<script lang="ts">
import { NavigationPage } from '@podman-desktop/core-api';
import { Link, StatusBadge, SummaryField, SummaryGrid, SummarySection } from '@podman-desktop/ui-svelte';

import { handleNavigation } from '/@/navigation';

import type { NetworkInfoUI } from './NetworkInfoUI';

interface Props {
  network: NetworkInfoUI;
}

let { network }: Props = $props();

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
    <SummaryField label="Name" value={network.name} />
    <SummaryField label="Id" value={network.id} copyable mono />
    <SummaryField label="Status">
      <StatusBadge status={network.status} />
    </SummaryField>
    <SummaryField label="Driver" value={network.driver} />
    <SummaryField label="IPV6 enabled" value={String(network.ipv6_enabled)} />
    <SummaryField label="Engine ID" value={network.engineId} copyable mono />
    <SummaryField label="Engine Name" value={network.engineName} />
  </SummarySection>

  {#if network.containers.length > 0}
    <SummarySection title="Container Usage">
      {#each network.containers as container (container.id)}
        <SummaryField label={container.id} mono>
          <Link on:click={(): void => openContainer(container.id)}
            >{container.name}</Link>
        </SummaryField>
      {/each}
    </SummarySection>
  {/if}
</SummaryGrid>
