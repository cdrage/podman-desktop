/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import * as extensionApi from '@podman-desktop/api';

import { McpServer } from './mcp-server';

let mcpServer: McpServer | undefined;

/**
 * Activate the MCP extension
 */
export async function activate(extensionContext: extensionApi.ExtensionContext): Promise<void> {
  console.log('MCP extension activating...');

  // Get configuration
  const config = extensionApi.configuration.getConfiguration('mcp.server');
  const enabled = config.get<boolean>('enabled', true);
  const port = config.get<number>('port', 6110);

  if (!enabled) {
    console.log('MCP Server is disabled in configuration');
    return;
  }

  // Create and start the MCP server
  mcpServer = new McpServer(port);

  try {
    await mcpServer.start();
    console.log(`MCP Server started on port ${port}`);

    // Show notification on first activation
    await extensionApi.window.showInformationMessage(
      `MCP Server is running on http://localhost:${port}\n\nClaude Code: claude mcp add podman-desktop --transport sse http://127.0.0.1:${port}/sse\nClaude Desktop: Configure in claude_desktop_config.json`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to start MCP server:', message);
    await extensionApi.window.showErrorMessage(`Failed to start MCP Server: ${message}`);
    return;
  }

  // Register command to show connection info
  const showConnectionInfoCommand = extensionApi.commands.registerCommand('mcp.showConnectionInfo', async () => {
    const serverPort = mcpServer?.getPort() ?? port;
    const configJson = JSON.stringify(
      {
        mcpServers: {
          'podman-desktop': {
            url: `http://localhost:${serverPort}/sse`,
          },
        },
      },
      null,
      2,
    );

    await extensionApi.window.showInformationMessage(
      `MCP Server Connection Info\n\nURL: http://localhost:${serverPort}/sse\n\nClaude Code:\nclaude mcp add podman-desktop --transport sse http://127.0.0.1:${serverPort}/sse\n\nClaude Desktop config:\n${configJson}`,
    );
  });

  extensionContext.subscriptions.push(showConnectionInfoCommand);

  // Clean up on deactivation
  extensionContext.subscriptions.push({
    dispose: async () => {
      if (mcpServer) {
        await mcpServer.stop();
        mcpServer = undefined;
      }
    },
  });
}

/**
 * Deactivate the MCP extension
 */
export async function deactivate(): Promise<void> {
  console.log('MCP extension deactivating...');

  if (mcpServer) {
    await mcpServer.stop();
    mcpServer = undefined;
  }
}
