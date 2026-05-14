const express = require('express');

const { Pool } = require('pg');

require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

const cors = require('cors');
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost', 'http://localhost:80']
}));

app.use(express.json());



// Root

app.get('/', (req, res) => {

  res.json({ app: 'System Health Dashboard', status: 'running' });

});

// Health check — required by assignment

app.get('/health', async (req, res) => {

  try {

    await pool.query('SELECT 1');

    res.status(200).json({ status: 'ok', db: 'connected', timestamp: new Date() });

  } catch (err) {

    res.status(500).json({ status: 'error', db: 'disconnected' });

  }

});

// Metrics endpoint

app.get('/api/metrics', (req, res) => {

  res.json({

    uptime: process.uptime(),

    memory: process.memoryUsage(),

    cpu: process.cpuUsage(),

    timestamp: new Date()

  });

});

// Log a deployment record

app.post('/api/deployments', async (req, res) => {

  const { version, status } = req.body;

  try {

    const result = await pool.query(

      'INSERT INTO deployments (version, status, deployed_at) VALUES ($1, $2, NOW()) RETURNING *',

      [version, status]

    );

    res.status(201).json(result.rows[0]);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});

// Get all deployments

app.get('/api/deployments', async (req, res) => {

  try {

    const result = await pool.query('SELECT * FROM deployments ORDER BY deployed_at DESC LIMIT 20');

    res.json(result.rows);

  } catch (err) {

    res.status(500).json({ error: err.message });

  }

});

let server;
if (require.main === module) {
  server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = { app, pool, server };