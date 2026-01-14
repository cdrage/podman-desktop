<script lang="ts">
import { DropdownMenu } from '@podman-desktop/ui-svelte';
import type { Snippet } from 'svelte';

import FlatMenu from '/@/lib/ui/FlatMenu.svelte';

interface Props {
  dropdownMenu?: boolean;
  dropdownMenuAsMenuActionItem?: boolean;
  onBeforeToggle?: () => void;
  title?: string;
  children?: Snippet;
}

let {
  dropdownMenu = false,
  dropdownMenuAsMenuActionItem = false,
  onBeforeToggle = (): void => {},
  title = '',
  children,
}: Props = $props();
</script>

{#if dropdownMenu}
  <DropdownMenu shownAsMenuActionItem={dropdownMenuAsMenuActionItem} onBeforeToggle={onBeforeToggle} title={title}
    >{@render children?.()}</DropdownMenu>
{:else}
  <FlatMenu>{@render children?.()}</FlatMenu>
{/if}
