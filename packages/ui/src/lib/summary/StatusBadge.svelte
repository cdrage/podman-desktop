<script lang="ts">
interface Props {
  status: string;
  size?: 'sm' | 'md';
  class?: string;
}

let { status, size = 'md', class: className = '' }: Props = $props();

interface StatusStyle {
  bg: string;
  text: string;
  dot: string;
  outline: boolean;
}

function getStatusStyle(s: string): StatusStyle {
  const lower = s.toLowerCase();
  const filledStatuses: Record<string, string> = {
    running: '--pd-status-running',
    terminated: '--pd-status-terminated',
    waiting: '--pd-status-waiting',
    paused: '--pd-status-paused',
    dead: '--pd-status-dead',
    degraded: '--pd-status-degraded',
    starting: '--pd-status-starting',
  };

  const outlineStatuses: Record<string, string> = {
    stopped: '--pd-status-stopped',
    exited: '--pd-status-exited',
    created: '--pd-status-created',
  };

  if (filledStatuses[lower]) {
    const token = filledStatuses[lower];
    return {
      bg: `background-color: var(${token})`,
      text: `color: var(--pd-status-contrast)`,
      dot: `background-color: var(--pd-status-contrast)`,
      outline: false,
    };
  }

  if (outlineStatuses[lower]) {
    const token = outlineStatuses[lower];
    return {
      bg: `border: 1px solid var(${token}); background-color: transparent`,
      text: `color: var(${token})`,
      dot: `background-color: var(${token})`,
      outline: true,
    };
  }

  return {
    bg: `border: 1px solid var(--pd-status-unknown); background-color: transparent`,
    text: `color: var(--pd-status-unknown)`,
    dot: `background-color: var(--pd-status-unknown)`,
    outline: true,
  };
}

let style = $derived(getStatusStyle(status));
let displayText = $derived(status.charAt(0).toUpperCase() + status.slice(1).toLowerCase());
let sizeClasses = $derived(size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-sm');
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-full font-medium {sizeClasses} {className}"
  style={style.bg}
  role="status"
  aria-label="{displayText} status">
  <span class="h-2 w-2 rounded-full" style={style.dot}></span>
  <span style={style.text}>{displayText}</span>
</span>
