<script lang="ts">
import type { ChatMessage } from '/@api/selkie-mode-info';

interface Props {
  message: ChatMessage;
}

const { message }: Props = $props();

const isUser = $derived(message.role === 'user');
</script>

<div class="flex {isUser ? 'justify-end' : 'justify-start'}">
  <div class="max-w-[85%] {isUser ? 'order-2' : ''}">
    {#if !isUser}
      <div class="text-xs text-[var(--pd-content-card-text)] opacity-40 mb-1.5 ml-1">
        Assistant
      </div>
    {/if}
    <div
      class="px-4 py-3 rounded-2xl text-sm leading-relaxed
        {isUser
          ? 'bg-purple-600 text-white rounded-br-md'
          : 'bg-[var(--pd-content-card-inset-bg)] text-[var(--pd-content-card-text)] rounded-bl-md'}">
      {#if message.content}
        <div class="whitespace-pre-wrap break-words">{message.content}</div>
      {:else}
        <div class="opacity-40">...</div>
      {/if}
    </div>
  </div>
</div>
