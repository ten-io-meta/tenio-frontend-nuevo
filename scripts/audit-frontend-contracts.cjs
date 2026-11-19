"use strict";
// Read-only audit of the two CONTRACT addresses used by the TEN.IO frontend.
// No wallet, no private key, no transactions and no deployment.
const fs=require("node:fs"), path=require("node:path"), {ethers}=require("ethers");
const env=Object.fromEntries(fs.readFileSync(".env","utf8").split(/\r?\n/).filter(x=>/^\s*VITE_[A-Z_0-9]+\s*=/.test(x)).map(x=>{const i=x.indexOf("=");return[x.slice(0,i).trim(),x.slice(i+1).trim().replace(/^["']|["']$/g,"")]}));
const sources=[
 {name:"frontend-mainnet",chainId:1,address:env.VITE_CONTRACT_MAINNET,rpcs:["https://ethereum-rpc.publicnode.com","https://eth.drpc.org"]},
 {name:"frontend-sepolia",chainId:11155111,address:env.VITE_CONTRACT_SEPOLIA,rpcs:["https://ethereum-sepolia-rpc.publicnode.com","https://1rpc.io/sepolia"]}
];
const iface=new ethers.Interface([
"function supportsInterface(bytes4) view returns (bool)",
"function owner() view returns (address)",
"function totalSupply() view returns (uint256)",
"function mintedEver() view returns (uint256)",
"function nextId() view returns (uint256)",
"function requiredReserve() view returns (uint256)",
"function surplus() view returns (uint256)",
"function MINT_PRICE() view returns (uint256)",
"function BURN_REFUND() view returns (uint256)",
"function MAX_SUPPLY() view returns (uint256)",
"function valueOf(uint256) view returns (uint256)"
]);
let id=0;
async function rpc(url,method,params) {
 const control=new AbortController(), timer=setTimeout(()=>control.abort(),11000);
 try{
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:++id,method,params}),signal:control.signal});
  if(!response.ok)throw Error("HTTP "+response.status);
  const j=await response.json();if(j.error)throw Error("RPC "+j.error.code+": "+String(j.error.message).slice(0,90));return j.result;
 } finally {clearTimeout(timer);}
}
function err(e){return String(e?.message||e).slice(0,140);}
async function call(url,address,signature,args,block){
 try{
  const returned=await rpc(url,"eth_call",[{to:address,data:iface.encodeFunctionData(signature,args)},block]);
  if(!returned||returned.length<66)return{status:"missing-return",raw:String(returned).slice(0,25)};
  const val=iface.decodeFunctionResult(signature,returned)[0];
  return{status:"ok",value:typeof val==="bigint"?val.toString():val};
 }catch(e){return{status:"reverted-or-unsupported",error:err(e)};}
}
async function inspect(url,t,block){
 const code=await rpc(url,"eth_getCode",[t.address,block]);
 const balance=await rpc(url,"eth_getBalance",[t.address,block]);
 const snapshot={codePresent:code!=="0x",codeHash:code!=="0x"?ethers.keccak256(code):null,
  runtimeBytes:(code.length-2)/2,contractBalanceWei:BigInt(balance).toString(),views:{}};
 if(!snapshot.codePresent)return snapshot;
 for(const [key,sig,args] of [
 ["erc165","supportsInterface(bytes4)",["0x01ffc9a7"]],
 ["erc721","supportsInterface(bytes4)",["0x80ac58cd"]],
 ["strictERC8060","supportsInterface(bytes4)",["0x88495fe7"]],
 ["historicReadOnly","supportsInterface(bytes4)",["0xcadf338f"]],
 ["owner","owner()",[]], ["mintPriceWei","MINT_PRICE()",[]],
 ["refundWei","BURN_REFUND()",[]],["maxSupply","MAX_SUPPLY()",[]],
 ["totalSupply","totalSupply()",[]],["mintedEver","mintedEver()",[]],
 ["nextId","nextId()",[]],["requiredReserveWei","requiredReserve()",[]],
 ["surplusWei","surplus()",[]],["valueOf1","valueOf(uint256)",[1]]
 ]) snapshot.views[key]=await call(url,t.address,sig,args,block);
 return snapshot;
}
(async()=>{
 const results={date:new Date().toISOString(),scope:"FRONTEND_LEGACY_READ_ONLY",targets:[]};
 let failed=false;
 for(const t of sources){
  if(!ethers.isAddress(t.address)){results.targets.push({name:t.name,error:"invalid public address configured"});failed=true;continue;}
  let nodes=[];
  for(const url of t.rpcs){
   try{
    const chain=parseInt(await rpc(url,"eth_chainId",[]),16);
    if(chain!==t.chainId)throw Error("unexpected chain "+chain);
    const head=parseInt(await rpc(url,"eth_blockNumber",[]),16);
    nodes.push({url,head});
   }catch(e){nodes.push({url,error:err(e)});}
  }
  const live=nodes.filter(x=>Number.isInteger(x.head));
  if(live.length<2){results.targets.push({name:t.name,address:t.address,status:"INCONCLUSIVE_RPC_AVAILABILITY",nodes});failed=true;continue;}
  const blockNo=Math.min(...live.map(x=>x.head))-3,tag="0x"+blockNo.toString(16);
  const checks=[];
  for(const n of live){
   try{
    const snap=await inspect(n.url,t,tag);
    checks.push({endpoint:n.url,snapshot:snap});
   }catch(e){checks.push({endpoint:n.url,error:err(e)});}
  }
  const v=checks.filter(x=>x.snapshot);
  const requiredKeys=["codePresent","codeHash","runtimeBytes","contractBalanceWei"];
  const disagreements= v.length===2 ? requiredKeys.filter(k=>v[0].snapshot[k]!==v[1].snapshot[k]):requiredKeys;
  if(v.length===2)for(const key of ["strictERC8060","erc721","mintPriceWei","refundWei"]){
    const a=v[0].snapshot.views[key],b=v[1].snapshot.views[key];
    if(a?.status!==b?.status||a?.status==="ok"&&a?.value!==b?.value) disagreements.push("view."+key);
  }
  const status=v.length===2&&!disagreements.length?"TWO_RPC_CRITICAL_AGREE":"INCONCLUSIVE";
  if(status!=="TWO_RPC_CRITICAL_AGREE")failed=true;
  const rec={name:t.name,chainId:t.chainId,address:t.address,block:blockNo,status,disagreements,checks};
  results.targets.push(rec);
  const first=v[0]?.snapshot;
  console.log("FRONTEND_CONTRACT_RESULT "+JSON.stringify({name:t.name,address:t.address,block: blockNo,status,
    codeHash:first?.codeHash,balanceWei:first?.contractBalanceWei,views:first?.views}));
 }
 fs.mkdirSync("audit-results",{recursive:true});
 const out="audit-results/frontend-legacy-contracts.json";
 fs.writeFileSync(out,JSON.stringify(results,null,2)+"\n");
 console.log("AUDIT_RESULT_PATH "+out);
 if(failed)process.exitCode=1;
})().catch(e=>{console.error("AUDIT_FATAL",err(e));process.exitCode=1;});
