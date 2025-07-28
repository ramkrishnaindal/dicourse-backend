#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const axios = require('axios');
require('dotenv').config();

const DISCOURSE_BASE_URL = process.env.DISCOURSE_URL;

const discourseApi = axios.create({
  baseURL: DISCOURSE_BASE_URL,
  headers: {
    'Api-Key': process.env.DISCOURSE_API_KEY,
    'Api-Username': process.env.DISCOURSE_API_USERNAME
  }
});

const server = new Server(
  {
    name: 'discourse-api',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'search_discourse',
        description: 'Search across all Discourse content',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Search query' }
          },
          required: ['q']
        }
      },
      {
        name: 'get_posts',
        description: 'Get posts from Discourse',
        inputSchema: {
          type: 'object',
          properties: {
            topic_id: { type: 'integer', description: 'Topic ID to get posts from' }
          }
        }
      },
      {
        name: 'get_topic',
        description: 'Get topic by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Topic ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'get_category',
        description: 'Get category by ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Category ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'advanced_search',
        description: 'Advanced search in topics or categories',
        inputSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Search query' },
            type: { type: 'string', enum: ['topic', 'category'], description: 'Search type', default: 'topic' }
          },
          required: ['q']
        }
      }
    ]
  };
});

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_discourse':
        const searchResponse = await discourseApi.get(`/search.json?q=${encodeURIComponent(args.q)}`);
        return { content: [{ type: 'text', text: JSON.stringify(searchResponse.data, null, 2) }] };

      case 'get_posts':
        const postsResponse = await discourseApi.get('/posts.json', { params: args });
        return { content: [{ type: 'text', text: JSON.stringify(postsResponse.data, null, 2) }] };

      case 'get_topic':
        const topicResponse = await discourseApi.get(`/t/${args.id}.json`);
        return { content: [{ type: 'text', text: JSON.stringify(topicResponse.data, null, 2) }] };

      case 'get_category':
        const categoryResponse = await discourseApi.get(`/c/${args.id}.json`);
        return { content: [{ type: 'text', text: JSON.stringify(categoryResponse.data, null, 2) }] };

      case 'advanced_search':
        let searchQuery = args.q;
        if (args.type === 'topic') {
          searchQuery = `${args.q} in:title,first`;
        } else if (args.type === 'category') {
          searchQuery = `${args.q} #category`;
        }
        const advancedResponse = await discourseApi.get(`/search.json?q=${encodeURIComponent(searchQuery)}`);
        return { content: [{ type: 'text', text: JSON.stringify(advancedResponse.data, null, 2) }] };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);