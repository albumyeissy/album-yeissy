// ============================================================
// HOLO VAULT — Cromo (holo + flip 3D) + detalle
// ============================================================
const { useState, useRef, useEffect } = React;

// hook: tilt + posición del foil siguiendo el puntero
function useHolo(enabled){
  const ref = useRef(null);
  const onPointerMove = (e)=>{
    const el = ref.current; if(!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left)/r.width;
    const py = (e.clientY - r.top)/r.height;
    el.style.setProperty('--mx', (px*100).toFixed(1)+'%');
    el.style.setProperty('--my', (py*100).toFixed(1)+'%');
    el.style.setProperty('--active','1');
    if(enabled){
      el.style.setProperty('--rx', ((py-.5)*-15).toFixed(2)+'deg');
      el.style.setProperty('--ry', ((px-.5)*17).toFixed(2)+'deg');
    }
  };
  const onPointerLeave = ()=>{
    const el = ref.current; if(!el) return;
    el.style.setProperty('--active','0');
    el.style.setProperty('--rx','0deg');
    el.style.setProperty('--ry','0deg');
  };
  return { ref, onPointerMove, onPointerLeave };
}

function StatBar({ label, value }){
  return (
    <div className="hv-stat">
      <span>{label}</span>
      <i style={{'--v': value+'%'}}></i>
      <b>{value}</b>
    </div>
  );
}

function RarityChip({ r, small }){
  const R = RARITY[r];
  return <span className={"hv-rchip"+(small?" sm":"")} style={{'--rc':R.color, '--rs':R.soft}}>{R.label}</span>;
}

// cara frontal del cromo (contenido)
function CromoFront({ card, big }){
  return (
    <React.Fragment>
      <div className="hv-foil"></div>
      <div className="hv-sheen"></div>
      <div className="hv-card-top">
        <span className="hv-num">#{String(card.num).padStart(2,'0')}</span>
        <RarityChip r={card.rarity} small={!big} />
      </div>
      <div className="hv-photo">
        <span className="hv-init">{initials(card)}</span>
        <span className="hv-variant">{card.variant}</span>
        <span className="hv-flabel">foto</span>
      </div>
      <div className="hv-name">{card.name}</div>
      <div className="hv-mote">“{card.mote}”</div>
      {big && (
        <div className="hv-stats">
          <StatBar label="RISAS"   value={card.stats.risas} />
          <StatBar label="SALSEO"  value={card.stats.salseo} />
          <StatBar label="AGUANTE" value={card.stats.aguante} />
        </div>
      )}
    </React.Fragment>
  );
}

// Cromo grande con flip (para el detalle y los sobres)
function Cromo({ card, w=270, tilt=true, flippable=true, flipped:flippedProp, onFlip }){
  const holo = useHolo(tilt);
  const [flippedState, setFlipped] = useState(false);
  const flipped = flippedProp!==undefined ? flippedProp : flippedState;
  const toggle = ()=>{
    if(!flippable) return;
    if(onFlip) onFlip(); else setFlipped(f=>!f);
  };
  const R = RARITY[card.rarity];
  return (
    <div className={"hv-card-outer rar-"+card.rarity} ref={holo.ref}
         onPointerMove={holo.onPointerMove} onPointerLeave={holo.onPointerLeave}
         style={{ '--rc':R.color, '--rs':R.soft, width:w, height:w/0.7 }}>
      <div className={"hv-card-inner"+(flipped?" flipped":"")} onClick={toggle}>
        <div className="hv-face hv-front">
          <CromoFront card={card} big={true} />
        </div>
        <div className="hv-face hv-back">
          <div className="hv-back-grid"></div>
          <div className="hv-back-logo">HOLO<br/>VAULT</div>
          <div className="hv-back-num">#{String(card.num).padStart(2,'0')}</div>
          <div className="hv-back-name">{card.name}</div>
          <RarityChip r={card.rarity} />
          <p className="hv-back-fact">{card.fact}</p>
          <div className="hv-back-tag">TEMPORADA 1 · ÁLBUM YEISSY</div>
        </div>
      </div>
    </div>
  );
}

// cromo mini para la cuadrícula del álbum
function MiniCromo({ card, onClick }){
  const holo = useHolo(false);
  const R = RARITY[card.rarity];
  if(!card.owned){
    return (
      <button className="hv-slot empty" onClick={onClick}>
        <b>#{String(card.num).padStart(2,'0')}</b>
        <small>POR CONSEGUIR</small>
      </button>
    );
  }
  return (
    <button className={"hv-slot filled rar-"+card.rarity} ref={holo.ref}
            onPointerMove={holo.onPointerMove} onPointerLeave={holo.onPointerLeave}
            onClick={onClick} style={{'--rc':R.color,'--rs':R.soft}}>
      <div className="hv-foil"></div>
      <span className="hv-slot-num">#{String(card.num).padStart(2,'0')}</span>
      {card.isNew && <span className="hv-new">NUEVO</span>}
      {card.dupes>0 && <span className="hv-dupe">×{card.dupes+1}</span>}
      <div className="hv-slot-photo"><span>{initials(card)}</span></div>
      <div className="hv-slot-foot">
        <span className="hv-slot-name">{card.name}</span>
        <i className="hv-slot-rdot" style={{background:R.color}}></i>
      </div>
    </button>
  );
}

// ── Detalle a pantalla completa ──
function CromoDetail({ card, onClose, onProponer, tilt=true }){
  const [flipped, setFlipped] = useState(false);
  const R = RARITY[card.rarity];
  return (
    <div className="hv-detail" onClick={onClose}>
      <div className="hv-detail-inner" onClick={e=>e.stopPropagation()}>
        <button className="hv-x" onClick={onClose} aria-label="Cerrar">✕</button>
        <Cromo card={card} w={258} tilt={tilt} flipped={flipped} onFlip={()=>setFlipped(f=>!f)} />
        <div className="hv-detail-hint">toca la carta para girarla ✦ mueve para ver el holo</div>

        <div className="hv-detail-meta">
          <div className="hv-detail-line">
            <span className="hv-dl-k">Variante</span>
            <span className="hv-dl-v">{card.variant}</span>
          </div>
          <div className="hv-detail-line">
            <span className="hv-dl-k">Rareza</span>
            <span className="hv-dl-v" style={{color:R.color}}>{R.label}</span>
          </div>
          <div className="hv-detail-line">
            <span className="hv-dl-k">Estado</span>
            <span className="hv-dl-v">
              {card.owned ? (card.dupes>0 ? `Tienes ${card.dupes+1} · ${card.dupes} repe${card.dupes>1?'s':''}` : "En tu álbum") : "Te falta"}
            </span>
          </div>
        </div>

        {card.owned && card.dupes>0 && (
          <button className="hv-btn primary" onClick={()=>onProponer(card)}>
            Proponer cambio con esta repe
          </button>
        )}
        {!card.owned && (
          <button className="hv-btn ghost" onClick={()=>onProponer(card)}>
            Buscar cambio · pídela al grupo
          </button>
        )}
        {card.owned && card.dupes===0 && (
          <div className="hv-btn done">✓ Pegada en el álbum</div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { useHolo, Cromo, MiniCromo, CromoDetail, StatBar, RarityChip, CromoFront });
