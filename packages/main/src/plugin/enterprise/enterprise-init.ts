import * as fs from 'node:fs';

import { inject, injectable } from 'inversify';

import { isLinux, isMac, isWindows } from '/@/util.js';

import { ImageRegistry } from '../image-registry.js';
import {
  CONFIGURATION_ENTERPRISE_LINUX_LOCATION,
  CONFIGURATION_ENTERPRISE_MAC_LOCATION,
  CONFIGURATION_ENTERPRISE_REGISTRIES_ENABLE,
  CONFIGURATION_ENTERPRISE_WINDOWS_LOCATION,
} from './enterprise-constants.js';

@injectable()
export class EnterpriseInit {
  // We need image registry so we can modify the registry settings (enable enterprise registries).
  constructor(
    @inject(ImageRegistry)
    private imageRegistry: ImageRegistry,
  ) {}

  // Retrieve the enterprise settings file location,
  // depending on the OS. If unsupported (ex. FreeBSD), return undefined so that we do NOT proceed.
  private getEnterpriseSettingsFile(): string | undefined {
    if (isMac()) return CONFIGURATION_ENTERPRISE_MAC_LOCATION;
    if (isLinux()) return CONFIGURATION_ENTERPRISE_LINUX_LOCATION;
    if (isWindows()) return CONFIGURATION_ENTERPRISE_WINDOWS_LOCATION;

    // If we reach here, it means we are on an unsupported OS
    console.error(`Unsupported OS detected: ${process.platform} for enterprise file retrieval.`);
    return undefined;
  }

  // This file loads the enterprise settings from disk into memory,
  // so we can apply enterprise defaults.
  // we want to return an easily accessible object so we use Record<string, unknown>
  private loadEnterpriseSettings(): Record<string, unknown> {
    // Get the location of the file
    const settingsFile = this.getEnterpriseSettingsFile();

    // If the settingsFile is undefined, or does not exist, fail early and return an empty object.
    if (!settingsFile || !fs.existsSync(settingsFile)) {
      return {};
    }

    // Parse the JSON file
    try {
      const raw = fs.readFileSync(settingsFile, 'utf-8');
      const configData = JSON.parse(raw);
      console.log(`Enterprise settings loaded: ${JSON.stringify(configData, null, 2)}`);
      return configData;
    } catch (err) {
      console.error(`Unable to parse enterprise settings at ${settingsFile}`, err);
      return {};
    }
  }

  // The main "initialization" entrypoint. Loads the enterprise configuration file
  // and applies supported enterprise settings to Podman Desktop.
  async init(): Promise<void> {
    // Step 1: Load enterprise config file
    const enterpriseValues = this.loadEnterpriseSettings();

    // Step 2: Apply settings...

    // registries.enable
    const registries = enterpriseValues[CONFIGURATION_ENTERPRISE_REGISTRIES_ENABLE] as
      | { name: string; url: string }[]
      | undefined;
    this.enableRegistries(registries);
  }

  // Enable any registries in Podman Desktop according to what's been passed (only need "name" and "url").
  // Note: username/secret are left empty intentionally so that "Login now!" appears.
  private enableRegistries(registries: { name: string; url: string }[] | undefined): void {
    if (!registries) return;

    for (const registry of registries) {
      console.log(`Enterprise: Enabling ${registry.name} (${registry.url})`);

      // TODO: CHECK that the registry has already been added (check serverURL) before continuing!
      // we do this check EVERY time because the "second" registry in the list, may already exist too (rare case)
      const registryExists = this.imageRegistry.getRegistries().find(r => r.serverUrl === registry.url);

      // We PURPOSELY leave username/secret empty so that "Login now!" appears when going to Preferences > Registries.
      if (!registryExists) {
        this.imageRegistry.registerRegistry({
          source: registry.name,
          serverUrl: registry.url,
          username: '',
          secret: '',
        });
      } else {
        console.log(`Enterprise: Registry ${registry.name} (${registry.url}) is already enabled.`);
      }
    }
  }
}
