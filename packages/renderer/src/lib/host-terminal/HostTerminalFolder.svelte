<script lang="ts">
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@podman-desktop/ui-svelte/icons';

import { agentWorkingDirectory } from '/@/stores/host-terminal-store';

import { chooseTerminalFolder, terminalFolderName } from './terminal-folder';

async function browseFolder(): Promise<void> {
  const folder = await chooseTerminalFolder();
  if (folder) {
    agentWorkingDirectory.set(folder);
  }
}

function onChooseFolder(): void {
  browseFolder().catch(console.error);
}
</script>

<div class="px-3 py-2 border-b border-[var(--pd-content-card-border)]">
  <p class="font-medium truncate">Folder: {terminalFolderName($agentWorkingDirectory)}</p>
  {#if $agentWorkingDirectory}
    <p class="mt-1 truncate" title={$agentWorkingDirectory}>{$agentWorkingDirectory}</p>
  {/if}
</div>
<button
  class="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[var(--pd-global-nav-bg-hover)]"
  onclick={onChooseFolder}>
  <Icon icon={faFolderOpen} size="xs" />
  Choose folder…
</button>
