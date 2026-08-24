<script lang="ts">
import type { ProviderContainerConnectionInfo, ProviderKubernetesConnectionInfo } from '@podman-desktop/core-api';
import { TerminalSettings } from '@podman-desktop/core-api/terminal';
import { EmptyScreen } from '@podman-desktop/ui-svelte';
import { FitAddon, Terminal } from 'ghostty-web';
import { onDestroy, onMount } from 'svelte';

import { ensureGhosttyInit } from '/@/lib/terminal/ghostty-init';
import { getTerminalTheme, TERMINAL_FONT_FAMILY } from '/@/lib/terminal/terminal-theme';
import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';

import { writeToTerminal } from './Util';

interface Props {
  providerInternalId?: string;
  connectionInfo?: ProviderContainerConnectionInfo | ProviderKubernetesConnectionInfo;
  setNoLogs: () => void;
  noLog: boolean;
}
let { providerInternalId, connectionInfo, setNoLogs, noLog }: Props = $props();
let logsTerminal: Terminal;

$effect(() => {
  noLog = !!noLog;
});
let noLogs = $state(!!noLog);

// Log
let logsXtermDiv: HTMLDivElement;

// Terminal resize
let resizeObserver: ResizeObserver;
let termFit: FitAddon;

async function refreshTerminal(): Promise<void> {
  // missing element, return
  if (!logsXtermDiv) {
    console.log('missing xterm div, exiting...');
    return;
  }

  logsTerminal.open(logsXtermDiv);

  termFit = new FitAddon();
  logsTerminal.loadAddon(termFit);

  // disable cursor
  logsTerminal.write('\x1b[?25l');

  termFit.fit();
}

onMount(async () => {
  await ensureGhosttyInit();
  // grab font size
  const fontSize = await window.getConfigurationValue<number>(
    TerminalSettings.SectionName + '.' + TerminalSettings.FontSize,
  );
  const scrollback = await window.getConfigurationValue<number>(
    TerminalSettings.SectionName + '.' + TerminalSettings.Scrollback,
  );
  logsTerminal = new Terminal({
    fontSize,
    fontFamily: TERMINAL_FONT_FAMILY,
    disableStdin: true,
    theme: getTerminalTheme(),
    convertEol: true,
    scrollback,
  });
  // Refresh the terminal on initial load
  await refreshTerminal();

  // Use onRender as a proxy for onLineFeed (ghostty-web doesn't have onLineFeed)
  logsTerminal.onRender(() => {
    setNoLogs();
    noLogs = false;
  });
  // Resize the terminal each time we change the div size
  resizeObserver = new ResizeObserver(() => {
    termFit?.fit();
  });

  // Observe the terminal div
  resizeObserver.observe(logsXtermDiv);
  const logHandler = (newContent: unknown[], colorPrefix: string): void => {
    writeToTerminal(logsTerminal, newContent, colorPrefix);
  };
  if (providerInternalId) {
    await window.startReceiveLogs(
      providerInternalId,
      (data: unknown[]) => logHandler(data, ''),
      (data: unknown[]) => logHandler(data, ''),
      (data: unknown[]) => logHandler(data, ''),
      connectionInfo,
    );
  }
});

onDestroy(() => {
  // Cleanup the observer on destroy
  resizeObserver?.disconnect();
});
</script>

<EmptyScreen
  icon={NoLogIcon}
  title="No Log"
  message="Log output"
  hidden={noLogs === false}
  class="bg-[var(--pd-details-bg)]" />

<div
  aria-label="terminal"
  class="min-w-full flex flex-col items-center bg-[var(--pd-terminal-background)] p-[5px]"
  class:invisible={noLogs === true}
  class:h-0={noLogs === true}
  class:h-full={noLogs === false}
  bind:this={logsXtermDiv}>
</div>
