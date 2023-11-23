import type { DownloadProvider } from './download-provider.js';
import { Disposable } from '../types/disposable.js';

// A map of registry with "type" (github, gitlab, etc.) as well as the actual provider
export class DownloadProviderRegistry {
  protected providers: Map<string, DownloadProvider> = new Map<string, DownloadProvider>();

  public registerProvider(downloadProvider: DownloadProvider): Disposable {
    if (this.providers.has(downloadProvider.type))
      throw new Error(`A download provider already exists with the type '${downloadProvider.type}'`);

    this.providers.set(downloadProvider.type, downloadProvider);
    return Disposable.create(() => this.unregisterProvider(downloadProvider.type));
  }

  public unregisterProvider(schema: string) {
    this.providers.delete(schema);
  }

  public getProvider(type: string): DownloadProvider | undefined {
    return this.providers.get(type);
  }
}
