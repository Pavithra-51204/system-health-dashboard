CREATE TABLE IF NOT EXISTS deployments (
  id          SERIAL PRIMARY KEY,
  version     VARCHAR(50) NOT NULL,
  status      VARCHAR(20) NOT NULL,
  deployed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_logs (
  id         SERIAL PRIMARY KEY,
  status     VARCHAR(20) NOT NULL,
  db_status  VARCHAR(20),
  checked_at TIMESTAMP DEFAULT NOW()
);