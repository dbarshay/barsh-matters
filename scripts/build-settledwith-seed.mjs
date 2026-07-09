// SettledWith -> "Settlement Contacts" reference list (ReferenceEntity type "individual").
// Reads FULL NF xlsx (SettledWith + Date Opened). Clusters, fuzzy-merges dupes, drops firms/junk/"&",
// reconciles display names to the live table (docs/individual-canonical-export.csv).
// KEEP RULE: all-time > FLOOR AND (matters opened >= CUTOFF >= MIN_RECENT  OR  >=1 matter opened in 2026).
// Usage: node scripts/build-settledwith-seed.mjs "<xlsx>" [floor=25] [cutoff=2025-01-01] ["<worksheet.xlsx>"]
import {readFileSync,writeFileSync,copyFileSync,existsSync} from "fs";
import {resolve} from "path";
import * as XLSX from "xlsx";
const REPO=resolve(process.cwd());
const XLSXPATH=process.argv[2], FLOOR=Number(process.argv[3]||25), CUTOFF=new Date(process.argv[4]||"2025-01-01"), WS=process.argv[5]||"";
const MIN_RECENT=10;                    // "less than 10 since cutoff" gets culled...
const Y2026=new Date("2026-01-01");     // ...unless they have >=1 matter opened in 2026

const norm=v=>String(v??"").toLowerCase().replace(/[’']/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const nkey=n=>n.toUpperCase().replace(/[^A-Z0-9 ]/g," ").replace(/\s+/g," ").trim();
const cleanPF=x=>{x=String(x).trim();return /^(NA|N\/A|UNKNOWN|-|)$/i.test(x)?"":x;};
const isJunk=n=>/^(NO RESPONDENT|UNKNOWN|N\/A|NA|TBD|NONE|PENDING|\?+)$/i.test(n.trim());
const isFirm=n=>/LAW (OFFICE|OFFICES|FIRM)|& ASSOC|\bPLLC\b|\bLLP\b|\bP\.?C\.?\b|ATTORNEY|&/i.test(n);
const pname=v=>{const m=v.match(/^(.*?)\s*=>/);return (m?m[1]:v).trim();};
const pphfax=v=>{const m=v.match(/ADJ\.PH#:\s*(.*?)\s*\/ADJ FAX#:\s*(.*?)\s*\]/i);return m?{ph:m[1].trim(),fax:m[2].trim()}:{ph:"",fax:""};};
function title(n){return n.toLowerCase().split(/\s+/).map(w=>w.split("-").map(p=>p?p[0].toUpperCase()+p.slice(1):p).join("-")).join(" ").replace(/\b([a-z])\b/g,c=>c.toUpperCase());}
function lev(a,b){const m=a.length,n=b.length;const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=0;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];}
function toDate(cell){if(!cell)return null;if(cell.v instanceof Date)return cell.v;const s=String(cell.w??cell.v??"");const d=new Date(s);return isNaN(d)?null:d;}
const MERGE_DENY=new Set(["kevon lewis|kevin lewis"]);

const existingMap=new Map();
if(existsSync(resolve(REPO,"docs/individual-canonical-export.csv"))){
  const p=(t)=>{const rows=[];let row=[],cell="",q=false;for(let i=0;i<t.length;i++){const c=t[i],n=t[i+1];if(c==='"'){if(q&&n==='"'){cell+='"';i++;}else q=!q;continue;}if(c===","&&!q){row.push(cell);cell="";continue;}if((c==="\n"||c==="\r")&&!q){if(c==="\r"&&n==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell="";continue;}cell+=c;}row.push(cell);if(row.some(x=>x!==""))rows.push(row);return rows;};
  for(const r of p(readFileSync(resolve(REPO,"docs/individual-canonical-export.csv"),"utf8")).slice(1)){const disp=r[0];existingMap.set(norm(disp),disp);(r[2]||"").split(";").filter(Boolean).forEach(a=>{if(!existingMap.has(norm(a)))existingMap.set(norm(a),disp);});}
}

const wb=XLSX.read(readFileSync(XLSXPATH),{type:"buffer",cellDates:true});
const ws=wb.Sheets[wb.SheetNames[0]];const range=XLSX.utils.decode_range(ws["!ref"]);
let swCol=-1,doCol=-1;
for(let c=range.s.c;c<=range.e.c;c++){const h=String(ws[XLSX.utils.encode_cell({c,r:range.s.r})]?.w??ws[XLSX.utils.encode_cell({c,r:range.s.r})]?.v??"");if(/^settled\s*with$/i.test(h))swCol=c;if(/^date\s*opened$/i.test(h))doCol=c;}
if(swCol<0||doCol<0){console.error("cols not found");process.exit(1);}

const cl=new Map(),srcToKey=new Map();
for(let r=range.s.r+1;r<=range.e.r;r++){
  const sv=String(ws[XLSX.utils.encode_cell({c:swCol,r})]?.w??ws[XLSX.utils.encode_cell({c:swCol,r})]?.v??"").trim();
  if(!sv)continue;const nm=pname(sv);if(isJunk(nm)||isFirm(nm)){srcToKey.set(sv,null);continue;}
  const k=nkey(nm);srcToKey.set(sv,k);const d=toDate(ws[XLSX.utils.encode_cell({c:doCol,r})]);
  if(!cl.has(k))cl.set(k,{name:nm,all:0,recent:0,y2026:0,latest:null,src:new Map(),ph:new Map(),fax:new Map()});
  const g=cl.get(k);g.all++;if(d){if(!g.latest||d>g.latest)g.latest=d;if(d>=CUTOFF)g.recent++;if(d>=Y2026)g.y2026++;}
  g.src.set(sv,(g.src.get(sv)||0)+1);const pf=pphfax(sv);const ph=cleanPF(pf.ph),fx=cleanPF(pf.fax);if(ph)g.ph.set(ph,(g.ph.get(ph)||0)+1);if(fx)g.fax.set(fx,(g.fax.get(fx)||0)+1);
}
const arr=[...cl.values()];const par=arr.map((_,i)=>i);const find=x=>par[x]===x?x:(par[x]=find(par[x]));const uni=(a,b)=>{par[find(a)]=find(b);};
for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
  const a=norm(arr[i].name),b=norm(arr[j].name);if(MERGE_DENY.has([a,b].sort().join("|")))continue;
  const at=a.split(" "),bt=b.split(" "),asur=at[at.length-1],bsur=bt[bt.length-1],af=at[0],bf=bt[0];let dup=false;
  if(a!==b&&lev(a,b)<=1)dup=true;else if(asur===bsur&&asur.length>3&&at.length>1&&bt.length>1){if(af===bf)dup=true;else if(af[0]===bf[0]&&(af.length<=2||bf.length<=2))dup=true;else if(lev(af,bf)<=1)dup=true;}
  if(dup)uni(i,j);
}
const groups=new Map();arr.forEach((g,i)=>{const root=find(i);(groups.get(root)||groups.set(root,[]).get(root)).push(g);});
const people=[];
for(const gs of groups.values()){gs.sort((x,y)=>y.all-x.all);const rep=gs[0];const m={name:rep.name,all:0,recent:0,y2026:0,latest:null,src:new Map(),ph:new Map(),fax:new Map(),variants:gs.length};
  for(const g of gs){m.all+=g.all;m.recent+=g.recent;m.y2026+=g.y2026;if(g.latest&&(!m.latest||g.latest>m.latest))m.latest=g.latest;for(const[s,c]of g.src)m.src.set(s,(m.src.get(s)||0)+c);for(const[p,c]of g.ph)m.ph.set(p,(m.ph.get(p)||0)+c);for(const[f,c]of g.fax)m.fax.set(f,(m.fax.get(f)||0)+c);}people.push(m);}
const best=m=>[...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||"";
const kept=people.filter(p=>p.all>FLOOR&&(p.recent>=MIN_RECENT||p.y2026>=1)).sort((a,b)=>b.all-a.all);

const csvCell=s=>/[",\r\n]/.test(String(s))?`"${String(s).replace(/"/g,'""')}"`:String(s);
const seed=[["displayName","aliases","active","notes","phone","fax","role","settledWith"]];
const srcCanon=new Map();let reconciled=0;
for(const p of kept){
  let disp=title(p.name);
  if(existingMap.has(norm(disp))&&existingMap.get(norm(disp))!==disp){disp=existingMap.get(norm(disp));reconciled++;}
  const aliases=[...new Map([...p.src.entries()].map(([s,c])=>[norm(s),{s,c}]).filter(([nv])=>nv&&nv!==norm(disp))).values()].sort((a,b)=>b.c-a.c).map(x=>x.s);
  seed.push([disp,aliases.join(";"),"TRUE",`Settled With contact; all-time ${p.all}, since ${CUTOFF.toISOString().slice(0,10)}: ${p.recent}, 2026: ${p.y2026}`,best(p.ph),best(p.fax),"Settled With","true"]);
  for(const s of p.src.keys())srcCanon.set(s,disp);
}
writeFileSync(resolve(REPO,"docs/nf-settledwith-seed.csv"),seed.map(r=>r.map(csvCell).join(",")).join("\n")+"\n","utf8");
const map=[["Source","Canonical","Note"]];
for(const s of new Set([...srcToKey.keys()])){const canon=srcCanon.get(s)||"";const k=srcToKey.get(s);map.push([s,canon,canon?"kept":(k===null?"dropped: firm/junk/&":"dropped: below basis")]);}
writeFileSync(resolve(REPO,"docs/nf-settledwith-mapping.csv"),map.map(r=>r.map(csvCell).join(",")).join("\n")+"\n","utf8");
if(WS&&existsSync(WS)){copyFileSync(WS,WS.replace(/\.xlsx$/,".bak.xlsx"));const w2=XLSX.read(readFileSync(WS),{type:"buffer"});const wr=XLSX.utils.sheet_to_json(w2.Sheets["SettledWith"],{header:1,defval:"",raw:false});const out=[wr[0]];for(let i=1;i<wr.length;i++){const s=String(wr[i][0]);out.push([wr[i][0],wr[i][1],srcCanon.get(s)||"",srcCanon.get(s)?"kept":"dropped"]);}w2.Sheets["SettledWith"]=XLSX.utils.aoa_to_sheet(out);writeFileSync(WS,XLSX.write(w2,{type:"buffer",bookType:"xlsx"}));}

console.log(`KEEP RULE: all-time > ${FLOOR} AND (>= ${MIN_RECENT} matters since ${CUTOFF.toISOString().slice(0,10)}  OR  >=1 matter opened in 2026)`);
console.log(`Clusters pre-merge ${cl.size} | after merge ${people.length}`);
console.log(`KEPT: ${kept.length}  | reconciled to existing spelling: ${reconciled}`);
const keptOn2026=kept.filter(p=>p.recent<MIN_RECENT&&p.y2026>=1).length;
console.log(`  kept ONLY because of a 2026 matter (since-2025 < ${MIN_RECENT}): ${keptOn2026}`);
console.log(`With phone ${kept.filter(p=>p.ph.size).length} | fax ${kept.filter(p=>p.fax.size).length}`);
console.log(`\nWrote docs/nf-settledwith-seed.csv (+ mapping)`);
