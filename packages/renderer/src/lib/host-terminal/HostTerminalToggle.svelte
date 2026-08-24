<script lang="ts">
import { faTerminal } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from '@podman-desktop/ui-svelte';
import Fa from 'svelte-fa';

import { hostTerminalPanelVisible } from '/@/stores/host-terminal-store';

function toggle(): void {
  hostTerminalPanelVisible.update(v => !v);
}
</script>

<Tooltip tip="Toggle Terminal (Ctrl+`)" top>
  <button
    class="flex items-center justify-center px-1.5 h-full hover:bg-[var(--pd-statusbar-hover-bg)]"
    class:bg-[var(--pd-statusbar-hover-bg)]={$hostTerminalPanelVisible}
    onclick={toggle}
    aria-label="Toggle Terminal">
    <Fa icon={faTerminal} size="0.85x" />
  </button>
</Tooltip>
