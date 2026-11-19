"use strict";
// Read-only: compare published flattened Solidity to both observed runtimes.
const fs=require("node:fs"), crypto=require("node:crypto"), solc=require("solc"), {ethers}=require("ethers");
const sourceFile="contracts/UmbralFragmentV2_flat.sol";
const raw=fs.readFileSync(sourceFile);
const source=(raw[0]===0xff&&raw[1]===0xfe?raw.toString("utf16le"):raw.toString("utf8")).replace(/^\uFEFF/,"");
console.log("SOURCE_ENCODING "+(raw[0]===0xff&&raw[1]===0xfe?"utf16le":"utf8")+" "+source.length+" characters");
const targets=[
 {chain:"mainnet",chainId:1,address:"0x841c6a8e1858fd7daf25824e4d305ff06bd7a525",block:26450345,providers:["https://ethereum-rpc.publicnode.com","https://eth.drpc.org","https://eth.llamarpc.com","https://1rpc.io/eth","https://ethereum.publicnode.com"]},
 {chain:"sepolia",chainId:11155111,address:"0x47C049d0441dae4D06fd7E8d512e4E91B7E92e77",block:12169588,providers:["https://ethereum-sepolia-rpc.publicnode.com","https://sepolia.gateway.tenderly.co","https://sepolia.drpc.org","https://1rpc.io/sepolia"]}
];let id=0;
async function rpc(url,method,params){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({jsonrpc:"2.0",id:++id,method,params}),signal:ctrl.signal});
  if(!r.ok)throw Error("HTTP "+r.status);
  const v=await r.json();if(v.error)throw Error(String(v.error.message).slice(0,150));return v.result;
 }finally{clearTimeout(timer);}
}
function stripCBOR(hex){
 if(!hex||hex.length<4)return{executable:hex,metadata:"",valid:false};
 const n=parseInt(hex.slice(-4),16),off=hex.length-(n+2)*2;
 if(n<6||n>256||off<0||!/^a[0-9a-f]$|^b[0-9a-f]$/.test(hex.slice(off,off+2)))
  return{executable:hex,metadata:"",valid:false};
 return{executable:hex.slice(0,off),metadata:hex.slice(off),valid:true};
}
function deployedSolc(hex){
 const m=hex.slice(-230).match(/64736f6c6343([0-9a-f]{6})/);
 return m?parseInt(m[1].slice(0,2),16)+"."+parseInt(m[1].slice(2,4),16)+"."+parseInt(m[1].slice(4,6),16):null;
}
function compile(settings){
 const input={language:"Solidity",sources:{[sourceFile]:{content:source}},settings:{
  optimizer:{enabled:settings.optimizer,runs:settings.runs},viaIR:settings.viaIR,evmVersion:settings.evmVersion,
  outputSelection:{"*":{"*":["evm.deployedBytecode.object","evm.deployedBytecode.immutableReferences"]}}
 }};
 const out=JSON.parse(solc.compile(JSON.stringify(input)));
 const errors=(out.errors||[]).filter(e=>e.severity==="error");
 if(errors.length)return{error:errors.map(e=>e.formattedMessage).join(" | ").slice(0,900)};
 const result=out.contracts?.[sourceFile]?.UmbralFragmentV2?.evm?.deployedBytecode;
 return result?.object?{hex:result.object.toLowerCase(),immutables:result.immutableReferences}:{error:"missing UmbralFragmentV2"};
}
function sha(x){return crypto.createHash("sha256").update(x).digest("hex");}
(async()=>{
 const observations=[];let failed=false;
 for(const t of targets){
  const tag="0x"+t.block.toString(16),checks=[];
  for(const url of t.providers){
   try{
    if(parseInt(await rpc(url,"eth_chainId",[]),16)!==t.chainId)throw Error("wrong chain");
    const [block,code]=await Promise.all([rpc(url,"eth_getBlockByNumber",[tag,false]),rpc(url,"eth_getCode",[t.address,tag])]);
    if(!block?.hash||!code||code==="0x")throw Error("missing code/block");
    checks.push({url,blockHash:block.hash,runtime:code.slice(2).toLowerCase()});
    if(checks.filter(x=>x.runtime).length===2)break;
   }catch(e){checks.push({url,error:String(e).slice(0,150)});}
  }
  const valid=checks.filter(x=>x.runtime);
  const agrees=valid.length===2&&valid[0].blockHash===valid[1].blockHash&&valid[0].runtime===valid[1].runtime;
  const runtime=valid[0]?.runtime||null, stripped=stripCBOR(runtime);
  observations.push({chain:t.chain,address:t.address,block:t.block,runtime,blockHash:valid[0]?.blockHash,
   providers:checks.map(({runtime,...x})=>x),twoRPCsAgree:agrees,bytes:runtime?.length/2,
   codehash:runtime?ethers.keccak256("0x"+runtime):null,
   solcCBOR:runtime?deployedSolc(runtime):null,
   cbor: stripped.valid?{bytes:stripped.metadata.length/2,sha256:sha(stripped.metadata)}:null});
  const last=observations.at(-1);
  console.log("CHAIN "+t.chain+" "+JSON.stringify({twoRPCsAgree:agrees,bytes:last.bytes,codehash:last.codehash,solcCBOR:last.solcCBOR}));
  if(!agrees)failed=true;
 }
 // Decode the metadata hash embedded in the deployed bytecode.
// These are PUBLIC CBOR bytes. Metadata retrieval may be unavailable if nobody pinned it.
function toBase58(bytes){
 const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
 let n=BigInt("0x"+bytes.toString("hex")),out="";
 while(n>0n){out=alphabet[Number(n%58n)]+out;n/=58n;}
 for(const x of bytes){if(x===0)out="1"+out;else break;}return out;
}
async function fetchMetadata(cid){
 for(const gateway of ["https://ipfs.io/ipfs/","https://dweb.link/ipfs/","https://gateway.pinata.cloud/ipfs/"]){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6500);
  try{
   const response=await fetch(gateway+cid,{signal:ctrl.signal});
   if(!response.ok)continue;
   const body=await response.json();
   if(body?.compiler?.version&&body?.settings?.compilationTarget)return{source:gateway+cid,data:body};
  }catch(_){}
  finally{clearTimeout(timer);}
 }
 return null;
}
const original=stripCBOR(observations[0].runtime);
const hash=original.metadata.match(/697066735822(1220[0-9a-f]{64})/);
const cid=hash?toBase58(Buffer.from(hash[1],"hex")):null;
console.log("DEPLOYED_METADATA_CID "+JSON.stringify({cid,solcCBOR:observations[0].solcCBOR}));
const originalMetadata=cid?await fetchMetadata(cid):null;
const metadataLookup={cid,available:!!originalMetadata,url:originalMetadata?.source||null,
 originalCompiler:originalMetadata?.data?.compiler?.version||null,
 originalSettings:originalMetadata?.data?.settings||null,
 originalSourcePaths:Object.keys(originalMetadata?.data?.sources||{})};
if(originalMetadata)console.log("ORIGINAL_SOLC_METADATA "+JSON.stringify(metadataLookup));

 const compiler=solc.version(),attempts=[];
 console.log("LOCAL_SOLC "+compiler);
 for(const optimizer of [false,true])
 for(const runs of optimizer?[1,200,999]:[200])
 for(const viaIR of [false,true])
 for(const evmVersion of ["cancun","shanghai","paris"]){
  const settings={optimizer,runs,viaIR,evmVersion},compiled=compile(settings);
  const comparison=observations.map(o=>{
   if(!o.runtime||!compiled.hex)return{chain:o.chain,exact:false,executableMatch:false};
   const a=stripCBOR(compiled.hex),b=stripCBOR(o.runtime);
   return{chain:o.chain,exact:compiled.hex===o.runtime,
    executableMatch:a.valid&&b.valid&&a.executable===b.executable,
    compiledBytes:compiled.hex.length/2,deployedBytes:o.runtime.length/2};
  });
  const item={settings,error:compiled.error||null,comparison};attempts.push(item);
  if(comparison.some(x=>x.exact||x.executableMatch))console.log("MATCH_CANDIDATE "+JSON.stringify(item));
 }
 const report={schema:"UMBRAL_V2_DEPLOYED_SOURCE_REPRODUCTION",timestamp:new Date().toISOString(),
 sourceFile,sourceSHA256:sha(source),compiler,metadataLookup,
 observations:observations.map(({runtime,...x})=>x),attempts,
 caveat:"Executable match without full Solidity CBOR match is NOT full byte-for-byte identity. Constructor initialization, source-path provenance and access control must also be verified."};
 fs.mkdirSync("audit-results",{recursive:true});
 fs.writeFileSync("audit-results/umbral-v2-source-match.json",JSON.stringify(report,null,2)+"\n");
 console.log("FINAL "+JSON.stringify({builds:attempts.length,exact:attempts.filter(x=>x.comparison.some(y=>y.exact)).length,
 executableMatch:attempts.filter(x=>x.comparison.some(y=>y.executableMatch)).length,
 chains:observations.map(x=>({chain:x.chain,twoRPCsAgree:x.twoRPCsAgree,solcCBOR:x.solcCBOR}))}));
 const matchesBoth=observations.every(o=>attempts.some(a=>a.comparison.some(x=>x.chain===o.chain&&(x.exact||x.executableMatch))));
 if(!matchesBoth){
   console.error("SOURCE_MATCH_INCONCLUSIVE: no verifiable executable match on both networks");
   process.exitCode=3;
 } else if(failed){
   console.warn("PARTIAL_RPC_CORROBORATION: matched both deployed runtimes but one chain had fewer than two responsive public RPCs. Do not claim independent dual-provider agreement from THIS run; see prior verified survey.");
 }
})().catch(e=>{console.error("AUDIT_FATAL",e.stack||String(e));process.exitCode=1});
