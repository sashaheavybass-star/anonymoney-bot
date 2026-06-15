const STAGES = [1, 23, 34, 45, 57, 75, 87, 100];

function formatMoney(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function stageFor(percent) {
  let best = STAGES[0];
  for (const s of STAGES) {
    if (Math.abs(s - percent) < Math.abs(best - percent)) best = s;
  }
  return best;
}

function spawnHeart(x, y) {
  const heart = document.createElement('div');
  heart.className = 'heart';
  heart.textContent = ['💖', '❤️', '✨'][Math.floor(Math.random() * 3)];
  heart.style.left = `${x - 14}px`;
  heart.style.top = `${y - 14}px`;
  heart.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
  heart.style.setProperty('--rot', `${(Math.random() - 0.5) * 60}deg`);
  document.body.appendChild(heart);
  heart.addEventListener('animationend', () => heart.remove());
}

async function loadData() {
  const res = await fetch('/api/data');
  const data = await res.json();

  const ratio = data.goal > 0 ? Math.min(data.current / data.goal, 1) : 0;
  const percent = Math.round(ratio * 100);

  document.getElementById('title').textContent = data.title || 'Сбор на юбилей';
  document.getElementById('amount').textContent = `${formatMoney(data.current)} ₽`;
  document.getElementById('goal').textContent = `Цель: ${formatMoney(data.goal)} ₽`;
  document.getElementById('percent').textContent = `${percent}%`;
  document.getElementById('progressFill').style.width = `${percent}%`;

  const stage = stageFor(percent);
  const img = document.getElementById('cakeImg');
  img.src = `assets/cake-${stage}.png`;

  const size = 200 + 80 * ratio;
  img.style.width = `${size}px`;
}

function init() {
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor('#1B3A5C');
      tg.setBackgroundColor('#1B3A5C');
    } catch (e) {}
  }

  const cakeArea = document.getElementById('cakeArea');
  cakeArea.addEventListener('click', (e) => {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    for (let i = 0; i < 6; i++) {
      const jitterX = e.clientX + (Math.random() - 0.5) * 30;
      const jitterY = e.clientY + (Math.random() - 0.5) * 30;
      setTimeout(() => spawnHeart(jitterX, jitterY), i * 60);
    }
  });

  loadData();
  setInterval(loadData, 5000);
}

init();
