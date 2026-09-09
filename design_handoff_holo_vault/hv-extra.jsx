// ============================================================
// HOLO VAULT — Ruleta · Tienda · Feed · Hub "Conseguir"
// ============================================================
const { useState, useRef, useEffect } = React;

function CoinPill({ n, big }){
  return (
    <div className={"hv-coin-pill"+(big?" big":"")}>
      <span className="hv-coin-ic">◉</span>
      <b>{n.toLocaleString('es')}</b>
    </div>
  );
}

// ───────────────────────── RULETA ─────────────────────────
function RuletaScreen({ topNav, coins, onWin }){
  const N = WHEEL.length;
  const seg = 360/N;
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [freeSpin, setFreeSpin] = useState(true);
  const COST = 40;

  const spin = ()=>{
    if(spinning) return;
    if(!freeSpin && coins < COST) return;
    setResult(null);
    const win = Math.floor(Math.random()*N);
    const turns = 5 + Math.floor(Math.random()*2);
    // pointer is at top (0deg). center of segment i is at i*seg + seg/2.
    const target = turns*360 + (360 - (win*seg + seg/2));
    const base = angle - (angle % 360);
    setAngle(base + target);
    setSpinning(true);
    if(!freeSpin) onWin({ kind:"spend", amount:COST });
    setTimeout(()=>{
      setSpinning(false);
      setResult(WHEEL[win]);
      setFreeSpin(false);
      onWin(WHEEL[win]);
    }, 4200);
  };

  const canSpin = freeSpin || coins >= COST;

  return (
    <div className="hv-screen">
      {topNav}
      <p className="hv-sub">Un giro gratis al día. Después, {COST} <span className="hv-coin-inline">◉</span> por tirada.</p>

      <div className="hv-wheel-wrap">
        <div className="hv-wheel-pointer">▼</div>
        <div className="hv-wheel" style={{ transform:`rotate(${angle}deg)`, transition: spinning?'transform 4.1s cubic-bezier(.16,.84,.3,1)':'none' }}>
          <svg viewBox="0 0 200 200" className="hv-wheel-svg">
            {WHEEL.map((w,i)=>{
              const a0 = (i*seg-90)*Math.PI/180, a1=((i+1)*seg-90)*Math.PI/180;
              const x0=100+98*Math.cos(a0), y0=100+98*Math.sin(a0);
              const x1=100+98*Math.cos(a1), y1=100+98*Math.sin(a1);
              const mid=((i+.5)*seg-90)*Math.PI/180;
              const tx=100+62*Math.cos(mid), ty=100+62*Math.sin(mid);
              return (
                <g key={i}>
                  <path d={`M100,100 L${x0},${y0} A98,98 0 0,1 ${x1},${y1} Z`}
                    fill={i%2? `color-mix(in oklch, ${w.color} 32%, var(--bg))` : `color-mix(in oklch, ${w.color} 18%, var(--bg2))`}
                    stroke="var(--bg)" strokeWidth="1"/>
                  <text x={tx} y={ty} fill={w.color} fontSize="11" fontWeight="700" fontFamily="'Chakra Petch',sans-serif"
                    textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${(i+.5)*seg}, ${tx}, ${ty})`}>{w.label}</text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r="98" fill="none" stroke="var(--line)" strokeWidth="2"/>
          </svg>
          <div className="hv-wheel-hub">◉</div>
        </div>
      </div>

      <button className={"hv-btn primary wide spin"+(spinning?" busy":"")} onClick={spin} disabled={spinning || !canSpin}>
        {spinning ? "Girando…" : freeSpin ? "¡Giro GRATIS!" : canSpin ? `Girar · ${COST} ◉` : "No te llegan las monedas"}
      </button>

      {result && (
        <div className="hv-wheel-result" style={{'--rc':result.color}}>
          <span className="hv-wr-burst">¡PREMIO!</span>
          <span className="hv-wr-label">{result.kind==="coins" ? `${result.amount} monedas` : result.kind==="pack" ? "1 sobre gratis" : `cromo ${RARITY[result.rarity].label}`}</span>
        </div>
      )}
      <div className="hv-screen-pad"></div>
    </div>
  );
}

// ───────────────────────── TIENDA ─────────────────────────
function ShopVis({ vis }){
  if(vis==="coins") return <div className="hv-shop-vis coins"><span>◉</span></div>;
  if(vis==="pick")  return <div className="hv-shop-vis pick"><span>✦</span></div>;
  if(vis==="frame") return <div className="hv-shop-vis frame"><div className="hv-foil"></div><span>▣</span></div>;
  if(vis==="slot")  return <div className="hv-shop-vis slot"><span>＋</span></div>;
  if(vis==="mega")  return <div className="hv-shop-vis mega"><div className="hv-foil"></div><span>★</span></div>;
  return <div className="hv-shop-vis pack"><div className="hv-foil"></div><span>?</span></div>;
}

function TiendaScreen({ topNav, coins, onBuy }){
  const [toast, setToast] = useState("");
  const buy = (item)=>{
    if(item.kind==="iap"){ onBuy(item); setToast("✓ +250 monedas añadidas"); }
    else if(coins >= item.price){ onBuy(item); setToast(`✓ Comprado · ${item.name}`); }
    else { setToast("Te faltan monedas — gira la ruleta"); }
    setTimeout(()=>setToast(""), 1900);
  };
  return (
    <div className="hv-screen">
      {topNav}
      <p className="hv-sub">Gasta tus monedas en sobres, cromos y extras.</p>
      <div className="hv-shop-grid">
        {SHOP.map(item=>{
          const afford = item.kind==="iap" || coins>=item.price;
          return (
            <div key={item.id} className={"hv-shop-card"+(afford?"":" cant")}>
              {item.badge && <span className="hv-shop-badge">{item.badge}</span>}
              <ShopVis vis={item.vis} />
              <div className="hv-shop-name">{item.name}</div>
              <div className="hv-shop-desc">{item.desc}</div>
              <button className={"hv-shop-buy"+(item.kind==="iap"?" iap":"")} onClick={()=>buy(item)}>
                {item.kind==="iap" ? "Gratis hoy" : <React.Fragment><span className="hv-coin-ic">◉</span> {item.price}</React.Fragment>}
              </button>
            </div>
          );
        })}
      </div>
      {toast && <div className="hv-toast">{toast}</div>}
      <div className="hv-screen-pad"></div>
    </div>
  );
}

// ───────────────────────── FEED ─────────────────────────
function FeedItem({ ev }){
  const f = FRIENDS[ev.who] || {hue:200};
  const card = ev.cardId ? cardById(ev.cardId) : null;
  return (
    <div className="hv-feed-row">
      <div className="hv-feed-av" style={{'--h':f.hue}}>{ev.who.slice(0,2).toUpperCase()}</div>
      <div className="hv-feed-body">
        <div className="hv-feed-text">
          <b>{ev.who}</b> {ev.text}
          {card && <span className="hv-feed-card" style={{color: RARITY[ev.rarity||card.rarity].color}}> {card.name}</span>}
          {ev.with && <b> {ev.with}</b>}
        </div>
        <div className="hv-feed-time">{ev.t}</div>
      </div>
      {ev.type==="pull" && card && (
        <div className="hv-feed-chip" style={{'--rc':RARITY[ev.rarity||card.rarity].color}}>
          <span>{initials(card)}</span>
        </div>
      )}
      {ev.type==="wheel" && <div className="hv-feed-emoji">◉</div>}
      {ev.type==="trade" && <div className="hv-feed-emoji">⇄</div>}
      {ev.type==="complete" && <div className="hv-feed-emoji">✓</div>}
      {ev.type==="join" && <div className="hv-feed-emoji">🎉</div>}
    </div>
  );
}

function FeedScreen({ coins }){
  const [seg, setSeg] = useState("actividad");
  return (
    <div className="hv-screen">
      <div className="hv-shead">
        <div>
          <div className="hv-kicker">ÁLBUM YEISSY</div>
          <h1 className="hv-h1">El grupo</h1>
        </div>
        <CoinPill n={coins} />
      </div>

      <div className="hv-seg">
        <button className={"hv-seg-btn"+(seg==="actividad"?" on":"")} onClick={()=>setSeg("actividad")}>Actividad</button>
        <button className={"hv-seg-btn"+(seg==="ranking"?" on":"")} onClick={()=>setSeg("ranking")}>Ranking</button>
      </div>

      {seg==="actividad" ? (
        <div className="hv-feed">
          {FEED.map(ev=> <FeedItem key={ev.id} ev={ev} />)}
        </div>
      ) : (
        <div className="hv-feed-rank"><RankingBody /></div>
      )}
      <div className="hv-screen-pad"></div>
    </div>
  );
}

// ───────────────────────── HUB "CONSEGUIR" ─────────────────────────
function GetHub({ coins, onAddToAlbum, onWin, onBuy, tilt }){
  const [sub, setSub] = useState("sobres");
  const SUBS = [{k:"sobres",l:"Sobres"},{k:"ruleta",l:"Ruleta"},{k:"tienda",l:"Tienda"}];
  const titles = { sobres:"Sobres", ruleta:"Ruleta", tienda:"Tienda" };

  const nav = (
    <React.Fragment>
      <div className="hv-shead">
        <div>
          <div className="hv-kicker">CONSEGUIR CROMOS</div>
          <h1 className="hv-h1">{titles[sub]}</h1>
        </div>
        <CoinPill n={coins} />
      </div>
      <div className="hv-seg three">
        {SUBS.map(s=>(
          <button key={s.k} className={"hv-seg-btn"+(sub===s.k?" on":"")} onClick={()=>setSub(s.k)}>{s.l}</button>
        ))}
      </div>
    </React.Fragment>
  );

  if(sub==="sobres") return <SobresScreen onAddToAlbum={onAddToAlbum} tilt={tilt} topNav={nav} />;
  if(sub==="ruleta") return <RuletaScreen coins={coins} onWin={onWin} topNav={nav} />;
  return <TiendaScreen coins={coins} onBuy={onBuy} topNav={nav} />;
}

Object.assign(window, { CoinPill, RuletaScreen, TiendaScreen, FeedScreen, GetHub });
