<script lang="ts">
import { TerminalSettings } from '@podman-desktop/core-api/terminal';
import { FitAddon, Terminal } from 'ghostty-web';
import { onDestroy, onMount } from 'svelte';

import { ensureGhosttyInit } from '/@/lib/terminal/ghostty-init';
import { getTerminalTheme, TERMINAL_FONT_FAMILY } from '/@/lib/terminal/terminal-theme';
import { updateTerminalTabName } from '/@/stores/host-terminal-store';

interface Props {
  tabId: number;
  active: boolean;
  onExit?: (tabId: number) => void;
  agentCommand?: string;
  agentArgs?: string[];
  cwd?: string;
}

let { tabId, active, onExit, agentCommand, agentArgs, cwd }: Props = $props();
let terminalDiv: HTMLDivElement;
let terminal: Terminal | undefined;
let fitAddon: FitAddon | undefined;
let callbackId: number | undefined;
let resizeObserver: ResizeObserver | undefined;

function doFit(): void {
  if (!fitAddon || !terminal) return;
  fitAddon.fit();
  if (callbackId) {
    window.hostTerminalResize(callbackId, terminal.cols, terminal.rows).catch(console.error);
  }
}

function handleResize(): void {
  if (active) doFit();
}

$effect(() => {
  if (active && terminal) {
    requestAnimationFrame(() => {
      doFit();
      terminal?.focus();
    });
  }
});

onMount(async () => {
  if (!terminalDiv) return;
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
    theme: getTerminalTheme(),
    scrollback,
    cursorBlink: false,
  });

  fitAddon = new FitAddon();
  terminal.open(terminalDiv);
  terminal.loadAddon(fitAddon);

  terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 't' || e.key === '`')) {
      return false;
    }
    return undefined;
  });

  resizeObserver = new ResizeObserver(() => handleResize());
  resizeObserver.observe(terminalDiv);
  window.addEventListener('host-terminal-resize', handleResize);

  fitAddon.fit();

  callbackId = await window.hostTerminalCreate(
    (data: string) => {
      terminal?.write(data);
    },
    (_exitCode: number) => {
      onExit?.(tabId);
    },
    agentCommand ? { command: agentCommand, args: agentArgs, cwd } : cwd ? { cwd } : undefined,
  );

  terminal.onData(data => {
    if (callbackId) {
      window.hostTerminalWrite(callbackId, data).catch(console.error);
    }
  });

  terminal.onTitleChange(title => {
    if (title) {
      updateTerminalTabName(tabId, title);
    }
  });

  if (callbackId && terminal) {
    await window.hostTerminalResize(callbackId, terminal.cols, terminal.rows);
  }

  if (active) {
    terminal.focus();
  }
});

onDestroy(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('host-terminal-resize', handleResize);
  if (callbackId) {
    window.hostTerminalClose(callbackId).catch(console.error);
    callbackId = undefined;
  }
  terminal?.dispose();
});
</script>

<div
  class="h-full w-full overflow-hidden py-[5px] flex justify-center bg-[var(--pd-terminal-background)]"
  bind:this={terminalDiv}>
</div>
