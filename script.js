// Page switching: the home screen shows the tiles; #section shows that panel with the tab bar.
const home = document.getElementById('home');
const inner = document.getElementById('inner');
const panels = document.querySelectorAll('.panel');
const tabs = document.querySelectorAll('.tabbar .tab:not(.homebtn)');
// A panel can swap in its own banner with data-banner (plus optional data-banner-alt and data-banner-pos).
const bannerImg = document.querySelector('.banner img');
const defaultBanner = { src: bannerImg.getAttribute('src'), alt: bannerImg.alt };

function route() {
  const id = location.hash.slice(1);
  const panel = id && document.getElementById(id);
  const isPanel = panel && panel.classList.contains('panel');
  home.hidden = isPanel;
  inner.hidden = !isPanel;
  panels.forEach((p) => { p.hidden = p !== panel; });
  const custom = isPanel && panel.dataset.banner;
  bannerImg.src = custom ? panel.dataset.banner : defaultBanner.src;
  bannerImg.alt = custom ? (panel.dataset.bannerAlt || '') : defaultBanner.alt;
  bannerImg.style.objectPosition = (custom && panel.dataset.bannerPos) || '';
  bannerImg.parentElement.classList.toggle('custom', Boolean(custom));
  tabs.forEach((t) => {
    const on = t.getAttribute('href') === '#' + id;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  if (isPanel) document.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();

// Live counts on home tiles, e.g. the Attendees tile shows how many people are listed on the Attendees page.
document.querySelectorAll('[data-count]').forEach((el) => {
  el.textContent = document.querySelectorAll(el.dataset.count).length;
});

// "← Home" clears the hash without leaving a "#" in the address bar.
document.querySelectorAll('.homebtn').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    history.pushState('', document.title, location.pathname + location.search);
    route();
  });
});
window.addEventListener('popstate', route);

// Banner countdown to the reunion: months until June, then days, then day-of and after.
const countdown = document.querySelector('.banner-countdown');
function updateCountdown() {
  const target = new Date(countdown.dataset.target);
  const now = new Date();
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  let text;
  if (now >= target) {
    const sameDay = now.toDateString() === target.toDateString();
    text = sameDay ? 'logging on today!' : 'connection established.';
  } else if (now < new Date(target.getFullYear(), target.getMonth(), 1)) {
    let months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    if (now.getDate() > target.getDate()) months -= 1;
    text = `${plural(Math.max(1, months), 'month')} remaining.`;
  } else {
    const days = Math.ceil((target - now) / 86400000);
    text = days <= 1 && now.toDateString() === target.toDateString() ? 'logging on today!' : `${plural(days, 'day')} remaining.`;
  }
  countdown.textContent = text;
}
updateCountdown();
setInterval(updateCountdown, 60 * 60 * 1000);

// Banner tray item "Area Codes – Ludacris": click to play the official track from YouTube; click again (or ×) to stop.
const music = document.querySelector('.banner-music');
const nowPlaying = document.querySelector('.nowplaying');
const npVideo = nowPlaying.querySelector('.np-video');
function stopMusic() {
  npVideo.innerHTML = '';
  nowPlaying.hidden = true;
}
music.addEventListener('click', () => {
  if (!nowPlaying.hidden) return stopMusic();
  npVideo.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/SZZyBg5jyk4?autoplay=1&rel=0&playsinline=1"'
    + ' title="Ludacris – Area Codes" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
  nowPlaying.hidden = false;
});
nowPlaying.querySelector('.np-close').addEventListener('click', stopMusic);

// RSVP: submit to Formspree without leaving the page.
const form = document.querySelector('.rsvp-form');
const status = form.querySelector('.form-status');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (form.action.includes('YOUR_FORM_ID')) {
    status.textContent = 'The RSVP form is not connected yet. See README.md to set it up.';
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  status.textContent = 'Sending…';
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error();
    form.reset();
    status.textContent = 'Thanks! Your RSVP is in.';
  } catch {
    status.textContent = 'Something went wrong. Please try again.';
  } finally {
    button.disabled = false;
  }
});

// Live weather from Open-Meteo (free, no API key). Settings live on .wxgrid in index.html.
(async () => {
  const grid = document.querySelector('.wxgrid');
  if (!grid) return;
  const { lat, lon, start, days } = grid.dataset;
  const first = new Date(start + 'T12:00:00');
  const daysAway = (first - new Date()) / 86400000;
  if (isNaN(daysAway) || daysAway > 15 || daysAway < -Number(days)) return; // outside the forecast window

  const end = new Date(first);
  end.setDate(end.getDate() + Number(days) - 1);
  const iso = (d) => d.toISOString().slice(0, 10);
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${iso(end)}`
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&temperature_unit=fahrenheit&timezone=auto';

  const label = (code) => {
    if (code === 0) return 'Clear';
    if (code <= 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code <= 48) return 'Fog';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Showers';
    return 'Thunderstorms';
  };

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const d = (await res.json()).daily;
    const cards = grid.querySelectorAll('.wx');
    d.time.forEach((t, i) => {
      const card = cards[i];
      if (!card) return;
      const date = new Date(t + 'T12:00:00');
      const dow = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      card.querySelector('.wd').textContent = `${dow} ${date.getMonth() + 1}/${date.getDate()}`;
      card.querySelector('.wt').textContent = `${Math.round(d.temperature_2m_max[i])}°`;
      card.querySelector('.wc').textContent = label(d.weather_code[i]);
      card.querySelector('.wlo').textContent =
        `Low ${Math.round(d.temperature_2m_min[i])}° · ${d.precipitation_probability_max[i] ?? 0}% rain`;
    });
  } catch {
    // Leave the written placeholders in place if the forecast can't load.
  }
})();
