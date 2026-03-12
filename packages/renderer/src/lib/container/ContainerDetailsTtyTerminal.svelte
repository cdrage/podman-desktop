<script lang="ts">
import { EmptyScreen } from '@podman-desktop/ui-svelte';
import type { Terminal } from 'ghostty-web';
import { onMount } from 'svelte';

import NoLogIcon from '/@/lib/ui/NoLogIcon.svelte';
import TerminalWindow from '/@/lib/ui/TerminalWindow.svelte';

import type { ContainerInfoUI } from './ContainerInfoUI';

interface Props {
  container: ContainerInfoUI;
}

let { container }: Props = $props();
let attachContainerTerminal: Terminal | undefined = $state(undefined);
let closed = $state(false);
let callbackId: number | undefined = $state(undefined);

let listened = false;
$effect(() => {
  listenTerminalData(attachContainerTerminal, callbackId);
});

// listenTerminalData only when attachContainerTerminal is bound from TerminalWindow component
// and callbackId is defined
function listenTerminalData(terminal: Terminal | undefined, cbId: number | undefined): void {
  if (!attachContainerTerminal || !cbId) {
    return;
  }
  if (listened) {
    return;
  }
  listened = true;
  // pass data from xterm to container
  terminal?.onData(data => {
    if (!callbackId) {
      return;
    }
    window
      .attachContainerSend(callbackId, data)
      .catch((err: unknown) => console.log(`Error sending data to container ${container.id}`, err));
  });
}

// update terminal when receiving data
function receiveDataCallback(data: Buffer): void {
  attachContainerTerminal?.write(data.toString());
}

function receiveEndCallback(): void {
  closed = true;
}

// call exec command
async function attachToContainer(): Promise<void> {
  if (container.state !== 'RUNNING') {
    return;
  }

  // attach to the container
  callbackId = await window.attachContainer(
    container.engineId,
    container.id,
    receiveDataCallback,
    () => {},
    receiveEndCallback,
  );

  attachContainerTerminal?.onData(data => {
    if (!callbackId) {
      return;
    }
    window.attachContainerSend(callbackId, data).catch((err: unknown) => console.log(String(err)));
  });
}

onMount(async () => {
  await attachToContainer();
});
</script>

<div class="h-full" class:hidden={container.state !== 'RUNNING'}>
  <TerminalWindow class="h-full" bind:terminal={attachContainerTerminal} disableStdIn={false} showCursor={true} />
</div>

<EmptyScreen
  hidden={!closed && container.state !== 'RUNNING'}
  icon={NoLogIcon}
  title="No TTY"
  message="Tty has stopped" />

<EmptyScreen
  hidden={container.state === 'RUNNING'}
  icon={NoLogIcon}
  title="No TTY"
  message="Container is not running" />
