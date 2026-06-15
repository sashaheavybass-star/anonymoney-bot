const path = require('path');
const express = require('express');
const { load } = require('../storage');

const PORT = process.env.PORT || process.env.WEBAPP_PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/data', async (req, res) => {
  const data = await load();
  res.json(data);
});

app.listen(PORT, () => console.log(`Mini App сервер запущен на порту ${PORT}`));
