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

import * as http from 'node:http';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { handleToolCall } from './handlers.js';
import { tools } from './tools.js';

const SERVER_NAME = 'podman-desktop';
const SERVER_VERSION = '1.0.0';

// CORS is required for MCP clients to connect from different origins
// This is safe as the server only runs locally and provides read/control of local containers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // NOSONAR - Required for local MCP server
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export class McpServer {
  private httpServer: http.Server | undefined;
  private mcpServer: Server | undefined;
  private transport: SSEServerTransport | undefined;
  private port: number;

  constructor(port: number = 6110) {
    this.port = port;
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // Add CORS headers to all responses
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    const url = new URL(req.url ?? '/', `http://localhost:${this.port}`);

    // Health check endpoint
    if (url.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', server: SERVER_NAME, version: SERVER_VERSION }));
      return;
    }

    // SSE endpoint for MCP
    if (url.pathname === '/sse' && req.method === 'GET') {
      console.log('MCP SSE connection established');

      // Create SSE transport for this connection
      this.transport = new SSEServerTransport('/message', res);
      this.mcpServer?.connect(this.transport).catch((error: unknown) => {
        console.error('Failed to connect MCP transport:', error);
      });
      return;
    }

    // Message endpoint for client-to-server messages
    if (url.pathname === '/message' && req.method === 'POST') {
      if (!this.transport) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No SSE connection established' }));
        return;
      }

      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        this.transport?.handlePostMessage(req, res, body).catch((error: unknown) => {
          console.error('Error handling message:', error);
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
      });
      return;
    }

    // Info endpoint
    if (url.pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          name: SERVER_NAME,
          version: SERVER_VERSION,
          description: 'Podman Desktop MCP Server',
          endpoints: {
            sse: '/sse',
            message: '/message',
            health: '/health',
          },
        }),
      );
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // Create the MCP server
    this.mcpServer = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Handle list tools request
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools };
    });

    // Handle tool call request
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      return handleToolCall(name, args ?? {});
    });

    // Handle errors
    this.mcpServer.onerror = (error): void => {
      console.error('[MCP Error]', error);
    };

    // Create HTTP server for SSE transport
    this.httpServer = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Start listening
    return new Promise((resolve, reject) => {
      this.httpServer?.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`MCP Server: Port ${this.port} is already in use`);
        }
        reject(error);
      });

      this.httpServer?.listen(this.port, () => {
        console.log(`MCP Server listening on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (this.mcpServer) {
      await this.mcpServer.close();
      this.mcpServer = undefined;
    }

    if (this.httpServer) {
      return new Promise(resolve => {
        this.httpServer?.close(() => {
          console.log('MCP Server stopped');
          this.httpServer = undefined;
          resolve();
        });
      });
    }
  }

  /**
   * Get the port the server is listening on
   */
  getPort(): number {
    return this.port;
  }
}
