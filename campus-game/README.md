# Campus Quest (Easter egg)

A pixel, Y2K-style top-down walk around the real University of West Georgia campus in Carrollton.
The quest is to find **Gunn Hall**, **the Honors House**, and **The Z (Z-6)**. Plain HTML, JS and canvas, with no build step.

## Files
- `index.html`: page shell, CSS, and touch controls (a d-pad plus A and MAP buttons appear on touch devices).
- `game.js`: the game.
- `map.js`: campus tile grid (199 × 129 tiles, about 8 m per tile, north up) rasterized from OpenStreetMap building and road outlines, plus building names.
- `Press_Start_2P.woff2`: pixel font (SIL OFL).

## Controls
Use the arrow keys or WASD to walk, and hold Shift to run. Space, Enter or Z is A (talk, read, advance). M opens the map and Esc closes things.

## Wiring it to the banner's peach START
Put this folder next to the site's `index.html` (as `campus-game/`). Then lay a transparent link over the START/peach area of the banner and open the game in a full-screen overlay:

```html
<!-- inside the banner wrapper (make the wrapper position:relative) -->
<a href="campus-game/" class="egg-start" aria-label="Start"></a>
```
```css
.banner { position: relative; }
.egg-start { position: absolute; /* set to the START/peach box, in % of the banner */
  left: 0%; top: 0%; width: 10%; height: 15%; }
.egg-overlay { position: fixed; inset: 0; z-index: 1000; border: 0; width: 100vw; height: 100vh; background: #12091f; }
```
```js
document.querySelector('.egg-start')?.addEventListener('click', (e) => {
  e.preventDefault(); e.stopPropagation();          // keep the banner's own "go home" click from firing
  const f = document.createElement('iframe');
  f.src = 'campus-game/index.html'; f.className = 'egg-overlay'; f.title = 'Campus Quest';
  document.body.appendChild(f); f.focus();
});
addEventListener('message', (e) => {
  if (e.data && e.data.type === 'campus-game:close') document.querySelector('.egg-overlay')?.remove();
});
```
The game's X button (and Esc) posts `{type: 'campus-game:close'}` to the parent when it runs in an iframe. Opened on its own, it goes back in history instead.

## Sources
- Building and road geometry: OpenStreetMap contributors (ODbL), pulled 2026-10-09.
- Names were checked against UWG's building inventory and campus maps. Z-6 isn't in OpenStreetMap. UWG's 2019 self-guided tour map labels "Z-6 Food Service" in the spot OpenStreetMap now calls West Commons, so the game puts The Z there.
- The map shows campus as it is today. Some buildings, such as Center Pointe Suites, University Suites, East Commons and the Momentum Center, went up after the early 2000s.
