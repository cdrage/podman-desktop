<script lang="ts">
import { faCheck, faCircleNotch, faExclamationCircle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { Icon } from '@podman-desktop/ui-svelte/icons';

interface ActionLogEntry {
  id: string;
  type: 'info' | 'action' | 'success' | 'error';
  message: string;
  timestamp: number;
}

interface Props {
  actions: ActionLogEntry[];
}

const { actions }: Props = $props();

function getIcon(type: ActionLogEntry['type']): typeof faCheck {
  switch (type) {
    case 'success':
      return faCheck;
    case 'error':
      return faExclamationCircle;
    case 'action':
      return faCircleNotch;
    default:
      return faInfoCircle;
  }
}

function getColor(type: ActionLogEntry['type']): string {
  switch (type) {
    case 'success':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    case 'action':
      return 'text-purple-400';
    default:
      return 'text-blue-400';
  }
}

function getBgColor(type: ActionLogEntry['type']): string {
  switch (type) {
    case 'success':
      return 'bg-green-500/10 border-green-500/20';
    case 'error':
      return 'bg-red-500/10 border-red-500/20';
    case 'action':
      return 'bg-purple-500/10 border-purple-500/20';
    default:
      return 'bg-blue-500/10 border-blue-500/20';
  }
}
</script>

{#if actions.length > 0}
  <div class="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none max-w-sm">
    {#each actions as action (action.id)}
      <div
        class="flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg pointer-events-auto animate-slide-in {getBgColor(action.type)}"
        style="animation: slideIn 0.2s ease-out;">
        <Icon
          icon={getIcon(action.type)}
          class="{getColor(action.type)} {action.type === 'action' ? 'animate-spin' : ''}"
        />
        <span class="text-sm text-white/90 font-medium truncate">
          {action.message}
        </span>
      </div>
    {/each}
  </div>
{/if}

<style>
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
