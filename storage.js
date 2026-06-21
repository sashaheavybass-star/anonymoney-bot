const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const REDIS_KEY = 'fund-bot:data';

let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function readDefaults() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

async function load() {
  if (!redis) return readDefaults();
  const data = await redis.get(REDIS_KEY);
  if (!data) {
    const defaults = readDefaults();
    await redis.set(REDIS_KEY, defaults);
    return defaults;
  }
  return data;
}

async function save(data) {
  if (!redis) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return;
  }
  await redis.set(REDIS_KEY, data);
}

module.exports = { load, save };
