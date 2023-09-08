/**********************************************************************
 * Copyright (C) 2023 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { Octokit } from '@octokit/rest';
import * as extensionApi from '@podman-desktop/api';
import { CliRun } from './cli-run';
import { Detect } from './detect';
import { ComposeExtension } from './compose-extension';
import type { ComposeGithubReleaseArtifactMetadata } from './compose-github-releases';
import { ComposeGitHubReleases } from './compose-github-releases';
import { OS } from './os';
import { ComposeWrapperGenerator } from './compose-wrapper-generator';
import * as path from 'path';
import { ComposeInstallation } from './installation';

let composeExtension: ComposeExtension | undefined;
let composeVersionMetadata: ComposeGithubReleaseArtifactMetadata | undefined;

export async function activate(extensionContext: extensionApi.ExtensionContext): Promise<void> {
  // do not hold the activation promise
  setTimeout(() => {
    postActivate(extensionContext).catch((error: unknown) => {
      console.error('Error activating extension', error);
    });
  }, 0);

  // Create a new Detect class so we can check to see if Compose is installed
  const os = new OS();

  // Create a new ComposeGitHubReleases class so we can check to see if there is a new version of Compose available
  const octokit = new Octokit();
  const composeGitHubReleases = new ComposeGitHubReleases(octokit);

  // New class of ComposeInstallation
  const composeInstallation = new ComposeInstallation(extensionContext, composeGitHubReleases, os);

  // ONBOARDING: Command to check compose installation
  const onboardingCheckInstallationCommand = extensionApi.commands.registerCommand(
    'compose.onboarding.checkComposeInstalled',
    async () => {
      // TODO's:
      // - We should also check to see if podman is version 4.7 because if not, `podman compose` will not work
      // - We need to check to see if `docker-compose` is installed as well
      // - Check "podman compose" somehow too?

      // REMOVE isInstalled = false; before pushing PR (this is just for testing).
      //const isInstalled = await detect.checkForDockerCompose();
      const isInstalled = false;
      extensionApi.context.setValue('composeIsNotInstalled', !isInstalled, 'onboarding');

      // CheckInstallation is the first step in the onboarding sequence,
      // we will run getLatestVersionAsset so we can show the user the latest
      // latest version of compose that is available.
      if (!isInstalled) {
        // Get the latest version and store the metadata in a local variable
        const composeLatestVersion = await composeInstallation.getLatestVersionAsset();
        if (composeLatestVersion) {
          composeVersionMetadata = composeLatestVersion;
        }

        // Set the value in the context to the version we're installing so it appears in the onboarding
        // sequence
        extensionApi.context.setValue('composeInstallVersion', composeVersionMetadata.tag, 'onboarding');
      }
    },
  );

  // ONBOARDING; Command to install the compose binary. We will get the value that the user has "picked"
  // from the context value. This is because we have the option to either "select a version" or "install the latest"
  const onboardingInstallComposeCommand = extensionApi.commands.registerCommand(
    'compose.onboarding.installCompose',
    async () => {
      // If the version is undefined (checks weren't run, or the user didn't select a version)
      // we will just install the latest version
      if (composeVersionMetadata === undefined) {
        composeVersionMetadata = await composeInstallation.getLatestVersionAsset();
      }

      // Install
      await composeInstallation.install(composeVersionMetadata);

      // We are all done, so we can set the context value to false
      extensionApi.context.setValue('composeIsNotInstalled', false, 'onboarding');
    },
  );

  // ONBOARDING: Prompt the user for the version of Compose they want to install
  const onboardingPromptUserForVersionCommand = extensionApi.commands.registerCommand(
    'compose.onboarding.promptUserForVersion',
    async () => {
      // Prompt the user for the verison
      const composeRelease = await composeInstallation.promptUserForVersion();

      if (composeRelease) {
        composeVersionMetadata = composeRelease;
      }

      // Update the context value that this is the version we are installing
      // we'll store both the metadata as well as version number in a sepearate context value
      extensionApi.context.setValue('composeInstallVersion', composeRelease.tag, 'onboarding');
    },
  );

  // Push the commands that will be used within the onboarding sequence
  extensionContext.subscriptions.push(
    onboardingCheckInstallationCommand,
    onboardingInstallComposeCommand,
    onboardingPromptUserForVersionCommand,
  );

  // Need to "ADD" a provider so we can actually press the button!
  // We set this to "unknown" so it does not appear on the dashboard (we only want it in preferences).
  const providerOptions: extensionApi.ProviderOptions = {
    name: 'Compose',
    id: 'Compose',
    status: 'unknown',
    images: {
      icon: './icon.png',
    },
  };

  providerOptions.emptyConnectionMarkdownDescription = `Compose is a specification for defining and running multi-container applications. We support both [podman compose](https://docs.podman.io/en/latest/markdown/podman-compose.1.html) and [docker compose](https://github.com/docker/compose) commands.\n\nMore information: [compose-spec.io](https://compose-spec.io/)`;

  const provider = extensionApi.provider.createProvider(providerOptions);
  extensionContext.subscriptions.push(provider);
}

async function postActivate(extensionContext: extensionApi.ExtensionContext): Promise<void> {
  const octokit = new Octokit();
  const os = new OS();
  const cliRun = new CliRun(extensionContext, os);
  const podmanComposeGenerator = new ComposeWrapperGenerator(os, path.resolve(extensionContext.storagePath, 'bin'));
  composeExtension = new ComposeExtension(
    extensionContext,
    new Detect(cliRun, os, extensionContext.storagePath),
    new ComposeGitHubReleases(octokit),
    os,
    podmanComposeGenerator,
  );
  await composeExtension.activate();
}

export async function deactivate(): Promise<void> {
  if (composeExtension) {
    await composeExtension.deactivate();
  }
}
