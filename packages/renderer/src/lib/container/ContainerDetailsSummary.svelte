<script lang="ts">
import { faExternalLink } from '@fortawesome/free-solid-svg-icons';
import {
  FormattedDate,
  LabelGroup,
  Link,
  StatusBadge,
  SummaryField,
  SummaryGrid,
  SummarySection,
  Tooltip,
} from '@podman-desktop/ui-svelte';
import Fa from 'svelte-fa';
import { router } from 'tinro';

import type { ContainerInfoUI } from './ContainerInfoUI';

interface Props {
  container: ContainerInfoUI;
}

let { container }: Props = $props();

function portUrl(port: number): string {
  return `http://localhost:${port}`;
}

function openPort(port: number): void {
  window.openExternal(portUrl(port)).catch((err: unknown) => console.error(`Error opening port ${port}`, err));
}
</script>

<SummaryGrid>
  <SummarySection title="Details">
    <SummaryField label="Name" value={container.name} />
    <SummaryField label="ID" value={container.id} copyable mono />
    <SummaryField label="Engine type" value={container.engineType} />
    <SummaryField label="Engine ID" value={container.engineId} copyable mono />
    <SummaryField label="Image">
      <Link on:click={(): void => router.goto(container.imageHref ?? $router.path)}>{container.image}</Link>
    </SummaryField>
    {#if container.command}
      <SummaryField label="Command" value={container.command} mono />
    {/if}
    <SummaryField label="Ports">
      {#if container.hasPublicPort}
        {#each container.ports as port, i (port.PublicPort)}
          {#if i > 0},&nbsp;{/if}
          <Tooltip tip={portUrl(port.PublicPort)} bottom>
            <Link on:click={(): void => openPort(port.PublicPort)}>
              <span class="inline-flex items-center"
                >{port.PublicPort}<Fa icon={faExternalLink} class="ml-1" size="0.7x" /></span>
            </Link>
          </Tooltip>
        {/each}
      {:else}
        <span class="italic opacity-50">None</span>
      {/if}
    </SummaryField>
    <SummaryField label="State">
      <StatusBadge status={container.state} />
    </SummaryField>
    <SummaryField label="Uptime" value={container.uptime === '' ? undefined : container.uptime} />
    <SummaryField label="Started at">
      <FormattedDate date={container.startedAt} relative />
    </SummaryField>
    {#if Object.entries(container.labels).length > 0}
      <SummaryField label="Labels" class="col-span-full">
        <LabelGroup labels={container.labels} collapsible maxVisible={3} />
      </SummaryField>
    {/if}
  </SummarySection>

  <SummarySection title="Group">
    <SummaryField label="Name" value={container.groupInfo.name} />
    <SummaryField label="Type" value={container.groupInfo.type} />
    {#if container.groupInfo.id}
      <SummaryField label="Id" value={container.groupInfo.id} copyable mono />
    {/if}
    {#if container.groupInfo.engineName}
      <SummaryField label="Engine name" value={container.groupInfo.engineName} />
    {/if}
    {#if container.groupInfo.engineType}
      <SummaryField label="Engine type" value={container.groupInfo.engineType} />
    {/if}
    {#if container.groupInfo.engineId}
      <SummaryField label="Engine Id" value={container.groupInfo.engineId} copyable mono />
    {/if}
    {#if container.groupInfo.status}
      <SummaryField label="Status">
        <StatusBadge status={container.groupInfo.status} />
      </SummaryField>
    {/if}
    {#if container.groupInfo.created}
      <SummaryField label="Created">
        <FormattedDate date={container.groupInfo.created} relative />
      </SummaryField>
    {/if}
  </SummarySection>
</SummaryGrid>
