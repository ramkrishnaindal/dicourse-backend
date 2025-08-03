#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios from 'axios';
import redis from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const DISCOURSE_BASE_URL = process.env.DISCOURSE_URL;
const CACHE_TTL = 300; // 5 minutes

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

client.on('error', (err) => console.log('Redis Client Error', err));
client.connect();

const discourseApi = axios.create({
  baseURL: DISCOURSE_BASE_URL,
  headers: {
    'Api-Key': process.env.DISCOURSE_API_KEY,
    'Api-Username': process.env.DISCOURSE_API_USERNAME
  }
});

async function getCached(key) {
  try {
    const cached = await client.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

async function setCache(key, data) {
  try {
    await client.setEx(key, CACHE_TTL, JSON.stringify(data));
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

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
        const searchKey = `search:${args.q}`;
        let searchData = await getCached(searchKey);
        if (!searchData) {
          const searchResponse = await discourseApi.get(`/search.json?q=${encodeURIComponent(args.q)}`);
          searchData = searchResponse.data;
          await setCache(searchKey, searchData);
        }
        return { content: [{ type: 'text', text: JSON.stringify(searchData, null, 2) }] };

      case 'get_posts':
        const postsKey = `posts:${args.topic_id || 'all'}`;
        let postsData = await getCached(postsKey);
        if (!postsData) {
          const postsResponse = await discourseApi.get('/posts.json', { params: args });
          postsData = postsResponse.data;
          await setCache(postsKey, postsData);
        }
        return { content: [{ type: 'text', text: JSON.stringify(postsData, null, 2) }] };

      case 'get_topic':
        const topicKey = `topic:${args.id}`;
        let topicData = await getCached(topicKey);
        if (!topicData) {
          const topicResponse = await discourseApi.get(`/t/${args.id}.json`);
          topicData = topicResponse.data;
          await setCache(topicKey, topicData);
        }
        return { content: [{ type: 'text', text: JSON.stringify(topicData, null, 2) }] };

      case 'get_category':
        const categoryKey = `category:${args.id}`;
        let categoryData = await getCached(categoryKey);
        if (!categoryData) {
          const categoryResponse = await discourseApi.get(`/c/${args.id}.json`);
          categoryData = categoryResponse.data;
          await setCache(categoryKey, categoryData);
        }
        return { content: [{ type: 'text', text: JSON.stringify(categoryData, null, 2) }] };

      case 'advanced_search':
        let searchQuery = args.q;
        if (args.type === 'topic') {
          searchQuery = `${args.q} in:title,first`;
        } else if (args.type === 'category') {
          searchQuery = `${args.q} #category`;
        }
        const advancedKey = `advanced:${searchQuery}`;
        let advancedData = await getCached(advancedKey);
        if (!advancedData) {
          const advancedResponse = await discourseApi.get(`/search.json?q=${encodeURIComponent(searchQuery)}`);
          advancedData = advancedResponse.data;
          await setCache(advancedKey, advancedData);
        }
        return { content: [{ type: 'text', text: JSON.stringify(advancedData, null, 2) }] };

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