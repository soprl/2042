/* 2042 — a 2048-style merge puzzle, vanilla JS */
(() => {
  "use strict";

  const SIZE = 4;
  const WIN_VALUE = 2048;
  const BEST_KEY = "2042.best";

  const TILE_COLOR = {
    2: "var(--t2)", 4: "var(--t4)", 8: "var(--t8)", 16: "var(--t16)",
    32: "var(--t32)", 64: "var(--t64)", 128: "var(--t128)", 256: "var(--t256)",
    512: "var(--t512)", 1024: "var(--t1024)", 2048: "var(--t2048)",
  };
  function colorFor(value) { return TILE_COLOR[value] || "var(--tmax)"; }
  function textColorFor(value) { return value <= 4 ? "var(--ink-dim)" : "var(--ink)"; }
  function fontSizeFor(value, cell) {
    const digits = String(value).length;
    const scale = digits <= 2 ? 0.42 : digits === 3 ? 0.35 : digits === 4 ? 0.29 : 0.23;
    return Math.round(cell * scale);
  }

  // ---------- model ----------
  class Tile {
    constructor(pos, value) {
      this.x = pos.x; this.y = pos.y;
      this.value = value;
      this.mergedFrom = null;
      this.isNew = false;
    }
    updatePosition(pos) { this.x = pos.x; this.y = pos.y; }
  }

  class Grid {
    constructor(size) {
      this.size = size;
      this.cells = this.empty();
    }
    empty() {
      const cells = [];
      for (let x = 0; x < this.size; x++) {
        cells[x] = [];
        for (let y = 0; y < this.size; y++) cells[x][y] = null;
      }
      return cells;
    }
    availableCells() {
      const out = [];
      for (let x = 0; x < this.size; x++)
        for (let y = 0; y < this.size; y++)
          if (!this.cells[x][y]) out.push({ x, y });
      return out;
    }
    randomAvailableCell() {
      const cells = this.availableCells();
      if (!cells.length) return null;
      return cells[Math.floor(Math.random() * cells.length)];
    }
    cellsAvailable() { return this.availableCells().length > 0; }
    withinBounds(pos) { return pos.x >= 0 && pos.x < this.size && pos.y >= 0 && pos.y < this.size; }
    cellContent(cell) { return this.withinBounds(cell) ? this.cells[cell.x][cell.y] : null; }
    cellAvailable(cell) { return !this.cellContent(cell); }
    insertTile(tile) { this.cells[tile.x][tile.y] = tile; }
    removeTile(tile) { this.cells[tile.x][tile.y] = null; }
    allTiles() {
      const out = [];
      for (let x = 0; x < this.size; x++)
        for (let y = 0; y < this.size; y++)
          if (this.cells[x][y]) out.push(this.cells[x][y]);
      return out;
    }
  }

  class GameManager {
    constructor(size) {
      this.size = size;
      this.onUpdate = () => {};
      this.setup();
    }
    setup() {
      this.grid = new Grid(this.size);
      this.score = 0;
      this.over = false;
      this.won = false;
      this.keepPlaying = false;
      this.addRandomTile();
      this.addRandomTile();
    }
    addRandomTile() {
      const cell = this.grid.randomAvailableCell();
      if (!cell) return;
      const value = Math.random() < 0.9 ? 2 : 4;
      const tile = new Tile(cell, value);
      tile.isNew = true;
      this.grid.insertTile(tile);
    }
    prepareTiles() {
      for (const tile of this.grid.allTiles()) { tile.mergedFrom = null; tile.isNew = false; }
    }
    moveTile(tile, cell) {
      this.grid.cells[tile.x][tile.y] = null;
      this.grid.cells[cell.x][cell.y] = tile;
      tile.updatePosition(cell);
    }
    getVector(direction) {
      return { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } }[direction];
    }
    buildTraversals(vector) {
      const t = { x: [], y: [] };
      for (let i = 0; i < this.size; i++) { t.x.push(i); t.y.push(i); }
      if (vector.x === 1) t.x.reverse();
      if (vector.y === 1) t.y.reverse();
      return t;
    }
    findFarthestPosition(cell, vector) {
      let previous;
      do {
        previous = cell;
        cell = { x: previous.x + vector.x, y: previous.y + vector.y };
      } while (this.grid.withinBounds(cell) && this.grid.cellAvailable(cell));
      return { farthest: previous, next: cell };
    }
    tileMatchesAvailable() {
      for (let x = 0; x < this.size; x++) {
        for (let y = 0; y < this.size; y++) {
          const tile = this.grid.cellContent({ x, y });
          if (!tile) continue;
          for (const v of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
            const other = this.grid.cellContent({ x: x + v.x, y: y + v.y });
            if (other && other.value === tile.value) return true;
          }
        }
      }
      return false;
    }
    movesAvailable() { return this.grid.cellsAvailable() || this.tileMatchesAvailable(); }

    move(direction) {
      if (this.over || (this.won && !this.keepPlaying)) return;
      const vector = this.getVector(direction);
      const traversals = this.buildTraversals(vector);
      let moved = false;

      this.prepareTiles();

      traversals.x.forEach((x) => {
        traversals.y.forEach((y) => {
          const cell = { x, y };
          const tile = this.grid.cellContent(cell);
          if (!tile) return;
          const positions = this.findFarthestPosition(cell, vector);
          const next = this.grid.cellContent(positions.next);

          if (next && next.value === tile.value && !next.mergedFrom) {
            const merged = new Tile(positions.next, tile.value * 2);
            merged.mergedFrom = [tile, next];
            this.grid.insertTile(merged);
            this.grid.removeTile(tile);
            tile.updatePosition(positions.next);
            this.score += merged.value;
            if (merged.value >= WIN_VALUE) this.won = true;
            moved = true;
          } else {
            this.moveTile(tile, positions.farthest);
            if (positions.farthest.x !== cell.x || positions.farthest.y !== cell.y) moved = true;
          }
        });
      });

      if (moved) {
        this.addRandomTile();
        if (!this.movesAvailable()) this.over = true;
        this.onUpdate();
      }
    }
  }

  // ---------- DOM / rendering ----------
  const board = document.getElementById("board");
  const cellGrid = document.getElementById("cell-grid");
  const tileLayer = document.getElementById("tile-layer");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const overlayEyebrow = document.getElementById("overlay-eyebrow");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySub = document.getElementById("overlay-sub");
  const overlayActions = document.getElementById("overlay-actions");

  for (let i = 0; i < SIZE * SIZE; i++) {
    const c = document.createElement("div");
    c.className = "cell";
    cellGrid.appendChild(c);
  }

  let best = Number(localStorage.getItem(BEST_KEY)) || 0;
  bestEl.textContent = best;

  const gm = new GameManager(SIZE);
  const tileEls = new Map();

  let cellSize = 0, step = 0;
  function measure() {
    const cells = cellGrid.children;
    const r0 = cells[0].getBoundingClientRect();
    const r1 = cells[1].getBoundingClientRect();
    const layerRect = tileLayer.getBoundingClientRect();
    cellSize = r0.width;
    step = r1.left - r0.left;
    tileLayer.dataset.originX = r0.left - layerRect.left;
    tileLayer.dataset.originY = r0.top - layerRect.top;
  }

  function placeTile(el, tile) {
    const ox = Number(tileLayer.dataset.originX) || 0;
    const oy = Number(tileLayer.dataset.originY) || 0;
    const x = ox + tile.x * step;
    const y = oy + tile.y * step;
    el.style.width = cellSize + "px";
    el.style.height = cellSize + "px";
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.fontSize = fontSizeFor(tile.value, cellSize) + "px";
  }

  function styleTile(el, tile) {
    el.textContent = tile.value;
    el.style.background = colorFor(tile.value);
    el.style.color = textColorFor(tile.value);
    if (tile.value >= WIN_VALUE) {
      el.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.25), 0 0 22px rgba(255,45,120,0.55)";
    } else {
      el.style.boxShadow = "";
    }
  }

  function render() {
    const current = gm.grid.allTiles();
    const seen = new Set(current);

    for (const tile of current) {
      let el = tileEls.get(tile);
      if (!el) {
        el = document.createElement("div");
        el.className = "tile";
        tileLayer.appendChild(el);
        tileEls.set(tile, el);
        placeTile(el, tile);
        styleTile(el, tile);
        requestAnimationFrame(() => {
          el.classList.add(tile.mergedFrom ? "merged" : "new");
        });
      } else {
        placeTile(el, tile);
        styleTile(el, tile);
      }

      if (tile.mergedFrom) {
        for (const src of tile.mergedFrom) {
          const srcEl = tileEls.get(src);
          if (srcEl) {
            placeTile(srcEl, tile);
            setTimeout(() => { srcEl.remove(); tileEls.delete(src); }, 130);
          }
        }
      }
    }

    for (const [tile, el] of tileEls) {
      if (!seen.has(tile) && el.isConnected && !tile.mergedFrom) {
        // orphaned node safety net (shouldn't normally trigger)
        el.remove();
        tileEls.delete(tile);
      }
    }

    scoreEl.textContent = gm.score;
    if (gm.score > best) {
      best = gm.score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    bestEl.textContent = best;

    if (gm.won && !gm.keepPlaying) showOverlay("win");
    else if (gm.over) showOverlay("over");
    else hideOverlay();
  }

  function showOverlay(kind) {
    overlay.classList.remove("hidden");
    overlayActions.innerHTML = "";
    if (kind === "win") {
      overlayEyebrow.textContent = "2048 · GELECEĞE HOŞ GELDİN";
      overlayTitle.textContent = "2042'ye ulaştın";
      overlaySub.textContent = "İstersen katlamaya devam edip daha büyük sayılara ulaşabilirsin.";
      const cont = document.createElement("button");
      cont.className = "btn";
      cont.textContent = "DEVAM ET";
      cont.onclick = () => { gm.keepPlaying = true; hideOverlay(); };
      const restart = document.createElement("button");
      restart.className = "btn ghost";
      restart.textContent = "YENİDEN BAŞLA";
      restart.onclick = restartGame;
      overlayActions.append(cont, restart);
    } else {
      overlayEyebrow.textContent = "2042";
      overlayTitle.textContent = "Hamle Kalmadı";
      overlaySub.textContent = `Skorun ${gm.score}. Panoyu yeniden doldurup tekrar dene.`;
      const restart = document.createElement("button");
      restart.className = "btn";
      restart.textContent = "YENİDEN BAŞLA";
      restart.onclick = restartGame;
      overlayActions.append(restart);
    }
  }
  function hideOverlay() { overlay.classList.add("hidden"); }

  function restartGame() {
    for (const el of tileEls.values()) el.remove();
    tileEls.clear();
    gm.setup();
    hideOverlay();
    measure();
    render();
  }

  gm.onUpdate = render;

  // ---------- input ----------
  const KEY_DIR = {
    arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right",
    w: "up", s: "down", a: "left", d: "right",
  };
  window.addEventListener("keydown", (e) => {
    const dir = KEY_DIR[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault();
    gm.move(dir);
  }, { passive: false });

  let touchStart = null;
  let touchDone = false;
  const SWIPE_THRESH = 18;

  board.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
    touchDone = false;
  }, { passive: true });

  board.addEventListener("touchmove", (e) => {
    if (!touchStart) return;
    // Swallow the gesture immediately so the page never scrolls under the finger.
    e.preventDefault();
    if (touchDone) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) < SWIPE_THRESH) return;

    touchDone = true;
    if (adx > ady) gm.move(dx > 0 ? "right" : "left");
    else gm.move(dy > 0 ? "down" : "up");
  }, { passive: false });

  board.addEventListener("touchend", () => {
    touchStart = null;
    touchDone = false;
  }, { passive: true });

  document.getElementById("new-game").addEventListener("click", restartGame);

  window.addEventListener("resize", () => { measure(); render(); });

  // ---------- boot ----------
  requestAnimationFrame(() => { measure(); render(); });
})();
