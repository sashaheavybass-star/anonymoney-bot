const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');

const DATA_FILE = path.join(__dirname, 'data.json');
const REDIS_KEY = 'fund-bot:data';

const redisUrl = process.env.REDIS_URL;
const redis = redisUrl ? new Redis(redisUrl) : null;

function readDefaults() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

async function load() {
  if (!redis) return readDefaults();

  const raw = await redis.get(REDIS_KEY);
  if (!raw) {
    const data = readDefaults();
    await redis.set(REDIS_KEY, JSON.stringify(data));
    return data;
  }
  return JSON.parse(raw);
}

async function save(data) {
  if (!redis) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return;
  }
  await redis.set(REDIS_KEY, JSON.stringify(data));
}

module.exports = { load, save };
