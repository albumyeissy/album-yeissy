// ============================================================
// HOLO VAULT — App shell · navegación · tweaks
// ============================================================
const { useState, useRef, useEffect } = React;

// iconos nav (formas simples)
function Icon({ name, active }){
  const s = active ? "var(--accent)" : "rgba(235,238,255,.55)";
  const sw = 2;
  if(name==="album") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="8" rx="1.5" stroke={s} strokeWidth={sw}/>
      <rect x="14" y="3" width="7" height="8" rx="1.5" stroke={s} strokeWidth={sw}/>
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={s} strokeWidth={sw}/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={s} strokeWidth={sw}/>
    </svg>);
  if(name==="conseguir") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke={s} strokeWidth={sw}/>
      <path d="M4 8h16" stroke={s} strokeWidth={sw}/>
      <circle cx="12" cy="14.5" r="2.2" stroke={s} strokeWidth={sw}/>
    </svg>);
  if(name==="cambios") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M5 9h13l-3-3M19 15H6l3 3" stroke={s} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>);
  if(name==="feed") return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="5" rx="1.5" stroke={s} strokeWidth={sw}/>
      <rect x="3" y="12" width="18" height="5" rx="1.5" stroke={s} strokeWidth={sw}/>
      <circle cx="6.5" cy="6.5" r="0.6" fill={s}/>
      <circle cx="6.5" cy="14.5" r="0.6" fill={s}/>
    </svg>);
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={s} strokeWidth={sw}/>
      <path d="M4.5 20a7.5 7.5 0 0115 0" stroke={s} strokeWidth={sw} strokeLinecap="round"/>
    </svg>);
}

const NAV = [
  {k:"feed",      label:"Grupo"},
  {k:"album",     label:"Álbum"},
  {k:"conseguir", label:"Conseguir", center:true},
  {k:"cambios",   label:"Cambios"},
  {k:"perfil",    label:"Perfil"},
];

function BottomNav({ tab, setTab }){
  return (
    <nav className="hv-nav">
      {NAV.map(n=>(
        n.center ? (
          <button key={n.k} className={"hv-nav-btn center"+(tab===n.k?" on":"")} onClick={()=>setTab(n.k)}>
            <span className="hv-nav-fab"><Icon name="conseguir" active={true} /></span>
            <span>{n.label}</span>
          </button>
        ) : (
          <button key={n.k} className={"hv-nav-btn"+(tab===n.k?" on":"")} onClick={()=>setTab(n.k)}>
            <Icon name={n.k} active={tab===n.k} />
            <span>{n.label}</span>
          </button>
        )
      ))}
    </nav>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#39d6e8",
  "bg": "azul",
  "foil": 85,
  "glow": 80,
  "tilt": true,
  "headFont": "Chakra Petch"
}/*EDITMODE-END*/;

function App(){
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tab, setTab] = useState("feed");
  const [detail, setDetail] = useState(null);
  const [cards, setCards] = useState(()=>CARDS.map(c=>({...c})));
  const [coins, setCoins] = useState(340);

  // aplica tweaks como variables CSS en el root de la app
  const rootRef = useRef(null);
  useEffect(()=>{
    const el = rootRef.current; if(!el) return;
    el.style.setProperty('--accent', t.accent);
    el.style.setProperty('--foil', (t.foil/100).toFixed(2));
    el.style.setProperty('--glow', (t.glow/100).toFixed(2));
    el.style.setProperty('--head-font', `'${t.headFont}'`);
    el.setAttribute('data-bg', t.bg);
  }, [t]);

  const addToAlbum = (pulls)=>{
    setCards(prev=>{
      const next = prev.map(c=>({...c, isNew:false}));
      pulls.forEach(p=>{
        const c = next.find(x=>x.id===p.id);
        if(!c) return;
        if(c.owned){ c.dupes = (c.dupes||0)+1; }
        else { c.owned = true; c.isNew = true; }
      });
      return next;
    });
    setTab("album");
  };

  const proponer = ()=>{ setDetail(null); setTab("cambios"); };

  // ruleta: premios
  const onWin = (prize)=>{
    if(!prize) return;
    if(prize.kind==="spend"){ setCoins(c=>Math.max(0,c-prize.amount)); return; }
    if(prize.kind==="coins"){ setCoins(c=>c+prize.amount); }
    else if(prize.kind==="card"){
      const pool = cards.filter(c=>c.rarity===prize.rarity && !c.owned);
      const pick = pool[0] || CARDS.find(c=>c.rarity===prize.rarity);
      if(pick) addToAlbumSilent([pick]);
    }
    // pack prize: no-op visual (lo abrirían en Sobres)
  };

  // tienda: compras
  const onBuy = (item)=>{
    if(item.kind==="iap"){ setCoins(c=>c+250); return; }
    setCoins(c=>Math.max(0,c-item.price));
  };

  // añadir sin cambiar de pestaña (para ruleta)
  const addToAlbumSilent = (pulls)=>{
    setCards(prev=>{
      const next = prev.map(c=>({...c}));
      pulls.forEach(p=>{
        const c = next.find(x=>x.id===p.id); if(!c) return;
        if(c.owned){ c.dupes=(c.dupes||0)+1; } else { c.owned=true; c.isNew=true; }
      });
      return next;
    });
  };

  return (
    <div className="hv-app" ref={rootRef} data-bg={t.bg}>
      <div className="hv-body album-scroll">
        {tab==="feed"      && <FeedScreen coins={coins} />}
        {tab==="album"     && <AlbumScreen cards={cards} onOpen={setDetail} />}
        {tab==="conseguir" && <GetHub coins={coins} onAddToAlbum={addToAlbum} onWin={onWin} onBuy={onBuy} tilt={t.tilt} />}
        {tab==="cambios"   && <CambiosScreen />}
        {tab==="perfil"    && <PerfilScreen cards={cards} />}
      </div>

      <BottomNav tab={tab} setTab={setTab} />

      {detail && <CromoDetail card={detail} onClose={()=>setDetail(null)} onProponer={proponer} tilt={t.tilt} />}

      <TweaksPanel>
        <TweakSection label="Estilo Holo Vault" />
        <TweakColor label="Color acento" value={t.accent}
          options={["#39d6e8","#f06ec0","#5ee08a","#e8c64a","#9b7bff"]}
          onChange={v=>setTweak('accent', v)} />
        <TweakRadio label="Fondo" value={t.bg} options={["azul","carbón","morado"]}
          onChange={v=>setTweak('bg', v)} />
        <TweakSection label="Holografía" />
        <TweakSlider label="Intensidad foil" value={t.foil} min={0} max={100} unit="%"
          onChange={v=>setTweak('foil', v)} />
        <TweakSlider label="Brillo de rareza" value={t.glow} min={0} max={100} unit="%"
          onChange={v=>setTweak('glow', v)} />
        <TweakToggle label="Inclinación 3D" value={t.tilt}
          onChange={v=>setTweak('tilt', v)} />
        <TweakSection label="Tipografía" />
        <TweakRadio label="Titulares" value={t.headFont}
          options={["Chakra Petch","Space Grotesk","Oswald"]}
          onChange={v=>setTweak('headFont', v)} />
      </TweaksPanel>
    </div>
  );
}

function Root(){
  return (
    <div className="hv-stage">
      <IOSDevice dark>
        <App />
      </IOSDevice>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root/>);
