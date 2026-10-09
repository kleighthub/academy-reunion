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

// Easter egg: the banner's Start button opens Campus Quest in a full-screen overlay.
document.querySelector('.egg-start').addEventListener('click', (e) => {
  e.preventDefault();
  if (document.querySelector('.egg-overlay')) return;
  const f = document.createElement('iframe');
  f.src = 'campus-game/index.html'; f.className = 'egg-overlay'; f.title = 'Campus Quest';
  document.body.appendChild(f); f.focus();
});
addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data && e.data.type === 'campus-game:close') document.querySelector('.egg-overlay')?.remove();
});

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

// Photo viewer: click or tap a photo in a gallery to see it bigger; arrows, keys or swipe move through that gallery.
const lightbox = document.querySelector('.lightbox');
const lbImg = lightbox.querySelector('.lb-img');
let photos = [];
let current = 0;
function showPhoto(i) {
  current = (i + photos.length) % photos.length;
  const img = photos[current];
  lbImg.src = img.dataset.full || img.currentSrc || img.src;
  lbImg.alt = img.alt;
}
for (const selector of ['#venue .cardimg, #venue .gallery img']) {
  const set = [...document.querySelectorAll(selector)];
  set.forEach((img, i) => img.addEventListener('click', () => { photos = set; showPhoto(i); lightbox.showModal(); }));
}
lightbox.querySelector('.lb-close').addEventListener('click', () => lightbox.close());
lightbox.querySelector('.lb-prev').addEventListener('click', () => showPhoto(current - 1));
lightbox.querySelector('.lb-next').addEventListener('click', () => showPhoto(current + 1));
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
lightbox.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') showPhoto(current - 1);
  if (e.key === 'ArrowRight') showPhoto(current + 1);
});
let touchX = null;
lightbox.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 40) showPhoto(current + (dx < 0 ? 1 : -1));
  touchX = null;
});

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
