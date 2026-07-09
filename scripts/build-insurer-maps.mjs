import {readFileSync,writeFileSync} from "fs";
import * as XLSX from "xlsx";
const parse=(t)=>{const rows=[];let row=[],cell="",q=false;for(let i=0;i<t.length;i++){const c=t[i],n=t[i+1];if(c==='"'){if(q&&n==='"'){cell+='"';i++;}else q=!q;continue;}if(c===","&&!q){row.push(cell);cell="";continue;}if((c==="\n"||c==="\r")&&!q){if(c==="\r"&&n==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell="";continue;}cell+=c;}row.push(cell);if(row.some(x=>x!==""))rows.push(row);return rows;};
const loose=s=>String(s).toLowerCase().replace(/[’']/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const EXP={co:"company",cos:"companies",ins:"insurance",corp:"corporation",cas:"casualty",mut:"mutual",natl:"national",nat:"national",assur:"assurance",assn:"association",amer:"american",prop:"property",und:"underwriters",indem:"indemnity"};
function tight(s){let x=String(s).toLowerCase();x=x.replace(/\b(d\/b\/a|c\/o|f\/k\/a|a\/k\/a)\b.*/g," ");x=x.replace(/,?\s*(si|inc|inc\.|llc|ltd|l\.l\.c\.)\b/g," ");x=x.replace(/&/g," and ");const toks=x.split(/[^a-z0-9]+/).filter(Boolean).map(t=>EXP[t]||t).filter(t=>!["the","a","an","of"].includes(t));return toks.join("");}
const canon=parse(readFileSync("docs/insurer_company-canonical-export.csv","utf8")).slice(1).map(r=>r[0]);
const byLoose=new Map(),byTight=new Map(),tightDup=new Set();
for(const c of canon){byLoose.set(loose(c),c);const t=tight(c);if(byTight.has(t)&&byTight.get(t)!==c)tightDup.add(t);else byTight.set(t,c);}

// REGISTRY-alias rules: true equivalents of EXISTING canonicals (unique), safe for ALL imports.
const CANON_ALIAS=[
 [/new york central mutual/i,"New York Central Mutual Fire Insurance Company"],
 [/clear blue/i,"Clear Blue Insurance Company"],
 [/countrywide|country wide/i,"Country-Wide Insurance Company"],
];
// LEGACY-only curated singles (bulk map, not registry)
const SINGLES=[
 [/bristol\s*west/i,"21st Century Casualty Company","curated (REVIEW: Bristol West usually Farmers)"],
 [/republic\s*western/i,"Repwest Insurance Company","curated"],
 [/mv[ia]{2}c|motor vehicle acc/i,"Motor Vehicle Accident Indemnification Corporation","curated (+MVIAC typo)"],
 [/nycta|mta.*transit|new york city transit|nyc transit/i,"New York City Transit Authority","self-insured"],
 [/\bavis\b/i,"Avis Rent a Car","rental self-insured"],
 [/enterprise|elrac|rental claims/i,"Elrac, Inc. d/b/a Enterprise Rent a Car","rental self-insured (+Rental Claims Svcs)"],
 [/sedgw?e?ick/i,"Sedgwick Claims","TPA (+Sedgewick typo)"],
 [/\besis\b/i,"ESIS Insurance Company","TPA"],
 [/comptroller/i,"The City of New York Office of The Comptroller","govt self-insured"],
];
// brand-generic flagships (bulk map)
const BRANDS=[
 [/geico/i,"Government Employees Insurance Company"],
 [/state\s*farm/i,"State Farm Mutual Automobile Insurance Company"],
 [/progressive/i,"Progressive Casualty Insurance Company"],
 [/all\s*state/i,"Allstate Insurance Company"],
 [/liberty\s*mutual/i,"Liberty Mutual Insurance Company"],
 [/usaa|ussa|united services auto/i,"USAA Casualty Insurance Company"],
 [/nationwide/i,"Nationwide Property and Casualty Insurance Company"],
 [/farmers/i,"Farmers Property and Casualty Insurance Company"],
 [/safeco/i,"Safeco National Insurance Company"],
 [/national general|integon/i,"National General Insurance Company"],
 [/plymouth\s*rock/i,"Plymouth Rock Assurance Corporation of New York"],
 [/mercury/i,"Mercury Casualty Company"],
 [/travelers/i,"Travelers Property Casualty Company of America"],
 [/hartford/i,"Hartford Underwriters Insurance Company"],
 [/kemper/i,"Kemper Independence Insurance Company"],
 [/metropolitan|metlife|met life/i,"Metropolitan General Insurance Company"],
 [/hanover/i,"Hanover Insurance Company"],
 [/infinity/i,"Infinity Insurance Company"],
 [/21\s*(st)?\s*century/i,"21st Century Insurance Company"],
];
const DROP=[/no insurer selected|^none$|^n\/a$|unknown/i];

const wb=XLSX.read(readFileSync(process.argv[2]),{type:"buffer"});
const src=XLSX.utils.sheet_to_json(wb.Sheets["Insurer"],{header:1,defval:"",raw:false}).slice(1).map(r=>({v:String(r[0]),c:+r[1]||0})).filter(x=>x.v);
const aliasesByCanon=new Map(); const legacy=[]; const unmatched=[]; const dropped=[]; let exactN=0,exactRows=0;
const addAlias=(cn,s)=>{(aliasesByCanon.get(cn)||aliasesByCanon.set(cn,[]).get(cn)).push(s);};
for(const s of src){
  if(DROP.some(re=>re.test(s.v))){dropped.push(s);continue;}
  const t=tight(s.v);
  if(byTight.has(t)&&!tightDup.has(t)){const cn=byTight.get(t);if(byLoose.get(loose(s.v))===cn){exactN++;exactRows+=s.c;}else addAlias(cn,s);continue;}
  const ca=CANON_ALIAS.find(([re])=>re.test(s.v));
  if(ca){addAlias(ca[1],s);continue;}
  const sg=SINGLES.find(([re])=>re.test(s.v));
  if(sg){legacy.push({...s,canon:sg[1],kind:sg[2]});continue;}
  const b=BRANDS.find(([re])=>re.test(s.v));
  if(b){legacy.push({...s,canon:b[1],kind:"brand-generic -> flagship"});continue;}
  unmatched.push(s);
}
const esc=x=>/[",\r\n]/.test(String(x))?'"'+String(x).replace(/"/g,'""')+'"':String(x);
const al=[["displayName","aliases","active","notes"]];
for(const [cn,arr] of [...aliasesByCanon.entries()].sort((a,b)=>b[1].reduce((s,x)=>s+x.c,0)-a[1].reduce((s,x)=>s+x.c,0))){
  const a=[...new Map(arr.map(x=>[loose(x.v),x])).values()].sort((x,y)=>y.c-x.c).map(x=>x.v);
  al.push([cn,a.join(";"),"TRUE",`insurer clean-equivalent aliases; ${a.length} variant(s), ${arr.reduce((s,x)=>s+x.c,0).toLocaleString()} rows`]);
}
writeFileSync("docs/nf-insurer-aliases.csv",al.map(r=>r.map(esc).join(",")).join("\n")+"\n");
const lm=[["nf_value","count","canonical","kind"]];
for(const x of legacy.sort((a,b)=>b.c-a.c)) lm.push([x.v,x.c,x.canon,x.kind]);
writeFileSync("docs/nf-insurer-legacy-map.csv",lm.map(r=>r.map(esc).join(",")).join("\n")+"\n");
const um=[["nf_value","count"]];
for(const x of unmatched.sort((a,b)=>b.c-a.c)) um.push([x.v,x.c]);
writeFileSync("docs/nf-insurer-unmatched.csv",um.map(r=>r.map(esc).join(",")).join("\n")+"\n");
const sum=a=>a.reduce((s,x)=>s+x.c,0);
const aliasVals=[...aliasesByCanon.values()].reduce((s,a)=>s+a.length,0), aliasRows=[...aliasesByCanon.values()].reduce((s,a)=>s+sum(a),0);
console.log(`EXACT (resolve by name)           : ${String(exactN).padStart(4)}  ${String(exactRows).padStart(8)} rows`);
console.log(`CLEAN ALIASES -> registry         : ${String(aliasVals).padStart(4)}  ${String(aliasRows).padStart(8)} rows (${aliasesByCanon.size} canonicals)`);
console.log(`LEGACY MAP (bulk-only)            : ${String(legacy.length).padStart(4)}  ${String(sum(legacy)).padStart(8)} rows`);
console.log(`UNMATCHED (bulk-recorded raw)     : ${String(unmatched.length).padStart(4)}  ${String(sum(unmatched)).padStart(8)} rows`);
console.log(`DROPPED (blank/none)             : ${String(dropped.length).padStart(4)}  ${String(sum(dropped)).padStart(8)} rows`);
const resolved=exactRows+aliasRows+sum(legacy);
console.log(`RESOLVED: ${resolved.toLocaleString()} / ${sum(src).toLocaleString()} = ${(100*resolved/sum(src)).toFixed(1)}%`);
console.log(`\nTop remaining unmatched (real carriers not in table + pure TPAs, recorded raw in bulk):`);
unmatched.sort((a,b)=>b.c-a.c).slice(0,18).forEach(x=>console.log(`   ${String(x.c).padStart(5)}  ${x.v}`));
