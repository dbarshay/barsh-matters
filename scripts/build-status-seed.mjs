// Status -> closed_reason seed builder + worksheet writeback (per 2026-07-09 review rulings).
import {readFileSync,writeFileSync,copyFileSync,existsSync} from "fs";
import {resolve} from "path";
import * as XLSX from "xlsx";
const REPO=resolve(process.cwd());
const WS="/sessions/friendly-great-dijkstra/mnt/!!!!!Barsh Matters Workspace!!!!!/NF-normalization-worksheet.xlsx";
const parse=(t)=>{const rows=[];let row=[],cell="",q=false;for(let i=0;i<t.length;i++){const c=t[i],n=t[i+1];if(c==='"'){if(q&&n==='"'){cell+='"';i++;}else q=!q;continue;}if(c===","&&!q){row.push(cell);cell="";continue;}if((c==="\n"||c==="\r")&&!q){if(c==="\r"&&n==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell="";continue;}cell+=c;}row.push(cell);if(row.some(x=>x!==""))rows.push(row);return rows;};
const norm=(v)=>String(v??"").toLowerCase().replace(/[’']/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const EXISTING=new Set(["AAA- DECISION- DISMISSED WITH PREJUDICE","AAA- VOLUNTARILY WITHDRAWN WITH PREJUDICE","DISCONTINUED WITH PREJUDICE","MOTION LOSS","OUT OF STATE CARRIER","PAID (DECISION)","PAID (FEE SCHEDULE)","PAID (JUDGMENT)","PAID (SETTLEMENT)","PAID (VOLUNTARY)","PER CLIENT","POLICY CANCELLED","POLICY EXHAUSTED/NO COVERAGE","PPO","SOL","TRANSFERRED TO LB","TRIAL LOSS","WORKERS COMPENSATION"]);
const NEW=new Set(["DUPLICATE","DISCONTINUED WITHOUT PREJUDICE","CARRIER IN LIQUIDATION","OTHER"]);
// classify -> {t, kind}  kind: MAP (existing or new) | DROP
const R=[
 [/NEW INTAKE|NEEDS TO BE REVIEWED|BILL SUBMITTED|BILL RE-SUBMITTED|RESPONSE TO VR|NEW-BILLS|NEW CASE ENTERED|CLUSTER HOLD|CLUSTER - HOLD|CLUSTER REJECT|OUR NOE|POM GENERATED|INDEX PURCHASED|AOS FILED|LETTER (SENT|MAILED)|SETTLEMENT STIP MERGED|STATUS - TRIAL|^TRIAL$|NEEDS TO BE RESUED|1ST RESPONSE|2ND RESPONSE|AAA - HEARING|AAA-ARB FILED|AAA - 412|AAA DUPLICATE FILED|AAA - ADMINISTRATIVELY CLOSED|AAA REJECTED|STATUS - JUDGMENT|^CLOSED$/i,"(drop)","DROP"],
 // AAA losses -> existing dismissed with prejudice
 [/AAA - DECISION - LOSS|MASTER ARBITRATION AWARD - AFFIRMED - LOSS|DECISION - AAA MASTER ARBITRATION - LOSS|LOSING AAA AWARD/i,"AAA- DECISION- DISMISSED WITH PREJUDICE","MAP"],
 // AAA without-prejudice + court dismissals + lien + 30-day/nf2 -> OTHER
 [/AAA.*WITHDRAWN.*WITHOUT PREJUDICE|AAA-WITHDRAWN WITHOUT PREJUDICE|AAA.*DISMISSED WITHOUT PREJUDICE|AAA-DISMISSED WITHOUT PREJUDICE|DISMISSED WITH.* PREJUDICE BY COURT|DISMISSED WITHOUT PREJUDICE BY COURT|Dismissed 3216|\bLIEN\b|30 DAY-NF2 RULE/i,"OTHER","MAP"],
 // AAA with prejudice
 [/AAA.*WITHDRAWN.*(W\/?\s*PREJUDICE|WITH PREJUDICE)/i,"AAA- VOLUNTARILY WITHDRAWN WITH PREJUDICE","MAP"],
 [/AAA.*DISMISSED WITH PREJUDICE/i,"AAA- DECISION- DISMISSED WITH PREJUDICE","MAP"],
 // PAID
 [/PAID PER FEE SCHEDULE|PAID PER ANGELO FEE SCHEDULE|PAID PER FS/i,"PAID (FEE SCHEDULE)","MAP"],
 [/PAID AFTER JUDGMENT/i,"PAID (JUDGMENT)","MAP"],
 [/PAID AFTER SETTLEMENT|PAID AFTER AAA SETTLEMENT|MAIN CASE PAID AFTER SETTLEMENT|PAID PER SETTLEMENT|SETTLED PER CLIENT|SETTLEMENT NEGOTIATED|SETTLEMENT STIP - SIGNED|CONSENT AWARD|AAA CASE SETTLED/i,"PAID (SETTLEMENT)","MAP"],
 [/PAID AFTER DECISION|PAID AFTER WINNING (DECISION|AAA DECISION)|CLOSED PAID AFTER DECISION|WINNING DECISION|AWARD RECEIVED - WIN|AWARD RECEIVED - PARTIAL WIN/i,"PAID (DECISION)","MAP"],
 [/PAID IN FULL|PAID AND CLOSED|CLOSED PAID IN FULL|PARTIALLY PAID|CLOSE FILE  ?- PAID$|CLOSE FILE - PAID$/i,"PAID (VOLUNTARY)","MAP"],
 // loss (non-AAA)
 [/DECISION - TRIAL - LOSS|TRIAL - LOSS|TRIAL LOSS/i,"TRIAL LOSS","MAP"],
 [/DECISION - MOTION - LOSS|MOTION - LOSS|MOTION LOSS|^DECISION - LOSS$/i,"MOTION LOSS","MAP"],
 [/WC - DECISION RECD - LOSS/i,"WORKERS COMPENSATION","MAP"],
 // discontinued
 [/DISCONTINUED.*WITHOUT PREJUDICE|DISCONTINUED - ENTIRE INDEX - WITHOUT PREJUDICE/i,"DISCONTINUED WITHOUT PREJUDICE","MAP"],
 [/DISCONTINUED PER CLIENT/i,"PER CLIENT","MAP"],
 [/DISCONTINUED.*WITH PREJUDICE|DISCONTINUED - ENTIRE INDEX - WITH PREJUDICE|DISCONTINUE PER DJ|DISCONTINUED - ENTIRE INDEX#/i,"DISCONTINUED WITH PREJUDICE","MAP"],
 // policy / carrier
 [/POLICY CANCELLED/i,"POLICY CANCELLED","MAP"],
 [/CARRIER IN LIQUIDATION/i,"CARRIER IN LIQUIDATION","MAP"],
 [/MV[IA]{2}C/i,"POLICY EXHAUSTED/NO COVERAGE","MAP"],   // MVAIC -> attaches here; display renamed post-import
 [/POLICY EXHAUSTED|NO COVERAGE|NO POLICY|DEDUCT|LACK OF COVERAGE/i,"POLICY EXHAUSTED/NO COVERAGE","MAP"],
 // wc / oos / sol / ppo / dup
 [/\bWC\b|WORKERS COMP|WCB|TRANSFERRED TO WORKERS COMP/i,"WORKERS COMPENSATION","MAP"],
 [/OUT OF STATE|NO NY JURISDICTION/i,"OUT OF STATE CARRIER","MAP"],
 [/\bSOL\b/i,"SOL","MAP"],
 [/\bPPO\b/i,"PPO","MAP"],
 [/DUPLICATE/i,"DUPLICATE","MAP"],
 // returned-to-client + per client
 [/RETURNED TO CLIENT|SENT FILE BACK TO CLIENT|BACK TO CLIENT|REJECTED NEW LITIGATION|SUB FILE|COMPANION FILES|PER CLIENT|PER ANGELO|PER JOAQ|NOT COST EFFECTIVE/i,"PER CLIENT","MAP"],
 // transferred
 [/TRANSFERRED TO LB/i,"TRANSFERRED TO LB","MAP"],
];
const rows=parse(readFileSync(resolve(REPO,"docs/nf-status-distinct.csv"),"utf8")).slice(1).map(([v,c])=>({v,c:+c}));
function classify(v){for(const [re,t,k] of R) if(re.test(v)) return {t,k}; return {t:"(unmatched)",k:"REVIEW"};}
const assigned=rows.map(r=>{const a=classify(r.v); const note=a.k==="DROP"?"dropped: workflow stage / no disposition":a.k==="REVIEW"?"REVIEW — unmatched":(NEW.has(a.t)?"NEW close reason":a.t==="POLICY EXHAUSTED/NO COVERAGE"&&/MV[IA]{2}C/i.test(r.v)?"MVAIC -> Policy Exhausted/No Coverage (rename to add /MVAIC post-import)":"-> existing"); return {...r,canonical:a.k==="DROP"||a.k==="REVIEW"?"":a.t,kind:a.k,note};});
// groups
const groups=new Map();
for(const a of assigned){ if(!a.canonical) continue; if(!groups.has(a.canonical)) groups.set(a.canonical,{rows:0,vals:[],existing:EXISTING.has(a.canonical)}); const g=groups.get(a.canonical); g.rows+=a.c; g.vals.push(a); }
const csvCell=(s)=>/[",\r\n]/.test(String(s))?`"${String(s).replace(/"/g,'""')}"`:String(s);
const seed=[["displayName","aliases","active","notes"]];
for(const [disp,g] of [...groups.entries()].sort((a,b)=>b[1].rows-a[1].rows)){
  const aliases=[...new Map(g.vals.map(v=>[norm(v.v),v]).filter(([nv])=>nv&&nv!==norm(disp))).values()].sort((a,b)=>b.c-a.c).map(v=>v.v);
  const tag=g.existing?"existing":"NEW close reason";
  seed.push([disp,aliases.join(";"),"TRUE",`${tag}; ${g.vals.length} src variants, ${g.rows.toLocaleString()} rows, ${aliases.length} aliases`]);
}
writeFileSync(resolve(REPO,"docs/nf-status-seed.csv"),seed.map(r=>r.map(csvCell).join(",")).join("\n")+"\n","utf8");
// mapping audit
const map=[["Source","Count","Canonical","Kind","Note"]];
for(const a of assigned.sort((x,y)=>y.c-x.c)) map.push([a.v,String(a.c),a.canonical,a.kind,a.note]);
writeFileSync(resolve(REPO,"docs/nf-status-mapping.csv"),map.map(r=>r.map(csvCell).join(",")).join("\n")+"\n","utf8");
// worksheet writeback (Status tab)
if(existsSync(WS)){
  copyFileSync(WS,WS.replace(/\.xlsx$/,".bak.xlsx"));
  const wb=XLSX.read(readFileSync(WS),{type:"buffer"});
  const bySrc=new Map(assigned.map(a=>[a.v,a]));
  const wr=XLSX.utils.sheet_to_json(wb.Sheets["Status"],{header:1,defval:"",raw:false});
  const out=[wr[0]];
  for(let i=1;i<wr.length;i++){const a=bySrc.get(wr[i][0]); out.push([wr[i][0],wr[i][1],a?a.canonical:wr[i][2],a?a.note:""]);}
  wb.Sheets["Status"]=XLSX.utils.aoa_to_sheet(out);
  writeFileSync(WS,XLSX.write(wb,{type:"buffer",bookType:"xlsx"}));
}
// summary
const drop=assigned.filter(a=>a.kind==="DROP"), rev=assigned.filter(a=>a.kind==="REVIEW");
console.log(`Status: ${rows.length} distinct, ${rows.reduce((s,r)=>s+r.c,0).toLocaleString()} rows`);
console.log(`Canonical groups: ${groups.size} (existing ${[...groups.values()].filter(g=>g.existing).length}, new ${[...groups.values()].filter(g=>!g.existing).length})`);
console.log(`Dropped: ${drop.length} values / ${drop.reduce((s,r)=>s+r.c,0).toLocaleString()} rows`);
console.log(`Unmatched/REVIEW: ${rev.length} (${rev.map(r=>r.v).join("; ")||"none"})`);
console.log(`\nSeed groups (rows desc):`);
for(const [disp,g] of [...groups.entries()].sort((a,b)=>b[1].rows-a[1].rows)) console.log(`  ${String(g.rows).padStart(7)}  [${g.vals.length}v] ${g.existing?"      ":"*NEW* "}${disp}`);
