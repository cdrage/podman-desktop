<script lang="ts">
interface Props {
  actionDescription: string;
  confirmationType: 'destructive' | 'file-picker' | 'external-browser';
  onconfirm: () => void;
  oncancel: () => void;
}

const { actionDescription, confirmationType, onconfirm, oncancel }: Props = $props();

const isFilePicker = $derived(confirmationType === 'file-picker');
const isExternalBrowser = $derived(confirmationType === 'external-browser');
</script>

<div class="selkie-mode-confirmation fixed inset-0 bg-black/10 z-[110] flex items-start justify-center pt-14">
  <div class="bg-[var(--pd-content-bg)] rounded-lg shadow-xl w-80 max-w-[90vw] border border-[var(--pd-content-card-border)]">

    <!-- Header -->
    <div class="p-5">
      <div class="flex items-start gap-4">
        <pre class="text-[var(--pd-content-card-text)] opacity-60 text-[10px] leading-tight font-mono select-none shrink-0">{isFilePicker ? `  .---.
 / O_O \\
>(     )
  '---'` : isExternalBrowser ? `  .---.
 / O_O \\
>(     )
  '---'` : `  .---.
 / O_O \\
>(  !  )
  '---'`}</pre>
        <div class="flex-1 min-w-0 pt-1">
          <div class="text-[var(--pd-content-card-text)] text-sm font-mono mb-2">
            {#if isFilePicker}
              Select File
            {:else if isExternalBrowser}
              Open Browser
            {:else}
              Confirm Action
            {/if}
          </div>
          <div class="text-[10px] text-[var(--pd-content-card-text)] opacity-70 font-mono tracking-wide">
            REQUIRES APPROVAL
          </div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="border-t border-[var(--pd-content-card-border)] px-5 py-4">
      <div class="text-xs text-[var(--pd-content-card-text)] font-mono leading-relaxed">
        {actionDescription}
      </div>
      {#if isFilePicker}
        <div class="text-[10px] text-[var(--pd-content-card-text)] opacity-70 mt-3 font-mono tracking-wide">
          A FILE PICKER WILL OPEN
        </div>
      {:else if isExternalBrowser}
        <div class="text-[10px] text-[var(--pd-content-card-text)] opacity-70 mt-3 font-mono tracking-wide">
          OPENS IN DEFAULT BROWSER
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="px-5 py-3 flex items-center justify-between text-xs font-mono border-t border-[var(--pd-content-card-border)]">
      <button onclick={oncancel} class="text-[var(--pd-content-card-text)] opacity-70 hover:opacity-100 transition-opacity tracking-wide">CANCEL</button>
      <button
        onclick={onconfirm}
        class="opacity-80 hover:opacity-100 transition-opacity tracking-wide {isFilePicker
          ? 'text-purple-500'
          : isExternalBrowser
            ? 'text-blue-500'
            : 'text-red-500'}">
        {isFilePicker ? 'CONTINUE' : isExternalBrowser ? 'OPEN' : 'CONFIRM'}
      </button>
    </div>
  </div>
</div>
