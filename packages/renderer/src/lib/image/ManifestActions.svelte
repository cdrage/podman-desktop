<script lang="ts">
import { faArrowUp } from '@fortawesome/free-solid-svg-icons';

import ListItemButtonIcon from '../ui/ListItemButtonIcon.svelte';
import ActionsWrapper from './ActionsMenu.svelte';
import type { ImageInfoUI } from './ImageInfoUI';

export let onPushManifest: (imageInfo: ImageInfoUI) => void;
export let image: ImageInfoUI;
export let dropdownMenu = false;
export let detailed = false;

async function pushManifest(imageInfo: ImageInfoUI): Promise<void> {
  onPushManifest(imageInfo);
}
</script>

<!-- If dropdownMenu is true, use it, otherwise just show the regular buttons -->
<ActionsWrapper dropdownMenu="{dropdownMenu}">
  <ListItemButtonIcon
    title="Push Image"
    onClick="{() => pushManifest(image)}"
    menu="{dropdownMenu}"
    detailed="{detailed}"
    icon="{faArrowUp}" />
</ActionsWrapper>
