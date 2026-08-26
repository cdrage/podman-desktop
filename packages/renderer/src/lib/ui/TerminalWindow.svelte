<script lang="ts">
import { TerminalSettings } from '@podman-desktop/core-api/terminal';
import { FitAddon, Terminal } from 'ghostty-web';
import { createEventDispatcher, onDestroy, onMount } from 'svelte';

import { ensureGhosttyInit } from '/@/lib/terminal/ghostty-init';
import { getTerminalTheme, TERMINAL_FONT_FAMILY } from '/@/lib/terminal/terminal-theme';
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
let resizeObserver: ResizeObserver | undefined;

const dispatch = createEventDispatcher();

async function refreshTerminal(): Promise<void> {
  if (!logsXtermDiv) {
    return;
  }
  await ensureGhosttyInit();

  const fontSize = await window.getConfigurationValue<number>(
    TerminalSettings.SectionName + '.' + TerminalSettings.FontSize,
  );
  const scrollback = await window.getConfigurationValue<number>(
    TerminalSettings.SectionName + '.' + TerminalSettings.Scrollback,
  );

  terminal = new Terminal({
    fontSize,
    fontFamily: TERMINAL_FONT_FAMILY,
    disableStdin: disableStdIn,
    theme: getTerminalTheme(),
    convertEol: convertEol,
    scrollback,
  });
  const fitAddon = new FitAddon();

  terminal.open(logsXtermDiv);
  terminal.loadAddon(fitAddon);
  if (!showCursor) {
    terminal.write('\x1b[?25l');
  }

  const doFit = (): void => {
    if (!logsXtermDiv || logsXtermDiv.offsetHeight === 0) {
      return;
    }
    fitAddon.fit();
  };

  resizeHandler = doFit;
  window.addEventListener('resize', resizeHandler);

  resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(doFit);
  });
  resizeObserver.observe(logsXtermDiv);

  doFit();
}

onMount(async () => {
  await refreshTerminal();
  dispatch('init');
});

onDestroy(() => {
  window.removeEventListener('resize', resizeHandler);
  resizeObserver?.disconnect();
  terminal?.dispose();
});
</script>

{#if search && terminal}
  <TerminalSearchControls {terminal} />
{/if}

<div class="{className} overflow-hidden p-[5px] flex justify-center bg-[var(--pd-terminal-background)]" role="term" bind:this={logsXtermDiv}></div>
