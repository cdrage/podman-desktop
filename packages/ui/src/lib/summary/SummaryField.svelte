<script lang="ts">
import { faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';
import type { Snippet } from 'svelte';

import Icon from '../icons/Icon.svelte';
import Tooltip from '../tooltip/Tooltip.svelte';

interface Props {
  label: string;
  value?: string;
  copyable?: boolean;
  mono?: boolean;
  children?: Snippet;
  class?: string;
}

let { label, value, copyable = false, mono = false, children, class: className = '' }: Props = $props();

let copied = $state(false);

async function copyToClipboard(): Promise<void> {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1500);
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
  }
}
</script>

<div
  class="group flex flex-col gap-1 {className}"
  aria-label={label}>
  <span class="text-sm text-[var(--pd-details-body-text)] opacity-60">
    {label}
  </span>
  <span
    class="flex min-w-0 items-center gap-2 break-all text-base text-[var(--pd-details-body-text)]
      {mono ? 'font-mono' : ''}">
    {#if children}
      {@render children()}
    {:else if value}
      {value}
    {:else}
      <span class="italic opacity-50">Not set</span>
    {/if}
    {#if copyable && value}
      <Tooltip bottom tip={copied ? 'Copied!' : 'Copy'}>
        <button
          class="inline-flex shrink-0 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
          onclick={copyToClipboard}
          aria-label="Copy {label} to clipboard"
          type="button">
          <Icon icon={copied ? faCheck : faCopy} size="0.75x" />
        </button>
      </Tooltip>
    {/if}
  </span>
</div>
