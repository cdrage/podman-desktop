/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

<script lang="ts">
import { faBox, faCheck, faPlay, faRocket, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type {
  ContainerCreateOptions,
  HostConfig,
  ImageInfo,
  ProviderContainerConnectionInfo,
  PullEvent,
  RunImageFromProtocolConfig,
} from '@podman-desktop/core-api';
import { NavigationPage } from '@podman-desktop/core-api';
import { Button, Checkbox, ErrorMessage, Spinner } from '@podman-desktop/ui-svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';
import type { Terminal } from '@xterm/xterm';
import { onMount, tick } from 'svelte';
// eslint-disable-next-line import/no-duplicates
import { SvelteMap } from 'svelte/reactivity';
// eslint-disable-next-line import/no-duplicates
import { get } from 'svelte/store';
import { router } from 'tinro';

import ContainerConnectionDropdown from '/@/lib/forms/ContainerConnectionDropdown.svelte';
import { splitSpacesHandlingDoubleQuotes } from '/@/lib/string/string';
import TerminalWindow from '/@/lib/ui/TerminalWindow.svelte';
import { handleNavigation } from '/@/navigation';
import { launchContainerWizardConfig } from '/@/stores/launch-container-wizard-store';
import { providerInfos } from '/@/stores/providers';

type WizardStep = 'review' | 'launch' | 'done' | 'error';

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'review', label: 'Review' },
  { key: 'launch', label: 'Launch' },
  { key: 'done', label: 'Done' },
];

let config: RunImageFromProtocolConfig | undefined = $state();
let currentStep = $state<WizardStep>('review');

// Provider connection
let providerConnections = $derived(
  $providerInfos
    .map(provider => provider.containerConnections)
    .flat()
    .filter(conn => conn.status === 'started'),
);
let selectedProviderConnection: ProviderContainerConnectionInfo | undefined = $state();

// Toggle states for optional config
let useName = $state(true);
let usePorts = $state(true);
let useEnv = $state(true);
let useVolumes = $state(true);
let useCmd = $state(true);
let useEntrypoint = $state(true);
let useHostname = $state(true);

// Pull state
let pullInProgress = $state(false);
let pullFinished = $state(false);
let logsPull: Terminal | undefined = $state();
const lineNumberPerId = new SvelteMap<string, number>();
let lineIndex = 0;

// Create state
let createInProgress = $state(false);
let errorMessage = $state('');
let createdContainerId = $state('');
let createdEngineTty = $state(false);

onMount(() => {
  config = get(launchContainerWizardConfig);
  if (!config) {
    router.goto('/images');
    return;
  }
  selectedProviderConnection ??= providerConnections.length > 0 ? providerConnections[0] : undefined;
});

function pullCallback(event: PullEvent): void {
  let lineIndexToWrite;
  if (event.status && event.id) {
    const lineNumber = lineNumberPerId.get(event.id);
    if (lineNumber) {
      lineIndexToWrite = lineNumber;
    } else {
      lineIndex++;
      lineIndexToWrite = lineIndex;
      lineNumberPerId.set(event.id, lineIndex);
    }
  }
  if (!lineIndexToWrite) {
    lineIndex++;
    lineIndexToWrite = lineIndex;
  }

  if (event.status) {
    logsPull?.write(`\u001b[${lineIndexToWrite};0H`);
    logsPull?.write('\u001B[2K');
    if (event.id) {
      logsPull?.write(`${event.id}: `);
    }
    logsPull?.write(event.status);
    if (event.progress && event.progress !== '') {
      logsPull?.write(event.progress);
    } else if (event?.progressDetail?.current && event?.progressDetail?.total) {
      logsPull?.write(` ${Math.round((event.progressDetail.current / event.progressDetail.total) * 100)}%`);
    }
    logsPull?.write('\n\r');
  } else if (event.error) {
    logsPull?.write(event.error.replaceAll('\n', '\n\r') + '\n\r');
  }
}

async function findLocalImage(imageName: string): Promise<ImageInfo | undefined> {
  if (!selectedProviderConnection) return undefined;
  const images = await window.listImages({ provider: $state.snapshot(selectedProviderConnection) });
  return images.find(img =>
    img.RepoTags?.some(tag => tag === imageName || imageName.includes(tag) || tag.includes(imageName)),
  );
}

async function startLaunch(): Promise<void> {
  if (!config || !selectedProviderConnection) return;

  currentStep = 'launch';
  errorMessage = '';

  try {
    // Check if image exists locally
    let localImage = await findLocalImage(config.image);

    // Pull if not found
    if (!localImage) {
      pullInProgress = true;
      lineNumberPerId.clear();
      lineIndex = 0;
      await tick();
      logsPull?.reset();

      await window.pullImage($state.snapshot(selectedProviderConnection), config.image, pullCallback);
      pullInProgress = false;
      pullFinished = true;

      // Find the freshly pulled image
      localImage = await findLocalImage(config.image);
      if (!localImage) {
        throw new Error(`Image "${config.image}" not found after pull`);
      }
    }

    // Build ContainerCreateOptions
    createInProgress = true;
    const engineId = localImage.engineId;

    const PortBindings: { [port: string]: { HostPort?: string; HostIp?: string }[] } = {};
    const ExposedPorts: { [port: string]: object } = {};

    if (usePorts && config.ports) {
      for (const mapping of config.ports) {
        const parts = mapping.split(':');
        let hostPort: string;
        let containerPort: string;
        if (parts.length === 2) {
          hostPort = parts[0];
          containerPort = parts[1];
        } else {
          hostPort = parts[0];
          containerPort = parts[0];
        }
        const portKey = containerPort.includes('/') ? containerPort : `${containerPort}/tcp`;
        ExposedPorts[portKey] = {};
        PortBindings[portKey] = [{ HostPort: hostPort }];
      }
    }

    const Env: string[] = [];
    if (useEnv && config.env) {
      Env.push(...config.env);
    }

    const Binds: string[] = [];
    if (useVolumes && config.volumes) {
      Binds.push(...config.volumes);
    }

    const HostConfigObj: HostConfig = {
      PortBindings,
    };
    if (Binds.length > 0) {
      HostConfigObj.Binds = Binds;
    }

    const options: ContainerCreateOptions = {
      Image: config.image,
      Env: Env.length > 0 ? Env : undefined,
      HostConfig: HostConfigObj,
      ExposedPorts: Object.keys(ExposedPorts).length > 0 ? ExposedPorts : undefined,
      Tty: true,
      OpenStdin: true,
    };

    if (useName && config.name) {
      options.name = config.name;
    }
    if (useCmd && config.cmd) {
      options.Cmd = splitSpacesHandlingDoubleQuotes(config.cmd);
    }
    if (useEntrypoint && config.entrypoint) {
      options.Entrypoint = splitSpacesHandlingDoubleQuotes(config.entrypoint);
    }
    if (useHostname && config.hostname) {
      options.Hostname = config.hostname;
    }

    const data = await window.createAndStartContainer(engineId, options);
    createdContainerId = data.id;
    createdEngineTty = Boolean(options.Tty && options.OpenStdin);
    createInProgress = false;
    currentStep = 'done';

    // Clear the store
    launchContainerWizardConfig.set(undefined);
  } catch (error: unknown) {
    pullInProgress = false;
    createInProgress = false;
    const msg =
      error && typeof error === 'object' && 'message' in error && error.message ? error.message : String(error);
    errorMessage = String(msg);
    currentStep = 'error';
  }
}

function goToContainer(): void {
  if (createdEngineTty) {
    handleNavigation({
      page: NavigationPage.CONTAINER_TTY,
      parameters: { id: createdContainerId },
    });
  } else {
    handleNavigation({ page: NavigationPage.CONTAINERS });
  }
}

function cancel(): void {
  launchContainerWizardConfig.set(undefined);
  router.goto('/images');
}

function retry(): void {
  currentStep = 'review';
  errorMessage = '';
  pullFinished = false;
}

function getStepIndex(step: WizardStep): number {
  if (step === 'error') return 1;
  return STEPS.findIndex(s => s.key === step);
}
</script>

{#if config}
  <div class="flex flex-col h-full bg-[var(--pd-content-card-bg)] text-[var(--pd-details-body-text)]">
    <!-- Header -->
    <div
      class="flex flex-row justify-between items-center p-5 bg-[var(--pd-content-bg)] bg-opacity-90 border-b border-[var(--pd-content-divider)]">
      <div class="flex flex-col">
        <h1 class="text-lg font-bold text-[var(--pd-content-header)]">Launch Container</h1>
        <p class="text-sm text-[var(--pd-content-sub-header)]">from external link</p>
      </div>
      <!-- Step indicators -->
      <div class="flex flex-row gap-6">
        {#each STEPS as step, index (step.key)}
          <div class="flex flex-col items-center">
            <div
              class="w-5 h-5 rounded-full mb-1 border-2 {getStepIndex(currentStep) >= index
                ? 'bg-[var(--pd-onboarding-active-dot-bg)] border-[var(--pd-onboarding-active-dot-border)]'
                : 'border-[var(--pd-onboarding-inactive-dot-border)] bg-[var(--pd-onboarding-inactive-dot-bg)]'}">
            </div>
            <span class="text-xs">{step.label}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-8">
      {#if currentStep === 'review'}
        <div class="max-w-[600px] mx-auto space-y-6">
          <!-- Image -->
          <div class="flex flex-row items-center gap-3 p-4 rounded-lg bg-[var(--pd-content-bg)]">
            <Icon icon={faBox} size="1.5x" class="text-[var(--pd-status-running)]" />
            <div>
              <div class="text-sm text-[var(--pd-content-sub-header)]">Image</div>
              <div class="text-lg font-semibold text-[var(--pd-content-header)]" aria-label="Image name">{config.image}</div>
            </div>
          </div>

          <!-- Container Engine -->
          {#if providerConnections.length > 1}
            <div>
              <label for="providerChoice" class="block mb-2 font-semibold text-[var(--pd-content-card-header-text)]">
                Container Engine
              </label>
              <ContainerConnectionDropdown
                id="providerChoice"
                bind:value={selectedProviderConnection}
                connections={providerConnections} />
            </div>
          {/if}

          <!-- Optional Configuration Toggles -->
          {#if config.name ?? config.ports?.length ?? config.env?.length ?? config.volumes?.length ?? config.cmd ?? config.entrypoint ?? config.hostname}
            <div>
              <h2 class="text-md font-semibold text-[var(--pd-content-header)] mb-3">Configuration</h2>
              <p class="text-sm text-[var(--pd-content-sub-header)] mb-4">
                The following options were included in the link. Toggle any you want to skip.
              </p>

              <div class="space-y-3">
                {#if config.name}
                  <div class="flex flex-row items-center gap-3 p-3 rounded bg-[var(--pd-content-bg)]">
                    <Checkbox bind:checked={useName} title="Use container name" />
                    <div class="flex-1">
                      <div class="text-sm font-medium">Container Name</div>
                      <div class="text-xs text-[var(--pd-content-sub-header)]">{config.name}</div>
                    </div>
                  </div>
                {/if}

                {#if config.ports?.length}
                  <div class="flex flex-row items-start gap-3 p-3 rounded bg-[var(--pd-content-bg)]">
                    <div class="mt-0.5">
                      <Checkbox bind:checked={usePorts} title="Use port mappings" />
                    </div>
                    <div class="flex-1">
                      <div class="text-sm font-medium">Port Mappings</div>
                      {#each config.ports as port (port)}
                        <div class="text-xs text-[var(--pd-content-sub-header)]">{port}</div>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if config.env?.length}
                  <div class="flex flex-row items-start gap-3 p-3 rounded bg-[var(--pd-content-bg)]">
                    <div class="mt-0.5">
                      <Checkbox bind:checked={useEnv} title="Use environment variables" />
                    </div>
                    <div class="flex-1">
                      <div class="text-sm font-medium">Environment Variables</div>
                      {#each config.env as envVar (envVar)}
                        <div class="text-xs text-[var(--pd-content-sub-header)] font-mono">{envVar}</div>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if config.volumes?.length}
                  <div class="flex flex-row items-start gap-3 p-3 rounded bg-[var(--pd-content-bg)]">
                    <div class="mt-0.5">
                      <Checkbox bind:checked={useVolumes} title="Use volume mounts" />
                    </div>
                    <div class="flex-1">
                      <div class="text-sm font-medium">Volume Mounts</div>
                      {#each config.volumes as volume (volume)}
                        <div class="text-xs text-[var(--pd-content-sub-header)] font-mono">{volume}</div>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if config.cmd}
                  <div class="flex flex-row items-center gap-3 p-3 rounded bg-[var(--pd-content-bg)]">
                    <Checkbox bind:checked={useCmd} title="Use command" />
                    <div class="flex-1">
                      <div class="text-sm font-medium">Command</div>
                      <div class="text-xs text-[var(--pd-content-sub-header)] font-mono">{config.cmd}</div>
                    </div>
                  </div>
                {/if}

                {#if config.entrypoint}
                  <div class="flex flex-row items-center gap-3 p-3 rounded bg-[var(--pd-content-bg)]">
                    <Checkbox bind:checked={useEntrypoint} title="Use entrypoint" />
                    <div class="flex-1">
                      <div class="text-sm font-medium">Entrypoint</div>
                      <div class="text-xs text-[var(--pd-content-sub-header)] font-mono">{config.entrypoint}</div>
                    </div>
                  </div>
                {/if}

                {#if config.hostname}
                  <div class="flex flex-row items-center gap-3 p-3 rounded bg-[var(--pd-content-bg)]">
                    <Checkbox bind:checked={useHostname} title="Use hostname" />
                    <div class="flex-1">
                      <div class="text-sm font-medium">Hostname</div>
                      <div class="text-xs text-[var(--pd-content-sub-header)]">{config.hostname}</div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

      {:else if currentStep === 'launch'}
        <div class="max-w-[600px] mx-auto space-y-4">
          <div class="flex flex-col items-center gap-4 py-8">
            <Spinner />
            <div class="text-lg text-[var(--pd-content-header)]">
              {#if pullInProgress}
                Pulling {config.image}...
              {:else if createInProgress}
                Creating container...
              {:else}
                Preparing...
              {/if}
            </div>
          </div>
          {#if pullInProgress || pullFinished}
            <div class="h-[200px]">
              <TerminalWindow bind:terminal={logsPull} />
            </div>
          {/if}
        </div>

      {:else if currentStep === 'done'}
        <div class="max-w-[600px] mx-auto">
          <div class="flex flex-col items-center gap-4 py-12">
            <Icon icon={faCheck} size="3x" class="text-[var(--pd-status-running)]" />
            <div class="text-xl font-semibold text-[var(--pd-content-header)]">Container launched</div>
            <div class="text-sm text-[var(--pd-content-sub-header)]">
              Container from <span class="font-mono">{config.image}</span> is running.
            </div>
          </div>
        </div>

      {:else if currentStep === 'error'}
        <div class="max-w-[600px] mx-auto">
          <div class="flex flex-col items-center gap-4 py-12">
            <Icon icon={faTriangleExclamation} size="3x" class="text-[var(--pd-state-error)]" />
            <div class="text-xl font-semibold text-[var(--pd-content-header)]">Launch failed</div>
            <ErrorMessage error={errorMessage} />
          </div>
          {#if pullFinished || pullInProgress}
            <div class="h-[200px] mt-4">
              <TerminalWindow bind:terminal={logsPull} />
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div
      class="flex flex-row-reverse gap-3 p-5 bg-[var(--pd-content-bg)] border-t border-[var(--pd-content-divider)]">
      {#if currentStep === 'review'}
        <Button
          type="primary"
          icon={faRocket}
          aria-label="Launch container"
          disabled={!selectedProviderConnection}
          on:click={startLaunch}>
          Launch
        </Button>
        <Button type="secondary" aria-label="Cancel" on:click={cancel}>Cancel</Button>
      {:else if currentStep === 'done'}
        <Button type="primary" icon={faPlay} aria-label="View container" on:click={goToContainer}>
          View Container
        </Button>
        <Button type="secondary" aria-label="Close" on:click={cancel}>Close</Button>
      {:else if currentStep === 'error'}
        <Button type="primary" aria-label="Try again" on:click={retry}>Try Again</Button>
        <Button type="secondary" aria-label="Cancel" on:click={cancel}>Cancel</Button>
      {/if}
    </div>
  </div>
{/if}
