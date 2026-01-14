<script lang="ts">
import { router } from 'tinro';

import Dots from '/@/lib/ui/Dots.svelte';

import type { PodInfoUI } from './PodInfoUI';

export let object: PodInfoUI;

function openContainersFromPod(pod: PodInfoUI): void {
  router.goto(`/containers/?filter=${pod.shortId}`);
}
</script>

<button class:cursor-pointer={object.containers.length > 0} aria-label="View {object.containers.length} containers in pod {object.name}" on:click={(): void => openContainersFromPod(object)}>
  <Dots containers={object.containers} />
</button>