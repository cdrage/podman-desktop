<script lang="ts">
import type { ContainerProviderConnection } from '@podman-desktop/api';
import type { ProviderContainerConnectionInfo } from '@podman-desktop/core-api';
import type { IConfigurationPropertyRecordedSchema } from '@podman-desktop/core-api/configuration';
import { SummaryField, SummaryGrid, SummarySection } from '@podman-desktop/ui-svelte';

import Donut from '/@/lib/donut/Donut.svelte';

import { extractConnectionResourceMetrics, RESOURCE_FORMATS, toDisplayMetrics } from './connection-resource-metrics';
import type { IProviderConnectionConfigurationPropertyRecorded } from './Util';

interface Props {
  properties?: IConfigurationPropertyRecordedSchema[];
  providerInternalId?: string;
  containerConnectionInfo?: ProviderContainerConnectionInfo;
}

const { properties = [], providerInternalId, containerConnectionInfo }: Props = $props();

let providerContainerConfiguration: IProviderConnectionConfigurationPropertyRecorded[] = $state([]);
let resourceMetrics = $derived(extractConnectionResourceMetrics(providerContainerConfiguration));
let displayMetrics = $derived(resourceMetrics ? toDisplayMetrics(resourceMetrics) : []);
let nonResourceConfigs = $derived(
  providerContainerConfiguration.filter(conf => !RESOURCE_FORMATS.has(conf.format ?? '') && !conf.hidden),
);

let typeLabel = $derived(
  containerConnectionInfo?.type === 'docker'
    ? 'Docker'
    : containerConnectionInfo?.type === 'podman'
      ? 'Podman'
      : containerConnectionInfo?.type ?? '',
);

$effect(() => {
  Promise.all(
    properties.map(async configurationKey => ({
      ...configurationKey,
      value: configurationKey.id
        ? await window.getConfigurationValue(
            configurationKey.id,
            containerConnectionInfo as unknown as ContainerProviderConnection,
          )
        : undefined,
      connection: containerConnectionInfo?.name ?? '',
      providerId: providerInternalId ?? '',
    })),
  )
    .then(result => {
      providerContainerConfiguration = result.filter(configurationKey => configurationKey.value !== undefined);
    })
    .catch((err: unknown) => console.error('Error collecting providers', err));
});
</script>

{#if containerConnectionInfo}
  <SummaryGrid>
    <SummarySection title="Connection">
      {#if containerConnectionInfo.error}
        <SummaryField label="Error">
          <span class="text-[var(--pd-state-error)]" role="alert" aria-label="Connection error"
            >{containerConnectionInfo.error}</span>
        </SummaryField>
      {/if}
      <SummaryField label="Name" value={containerConnectionInfo.name} />
      {#each displayMetrics as metric (metric.title)}
        <SummaryField label={metric.title ?? ''}>
          <Donut title={metric.title} value={metric.value} percent={metric.percent} />
        </SummaryField>
      {/each}
      {#each nonResourceConfigs as connectionSetting (connectionSetting.id)}
        <SummaryField label={connectionSetting.description ?? ''} value={String(connectionSetting.value)} />
      {/each}
      <SummaryField label="Type" value={typeLabel} />
      <SummaryField label="Endpoint" value={containerConnectionInfo.endpoint.socketPath} copyable mono />
    </SummarySection>
  </SummaryGrid>
{/if}
