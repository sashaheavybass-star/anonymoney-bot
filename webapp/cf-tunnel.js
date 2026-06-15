const { bin } = require('cloudflared');
const { spawn } = require('child_process');

const PORT = process.env.WEBAPP_PORT || 3000;

const proc = spawn(bin, ['tunnel', '--protocol', 'http2', '--url', `http://localhost:${PORT}`]);

proc.stdout.on('data', (d) => process.stdout.write(d));
proc.stderr.on('data', (d) => {
  const text = d.toString();
  process.stdout.write(text);
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match) {
    console.log(`\nMini App доступен по адресу: ${match[0]}`);
  }
});
