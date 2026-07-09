import {readFileSync,writeFileSync} from "fs";
import * as XLSX from "xlsx";
const parse=(t)=>{const rows=[];let row=[],cell="",q=false;for(let i=0;i<t.length;i++){const c=t[i],n=t[i+1];if(c==='"'){if(q&&n==='"'){cell+='"';i++;}else q=!q;continue;}if(c===","&&!q){row.push(cell);cell="";continue;}if((c==="\n"||c==="\r")&&!q){if(c==="\r"&&n==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell="";continue;}cell+=c;}row.push(cell);if(row.some(x=>x!==""))rows.push(row);return rows;};
const norm=s=>String(s).toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]/g," ").replace(/\b(the|inc|incorporated|llc)\b/g," ").replace(/\s+/g," ").trim();
function lev(a,b){if(Math.abs(a.length-b.length)>4)return 99;const m=a.length,n=b.length;const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=0;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];}
const canon=parse(readFileSync("docs/insurer_company-canonical-export.csv","utf8")).slice(1).map(r=>({disp:r[0],n:norm(r[0])}));
const canonByNorm=new Map(canon.map(c=>[c.n,c.disp]));
const wb=XLSX.read(readFileSync(process.argv[2]),{type:"buffer"});
const src=XLSX.utils.sheet_to_json(wb.Sheets["Insurer"],{header:1,defval:"",raw:false}).slice(1).map(r=>({v:String(r[0]),c:+r[1]||0})).filter(x=>x.v);
const BRANDS=[["GEICO",/geico|government employees/i],["State Farm",/state\s*farm/i],["Progressive",/progressive/i],["Allstate",/allstate/i],["Liberty Mutual",/liberty\s*mutual/i],["Nationwide",/nationwide/i],["Travelers",/travelers/i],["USAA",/usaa|united services auto/i],["National General/Integon",/national general|integon/i],["Hereford",/hereford/i],["American Transit",/american transit/i],["MVAIC",/mvaic|motor vehicle acc/i]];
let exact=[],near=[],brand=[],unmatched=[];
for(const s of src){
  const ns=norm(s.v);
  if(canonByNorm.has(ns)){exact.push({...s,canon:canonByNorm.get(ns)});continue;}
  let best=null,bl=99;for(const c of canon){const l=lev(ns,c.n);if(l<bl){bl=l;best=c.disp;}}
  if(bl<=2){near.push({...s,canon:best,lev:bl});continue;}
  const b=BRANDS.find(([n,re])=>re.test(s.v));
  if(b){brand.push({...s,brand:b[0]});continue;}
  unmatched.push({...s,best,lev:bl});
}
const sum=a=>a.reduce((s,x)=>s+x.c,0);
console.log(`NF insurer values: ${src.length} distinct, ${sum(src).toLocaleString()} rows\n`);
console.log(`TIER 1 EXACT (norm match to a canonical) : ${String(exact.length).padStart(4)} vals  ${String(sum(exact)).padStart(8)} rows`);
console.log(`TIER 2 TYPO/PUNCT (Levenshtein <=2)      : ${String(near.length).padStart(4)} vals  ${String(sum(near)).padStart(8)} rows`);
console.log(`TIER 3 BRAND-GENERIC (needs flagship pick): ${String(brand.length).padStart(4)} vals  ${String(sum(brand)).padStart(8)} rows`);
console.log(`TIER 4 UNMATCHED (review / likely wrong)  : ${String(unmatched.length).padStart(4)} vals  ${String(sum(unmatched)).padStart(8)} rows`);
console.log(`\nBrand-generic rows by brand (Tier 3):`);
for(const [n] of BRANDS){const g=brand.filter(x=>x.brand===n);if(g.length)console.log(`   ${n.padEnd(26)} ${String(g.length).padStart(3)} vals  ${String(sum(g)).padStart(8)} rows`);}
console.log(`\nTier 2 examples (typo/punct -> canonical):`);
near.sort((a,b)=>b.c-a.c).slice(0,12).forEach(x=>console.log(`   ${String(x.c).padStart(5)}  "${x.v}"  ->  "${x.canon}" (lev ${x.lev})`));
console.log(`\nTier 4 top unmatched (review):`);
unmatched.sort((a,b)=>b.c-a.c).slice(0,20).forEach(x=>console.log(`   ${String(x.c).padStart(5)}  "${x.v}"   [nearest: ${x.best}, lev ${x.lev}]`));
const esc=s=>/[",\r\n]/.test(String(s))?'"'+String(s).replace(/"/g,'""')+'"':String(s);
const out=[["nf_value","count","tier","matched_canonical","brand","lev"]];
for(const x of exact)out.push([x.v,x.c,"exact",x.canon,"",0]);
for(const x of near)out.push([x.v,x.c,"typo",x.canon,"",x.lev]);
for(const x of brand)out.push([x.v,x.c,"brand-generic","",x.brand,""]);
for(const x of unmatched)out.push([x.v,x.c,"unmatched",x.best||"",x.lev]);
writeFileSync("docs/nf-insurer-match-preview.csv",out.map(r=>r.map(esc).join(",")).join("\n")+"\n");
console.log(`\nWrote docs/nf-insurer-match-preview.csv`);
