<script lang="ts">
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import { terminalWorkingDirectory } from '/@/stores/host-terminal-store';

import { chooseTerminalFolder, terminalFolderName } from './terminal-folder';

async function browseFolder(): Promise<void> {
  const folder = await chooseTerminalFolder();
  if (folder) {
    terminalWorkingDirectory.set(folder);
  }
}

function onChooseFolder(): void {
  browseFolder().catch(console.error);
}
</script>

<div class="px-3 py-2 border-b border-[var(--pd-content-card-border)]">
  <p class="font-medium truncate">Folder: {terminalFolderName($terminalWorkingDirectory)}</p>
  {#if $terminalWorkingDirectory}
    <p class="mt-1 truncate" title={$terminalWorkingDirectory}>{$terminalWorkingDirectory}</p>
  {/if}
</div>
<Button
  type="link"
  class="flex items-center gap-2 w-full text-left"
  padding="px-3 py-2"
  onclick={onChooseFolder}>
  <Icon icon={faFolderOpen} size="xs" />
  Choose folder…
</Button>
