import type { CliToolProvider } from './cli-tool-provider.js';
import { Disposable } from '../types/disposable.js';

// A map of registry with "type" (github, gitlab, etc.) as well as the actual provider
export class CliToolProviderRegistry {
  protected providers: Map<string, CliToolProvider> = new Map<string, CliToolProvider>();

  public registerProvider(downloadProvider: CliToolProvider): Disposable {
    if (this.providers.has(downloadProvider.type))
      throw new Error(`A download provider already exists with the type '${downloadProvider.type}'`);

    this.providers.set(downloadProvider.type, downloadProvider);
    return Disposable.create(() => this.unregisterProvider(downloadProvider.type));
  }

  public unregisterProvider(schema: string) {
    this.providers.delete(schema);
  }

  public getProvider(type: string): CliToolProvider | undefined {
    return this.providers.get(type);
  }
}
