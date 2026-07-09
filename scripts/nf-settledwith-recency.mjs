// SettledWith recency analysis: cross-tab SettledWith x Date Opened.
// Usage: node scripts/nf-settledwith-recency.mjs "/path/to/NF All Closed.xlsx" [YYYY-MM-DD cutoff, default 2024-01-01]
import {readFileSync} from "fs";
import * as XLSX from "xlsx";
const src=process.argv[2];
const cutoff=new Date(process.argv[3]||"2024-01-01");
const wb=XLSX.read(readFileSync(src),{type:"buffer",cellDates:true});
const ws=wb.Sheets[wb.SheetNames[0]];
const range=XLSX.utils.decode_range(ws["!ref"]);
let swCol=-1,doCol=-1;
for(let c=range.s.c;c<=range.e.c;c++){const h=String(ws[XLSX.utils.encode_cell({c,r:range.s.r})]?.w??ws[XLSX.utils.encode_cell({c,r:range.s.r})]?.v??"");if(/^settled\s*with$/i.test(h))swCol=c;if(/^date\s*opened$/i.test(h))doCol=c;}
if(swCol<0||doCol<0){console.error("cols not found: settledWith="+swCol+" dateOpened="+doCol);process.exit(1);}
const nkey=n=>n.toUpperCase().replace(/[^A-Z0-9 ]/g," ").replace(/\s+/g," ").trim();
const isJunk=n=>/^(NO RESPONDENT|UNKNOWN|N\/A|NA|TBD|NONE|PENDING|\?+)$/i.test(n.trim());
const isFirm=n=>/LAW (OFFICE|OFFICES|FIRM)|& ASSOC|\bPLLC\b|\bLLP\b|\bP\.?C\.?\b|ATTORNEY/i.test(n);
const name=v=>{const m=v.match(/^(.*?)\s*=>/);return (m?m[1]:v).trim();};
function toDate(cell){if(!cell)return null;if(cell.v instanceof Date)return cell.v;const s=String(cell.w??cell.v??"");const d=new Date(s);return isNaN(d)?null:d;}
const ppl=new Map(); let totalRows=0, recentRows=0;
for(let r=range.s.r+1;r<=range.e.r;r++){
  const sv=String(ws[XLSX.utils.encode_cell({c:swCol,r})]?.w??ws[XLSX.utils.encode_cell({c:swCol,r})]?.v??"").trim();
  if(!sv)continue; const nm=name(sv); if(isJunk(nm)||isFirm(nm))continue;
  const d=toDate(ws[XLSX.utils.encode_cell({c:doCol,r})]);
  totalRows++; const k=nkey(nm);
  if(!ppl.has(k))ppl.set(k,{name:nm,rows:0,recent:0,latest:null});
  const g=ppl.get(k); g.rows++; if(d){if(!g.latest||d>g.latest)g.latest=d; if(d>=cutoff){g.recent++;recentRows++;}}
}
const all=[...ppl.values()];
const kept50=all.filter(g=>g.rows>=50);                       // current basis
const survivors=kept50.filter(g=>g.recent>0);                 // >=50 all-time AND active since cutoff
const stale=kept50.filter(g=>g.recent===0);
const cut=(a)=>a.reduce((s,g)=>s+g.rows,0);
console.log(`Cutoff: opened on/after ${cutoff.toISOString().slice(0,10)}`);
console.log(`Total adjuster rows (non-firm/junk): ${totalRows.toLocaleString()}  | opened >= cutoff: ${recentRows.toLocaleString()} (${(100*recentRows/totalRows).toFixed(1)}%)`);
console.log(`\nCurrent basis = adjusters with >=50 rows all-time: ${kept50.length}`);
console.log(`  SURVIVE (>=1 matter opened >= cutoff): ${survivors.length}  (${cut(survivors).toLocaleString()} all-time rows)`);
console.log(`  STALE (no matter opened >= cutoff):    ${stale.length}  (${cut(stale).toLocaleString()} all-time rows)`);
console.log(`\nAlternative bases restricted to recent activity:`);
for(const th of [1,10,25,50]){const g=all.filter(x=>x.recent>=th);console.log(`  adjusters with >=${th} matters opened >= cutoff: ${g.length}`);}
console.log(`\nSample STALE adjusters being cut (top 20 by all-time rows, latest open date):`);
stale.sort((a,b)=>b.rows-a.rows).slice(0,20).forEach(g=>console.log(`  ${String(g.rows).padStart(6)} rows  latest ${g.latest?g.latest.toISOString().slice(0,10):"?"}  ${g.name}`));
