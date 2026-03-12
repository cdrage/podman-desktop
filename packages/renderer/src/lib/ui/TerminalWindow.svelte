<script lang="ts">
import { TerminalSettings } from '@podman-desktop/core-api/terminal';
import { FitAddon, Terminal } from 'ghostty-web';
import { createEventDispatcher, onDestroy, onMount } from 'svelte';

import { ensureGhosttyInit } from '/@/lib/terminal/ghostty-init';
import { getTerminalTheme } from '/@/lib/terminal/terminal-theme';
import TerminalSearchControls from '/@/lib/ui/TerminalSearchControls.svelte';

interface Props {
  terminal?: Terminal;
  convertEol?: boolean;
  disableStdIn?: boolean;
  showCursor?: boolean;
  search?: boolean;
  class?: string;
}

let {
  terminal = $bindable(),
  convertEol,
  disableStdIn = true,
  showCursor = false,
  search = false,
  class: className,
}: Props = $props();

let logsXtermDiv: HTMLDivElement | undefined;
let resizeHandler: () => void;

const dispatch = createEventDispatcher();

async function refreshTerminal(): Promise<void> {
  // missing element, return
  if (!logsXtermDiv) {
    return;
  }
  await ensureGhosttyInit();
  // grab font size
  const fontSize = await window.getConfigurationValue<number>(
    TerminalSettings.SectionName + '.' + TerminalSettings.FontSize,
  );
  const scrollback = await window.getConfigurationValue<number>(
    TerminalSettings.SectionName + '.' + TerminalSettings.Scrollback,
  );

  terminal = new Terminal({
    fontSize,
    disableStdin: disableStdIn,
    theme: getTerminalTheme(),
    convertEol: convertEol,
    scrollback,
  });
  const fitAddon = new FitAddon();

  terminal.open(logsXtermDiv);
  terminal.loadAddon(fitAddon);
  if (!showCursor) {
    // disable cursor
    terminal.write('\x1b[?25l');
  }

  // call fit addon each time we resize the window
  resizeHandler = (): void => {
    fitAddon.fit();
  };
  window.addEventListener('resize', resizeHandler);

  fitAddon.fit();
}

onMount(async () => {
  await refreshTerminal();
  dispatch('init');
});

onDestroy(() => {
  window.removeEventListener('resize', resizeHandler);
  terminal?.dispose();
});
</script>

{#if search && terminal}
  <TerminalSearchControls {terminal} />
{/if}

<div class="{className} overflow-hidden p-[5px] pr-0 bg-[var(--pd-terminal-background)]" role="term" bind:this={logsXtermDiv}></div>
