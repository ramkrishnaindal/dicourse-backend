import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
dotenv.config();

const swaggerDocument = YAML.load("./openapi.yaml");

const app = express();
const PORT = process.env.PORT || 3000;
const DISCOURSE_BASE_URL = process.env.DISCOURSE_URL;

const discourseApi = axios.create({
  baseURL: DISCOURSE_BASE_URL,
  headers: {
    "Api-Key": process.env.DISCOURSE_API_KEY,
    "Api-Username": process.env.DISCOURSE_API_USERNAME,
  },
});

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Search endpoint
app.get("/search.json", async (req, res) => {
  try {
    const { q } = req.query;
    const response = await discourseApi.get(
      `/search.json?q=${encodeURIComponent(q)}`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get posts
app.get("/posts.json", async (req, res) => {
  try {
    const response = await discourseApi.get("/posts.json", {
      params: req.query,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get topic by ID
app.get("/topics/:id", async (req, res) => {
  try {
    const response = await discourseApi.get(`/t/${req.params.id}.json`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get category by ID
app.get("/categories/:id", async (req, res) => {
  try {
    const response = await discourseApi.get(`/c/${req.params.id}.json`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search in topics/categories by title or description
app.get("/search/advanced", async (req, res) => {
  try {
    const { q, type = "topic" } = req.query;
    let searchQuery = q;

    if (type === "topic") {
      searchQuery = `${q} in:title,first`;
    } else if (type === "category") {
      searchQuery = `${q} #category`;
    }

    const response = await discourseApi.get(
      `/search.json?q=${encodeURIComponent(searchQuery)}`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search in specific category by slug
app.get("/search/category/:slug", async (req, res) => {
  try {
    const { q } = req.query;
    const searchQuery = `${q} #${req.params.slug}`;
    const response = await discourseApi.get(
      `/search.json?q=${encodeURIComponent(searchQuery)}`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search by tags
app.get("/search/tags/:tag", async (req, res) => {
  try {
    const { q = "" } = req.query;
    const searchQuery = q
      ? `${q} tags:${req.params.tag}`
      : `tags:${req.params.tag}`;
    const response = await discourseApi.get(
      `/search.json?q=${encodeURIComponent(searchQuery)}`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});