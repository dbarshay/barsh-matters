// Patient clustering analysis for the one-time NF bulk load.
// Identity = strong accident/claim group (Packet ID > Claim# > Policy#+DOL > solo) + fuzzy NAME
// within that group (folds misspellings, keeps distinct first names / family members apart).
// Read-only; prints stats + examples. Usage: node scripts/nf-patient-cluster-analysis.mjs "<xlsx>"
import {readFileSync} from "fs";
import * as XLSX from "xlsx";
const wb=XLSX.read(readFileSync(process.argv[2]),{type:"buffer",cellDates:true});
const ws=wb.Sheets[wb.SheetNames[0]];const range=XLSX.utils.decode_range(ws["!ref"]);
const H={};for(let c=range.s.c;c<=range.e.c;c++){const h=String(ws[XLSX.utils.encode_cell({c,r:range.s.r})]?.w??ws[XLSX.utils.encode_cell({c,r:range.s.r})]?.v??"").trim();H[h.toLowerCase()]=c;}
const col=(...names)=>{for(const n of names){if(H[n.toLowerCase()]!=null)return H[n.toLowerCase()];}return -1;};
const cId=col("Case_Id"), cName=col("Claimant"), cClaim=col("Claim Number"), cPol=col("Policy No"), cDol=col("Date Of Loss","Date of Loss"), cPkt=col("Packet ID");
const cell=(r,c)=>c<0?"":String(ws[XLSX.utils.encode_cell({c,r})]?.w??ws[XLSX.utils.encode_cell({c,r})]?.v??"").trim();
const junk=x=>/^(n\/?a|unknown|-|none|)$/i.test(String(x).trim());
const nn=s=>s.toUpperCase().replace(/[^A-Z0-9]/g," ").replace(/\s+/g," ").trim();
function parseName(v){const t=v.split(",");const last=nn(t[0]||"");const first=nn((t[1]||"").split(/\s+/)[0]||"");return {last,first,full:nn(v)};}
function lev(a,b){const m=a.length,n=b.length;if(Math.abs(m-n)>3)return 9;const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=0;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];}

// pass 1: gather rows, assign strong group
const rows=[];
for(let r=range.s.r+1;r<=range.e.r;r++){
  const name=cell(r,cName);if(!name)continue;
  const pkt=cell(r,cPkt),clm=cell(r,cClaim),pol=cell(r,cPol),dol=cell(r,cDol);
  let g; if(!junk(pkt))g="PKT:"+pkt; else if(!junk(clm))g="CLM:"+nn(clm); else if(!junk(pol)&&!junk(dol))g="POL:"+nn(pol)+"|"+dol; else g="SOLO:"+cell(r,cId)+":"+nn(name);
  const p=parseName(name);
  rows.push({id:cell(r,cId),name,...p,dol,g});
}
// pass 2: within each group, union by near-full-name; keep distinct first names apart
const byG=new Map();rows.forEach((row,i)=>{(byG.get(row.g)||byG.set(row.g,[]).get(row.g)).push(i);});
const par=rows.map((_,i)=>i);const find=x=>par[x]===x?x:(par[x]=find(par[x]));const uni=(a,b)=>{par[find(a)]=find(b);};
let misspellExamples=[],familyExamples=[];
for(const idxs of byG.values()){
  for(let a=0;a<idxs.length;a++)for(let b=a+1;b<idxs.length;b++){
    const A=rows[idxs[a]],B=rows[idxs[b]];
    const sameFullish=lev(A.full,B.full)<=2;
    const sameLastFirstClose=A.last===B.last && (A.first===B.first||lev(A.first,B.first)<=1||(A.first&&B.first&&(A.first[0]===B.first[0])&&(A.first.length<=2||B.first.length<=2)));
    if(sameFullish||sameLastFirstClose){ if(find(idxs[a])!==find(idxs[b])){ if(A.full!==B.full&&misspellExamples.length<25)misspellExamples.push([A.name,B.name,A.g]); uni(idxs[a],idxs[b]); } }
    else if(A.last===B.last&&A.first!==B.first&&familyExamples.length<25){ familyExamples.push([A.name,B.name,A.g]); }
  }
}
// pass 3: safe cross-group union on EXACT name + DOL (same person, packeted + non-packeted same accident)
const key3=new Map();rows.forEach((row,i)=>{if(row.dol&&!junk(row.dol)){const k=row.full+"|"+row.dol;(key3.get(k)||key3.set(k,[]).get(k)).push(i);}});
for(const idxs of key3.values())for(let i=1;i<idxs.length;i++)uni(idxs[0],idxs[i]);

const clusters=new Map();rows.forEach((row,i)=>{const root=find(i);(clusters.get(root)||clusters.set(root,[]).get(root)).push(row);});
const distinctNames=new Set(rows.map(r=>r.full)).size;
const groupsMulti=[...byG.values()].filter(idxs=>new Set(idxs.map(i=>find(i))).size>1);
console.log(`Total matter rows w/ a claimant: ${rows.length.toLocaleString()}`);
console.log(`Distinct raw names (naive): ${distinctNames.toLocaleString()}`);
console.log(`DISTINCT PATIENTS after strong-key + fuzzy-name clustering: ${clusters.size.toLocaleString()}`);
console.log(`Strong groups (packet/claim/policy): ${byG.size.toLocaleString()}  | groups holding >1 patient (families): ${groupsMulti.length.toLocaleString()}`);
const spanning=[...clusters.values()].filter(c=>new Set(c.map(r=>r.g)).size>1).length;
console.log(`Patients spanning multiple strong groups (merged via exact name+DOL): ${spanning.toLocaleString()}`);
console.log(`\nMISSPELLING MERGES caught (same group, different spelling -> same patient):`);
misspellExamples.slice(0,15).forEach(([a,b,g])=>console.log(`   "${a}"  ==  "${b}"   [${g}]`));
console.log(`\nFAMILY / distinct people kept SEPARATE (same group, same last, diff first):`);
familyExamples.slice(0,10).forEach(([a,b,g])=>console.log(`   "${a}"  !=  "${b}"   [${g}]`));
