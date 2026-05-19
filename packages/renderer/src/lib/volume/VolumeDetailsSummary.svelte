<script lang="ts">
import { NavigationPage } from '@podman-desktop/core-api';
import { FormattedDate, Link, StatusBadge, SummaryField, SummaryGrid, SummarySection } from '@podman-desktop/ui-svelte';

import { handleNavigation } from '/@/navigation';

import type { VolumeInfoUI } from './VolumeInfoUI';

interface Props {
  volume: VolumeInfoUI;
}

let { volume }: Props = $props();

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
    <SummaryField label="Name" value={volume.name} />
    <SummaryField label="Size" value={volume.humanSize} />
    <SummaryField label="Age" value={volume.age} />
    <SummaryField label="Created">
      <FormattedDate date={volume.created} relative />
    </SummaryField>
    <SummaryField label="Status">
      <StatusBadge status={volume.status} />
    </SummaryField>
    <SummaryField label="Mount Point" value={volume.mountPoint} />
    <SummaryField label="Scope" value={volume.scope} />
    <SummaryField label="Driver" value={volume.driver} />
    <SummaryField label="Engine ID" value={volume.engineId} copyable mono />
    <SummaryField label="Engine Name" value={volume.engineName} />
  </SummarySection>

  {#if volume.containersUsage.length > 0}
    <SummarySection title="Container Usage">
      {#each volume.containersUsage as container (container.id)}
        <SummaryField label={container.id} mono>
          <Link on:click={(): void => openContainer(container.id)}
            >{container.names.map(name => (name.startsWith('/') ? name.slice(1) : name)).join(' ')}</Link>
        </SummaryField>
      {/each}
    </SummarySection>
  {/if}
</SummaryGrid>
