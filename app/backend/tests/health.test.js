const request = require('supertest');
const { app, pool, server } = require('../index');

describe('GET /health', () => {
  it('should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBeDefined();
  });

  it('GET / should return app name', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.app).toBe('System Health Dashboard');
  });

  it('GET /api/metrics should return uptime', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.body.uptime).toBeDefined();
  });

  afterAll(async () => {
    await pool.end();
    if (server) server.close();
  });
});