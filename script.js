// ====== CONFIG ======
let TILE = 24;
let SPEED = 2.2;               // HUD (slow/normal/fast) can change this
const TURN_ASSIST = 6;         // generous snap to corner

const MAP = [
"############################",
"#............##............#",
"#.####.#####.##.#####.####.#",
"#o####.#####.##.#####.####o#",
"#.####.#####.##.#####.####.#",
"#..........................#",
"#.####.##.########.##.####.#",
"#.####.##.########.##.####.#",
"#......##....##....##......#",
"######.##### ## #####.######",
"######.##### ## #####.######",
"######.##          ##.######",
"######.## ###--### ##.######",
"         #      #          ",
"######.## # #### # ##.######",
"######.## #      # ##.######",
"######.## ######## ##.######",
"#............##............#",
"#.####.#####.##.#####.####.#",
"#o..##................##..o#",
"###.##.##.########.##.##.###",
"#......##....##....##......#",
"#.##########.##.##########.#",
"#..........................#",
"############################",
];

// ====== SPRITES ======
const PALETTE={
  ".":null,"H":"#4b2e22","E":"#8a5a3a","S":"#ffd7b3","W":"#ffffff","K":"#111111",
  "B":"#4da3ff","P":"#ff9ac1","Y":"#ffd54a","O":"#f4a460","T":"#fbd59a" // cat orange + tummy
};

// Girl (16x16)
const GIRL_FRAMES=[
["..HHHHHHHH......",".HHHHHHHHH......","HHHEHHHHHHH.....","HHHHHEHHHHH.....",".HHHHHHHHHHH....","..HHHHSSSHHH....","...HSSSSSSHH....","...HSSWSSSHH....","...HSSKSSSHH....","...HSSSSSSHH....","...HHHBBHHH.....","..HH.BBB.HH.....","..H..BBB..H.....","..H..BBB..H.....","...H....H.......","....HHHH........",],
["..HHHHHHH.H.....",".HHHHHHHHH......","HHHEHHHHHHH.....","HHHHHEHHHHH.....",".HHHHHHHHHHH....","..HHHHSSSHHH....","...HSSSSSSHH....","...HSSWSSSHH....","...HSSKSSSHH....","...HSSSSSSHH....","...HHHBBHHH.....","..HH.BBB.HH.....","..H..BBB..H.....","..H..BBB..H.....","...H....H.......","....HHHH........",],
];

// Cat (16x16)
const CAT_FRAMES=[
[
"KK............KK",
"KOOO........OOOK",
"OOOOWWWWWWOOOOOK",
"OOOWWTTTTWWOOOOK",
"OOWTTOOOOTTWOOOK",
"OOWTOOOOOOTWOOOK",
"OOOWWTOOTWWOOOOK",
"....KWWWWK......",
"...K.WWWW.K.....",
"..K..W..W..K....",
".K...K..K...K...",
".K...K..K...K...",
"..K..K..K..K....",
"...K..KK..K.....",
".....K..K.......",
"......KK........",
],
[
"KK............KK",
"KOOO........OOOK",
"OOOOWWWWWWOOOOOK",
"OOOWWTTTTWWOOOOK",
"OOWTTOOOOTTWOOOK",
"OOWTOOOOOOTWOOOK",
"OOOWWTOOTWWOOOOK",
"....KWWWWK......",
"...K.WW..K......",
"..K..W..W..K....",
".K...K..K...K...",
".K...K..K...K...",
"..K..K..K..K....",
"...K..KK..K.....",
".....K..K.......",
"......KK........",
],
];

// ====== SOUND (WebAudio, no files) ======
const SND = (() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = () => ctx.currentTime;
  function beep(freq=440, len=0.08, type="square", vol=0.2){
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, now());
    g.gain.exponentialRampToValueAtTime(0.001, now()+len);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(now()+len);
  }
  return {
    pellet(){ beep(880, 0.06, "square", 0.12); },
    power(){ beep(440, 0.12, "sawtooth", 0.18); },
    death(){ beep(180, 0.25, "triangle", 0.2); setTimeout(()=>beep(120,0.25,"triangle",0.2),120); },
    win(){ beep(1046,0.12,"sine",0.2); setTimeout(()=>beep(1318,0.12,"sine",0.2),120); setTimeout(()=>beep(1567,0.16,"sine",0.2),240); },
    start(){ beep(660,0.08,"square",0.15); setTimeout(()=>beep(880,0.08,"square",0.15),100); setTimeout(()=>beep(990,0.1,"square",0.15),200); },
  };
})();

// ====== STATE ======
const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");
let score=0,lives=3;
let hero={x:13*TILE,y:17*TILE,dir:{x:0,y:0},next:{x:0,y:0},skin:"girl"};
let enemies=[];       // <— multiple cats here
let enemyCount=1;     // HUD sets 1/2/3
let pellets=new Set(), power=new Set();

let started=false, paused=false, won=false;
let startDirMode="random";
let loopId, winCats=[], customImg=null;

let seconds=0, timerId=null;

// ====== RESPONSIVE SIZING ======
function fitForPhone(){
  const cols = Math.max(...MAP.map(r=>r.length));
  const vw = Math.min(window.innerWidth, 672);
  TILE = Math.max(18, Math.floor(vw / cols));
  cvs.width  = TILE * cols;
  cvs.height = TILE * MAP.length;
  hero.x = Math.round(hero.x/TILE)*TILE; hero.y=Math.round(hero.y/TILE)*TILE;
  for (const e of enemies){ e.x=Math.round(e.x/TILE)*TILE; e.y=Math.round(e.y/TILE)*TILE; }
}
window.addEventListener("resize", fitForPhone);

// ====== BOOT ======
boot();
function boot(){
  bindInputs();
  showStart();
  fitForPhone();
  draw();

  q("#btn-start").addEventListener("click", startGame);
  q("#btn-pause").addEventListener("click", () => { if(!started) return; paused?resume():pauseOverlay("Paused","Tap continue"); });

  document.querySelectorAll("[data-startdir]").forEach(b=>{
    b.addEventListener("click",()=>{
      startDirMode=b.dataset.startdir;
      document.querySelectorAll("[data-startdir]").forEach(x=>x.setAttribute("aria-pressed","false"));
      b.setAttribute("aria-pressed","true");
    });
  });

  document.querySelectorAll("[data-speed]").forEach(b=>{
    b.addEventListener("click",()=>{
      document.querySelectorAll("[data-speed]").forEach(x=>x.setAttribute("aria-pressed","false"));
      b.setAttribute("aria-pressed","true");
      const v = b.dataset.speed;
      SPEED = v==="slow" ? 1.6 : v==="fast" ? 2.8 : 2.2;
    });
  });

  document.querySelectorAll("[data-enemies]").forEach(b=>{
    b.addEventListener("click",()=>{
      document.querySelectorAll("[data-enemies]").forEach(x=>x.setAttribute("aria-pressed","false"));
      b.setAttribute("aria-pressed","true");
      enemyCount = parseInt(b.dataset.enemies,10);
    });
  });
}

// ====== LIFECYCLE ======
function startGame(){
  seconds=0; updateTime(); stopTimer();
  started=false; paused=false; won=false;
  hideStart();
  initWorld();
  spawnEnemies(enemyCount);

  const heroSpawn = nearestOpenCell(13,17);
  hero.x = heroSpawn.c*TILE; hero.y = heroSpawn.r*TILE; hero.dir={x:0,y:0}; hero.next={x:0,y:0};

  runCountdown(3, ()=>{
    started = true;
    SND.start();
    hero.dir = chooseStartDir();    // always open
    startTimer();
    startLoop();
  });
}
function exitToStart(){ started=false; paused=false; won=false; stopTimer(); showStart(); }

function initWorld(){
  pellets.clear(); power.clear();
  const width = Math.max(...MAP.map(r=>r.length));
  for(let r=0;r<MAP.length;r++){
    for(let c=0;c<width;c++){
      const ch = MAP[r][c] ?? " ";
      const key = `${c},${r}`;
      if(ch===".") pellets.add(key);
      if(ch==="o") power.add(key);
    }
  }
  score=0; lives=3; updateHUD();
}

function spawnEnemies(n){
  enemies = [];
  // three spawn spots near the pen
  const spawns = [
    nearestOpenCell(13,11),
    nearestOpenCell(12,11),
    nearestOpenCell(14,11),
  ];
  for (let i=0;i<n;i++){
    const s = spawns[i % spawns.length];
    enemies.push({
      x: s.c*TILE, y: s.r*TILE,
      dir: {x:0,y:0},
      _decideAt: performance.now(),
      _watchAt: performance.now(),
      _stuckFrames: 0,
      // tiny per-enemy jitter so they don't sync
      retargetMs: 100 + Math.random()*80
    });
  }
}

function startLoop(){
  cancelAnimationFrame(loopId);
  const tick=()=>{ if(started && !paused){ step(); draw(); } loopId=requestAnimationFrame(tick); };
  tick();
}

// ====== INPUT (fast response) ======
function requestDir(dx,dy){
  const desired = {x:dx,y:dy};
  hero.next = desired;

  if (hero.dir.x===0 && hero.dir.y===0){
    if (!willCollide(hero.x + desired.x*SPEED, hero.y + desired.y*SPEED)) hero.dir = desired;
    return;
  }
  if (hero.dir.x === -desired.x && hero.dir.y === -desired.y){ hero.dir = desired; return; }

  const cx = Math.round(hero.x / TILE) * TILE;
  const cy = Math.round(hero.y / TILE) * TILE;
  if (Math.abs(hero.x - cx) <= TURN_ASSIST && Math.abs(hero.y - cy) <= TURN_ASSIST){
    const c = toCell(cx + TILE/2, cy + TILE/2);
    if (!hitsWall(c.c + desired.x, c.r + desired.y)){
      hero.x = cx; hero.y = cy; hero.dir = desired; hero.next = {x:0,y:0};
    }
  }
}

// ====== START DIRECTION ======
function chooseStartDir(){
  const c = toCell(hero.x + TILE/2, hero.y + TILE/2);
  const open = [{x:-1,y:0},{x:1,y:0},{x:0,y:-1},{x:0,y:1}]
    .filter(d => !hitsWall(c.c + d.x, c.r + d.y));
  if (open.length===0) return {x:0,y:0};
  if (startDirMode==="left"){
    const left = open.find(d=>d.x===-1 && d.y===0);
    return left || open[0];
  }
  return open[Math.floor(Math.random()*open.length)];
}

// ====== COUNTDOWN ======
function runCountdown(n,done){
  const el=q("#countdown"); el.classList.remove("hidden"); el.textContent=String(n);
  let count=n;
  const id=setInterval(()=>{
    count--;
    if(count>=1){ el.textContent=String(count); el.style.animation="none"; el.offsetHeight; el.style.animation=""; }
    else{ clearInterval(id); el.textContent="GO!"; setTimeout(()=>{ el.classList.add("hidden"); done(); },500); }
  },1000);
}

// ====== TIMER ======
function startTimer(){ stopTimer(); timerId=setInterval(()=>{ if(started && !paused && !won){ seconds++; updateTime(); }},1000); }
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }
function updateTime(){ const m=Math.floor(seconds/60), s=seconds%60; q("#time").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }

// ====== CAT AI HELPERS ======
function isReverse(a, b){ return a && (a.x === -b.x && a.y === -b.y); }
function availableDirs(cell, prevDir){
  const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]
    .filter(d => !hitsWall(cell.c + d.x, cell.r + d.y));
  if (dirs.length <= 1) return dirs;
  const nonRev = dirs.filter(d => !isReverse(prevDir, d));
  return nonRev.length ? nonRev : dirs;
}
function manhattan(a,b){ return Math.abs(a.c-b.c) + Math.abs(a.r-b.r); }
function chooseEnemyDir(heroCell, eCell, prevDir){
  const dirs = availableDirs(eCell, prevDir);
  if (dirs.length === 0) return {x:0,y:0};
  let best = dirs[0], bestScore = Infinity;
  for (const d of dirs){
    const next = { c: eCell.c + d.x, r: eCell.r + d.y };
    let score = manhattan(next, heroCell) + Math.random()*0.05;
    if (prevDir && d.x === prevDir.x && d.y === prevDir.y) score -= 0.1; // bias straight
    if (isReverse(prevDir, d)) score += 0.2; // avoid reverse
    if (score < bestScore){ bestScore = score; best = d; }
  }
  return best;
}
function snapIfNearCenter(e){
  const cx = Math.round(e.x / TILE) * TILE;
  const cy = Math.round(e.y / TILE) * TILE;
  if (Math.abs(e.x - cx) <= 4 && Math.abs(e.y - cy) <= 4){
    e.x = cx; e.y = cy;
    return true;
  }
  return false;
}

// ====== STEP ======
function step(){
  if(!won){
    tryTurn(hero);
    moveEntity(hero);

    // ---- Pellet / power pickup: any overlapping tiles ----
    const c0 = Math.floor(hero.x / TILE);
    const c1 = Math.floor((hero.x + TILE - 1) / TILE);
    const r0 = Math.floor(hero.y / TILE);
    const r1 = Math.floor((hero.y + TILE - 1) / TILE);
    let ate = false, atePower = false;
    for (let r=r0; r<=r1; r++){
      for (let c=c0; c<=c1; c++){
        const key=`${c},${r}`;
        if (pellets.delete(key)) { score+=10; ate = true; }
        if (power.delete(key))   { score+=50; atePower = true; }
      }
    }
    if (ate) SND.pellet();
    if (atePower) SND.power();
    updateHUD();

    // ---- Enemy AI for each cat ----
    const heroCell = toCell(hero.x + TILE/2, hero.y + TILE/2);
    for (const cat of enemies){
      const now = performance.now();
      const eCell = toCell(cat.x + TILE/2, cat.y + TILE/2);
      const blocked  = willCollide(cat.x + cat.dir.x*SPEED, cat.y + cat.dir.y*SPEED);
      const atCenter = atTileCenter(cat);
      const timeUp   = (now - (cat._decideAt || 0)) > (cat.retargetMs || 120);

      if (blocked || atCenter || timeUp){
        if (snapIfNearCenter(cat)) { /* snap */ }
        const freshE = toCell(cat.x + TILE/2, cat.y + TILE/2);
        cat.dir = chooseEnemyDir(heroCell, freshE, cat.dir);
        cat._decideAt = now;
      }

      const prevX = cat.x, prevY = cat.y;
      moveEntity(cat);

      // Hard watchdog (unstick)
      if (Math.hypot(cat.x - prevX, cat.y - prevY) < 0.1) {
        cat._stuckFrames = (cat._stuckFrames||0)+1;
        if (cat._stuckFrames >= 2) {
          snapIfNearCenter(cat);
          const fresh = toCell(cat.x + TILE/2, cat.y + TILE/2);
          let dir = chooseEnemyDir(heroCell, fresh, {x:0,y:0});
          const reverse = { x: -cat.dir.x, y: -cat.dir.y };
          if (willCollide(cat.x + dir.x*SPEED, cat.y + dir.y*SPEED)) {
            dir = reverse;
          }
          cat.dir = dir;
          cat._decideAt = performance.now();
          cat._stuckFrames = 0;
        }
      } else {
        cat._stuckFrames = 0;
      }
    }

    // ---- Collision: any cat touching hero ----
    let hit = false;
    for (const cat of enemies){
      if (distance(hero, cat) < TILE*0.6){ hit = true; break; }
    }
    if (hit){
      SND.death();
      lives--; updateHUD();
      if (lives <= 0) return gameOver();

      // respawn hero
      const open = nearestOpenCell(13,17);
      hero.x=open.c*TILE; hero.y=open.r*TILE; hero.dir=chooseStartDir(); hero.next={x:0,y:0};

      // respawn cats
      const spawns = [nearestOpenCell(13,11), nearestOpenCell(12,11), nearestOpenCell(14,11)];
      enemies.forEach((cat,i)=>{
        const s=spawns[i%spawns.length];
        cat.x=s.c*TILE; cat.y=s.r*TILE; cat.dir={x:0,y:0};
        cat._decideAt=performance.now(); cat._watchAt=performance.now(); cat._stuckFrames=0;
      });
    }

    // ---- Win ----
    if (pellets.size===0 && power.size===0){
      triggerWinCats();
      SND.win();
      pauseOverlay("You Win! 🐱","Time: "+q("#time").textContent);
    }
  } else {
    for (const c of winCats){ c.x+=c.vx; if(c.x<-TILE*2)c.x=cvs.width+TILE*2; if(c.x>cvs.width+TILE*2)c.x=-TILE*2; }
  }
}

// ====== WIN CATS ======
function triggerWinCats(){
  won=true; stopTimer(); winCats=[];
  const cols=Math.floor(cvs.width/(TILE*2)), rows=Math.floor(cvs.height/(TILE*2));
  for(let r=0;r<=rows;r++){ for(let c=0;c<=cols;c++){ winCats.push({x:c*(TILE*2)+(r%2?TILE:0), y:r*(TILE*2), vx:(r%2?0.3:-0.3)}); } }
}

// ====== MOVE / COLLISION ======
function moveEntity(e){
  const nx=e.x + e.dir.x*SPEED, ny=e.y + e.dir.y*SPEED;
  if(!willCollide(nx,ny)){ e.x=nx; e.y=ny; }
  if(e.x<-TILE) e.x=cvs.width; if(e.x>cvs.width) e.x=-TILE;
}
function tryTurn(e){
  if(e.next.x===0 && e.next.y===0) return;
  if(!atTileCenter(e)) return;
  const c=toCell(e.x+TILE/2,e.y+TILE/2);
  if(!hitsWall(c.c+e.next.x,c.r+e.next.y)){ e.dir={...e.next}; e.next={x:0,y:0}; }
}
function willCollide(nx,ny){
  const pad=1; // small pad reduces false corner hits
  const corners=[
    {x:nx+pad,y:ny+pad},
    {x:nx+TILE-pad,y:ny+pad},
    {x:nx+pad,y:ny+TILE-pad},
    {x:nx+TILE-pad,y:ny+TILE-pad},
  ];
  return corners.some(p=>wallAt(p.x,p.y));
}

// Only walls “#” and gate “-” block; spaces are walkable.
function wallAt(px,py){
  const {c,r}=toCell(px,py);
  const ch = (MAP[r] && MAP[r][c]) ?? " ";
  return ch==="#" || ch==="-" ;
}
function hitsWall(c,r){
  const ch = (MAP[r] && MAP[r][c]) ?? " ";
  return ch==="#" || ch==="-" ;
}

// ====== UTIL ======
function nearestOpenCell(c0,r0){
  const maxD=20;
  for(let d=0; d<=maxD; d++){
    for(let dr=-d; dr<=d; dr++){
      for(let dc=-d; dc<=d; dc++){
        if (Math.abs(dc)!==d && Math.abs(dr)!==d) continue;
        const c=c0+dc, r=r0+dr;
        if (r<0||r>=MAP.length||c<0) continue;
        const ch = MAP[r][c] ?? " ";
        if (ch!=="#" && ch!=="-") return {c,r};
      }
    }
  }
  return {c:c0,r:r0};
}
function toCell(px,py){ return { c:Math.floor(px/TILE), r:Math.floor(py/TILE) }; }
function atTileCenter(e){ return (e.x%TILE===0) && (e.y%TILE===0); }
function distance(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

// ====== DRAW ======
function draw(){
  // board bg
  ctx.fillStyle = "#08152f";
  ctx.fillRect(0,0,cvs.width,cvs.height);

  const width = Math.max(...MAP.map(r=>r.length));
  for(let r=0;r<MAP.length;r++){
    for(let c=0;c<width;c++){
      const ch = MAP[r][c] ?? " ";
      const x=c*TILE, y=r*TILE;

      // grid lines
      ctx.strokeStyle="#0f3c8f"; ctx.lineWidth=1;
      ctx.strokeRect(x+0.5,y+0.5,TILE-1,TILE-1);

      if(ch==="#"){
        ctx.fillStyle = "#0e2a6b";
        ctx.fillRect(x,y,TILE,TILE);
        ctx.strokeStyle = "#3da1ff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x+0.75,y+0.75,TILE-1.5,TILE-1.5);
      } else if(ch==="-"){
        ctx.strokeStyle="#a04362";
        ctx.beginPath(); ctx.moveTo(x, y+TILE/2); ctx.lineTo(x+TILE, y+TILE/2); ctx.stroke();
      }
    }
  }

  // pellets/power from live sets
  for (const key of pellets){
    const [c,r] = key.split(",").map(Number);
    const x=c*TILE, y=r*TILE;
    ctx.fillStyle="#ffe39d";
    ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,Math.max(3,Math.floor(TILE*0.13)),0,Math.PI*2); ctx.fill();
  }
  for (const key of power){
    const [c,r] = key.split(",").map(Number);
    const x=c*TILE, y=r*TILE;
    ctx.fillStyle="#fff3b9";
    ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,Math.max(6,Math.floor(TILE*0.24)),0,Math.PI*2); ctx.fill();
  }

  // hero
  drawHero(hero);

  // cats
  const f = Math.floor(performance.now()/220)%2;
  for (const cat of enemies){
    drawSprite(CAT_FRAMES[f], cat.x, cat.y, TILE/16);
  }

  // win cats rain
  if(won){
    const frame=Math.floor(performance.now()/250)%2;
    for(const c of winCats){ drawSprite(CAT_FRAMES[frame], c.x, c.y, TILE/16); }
  }
}

function drawHero(h){
  const scale=TILE/16;
  if(h.skin==="girl" && !customImg){
    const frame=Math.floor(performance.now()/220)%2;
    drawSprite(GIRL_FRAMES[frame],h.x,h.y,scale); return;
  }
  if(customImg){ ctx.imageSmoothingEnabled=false; ctx.drawImage(customImg,Math.round(h.x),Math.round(h.y),TILE,TILE); return; }
  const cx=h.x+TILE/2, cy=h.y+TILE/2;
  ctx.fillStyle="#ffd54a"; ctx.beginPath(); ctx.arc(cx,cy,TILE/2-2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#000"; const open=6+(Math.sin(performance.now()/90)*4+4);
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,TILE/2-2,(open/32)*Math.PI,(2-(open/32))*Math.PI); ctx.closePath(); ctx.fill();
}
function drawSprite(grid,x,y,s){
  for(let r=0;r<grid.length;r++){
    for(let c=0;c<grid[r].length;c++){
      const col=PALETTE[grid[r][c]]; if(!col) continue;
      ctx.fillStyle=col; ctx.fillRect(Math.round(x+c*s),Math.round(y+r*s),Math.ceil(s),Math.ceil(s));
    }
  }
}

// ====== INPUTS / UI ======
function bindInputs(){
  window.addEventListener("keydown", e => {
    const k=e.key.toLowerCase();
    if(k===" "){ if(!started) return; paused?resume():pauseOverlay("Paused","Tap continue"); return; }
    if(!started) return;
    if(k==="arrowup"||k==="w") requestDir(0,-1);
    if(k==="arrowdown"||k==="s") requestDir(0,1);
    if(k==="arrowleft"||k==="a") requestDir(-1,0);
    if(k==="arrowright"||k==="d") requestDir(1,0);
  });

  document.querySelectorAll(".dpad [data-dir]").forEach(btn=>{
    const trigger = () => {
      if(!started) return;
      const d=btn.dataset.dir;
      if(d==="up") requestDir(0,-1);
      if(d==="down") requestDir(0,1);
      if(d==="left") requestDir(-1,0);
      if(d==="right") requestDir(1,0);
    };
    btn.addEventListener("touchstart", e=>{ e.preventDefault(); trigger(); }, {passive:false});
    btn.addEventListener("click", trigger);
  });

  document.querySelectorAll(".chip[data-hero]").forEach(b=>{
    b.addEventListener("click",()=>{
      const name=b.dataset.hero;
      document.querySelectorAll('.chip[data-hero]').forEach(x=>x.setAttribute('aria-pressed','false'));
      b.setAttribute('aria-pressed','true');
      if(name==="custom"){ q("#custom-file").click(); return; }
      if(name==="girl"){ hero.skin="girl"; customImg=null; }
      if(name==="yellow"){ hero.skin="yellow"; customImg=null; }
    });
  });
  q("#custom-file").addEventListener("change",e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const img=new Image(); img.onload=()=>{ customImg=img; hero.skin="custom"; };
    img.src=URL.createObjectURL(f);
  });

  q("#btn-continue").onclick = resume;
  q("#btn-restart").onclick  = ()=>{ hideOverlay(); startGame(); };
  q("#btn-exit").onclick     = ()=>{ hideOverlay(); exitToStart(); };
}

// HUD / overlays
function updateHUD(){ q("#score").textContent=score; q("#lives").textContent=lives; }
function pauseOverlay(title,sub){
  paused=true; stopTimer();
  q("#overlay-title").textContent=title; q("#overlay-sub").textContent=sub||"";
  q("#overlay").classList.remove("hidden");
  q("#btn-pause").textContent="Resume";
}
function hideOverlay(){ q("#overlay").classList.add("hidden"); }
function resume(){ paused=false; hideOverlay(); startTimer(); q("#btn-pause").textContent="Pause"; }
function showStart(){ q("#start-screen").classList.remove("hidden"); }
function hideStart(){ q("#start-screen").classList.add("hidden"); }
function q(s){ return document.querySelector(s); }
function gameOver(){ stopTimer(); pauseOverlay("Game Over","Restart to try again"); }
