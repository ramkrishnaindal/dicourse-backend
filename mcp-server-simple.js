#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const server = new Server({
  name: 'discourse-api',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

const discourseApi = axios.create({
  baseURL: process.env.DISCOURSE_URL,
  headers: {
    'Api-Key': process.env.DISCOURSE_API_KEY,
    'Api-Username': process.env.DISCOURSE_API_USERNAME
  }
});

server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'search_discourse',
    description: 'Search Discourse content',
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string' } },
      required: ['q']
    }
  }]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'search_discourse') {
    const response = await discourseApi.get(`/search.json?q=${encodeURIComponent(args.q)}`);
    return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
  }
  
  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);