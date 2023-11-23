import type { Octokit } from '@octokit/rest';
import * as podmanDesktopAPI from '@podman-desktop/api';
import type { BinaryReleaseAsset, BinaryReleaseInfo } from '@podman-desktop/api';
import * as fs from 'fs';
import * as path from 'path';

export const TYPE = 'github';

interface githubRepo {
  organization: string;
  repo: string;
}

export class GithubUpdateProvider extends podmanDesktopAPI.DownloadProvider {
  constructor(private readonly octokit: Octokit) {
    super(TYPE);
  }

  // Function that takes a URL from github such as https://github.com/containers/podman
  // and returns githubParsedName object with the organization and repo name
  // e.g. { organization: 'docker', repo: 'compose' }
  private parseUrl(url: URL): githubRepo {
    if (url.host === undefined) throw new Error('Unknown host in the provided url.');

    if (!url.pathname?.startsWith('/')) throw new Error('Malformed pathname in provided url.');

    return {
      organization: url.host,
      repo: url.pathname.slice(1, url.pathname.length),
    };
  }

  private async downloadReleaseAsset(
    organization: string,
    repo: string,
    assetId: number,
    destination: string,
  ): Promise<void> {
    const asset = await this.octokit.repos.getReleaseAsset({
      owner: organization,
      repo: repo,
      asset_id: assetId,
      headers: {
        accept: 'application/octet-stream',
      },
    });

    // check the parent folder exists
    const parentFolder = path.dirname(destination);

    if (!fs.existsSync(parentFolder)) {
      await fs.promises.mkdir(parentFolder, { recursive: true });
    }
    // write the file
    await fs.promises.writeFile(destination, Buffer.from(asset.data as unknown as ArrayBuffer));
  }

  // Download the release asset from a given url, release (id), assetName, and destination
  async download(url: URL, release: BinaryReleaseInfo, assetName: BinaryReleaseAsset, destination: string): Promise<void> {
    const { organization, repo } = this.parseUrl(url);

    const listOfAssets = await this.octokit.repos.listReleaseAssets({
      owner: organization,
      repo: repo,
      release_id: parseInt(release.id),
    });

    // Find the asset within listOfAssets.data
    const asset = listOfAssets.data.find(asset => asset.name === assetName.name);
    if (!asset) {
      throw new Error(`No asset found for ${assetName}`);
    }

    await this.downloadReleaseAsset(organization, repo, asset.id, destination);
  }

  // Get all the releases with a given limit as well.
  async getReleases(url: URL, limit?: number): Promise<BinaryReleaseInfo[]> {
    const { organization, repo } = this.parseUrl(url);

    const releases = await this.octokit.repos.listReleases({
      owner: organization,
      repo: repo,
      per_page: limit,
    });

    return releases.data.map(release => {
      return {
        id: release.id.toString(),
        name: release.name,
        assets: release.assets.map(asset => {
          return {
            name: asset.name,
          };
        }),
      };
    });
  }
}
