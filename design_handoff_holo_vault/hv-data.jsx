// ============================================================
// HOLO VAULT — datos del álbum
// ============================================================

const RARITY = {
  comun:      { key:"comun",      label:"COMÚN",      w:0, color:"oklch(0.74 0.03 265)", soft:"oklch(0.5 0.04 265)" },
  raro:       { key:"raro",       label:"RARO",       w:1, color:"oklch(0.76 0.15 230)", soft:"oklch(0.5 0.13 230)" },
  epico:      { key:"epico",      label:"ÉPICO",      w:2, color:"oklch(0.72 0.2 300)",  soft:"oklch(0.5 0.18 300)" },
  legendario: { key:"legendario", label:"LEGENDARIO", w:3, color:"oklch(0.83 0.13 85)",  soft:"oklch(0.6 0.13 85)"  },
  mitico:     { key:"mitico",     label:"MÍTICO",     w:4, color:"oklch(0.68 0.22 18)",  soft:"oklch(0.5 0.2 18)"   },
};
const RARITY_ORDER = ["comun","raro","epico","legendario","mitico"];

// los 6 del grupo + el avatar del usuario (eres JC)
const FRIENDS = {
  JC:     { key:"JC",     name:"JC",     mote:"El Capitán",  hue:200, fact:"Organiza todos los planes del grupo. Sin él no sale nada." },
  Sergio: { key:"Sergio", name:"Sergio", mote:"El Crack",    hue:150, fact:"Siempre llega 40 minutos tarde. Siempre." },
  Coke:   { key:"Coke",   name:"Coke",   mote:"El Salsa",    hue:350, fact:"DJ oficial. Si suena reguetón, ha sido él." },
  Noel:   { key:"Noel",   name:"Noel",   mote:"El Tanque",   hue:60,  fact:"No falla un finde ni con 39 de fiebre." },
  Juanma: { key:"Juanma", name:"Juanma", mote:"El Mago",     hue:270, fact:"Desaparece en mitad de la fiesta. Nadie sabe cómo." },
  Robert: { key:"Robert", name:"Robert", mote:"El Fantasma", hue:310, fact:"El más random. Aparece una vez al mes." },
};

const ME = "JC";

// helper para construir un cromo
let _id = 0;
function C(who, variant, rarity, stats, ownedSpec){
  const f = FRIENDS[who] || { name:who, mote:"", hue:200, fact:"" };
  _id += 1;
  return {
    id: _id,
    num: _id,
    who,
    name: f.name,
    mote: f.mote,
    hue: f.hue,
    fact: f.fact,
    variant,                       // BASE / ACCIÓN / LEYENDA / ESPECIAL
    rarity,
    stats,                         // {risas, salseo, aguante}
    owned: ownedSpec.owned,
    dupes: ownedSpec.dupes || 0,   // repes extra (para intercambiar)
    isNew: ownedSpec.isNew || false,
  };
}

// stats helper
const S = (r,s,a)=>({risas:r, salseo:s, aguante:a});

// ── EL ÁLBUM ── (variantes por persona, estilo Panini: base / acción / leyenda)
const CARDS = [
  // JC
  C("JC","BASE","raro", S(92,70,95), {owned:true, dupes:1}),
  C("JC","ACCIÓN","epico", S(90,72,96), {owned:true}),
  C("JC","LEYENDA","legendario", S(95,75,99), {owned:true, isNew:true}),
  // Sergio
  C("Sergio","BASE","comun", S(80,88,72), {owned:true, dupes:2}),
  C("Sergio","ACCIÓN","epico", S(82,90,70), {owned:false}),
  C("Sergio","LEYENDA","legendario", S(85,92,74), {owned:false}),
  // Coke
  C("Coke","BASE","comun", S(85,99,60), {owned:true}),
  C("Coke","ACCIÓN","raro", S(86,99,62), {owned:true, dupes:1}),
  C("Coke","LEYENDA","legendario", S(88,99,64), {owned:false}),
  // Noel
  C("Noel","BASE","comun", S(66,50,90), {owned:true, dupes:3}),
  C("Noel","ACCIÓN","raro", S(68,52,92), {owned:true}),
  C("Noel","LEYENDA","epico", S(70,55,95), {owned:false}),
  // Juanma
  C("Juanma","BASE","comun", S(78,75,70), {owned:true}),
  C("Juanma","ACCIÓN","raro", S(80,77,72), {owned:false}),
  C("Juanma","LEYENDA","epico", S(82,80,74), {owned:true, dupes:1}),
  // Robert
  C("Robert","BASE","raro", S(70,82,88), {owned:false}),
  C("Robert","ACCIÓN","epico", S(72,84,90), {owned:true}),
  C("Robert","LEYENDA","mitico", S(75,88,93), {owned:false}),
];

// dos cartas especiales del set
CARDS.push(
  (function(){ _id+=1; return {
    id:_id, num:_id, who:"GRUPO", name:"EL GRUPO", mote:"Temporada 1", hue:195,
    fact:"La foto que lo empezó todo. La más buscada del álbum.",
    variant:"ESPECIAL", rarity:"mitico", stats:S(99,99,99),
    owned:false, dupes:0, isNew:false }; })(),
  (function(){ _id+=1; return {
    id:_id, num:_id, who:"GRUPO", name:"LA RESACA", mote:"Domingo 09:00", hue:30,
    fact:"Todos la tienen. Nadie la quiere.",
    variant:"ESPECIAL", rarity:"comun", stats:S(40,20,15),
    owned:true, dupes:4, isNew:false }; })(),
);

const TOTAL = CARDS.length;
const OWNED_COUNT = CARDS.filter(c=>c.owned).length;

// ── RANKING del grupo ──
const LEADERBOARD = [
  { who:"Coke",   pct:90, cromos:36, legendarias:4, sobres:128 },
  { who:"JC",     pct: Math.round(OWNED_COUNT/TOTAL*100), cromos:OWNED_COUNT, legendarias:CARDS.filter(c=>c.owned&&(c.rarity==='legendario'||c.rarity==='mitico')).length, sobres:96 },
  { who:"Noel",   pct:70, cromos:28, legendarias:2, sobres:80 },
  { who:"Sergio", pct:55, cromos:22, legendarias:1, sobres:64 },
  { who:"Juanma", pct:45, cromos:18, legendarias:1, sobres:51 },
  { who:"Robert", pct:30, cromos:12, legendarias:0, sobres:40 },
].sort((a,b)=>b.pct-a.pct);

// repes que tienes para intercambiar
function myDupes(){ return CARDS.filter(c=>c.owned && c.dupes>0); }
// cromos que te faltan
function myMissing(){ return CARDS.filter(c=>!c.owned); }

// propuestas de intercambio entrantes
const INCOMING_TRADES = [
  { id:1, from:"Coke",   giveId:5,  wantId:8  },  // te ofrece Sergio-Acción por Coke-Acción
  { id:2, from:"Noel",   giveId:16, wantId:10 },  // te ofrece Robert-Base por Noel-Base
];

function cardById(id){ return CARDS.find(c=>c.id===id); }
function initials(card){
  if(card.who==="GRUPO") return card.name==="EL GRUPO" ? "★" : "Z";
  return card.who.slice(0,2).toUpperCase();
}

// ── RULETA (premios del giro diario) ──
const WHEEL = [
  { id:0, kind:"coins",  amount:50,  label:"+50",      color:"oklch(0.74 0.03 265)" },
  { id:1, kind:"pack",   amount:1,   label:"SOBRE",    color:"oklch(0.76 0.15 230)" },
  { id:2, kind:"coins",  amount:20,  label:"+20",      color:"oklch(0.74 0.03 265)" },
  { id:3, kind:"card",   rarity:"epico", label:"ÉPICO",color:"oklch(0.72 0.2 300)" },
  { id:4, kind:"coins",  amount:100, label:"+100",     color:"oklch(0.83 0.13 85)" },
  { id:5, kind:"coins",  amount:10,  label:"+10",      color:"oklch(0.74 0.03 265)" },
  { id:6, kind:"card",   rarity:"legendario", label:"LEGEND.", color:"oklch(0.83 0.13 85)" },
  { id:7, kind:"coins",  amount:30,  label:"+30",      color:"oklch(0.74 0.03 265)" },
];

// ── TIENDA ──
const SHOP = [
  { id:"daily3",  name:"Pack de 3 sobres", desc:"3 sobres diarios de golpe", price:120, kind:"pack", n:3, badge:null, vis:"pack" },
  { id:"mega",    name:"Mega sobre PRO",   desc:"5 cromos · legendaria asegurada", price:300, kind:"mega", badge:"POPULAR", vis:"mega" },
  { id:"pick",    name:"Elige un cromo",   desc:"Escoge cualquier cromo que te falte", price:500, kind:"pick", badge:"PRO", vis:"pick" },
  { id:"coins",   name:"Bolsa de monedas", desc:"+250 monedas al instante", price:0, kind:"iap", badge:null, vis:"coins" },
  { id:"frame",   name:"Marco animado",    desc:"Marco holo para tu perfil", price:200, kind:"cosmetic", badge:null, vis:"frame" },
  { id:"slot",    name:"Hueco extra",      desc:"Guarda 5 repes más para cambiar", price:80, kind:"util", badge:null, vis:"slot" },
];

// ── FEED (actividad del grupo) ──
const FEED = [
  { id:1, who:"Coke",   t:"hace 5 min", type:"pull",  text:"sacó a", cardId:18, rarity:"mitico" },
  { id:2, who:"Noel",   t:"hace 20 min",type:"trade", text:"cambió con", with:"Sergio", cardId:10 },
  { id:3, who:"Juanma", t:"hace 1 h",   type:"wheel", text:"ganó 100 monedas en la ruleta" },
  { id:4, who:"JC",     t:"hace 2 h",   type:"complete", text:"completó la página de", who2:"JC", pct:100 },
  { id:5, who:"Robert", t:"hace 3 h",   type:"pull",  text:"sacó a", cardId:6, rarity:"comun" },
  { id:6, who:"Sergio", t:"ayer",       type:"join",  text:"se unió al álbum 🎉" },
];

Object.assign(window, { WHEEL, SHOP, FEED });

Object.assign(window, {
  RARITY, RARITY_ORDER, FRIENDS, ME, CARDS, TOTAL, OWNED_COUNT,
  LEADERBOARD, INCOMING_TRADES, myDupes, myMissing, cardById, initials,
});
