<script lang="ts">
import { TerminalSettings } from '@podman-desktop/core-api/terminal';
import { EmptyScreen } from '@podman-desktop/ui-svelte';
import { FitAddon, Terminal } from 'ghostty-web';
import { onDestroy, onMount } from 'svelte';
import { router } from 'tinro';

import { ensureGhosttyInit } from '/@/lib/terminal/ghostty-init';
import { SerializeAddon } from '/@/lib/terminal/ghostty-serialize-addon';
import { getTerminalTheme, TERMINAL_FONT_FAMILY } from '/@/lib/terminal/terminal-theme';
import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';
import { getExistingTerminal, registerTerminal } from '/@/stores/container-terminal-store';

import type { ContainerInfoUI } from './ContainerInfoUI';

interface ContainerDetailsTerminalProps {
  container: ContainerInfoUI;
}

let { container }: ContainerDetailsTerminalProps = $props();
let terminalXtermDiv: HTMLDivElement;
let shellTerminal: Terminal;
let currentRouterPath: string;
let sendCallbackId: number | undefined;
let terminalContent: string = '';
let serializeAddon: SerializeAddon;
let lastState = $state('');
let containerState = $derived(container.state);
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let onDataDisposable: { dispose(): void } | undefined;
let reconnecting = false;

function registerInputHandler(callbackId: number): void {
  onDataDisposable?.dispose();
  onDataDisposable = shellTerminal?.onData(data => {
    window.shellInContainerSend(callbackId, data).catch((error: unknown) => console.log(String(error)));
  });
}

$effect(() => {
  if (lastState !== '' && lastState !== 'RUNNING' && containerState === 'RUNNING') {
    restartTerminal().catch((err: unknown) => {
      console.error('Error restarting terminal', err);
      scheduleReconnect();
    });
  }
  lastState = container.state;
});

async function restartTerminal(): Promise<void> {
  if (reconnecting) return;
  reconnecting = true;
  try {
    clearReconnectTimer();
    ignoreFirstData = true;
    await executeShellIntoContainer();
    window.dispatchEvent(new Event('resize'));
  } finally {
    reconnecting = false;
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    if (container.state === 'RUNNING') {
      restartTerminal().catch((err: unknown) => {
        console.error('Error restarting terminal', err);
        scheduleReconnect();
      });
    }
  }, 2000);
}

// update current route scheme
router.subscribe(route => {
  currentRouterPath = route.path;
});

let ignoreFirstData = false;

function createDataCallback(): (data: Buffer) => void {
  let ignorePrompt = ignoreFirstData;
  ignoreFirstData = false;
  return (data: Buffer) => {
    if (ignorePrompt) {
      ignorePrompt = false;
      return;
    }
    shellTerminal.write(data.toString());
  };
}

function receiveEndCallback(): void {
  if (!sendCallbackId) return;

  if (reconnecting) {
    scheduleReconnect();
    return;
  }

  if (containerState === 'RUNNING') {
    restartTerminal().catch((err: unknown) => {
      console.error(`Error opening terminal for container ${container.id}`, err);
      scheduleReconnect();
    });
  } else {
    scheduleReconnect();
  }
}

// call exec command
async function executeShellIntoContainer(): Promise<void> {
  if (container.state !== 'RUNNING') {
    return;
  }
  // grab logs of the container
  const callbackId = await window.shellInContainer(
    container.engineId,
    container.id,
    createDataCallback(),
    () => {},
    receiveEndCallback,
  );
  await window.shellInContainerResize(callbackId, shellTerminal.cols, shellTerminal.rows);
  registerInputHandler(callbackId);
  sendCallbackId = callbackId;
}

// refresh
async function refreshTerminal(): Promise<void> {
  // missing element, return
  if (!terminalXtermDiv) {
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

  // get terminal if any
  const existingTerminal = getExistingTerminal(container.engineId, container.id);

  shellTerminal = new Terminal({
    fontSize,
    fontFamily: TERMINAL_FONT_FAMILY,
    theme: getTerminalTheme(),
    scrollback,
  });

  const fitAddon = new FitAddon();
  serializeAddon = new SerializeAddon();

  shellTerminal.open(terminalXtermDiv);
  shellTerminal.loadAddon(fitAddon);
  shellTerminal.loadAddon(serializeAddon);

  if (existingTerminal) {
    ignoreFirstData = true;
    shellTerminal.write(existingTerminal.terminal);
  }

  // call fit addon each time we resize the window
  window.addEventListener('resize', () => {
    if (currentRouterPath === `/containers/${container.id}/terminal`) {
      fitAddon.fit();
      if (sendCallbackId) {
        window
          .shellInContainerResize(sendCallbackId, shellTerminal.cols, shellTerminal.rows)
          .catch((err: unknown) => console.error(`Error resizing terminal for container ${container.id}`, err));
      }
    }
  });
  fitAddon.fit();
}
onMount(async () => {
  await refreshTerminal();
  await executeShellIntoContainer();
});

onDestroy(() => {
  clearReconnectTimer();
  onDataDisposable?.dispose();
  terminalContent = serializeAddon?.serialize() ?? '';
  registerTerminal({
    engineId: container.engineId,
    containerId: container.id,
    terminal: terminalContent,
    callbackId: sendCallbackId,
  });
  serializeAddon?.dispose();
  shellTerminal?.dispose();
  sendCallbackId = undefined;
});
</script>

<div
  class="h-full p-[5px] flex justify-center bg-[var(--pd-terminal-background)]"
  bind:this={terminalXtermDiv}
  class:hidden={container.state !== 'RUNNING'}>
</div>

<EmptyScreen
  hidden={container.state === 'RUNNING'}
  icon={NoLogIcon}
  title="No Terminal"
  message="Container is not running" />
