  /**
   * Holds information regarding the latest releases, usually given as an id and name
   */
  export interface BinaryReleaseInfo {
    id: string;
    name: string;
    assets: BinaryReleaseAsset[];
  }
  export interface BinaryReleaseAsset {
    name: string;
  }

  export abstract class DownloadProvider {
    protected constructor(public readonly type: string) {}

    // Returns the list of candidate versions for a given URL
    // typically this will be a list of the id (tag) and name of the release
    abstract getReleases(url: URL, limit?: number): Promise<BinaryReleaseInfo[]>;

    // Downloads an asset from a given release. The asset is identified by its filename within the release
    // It is up to the provider to determine which asset to download as each name could be different, for example
    // one provider may use "darwin" in the binary name while another may use "macos"
    abstract download(url: URL, release: BinaryReleaseInfo, asset: BinaryReleaseAsset, destination: string): Promise<void>;
  }