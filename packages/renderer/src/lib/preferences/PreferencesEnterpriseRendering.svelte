<script lang="ts">
  import SettingsPage from './SettingsPage.svelte';
  import StatusDot from '../ui/StatusDot.svelte';

  // TODO: wire this up to actual enterprise config JSON: "registries.enable"
  let registriesEnabled = true; // mock for now
</script>

<SettingsPage title="Enterprise Configuration">
    {#snippet subtitle()}
    <span>
      These enterprise configurations are provisioned on each startup. For more information, see our <a
        href="#"
        class="text-[var(--pd-content-text)] underline underline-offset-2">enterprise documentation</a>.
    </span>
  {/snippet}
  <div class="flex flex-col px-2 py-2 w-full text-[color:var(--pd-invert-content-card-text)] space-y-4">
    <div class="flex flex-row justify-between items-center bg-[color:var(--pd-invert-content-card-bg)] rounded-lg px-3 py-2 shadow-sm">
      <div class="flex flex-col">
        <span class="font-semibold">Registries Enabled</span>
        <span class="text-sm text-[color:var(--pd-invert-content-card-text-secondary)]">
          Shows whether enterprise registries are enabled in the configuration.
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span>{registriesEnabled ? 'Enabled' : 'Disabled'}</span>
        <StatusDot status={registriesEnabled ? 'running' : 'stopped'} />
      </div>
    </div>
  </div>
</SettingsPage>
