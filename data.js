/* Pokémon GO base stats and forms: PvPoke's public Game Master. */
const GM_URL = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json';
const CPM = [0.0939999967813491,0.135137430784308,0.166397869586944,0.192650914456886,0.215732470154762,0.236572655026622,0.255720049142837,0.273530381100769,0.290249884128570,0.306057381335773,0.321087598800659,0.335445032295077,0.349212676286697,0.362457748778790,0.375235587358474,0.387592411085168,0.399567276239395,0.411193549517250,0.422500014305114,0.432926413410414,0.443107545375824,0.453059953871985,0.462798386812210,0.472336077786704,0.481684952974319,0.490855810259008,0.499858438968658,0.508701756943992,0.517393946647644,0.525942508771329,0.534354329109191,0.542635762230353,0.550792694091796,0.558830599438087,0.566754519939422,0.574569148039264,0.582278907299041,0.589887911977272,0.597400009632110,0.604823657502073,0.612157285213470,0.619404110566050,0.626567125320434,0.633649181622743,0.640652954578399,0.647580963301656,0.654435634613037,0.661219263506722,0.667934000492096,0.674581899290818,0.681164920330047,0.687684905887771,0.694143652915954,0.700542893277978,0.706884205341339,0.713169102333341,0.719399094581604,0.725575616972598,0.731700003147125,0.734741011137376,0.737769484519958,0.740785574597326,0.743789434432983,0.746781208702482,0.749761044979095,0.752729105305821,0.755685508251190,0.758630366519684,0.761563837528228,0.764486065255226,0.767397165298461,0.770297273971590,0.773186504840850,0.776064945942412,0.778932750225067,0.781790064808426,0.784636974334716,0.787473583646825,0.790300011634826,0.792803950958807,0.795300006866455,0.797803921486970,0.800300002098083,0.802803892322847,0.805299997329711,0.807803863460723,0.810299992561340,0.812803834895026,0.815299987792968,0.817803806620319,0.820299983024597,0.822803778631297,0.825299978256225,0.827803750922782,0.830299973487854,0.832803753381377,0.835300028324127,0.837803755931569,0.840300023555755,0.842803729034748,0.845300018787384,0.847803702398935,0.850300014019012,0.852803676019539,0.855300009250640,0.857803649892077,0.860300004482269,0.862803624012168,0.865299999713897];

function openDatabase(){return new Promise((resolve,reject)=>{const req=indexedDB.open('iv-scout-data',1);req.onupgradeneeded=()=>req.result.createObjectStore('cache');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function cacheGet(){try{const db=await openDatabase();return await new Promise((resolve,reject)=>{const req=db.transaction('cache').objectStore('cache').get('pokemon');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}catch{return null}}
async function cachePut(value){try{const db=await openDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('cache','readwrite');tx.objectStore('cache').put(value,'pokemon');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch{}}
async function loadPokemonData(onStatus=()=>{}){
  onStatus('Loading Pokémon data…');
  try{
    const response=await fetch(GM_URL,{cache:'no-cache'});if(!response.ok)throw new Error('Game data request failed');
    const master=await response.json();const source=master.pokemon||master;
    const data=source.filter(p=>p.speciesId&&p.speciesName&&p.baseStats&&p.baseStats.atk>0&&p.baseStats.def>0&&p.baseStats.hp>0)
      .map(p=>({id:p.speciesId,name:p.speciesName,dex:p.dex||0,atk:p.baseStats.atk,def:p.baseStats.def,hp:p.baseStats.hp,alias:p.aliasId||null,levelCap:Math.min(50,p.levelCap||50)}));
    const result={timestamp:master.timestamp||new Date().toISOString(),pokemon:data};await cachePut(result);return result;
  }catch(error){const cached=await cacheGet();if(cached){onStatus('Using saved Pokémon data');return cached}throw error}
}
function cpAt(p,iv,level){const m=CPM[Math.round(level*2-2)];return Math.max(10,Math.floor((p.atk+iv[0])*Math.sqrt(p.def+iv[1])*Math.sqrt(p.hp+iv[2])*m*m/10))}
function statsAt(p,iv,level){const m=CPM[Math.round(level*2-2)];const a=(p.atk+iv[0])*m,d=(p.def+iv[1])*m,h=p.id==='shedinja'?10:Math.max(10,Math.floor((p.hp+iv[2])*m));return {cp:Math.max(10,Math.floor(a*Math.sqrt((p.def+iv[1])*(p.hp+iv[2]))*m/10)),sp:a*d*h}}
function calculateRank(p,targetIV,cpCap,maxLevel=50){
  const entries=[];
  for(let a=0;a<=15;a++)for(let d=0;d<=15;d++)for(let h=0;h<=15;h++){
    let best=null;for(let half=2;half<=maxLevel*2;half++){const level=half/2,st=statsAt(p,[a,d,h],level);if(st.cp>cpCap)break;best={...st,level}}
    if(best)entries.push({iv:[a,d,h],...best});
  }
  entries.sort((x,y)=>y.sp-x.sp||x.iv[0]-y.iv[0]||y.iv[1]-x.iv[1]||y.iv[2]-x.iv[2]);
  const ix=entries.findIndex(x=>x.iv[0]===targetIV[0]&&x.iv[1]===targetIV[1]&&x.iv[2]===targetIV[2]);
  return ix<0?null:{rank:ix+1,total:entries.length,percent:entries.length?entries[ix].sp/entries[0].sp*100:0,...entries[ix]};
}
window.PokemonData={loadPokemonData,calculateRank,cpAt,statsAt};
