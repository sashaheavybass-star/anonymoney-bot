const localtunnel = require('localtunnel');

const PORT = process.env.WEBAPP_PORT || 3000;

(async () => {
  const tunnel = await localtunnel({ port: PORT, subdomain: 'fundbot-anniversary' });
  console.log(`Mini App доступен по адресу: ${tunnel.url}`);

  tunnel.on('close', () => {
    console.log('Туннель закрыт');
  });
})();
