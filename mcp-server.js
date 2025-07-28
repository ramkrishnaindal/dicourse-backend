#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const axios = require('axios');
const cache = require('./cache');
require('dotenv').config();

const EXPRESS_API_URL = process.env.EXPRESS_API_URL || 'http://localhost:3000';

const expressApi = axios.create({
  baseURL: EXPRESS_API_URL
});

// Initialize cache
cache.connect();

const server = new Server(
  {
    name: 'discourse-search-api',
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
      },
      {
        name: 'search_category',
        description: 'Search within a specific category by slug',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'Category slug (e.g., "articles")' },
            q: { type: 'string', description: 'Search query' }
          },
          required: ['slug', 'q']
        }
      },
      {
        name: 'search_tags',
        description: 'Search by tags',
        inputSchema: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Tag name' },
            q: { type: 'string', description: 'Optional search query within tagged posts' }
          },
          required: ['tag']
        }
      }
    ]
  };
});

async function cachedApiCall(cacheKey, apiCall, ttl = 86400) {
  const cached = await cache.get(cacheKey);
  if (cached) return cached;
  
  const response = await apiCall();
  await cache.set(cacheKey, response.data, ttl);
  return response.data;
}

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let data;
    switch (name) {
      case 'search_discourse':
        const searchKey = cache.generateKey('search', { q: args.q });
        data = await cachedApiCall(searchKey, () => 
          expressApi.get(`/search.json?q=${encodeURIComponent(args.q)}`), 3600); // 1 hour
        break;

      case 'get_posts':
        const postsKey = cache.generateKey('posts', args);
        data = await cachedApiCall(postsKey, () => 
          expressApi.get('/posts.json', { params: args }), 1800); // 30 minutes
        break;

      case 'get_topic':
        const topicKey = cache.generateKey('topic', { id: args.id });
        data = await cachedApiCall(topicKey, () => 
          expressApi.get(`/topics/${args.id}`));
        break;

      case 'get_category':
        const categoryKey = cache.generateKey('category', { id: args.id });
        data = await cachedApiCall(categoryKey, () => 
          expressApi.get(`/categories/${args.id}`));
        break;

      case 'advanced_search':
        const advancedKey = cache.generateKey('advanced_search', { q: args.q, type: args.type });
        data = await cachedApiCall(advancedKey, () => 
          expressApi.get(`/search/advanced?q=${encodeURIComponent(args.q)}&type=${args.type || 'topic'}`), 3600);
        break;

      case 'search_category':
        const catSearchKey = cache.generateKey('search_category', { slug: args.slug, q: args.q });
        data = await cachedApiCall(catSearchKey, () => 
          expressApi.get(`/search/category/${args.slug}?q=${encodeURIComponent(args.q)}`), 3600);
        break;

      case 'search_tags':
        const tagSearchUrl = args.q 
          ? `/search/tags/${args.tag}?q=${encodeURIComponent(args.q)}`
          : `/search/tags/${args.tag}`;
        const tagKey = cache.generateKey('search_tags', { tag: args.tag, q: args.q });
        data = await cachedApiCall(tagKey, () => 
          expressApi.get(tagSearchUrl), 3600);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);