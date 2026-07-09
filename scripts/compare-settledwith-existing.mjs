// Compare the new SettledWith seed vs the CURRENT Settlement Contacts already in the table.
// Reads docs/nf-settledwith-seed.csv and docs/individual-canonical-export.csv.
// Flags EXACT matches (safe update) and NEAR matches (would create a duplicate -> alias instead).
import {readFileSync,existsSync} from "fs";
const parse=(t)=>{const rows=[];let row=[],cell="",q=false;for(let i=0;i<t.length;i++){const c=t[i],n=t[i+1];if(c==='"'){if(q&&n==='"'){cell+='"';i++;}else q=!q;continue;}if(c===","&&!q){row.push(cell);cell="";continue;}if((c==="\n"||c==="\r")&&!q){if(c==="\r"&&n==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell="";continue;}cell+=c;}row.push(cell);if(row.some(x=>x!==""))rows.push(row);return rows;};
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
function lev(a,b){const m=a.length,n=b.length;const d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=0;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];}
if(!existsSync("docs/individual-canonical-export.csv")){console.error("MISSING docs/individual-canonical-export.csv — run: npx tsx scripts/export-reference.ts individual");process.exit(1);}
const seed=parse(readFileSync("docs/nf-settledwith-seed.csv","utf8")).slice(1).map(r=>r[0]);
const cur=parse(readFileSync("docs/individual-canonical-export.csv","utf8")).slice(1).map(r=>({name:r[0],aliases:(r[2]||"").split(";").filter(Boolean)}));
const curByNorm=new Map();cur.forEach(c=>{curByNorm.set(norm(c.name),c);c.aliases.forEach(a=>curByNorm.set(norm(a),c));});
const exact=[],near=[],fresh=[];
for(const s of seed){
  const ns=norm(s);
  if(curByNorm.has(ns)){exact.push([s,curByNorm.get(ns).name]);continue;}
  let hit=null;for(const c of cur){if(lev(ns,norm(c.name))<=2){hit=c.name;break;}}
  if(hit)near.push([s,hit]);else fresh.push(s);
}
console.log(`Current Settlement Contacts in table: ${cur.length}`);
console.log(`Seed rows: ${seed.length}`);
console.log(`\nEXACT match to existing (will UPDATE, no dupe): ${exact.length}`);
exact.forEach(([s,c])=>console.log("   "+s+(norm(s)===norm(c)?"":"  ~ "+c)));
console.log(`\nNEAR match (spelling differs -> would CREATE A DUPLICATE; alias onto existing instead): ${near.length}`);
near.forEach(([s,c])=>console.log("   SEED: "+s+"   <>   EXISTING: "+c));
console.log(`\nNEW (no existing match): ${fresh.length}`);
