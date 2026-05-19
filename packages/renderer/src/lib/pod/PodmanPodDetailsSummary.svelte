<script lang="ts">
import { NavigationPage } from '@podman-desktop/core-api';
import { FormattedDate, Link, StatusBadge, SummaryField, SummaryGrid, SummarySection } from '@podman-desktop/ui-svelte';

import { handleNavigation } from '/@/navigation';

import type { PodInfoContainerUI, PodInfoUI } from './PodInfoUI';

interface Props {
  pod: PodInfoUI | undefined;
}

let { pod }: Props = $props();

function navigateToLogs(container: PodInfoContainerUI): void {
  return handleNavigation({ page: NavigationPage.CONTAINER_LOGS, parameters: { id: container.Id } });
}
</script>

{#if pod}
  <SummaryGrid>
    <SummarySection title="Details">
      <SummaryField label="Name" value={pod.name} />
      <SummaryField label="ID" value={pod.id} copyable mono />
      <SummaryField label="Created">
        <FormattedDate date={pod.created} relative />
      </SummaryField>
      <SummaryField label="Age" value={pod.age} />
    </SummarySection>

    <SummarySection title="Pod Status">
      <SummaryField label="Status">
        <StatusBadge status={pod.status} />
      </SummaryField>
    </SummarySection>

    <SummarySection title="Containers">
      {#if pod.containers.length > 0}
        {#each pod.containers as container, i (container.Id)}
          <div
            class="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4
              {i > 0 ? 'border-t border-[var(--pd-content-divider)] pt-5' : ''}">
            <SummaryField label="Name">
              <Link on:click={(): void => navigateToLogs(container)}>
                {container.Names}
              </Link>
            </SummaryField>
            <SummaryField label="ID" value={container.Id} copyable mono />
            <SummaryField label="Status">
              <StatusBadge status={container.Status} />
            </SummaryField>
          </div>
        {/each}
      {:else}
        <SummaryField label="Containers" value={undefined} />
      {/if}
    </SummarySection>
  </SummaryGrid>
{:else}
  <p class="text-[var(--pd-state-info)] font-medium">Loading...</p>
{/if}
