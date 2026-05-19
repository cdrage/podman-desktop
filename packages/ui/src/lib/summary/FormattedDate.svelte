<script lang="ts">
import humanizeDuration from 'humanize-duration';

import Tooltip from '../tooltip/Tooltip.svelte';

interface Props {
  date: Date | string | number;
  relative?: boolean;
  format?: 'short' | 'long';
  class?: string;
}

let { date, relative = false, format = 'short', class: className = '' }: Props = $props();

let dateObj = $derived(date instanceof Date ? date : new Date(date));
let isValid = $derived(!isNaN(dateObj.getTime()));

let formattedDate = $derived.by(() => {
  if (!isValid) return 'Invalid date';

  if (relative) {
    const diff = Date.now() - dateObj.getTime();
    if (Math.abs(diff) < 1000) return 'just now';
    return humanizeDuration(diff, { largest: 2, round: true }) + (diff > 0 ? ' ago' : ' from now');
  }

  const options: Intl.DateTimeFormatOptions =
    format === 'short'
      ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
      : {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        };

  return new Intl.DateTimeFormat(undefined, options).format(dateObj);
});

let fullTimestamp = $derived(isValid ? dateObj.toISOString() : '');
</script>

{#if isValid}
  <Tooltip bottom tip={fullTimestamp}>
    <time datetime={fullTimestamp} class={className}>
      {formattedDate}
    </time>
  </Tooltip>
{:else}
  <span class="italic opacity-50 {className}">Invalid date</span>
{/if}
