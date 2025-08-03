#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'discourse-api',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler('tools/list', async () => {
  return {
    tools: [{
      name: 'search_discourse',
      description: 'Search Discourse content',
      inputSchema: {
        type: 'object',
        properties: { q: { type: 'string' } },
        required: ['q']
      }
    }]
  };
});

server.setRequestHandler('tools/call', async (request) => {
  return { content: [{ type: 'text', text: 'MCP server working' }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);