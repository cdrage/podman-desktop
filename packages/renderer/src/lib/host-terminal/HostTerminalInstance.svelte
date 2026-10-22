<script lang="ts">
import '@xterm/xterm/css/xterm.css';

import { TerminalSettings } from '@desktop-framework/api/terminal';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { onMount } from 'svelte';

import { getTerminalTheme } from '/@/lib/terminal/terminal-theme';
import { updateTerminalTabName } from '/@/stores/host-terminal-store';

interface Props {
  tabId: number;
  active: boolean;
  onExit?: (tabId: number) => void;
  cwd?: string;
}

let { tabId, active, onExit, cwd }: Props = $props();
let terminalDiv: HTMLDivElement;
let terminal = $state.raw<Terminal>();
let fitAddon: FitAddon | undefined;
let callbackId: number | undefined;
let error = $state<string>();

function fitTerminal(): void {
  if (!active || !terminalDiv?.clientWidth || !terminalDiv.clientHeight) {
    return;
  }

  fitAddon?.fit();
}

$effect(() => {
  if (active && terminal) {
    const frame = requestAnimationFrame(() => {
      fitTerminal();
      terminal?.focus();
    });
    return (): void => cancelAnimationFrame(frame);
  }
});

onMount(() => {
  let disposed = false;
  const observer = new ResizeObserver(fitTerminal);
  observer.observe(terminalDiv);

  async function initTerminal(): Promise<void> {
    const [fontSize, lineHeight, scrollback] = await Promise.all([
      window.getConfigurationValue<number>(`${TerminalSettings.SectionName}.${TerminalSettings.FontSize}`),
      window.getConfigurationValue<number>(`${TerminalSettings.SectionName}.${TerminalSettings.LineHeight}`),
      window.getConfigurationValue<number>(`${TerminalSettings.SectionName}.${TerminalSettings.Scrollback}`),
    ]);
    if (disposed) {
      return;
    }

    terminal = new Terminal({ fontSize, lineHeight, scrollback, theme: getTerminalTheme() });
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalDiv);
    terminal.attachCustomKeyEventHandler(
      event => !((event.ctrlKey || event.metaKey) && ['t', '`'].includes(event.key)),
    );
    terminal.onData(data => {
      if (callbackId !== undefined) {
        window.hostTerminalWrite(callbackId, data).catch(console.error);
      }
    });
    terminal.onResize(({ cols, rows }) => {
      if (callbackId !== undefined) {
        window.hostTerminalResize(callbackId, cols, rows).catch(console.error);
      }
    });
    terminal.onTitleChange(title => {
      if (title) {
        updateTerminalTabName(tabId, title);
      }
    });

    const id = await window.hostTerminalCreate(
      data => terminal?.write(data),
      () => onExit?.(tabId),
      { cwd },
    );
    // A tab can close before the main process returns its session ID.
    if (disposed) {
      await window.hostTerminalClose(id);
      return;
    }

    callbackId = id;
    fitTerminal();
    await window.hostTerminalResize(id, terminal.cols, terminal.rows);
    if (active) {
      terminal.focus();
    }
  }

  initTerminal().catch((cause: unknown) => {
    if (!disposed) {
      error = `Failed to open terminal: ${String(cause)}`;
    }
  });

  return (): void => {
    disposed = true;
    observer.disconnect();
    if (callbackId !== undefined) {
      window.hostTerminalClose(callbackId).catch(console.error);
    }
    terminal?.dispose();
  };
});
</script>

{#if error}
  <p role="alert" class="p-2 text-[var(--pd-content-text)]">{error}</p>
{/if}
<div class="h-full w-full overflow-hidden p-[5px] bg-[var(--pd-terminal-background)]" bind:this={terminalDiv}></div>
