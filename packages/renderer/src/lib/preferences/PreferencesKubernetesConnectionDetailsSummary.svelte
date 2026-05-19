<script lang="ts">
import type { KubernetesProviderConnection } from '@podman-desktop/api';
import type { ProviderKubernetesConnectionInfo } from '@podman-desktop/core-api';
import type { IConfigurationPropertyRecordedSchema } from '@podman-desktop/core-api/configuration';
import { SummaryField, SummaryGrid, SummarySection } from '@podman-desktop/ui-svelte';

import type { IProviderConnectionConfigurationPropertyRecorded } from './Util';

interface Props {
  properties?: IConfigurationPropertyRecordedSchema[];
  providerInternalId?: string;
  kubernetesConnectionInfo?: ProviderKubernetesConnectionInfo;
}

const { properties = [], providerInternalId, kubernetesConnectionInfo }: Props = $props();

let providerContainerConfiguration: IProviderConnectionConfigurationPropertyRecorded[] = $state([]);
let providerConnectionConfiguration = $derived(
  providerContainerConfiguration.filter(configurationKey => configurationKey.value !== undefined),
);

$effect(() => {
  Promise.all(
    properties.map(async configurationKey => ({
      ...configurationKey,
      value: configurationKey.id
        ? await window.getConfigurationValue(
            configurationKey.id,
            kubernetesConnectionInfo as unknown as KubernetesProviderConnection,
          )
        : undefined,
      connection: kubernetesConnectionInfo?.name ?? '',
      providerId: providerInternalId ?? '',
    })),
  )
    .then(result => {
      providerContainerConfiguration = result.flat();
    })
    .catch((err: unknown) => console.error('Error collecting providers', err));
});
</script>

{#if kubernetesConnectionInfo}
  <SummaryGrid>
    <SummarySection title="Connection">
      {#if kubernetesConnectionInfo.error}
        <SummaryField label="Error">
          <span class="text-[var(--pd-state-error)]" role="alert" aria-label="Connection error"
            >{kubernetesConnectionInfo.error}</span>
        </SummaryField>
      {/if}
      <SummaryField label="Name" value={kubernetesConnectionInfo.name} />
      {#each providerConnectionConfiguration as connectionSetting (connectionSetting.id)}
        <SummaryField label={connectionSetting.description ?? ''} value={String(connectionSetting.value)} />
      {/each}
      <SummaryField label="Type" value="Kubernetes" />
      <SummaryField label="Endpoint" value={kubernetesConnectionInfo.endpoint.apiURL} copyable mono />
    </SummarySection>
  </SummaryGrid>
{/if}
