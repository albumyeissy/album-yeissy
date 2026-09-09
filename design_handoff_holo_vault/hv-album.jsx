// ============================================================
// HOLO VAULT — pantallas: Álbum · Ranking · Perfil
// ============================================================
const { useState, useRef, useEffect } = React;

function ProgressRing({ pct, size=60, stroke=6 }){
  const r = (size-stroke)/2;
  const c = 2*Math.PI*r;
  return (
    <svg width={size} height={size} className="hv-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c*(1-pct/100)} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)'}}/>
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="hv-ring-t">{pct}%</text>
    </svg>
  );
}

function ScreenHead({ kicker, title, right }){
  return (
    <div className="hv-shead">
      <div>
        <div className="hv-kicker">{kicker}</div>
        <h1 className="hv-h1">{title}</h1>
      </div>
      {right}
    </div>
  );
}

// ───────────────────────── ÁLBUM ─────────────────────────
function AlbumScreen({ cards, onOpen }){
  const [filter, setFilter] = useState("todos");
  const owned = cards.filter(c=>c.owned).length;
  const pct = Math.round(owned/cards.length*100);
  const repes = cards.filter(c=>c.owned&&c.dupes>0).reduce((n,c)=>n+c.dupes,0);

  const filters = [
    {k:"todos", label:"Todos", n:cards.length},
    {k:"tengo", label:"Tengo", n:owned},
    {k:"faltan",label:"Faltan", n:cards.length-owned},
    {k:"repes", label:"Repes", n:repes},
  ];
  const shown = cards.filter(c=>{
    if(filter==="tengo") return c.owned;
    if(filter==="faltan") return !c.owned;
    if(filter==="repes") return c.owned && c.dupes>0;
    return true;
  });

  return (
    <div className="hv-screen">
      <ScreenHead kicker="TEMPORADA 1" title="Álbum Yeissy"
        right={<ProgressRing pct={pct} />} />

      <div className="hv-progress-row">
        <div className="hv-prog-bar"><i style={{width:pct+"%"}}></i></div>
        <span className="hv-prog-txt">{owned}<em>/{cards.length}</em></span>
      </div>

      <div className="hv-chips album-scroll">
        {filters.map(f=>(
          <button key={f.k} className={"hv-chip"+(filter===f.k?" on":"")} onClick={()=>setFilter(f.k)}>
            {f.label} <b>{f.n}</b>
          </button>
        ))}
      </div>

      <div className="hv-grid">
        {shown.map(c=> <MiniCromo key={c.id} card={c} onClick={()=>onOpen(c)} />)}
      </div>
      <div className="hv-screen-pad"></div>
    </div>
  );
}

// ───────────────────────── RANKING ─────────────────────────
function podiumOrder(top3){ return [top3[1], top3[0], top3[2]]; } // 2,1,3

function RankingBody(){
  const top3 = LEADERBOARD.slice(0,3);
  const rest = LEADERBOARD.slice(3);
  const heights = {0:96, 1:128, 2:78};
  return (
    <React.Fragment>
      <div className="hv-podium">
        {podiumOrder(top3).map((p, i)=>{
          const f = FRIENDS[p.who];
          const place = p===top3[0]?1 : p===top3[1]?2 : 3;
          const me = p.who===ME;
          return (
            <div key={p.who} className={"hv-pod p"+place+(me?" me":"")}>
              <div className="hv-pod-av" style={{'--h':f.hue}}>
                {p.who.slice(0,2).toUpperCase()}
                {place===1 && <span className="hv-crown">♛</span>}
              </div>
              <div className="hv-pod-name">{p.who}{me?" · tú":""}</div>
              <div className="hv-pod-bar" style={{height:heights[i]}}>
                <span className="hv-pod-pct">{p.pct}%</span>
                <span className="hv-pod-place">{place}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hv-rank-list">
        {rest.map((p, i)=>{
          const f = FRIENDS[p.who];
          const me = p.who===ME;
          return (
            <div key={p.who} className={"hv-rank-row"+(me?" me":"")}>
              <span className="hv-rank-pos">{i+4}</span>
              <div className="hv-rank-av" style={{'--h':f.hue}}>{p.who.slice(0,2).toUpperCase()}</div>
              <div className="hv-rank-mid">
                <div className="hv-rank-name">{p.who}{me?" · tú":""}</div>
                <div className="hv-rank-bar"><i style={{width:p.pct+"%"}}></i></div>
              </div>
              <div className="hv-rank-stats">
                <b>{p.pct}%</b>
                <small>{p.legendarias} ✦</small>
              </div>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

function RankingScreen(){
  return (
    <div className="hv-screen">
      <ScreenHead kicker="EL GRUPO" title="Ranking" />
      <p className="hv-sub">Quién va ganando la temporada.</p>
      <RankingBody />
      <div className="hv-screen-pad"></div>
    </div>
  );
}

// ───────────────────────── PERFIL ─────────────────────────
function PerfilScreen({ cards }){
  const me = FRIENDS[ME];
  const owned = cards.filter(c=>c.owned);
  const pct = Math.round(owned.length/cards.length*100);
  const repes = cards.filter(c=>c.owned&&c.dupes>0).reduce((n,c)=>n+c.dupes,0);
  const legendarias = owned.filter(c=>c.rarity==='legendario'||c.rarity==='mitico').length;
  const best = owned.slice().sort((a,b)=>RARITY[b.rarity].w-RARITY[a.rarity].w).slice(0,3);

  const tiles = [
    {k:"Completado", v:pct+"%"},
    {k:"Cromos", v:owned.length+"/"+cards.length},
    {k:"Repes", v:repes},
    {k:"Legendarias", v:legendarias},
    {k:"Sobres abiertos", v:96},
    {k:"Racha", v:"7 días 🔥"},
  ];

  return (
    <div className="hv-screen">
      <ScreenHead kicker="MI PERFIL" title="Tú" />

      <div className="hv-profile-card">
        <div className="hv-prof-av" style={{'--h':me.hue}}>{ME.slice(0,2).toUpperCase()}</div>
        <div className="hv-prof-info">
          <div className="hv-prof-name">{me.name}</div>
          <div className="hv-prof-mote">“{me.mote}”</div>
          <div className="hv-prof-rank">2º del grupo · Temporada 1</div>
        </div>
      </div>

      <div className="hv-tiles">
        {tiles.map(t=>(
          <div key={t.k} className="hv-tile">
            <div className="hv-tile-v">{t.v}</div>
            <div className="hv-tile-k">{t.k}</div>
          </div>
        ))}
      </div>

      <div className="hv-section-label">TUS MEJORES CROMOS</div>
      <div className="hv-best">
        {best.map(c=>(
          <div key={c.id} className={"hv-best-card rar-"+c.rarity} style={{'--rc':RARITY[c.rarity].color}}>
            <div className="hv-best-init">{initials(c)}</div>
            <div className="hv-best-name">{c.name}</div>
            <RarityChip r={c.rarity} small={true} />
          </div>
        ))}
      </div>

      <button className="hv-btn ghost wide">Cerrar sesión</button>
      <div className="hv-screen-pad"></div>
    </div>
  );
}

Object.assign(window, { AlbumScreen, RankingScreen, RankingBody, PerfilScreen, ProgressRing, ScreenHead });
