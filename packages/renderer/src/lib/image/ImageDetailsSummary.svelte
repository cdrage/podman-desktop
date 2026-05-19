<script lang="ts">
import type { ManifestInspectInfo } from '@podman-desktop/api';
import { SummaryField, SummaryGrid, SummarySection } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';

import { ImageUtils } from './image-utils';
import type { ImageInfoUI } from './ImageInfoUI';

interface Props {
  image: ImageInfoUI;
}

let { image }: Props = $props();

let manifestDetails: ManifestInspectInfo | undefined = $state();

const imageUtils = new ImageUtils();

onMount(async () => {
  if (image.isManifest) {
    try {
      manifestDetails = await window.inspectManifest(image.engineId, image.id);
    } catch (err) {
      console.error(err);
    }
  }
});
</script>

<SummaryGrid>
  <SummarySection title="Details">
    <SummaryField label="Name" value={image.name} />
    <SummaryField label="Tag" value={image.tag} />
    <SummaryField label="ID" value={image.id} copyable mono />
    <SummaryField label="Size" value={image.humanSize} />
    <SummaryField label="Age" value={image.age} />
  </SummarySection>

  {#if manifestDetails && manifestDetails.manifests.length > 0}
    <SummarySection title="Manifest Details">
      {#each manifestDetails.manifests as manifest (manifest.digest)}
        <SummaryField label="Digest" value={imageUtils.getShortId(manifest.digest)} copyable mono />
        <SummaryField label="Media Type" value={manifest.mediaType} />
        <SummaryField label="Architecture" value={manifest.platform.architecture} />
        {#if manifest.platform.variant}
          <SummaryField label="Variant" value={manifest.platform.variant} />
        {/if}
        <SummaryField label="OS" value={manifest.platform.os} />
        <SummaryField label="Size" value={imageUtils.getHumanSize(manifest.size)} />
        {#if manifest.urls}
          {#each manifest.urls as url, index (index)}
            <SummaryField label="URL" value={url} />
          {/each}
        {/if}
      {/each}
    </SummarySection>
  {/if}
</SummaryGrid>
