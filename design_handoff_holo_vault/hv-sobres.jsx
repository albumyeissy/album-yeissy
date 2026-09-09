// ============================================================
// HOLO VAULT — pantallas: Sobres (abrir) · Cambios (trading)
// ============================================================
const { useState, useRef, useEffect } = React;

// elige cartas para un sobre, según pesos de rareza
function weightedRarity(mega){
  const table = mega
    ? [["raro",30],["epico",35],["legendario",28],["mitico",7]]
    : [["comun",50],["raro",30],["epico",14],["legendario",5],["mitico",1]];
  const total = table.reduce((s,[,w])=>s+w,0);
  let r = Math.random()*total;
  for(const [k,w] of table){ if((r-=w)<0) return k; }
  return "comun";
}
function pickPulls(n, mega){
  const out = [];
  for(let i=0;i<n;i++){
    let rar = weightedRarity(mega);
    if(mega && i===n-1 && !out.some(c=>RARITY[c.rarity].w>=3)) rar = Math.random()<.5?"legendario":"mitico";
    const pool = CARDS.filter(c=>c.rarity===rar);
    const base = pool[Math.floor(Math.random()*pool.length)] || CARDS[0];
    out.push({ ...base, _pullNew: !base.owned });
  }
  return out.sort((a,b)=>RARITY[a.rarity].w-RARITY[b.rarity].w);
}

function Confetti({ go }){
  if(!go) return null;
  const pieces = Array.from({length:36});
  const cols = ["oklch(0.8 0.14 195)","oklch(0.7 0.19 350)","oklch(0.83 0.13 85)","oklch(0.72 0.2 300)"];
  return (
    <div className="hv-confetti">
      {pieces.map((_,i)=>(
        <span key={i} style={{
          left: Math.random()*100+"%",
          background: cols[i%cols.length],
          animationDelay: (Math.random()*.3)+"s",
          animationDuration: (1.1+Math.random()*1)+"s",
          transform:`rotate(${Math.random()*360}deg)`
        }}></span>
      ))}
    </div>
  );
}

// ───────────────────────── SOBRES ─────────────────────────
function SobresScreen({ onAddToAlbum, tilt=true, topNav=null }){
  const [diarios, setDiarios] = useState(2);   // sobres diarios restantes
  const [view, setView] = useState("idle");     // idle | shake | reveal | summary
  const [pulls, setPulls] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mega, setMega] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);

  const openPack = (isMega)=>{
    if(!isMega && diarios<=0) return;
    setMega(isMega);
    setPulls(pickPulls(isMega?5:4, isMega));
    setIdx(0); setFlipped(false); setView("shake");
  };
  const rip = ()=>{ setView("reveal"); setIdx(0); setFlipped(false); };

  const revealCurrent = ()=>{
    if(flipped){
      // avanzar
      setConfetti(false);
      if(idx+1>=pulls.length){ setView("summary"); }
      else { setIdx(idx+1); setFlipped(false); }
      return;
    }
    setFlipped(true);
    const cur = pulls[idx];
    if(RARITY[cur.rarity].w>=3){
      setConfetti(true);
      setShakeScreen(true);
      setTimeout(()=>setShakeScreen(false), 600);
    }
  };

  const finish = ()=>{
    if(!mega) setDiarios(d=>Math.max(0,d-1));
    onAddToAlbum(pulls);
    setView("idle"); setPulls([]); setConfetti(false);
  };

  // ---- IDLE ----
  if(view==="idle"){
    return (
      <div className="hv-screen">
        {topNav}
        <p className="hv-sub">Abre sobres para completar el álbum. Las repes las cambias en el grupo.</p>

        <div className={"hv-pack-card daily"+(diarios<=0?" off":"")} onClick={()=>openPack(false)}>
          <div className="hv-pack-vis"><div className="hv-foil"></div><span>?</span></div>
          <div className="hv-pack-info">
            <div className="hv-pack-name">Sobre diario</div>
            <div className="hv-pack-desc">4 cromos · gratis cada día</div>
            <div className="hv-pack-cta">{diarios>0 ? `${diarios} disponible${diarios>1?'s':''} hoy` : "Vuelve mañana"}</div>
          </div>
        </div>

        <div className="hv-pack-card mega" onClick={()=>openPack(true)}>
          <div className="hv-pack-vis mega"><div className="hv-foil"></div><span>★</span></div>
          <div className="hv-pack-info">
            <div className="hv-pack-name">Mega sobre <em>PRO</em></div>
            <div className="hv-pack-desc">5 cromos · ¡legendaria garantizada!</div>
            <div className="hv-pack-cta gold">Abrir mega sobre</div>
          </div>
        </div>
        <div className="hv-screen-pad"></div>
      </div>
    );
  }

  // ---- SHAKE ----
  if(view==="shake"){
    return (
      <div className="hv-screen center-screen" onClick={rip}>
        <div className={"hv-bigpack"+(mega?" mega":"")}>
          <div className="hv-foil"></div>
          <div className="hv-bigpack-mark">{mega?"★":"?"}</div>
          <div className="hv-bigpack-label">ÁLBUM YEISSY</div>
        </div>
        <div className="hv-tap-pulse">TOCA PARA ABRIR</div>
      </div>
    );
  }

  // ---- REVEAL ----
  if(view==="reveal"){
    const cur = pulls[idx];
    return (
      <div className={"hv-screen center-screen reveal"+(shakeScreen?" shake":"")} onClick={revealCurrent}>
        <Confetti go={confetti} />
        <div className="hv-reveal-count">{idx+1} / {pulls.length}</div>
        {flipped && RARITY[cur.rarity].w>=3 &&
          <div className="hv-rarity-burst" style={{color:RARITY[cur.rarity].color}}>{RARITY[cur.rarity].label}</div>}
        <div key={idx} className="hv-reveal-card">
          <Cromo card={cur} w={236} tilt={tilt} flipped={!flipped} flippable={false} />
        </div>
        {cur._pullNew && flipped && <div className="hv-new-big">¡NUEVO!</div>}
        <div className="hv-tap-pulse sm">{flipped ? (idx+1>=pulls.length?"toca · ver resumen":"toca · siguiente") : "toca para revelar"}</div>
      </div>
    );
  }

  // ---- SUMMARY ----
  const news = pulls.filter(p=>p._pullNew).length;
  return (
    <div className="hv-screen">
      <ScreenHead kicker={mega?"MEGA SOBRE":"SOBRE DIARIO"} title="¡Tu botín!" />
      <p className="hv-sub">{news>0 ? `${news} cromo${news>1?'s':''} nuevo${news>1?'s':''} para el álbum.` : "Todo repes… ¡a cambiarlas!"}</p>
      <div className="hv-loot">
        {pulls.map((c,i)=>(
          <div key={i} className={"hv-loot-card rar-"+c.rarity} style={{'--rc':RARITY[c.rarity].color}}>
            {c._pullNew && <span className="hv-new">NUEVO</span>}
            <div className="hv-loot-init">{initials(c)}</div>
            <div className="hv-loot-name">{c.name}</div>
            <RarityChip r={c.rarity} small={true} />
          </div>
        ))}
      </div>
      <button className="hv-btn primary wide" onClick={finish}>Añadir al álbum</button>
      <div className="hv-screen-pad"></div>
    </div>
  );
}

// ───────────────────────── CAMBIOS ─────────────────────────
function TradeCard({ card, label }){
  const R = RARITY[card.rarity];
  return (
    <div className={"hv-tcard rar-"+card.rarity} style={{'--rc':R.color}}>
      <div className="hv-tcard-init">{initials(card)}</div>
      <div className="hv-tcard-name">{card.name}</div>
      <div className="hv-tcard-var">{card.variant}</div>
      <i className="hv-tcard-dot" style={{background:R.color}}></i>
      {label && <span className="hv-tcard-tag">{label}</span>}
    </div>
  );
}

function CambiosScreen(){
  const [tab, setTab] = useState("recibidas");
  const [trades, setTrades] = useState(INCOMING_TRADES);
  const [toast, setToast] = useState("");
  const dupes = myDupes();
  const missing = myMissing();
  const [giveSel, setGiveSel] = useState(dupes[0]?.id);
  const [wantSel, setWantSel] = useState(missing[0]?.id);

  const flash = (msg)=>{ setToast(msg); setTimeout(()=>setToast(""), 1900); };
  const resolve = (id, ok)=>{
    setTrades(t=>t.filter(x=>x.id!==id));
    flash(ok?"✓ ¡Intercambio hecho!":"Propuesta rechazada");
  };
  const send = ()=>{
    const g = cardById(giveSel), w = cardById(wantSel);
    flash(`Propuesta enviada · das ${g.name} por ${w.name}`);
  };

  return (
    <div className="hv-screen">
      <ScreenHead kicker="EL GRUPO" title="Cambios" />
      <div className="hv-tabs">
        <button className={"hv-tab"+(tab==="recibidas"?" on":"")} onClick={()=>setTab("recibidas")}>
          Recibidas {trades.length>0 && <b>{trades.length}</b>}
        </button>
        <button className={"hv-tab"+(tab==="proponer"?" on":"")} onClick={()=>setTab("proponer")}>Proponer</button>
      </div>

      {tab==="recibidas" && (
        <div className="hv-trades">
          {trades.length===0 && <div className="hv-empty">No tienes propuestas pendientes ✦</div>}
          {trades.map(t=>{
            const give = cardById(t.giveId), want = cardById(t.wantId);
            const f = FRIENDS[t.from];
            return (
              <div key={t.id} className="hv-trade">
                <div className="hv-trade-head">
                  <div className="hv-trade-av" style={{'--h':f.hue}}>{t.from.slice(0,2).toUpperCase()}</div>
                  <span><b>{t.from}</b> te propone un cambio</span>
                </div>
                <div className="hv-trade-body">
                  <TradeCard card={give} label="te da" />
                  <div className="hv-trade-swap">⇄</div>
                  <TradeCard card={want} label="le das" />
                </div>
                <div className="hv-trade-actions">
                  <button className="hv-btn mini ghost" onClick={()=>resolve(t.id,false)}>Rechazar</button>
                  <button className="hv-btn mini primary" onClick={()=>resolve(t.id,true)}>Aceptar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="proponer" && (
        <div className="hv-propose">
          <div className="hv-prop-label">TÚ DAS · una de tus repes</div>
          <div className="hv-prop-rail album-scroll">
            {dupes.map(c=>(
              <button key={c.id} className={"hv-prop-pick"+(giveSel===c.id?" sel":"")} onClick={()=>setGiveSel(c.id)}>
                <TradeCard card={c} label={`×${c.dupes}`} />
              </button>
            ))}
          </div>
          <div className="hv-prop-swap">⇅</div>
          <div className="hv-prop-label">TÚ PIDES · un cromo que te falta</div>
          <div className="hv-prop-rail album-scroll">
            {missing.map(c=>(
              <button key={c.id} className={"hv-prop-pick"+(wantSel===c.id?" sel":"")} onClick={()=>setWantSel(c.id)}>
                <TradeCard card={c} />
              </button>
            ))}
          </div>
          <button className="hv-btn primary wide" onClick={send} disabled={!giveSel||!wantSel}>Enviar propuesta al grupo</button>
        </div>
      )}

      {toast && <div className="hv-toast">{toast}</div>}
      <div className="hv-screen-pad"></div>
    </div>
  );
}

Object.assign(window, { SobresScreen, CambiosScreen, Confetti, TradeCard, pickPulls });
