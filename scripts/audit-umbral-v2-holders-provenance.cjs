"use strict";
// Public read-only attestation. No wallet, keys, signing, mint, burn, withdrawal, or deployment.
const fs = require("node:fs");
const { ethers } = require("ethers");
const targets = [
  { chain: "mainnet", chainId: 1, address: "0x841c6a8e1858fd7daf25824e4d305ff06bd7a525",
    expectedHash: "0x4ea55e352e81d0a52669ec97cc6d7ab871315cf54c0060ba615b30e932d0f74f",
    rpcs: ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://eth.llamarpc.com", "https://1rpc.io/eth"] },
  { chain: "sepolia", chainId: 11155111, address: "0x47C049d0441dae4D06fd7E8d512e4E91B7E92e77",
    expectedHash: "0x4ea55e352e81d0a52669ec97cc6d7ab871315cf54c0060ba615b30e932d0f74f",
    rpcs: ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.gateway.tenderly.co", "https://sepolia.drpc.org", "https://1rpc.io/sepolia"] }
];
const iface = new ethers.Interface([
  "function owner() view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function mintedEver() view returns (uint256)",
  "function nextId() view returns (uint256)",
  "function requiredReserve() view returns (uint256)",
  "function surplus() view returns (uint256)",
  "function MINT_PRICE() view returns (uint256)",
  "function BURN_REFUND() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function tokenByIndex(uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function tokenURI(uint256) view returns (string)",
  "function burned(uint256) view returns (bool)",
  "function supportsInterface(bytes4) view returns (bool)"
]);
let counter=0;
// JSON-RPC QUANTITY values must use minimal hexadecimal (no leading zeroes).
function blockTag(n){return "0x"+n.toString(16);}
function readable(error){return String(error && error.message || error).slice(0,160);}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function rpc(url,method,params,ms=13000){
  for(let attempt=0;attempt<4;attempt++){
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),ms);
    try {
      const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({jsonrpc:"2.0",id:++counter,method,params}),signal:ctrl.signal});
      if((r.status===429||r.status===503)&&attempt<3){
        await pause(1000*(attempt+1));
        continue;
      }
      if(!r.ok)throw Error("HTTP "+r.status);
      const body=await r.json();
      if(body.error)throw Error("RPC "+body.error.code+": "+body.error.message);
      return body.result;
    } finally {clearTimeout(timer);}
  }
  throw Error("RPC retries exhausted");
}
async function call(url,address,signature,args,tag){
  const data=iface.encodeFunctionData(signature,args);
  const answer=await rpc(url,"eth_call",[{to:address,data},tag]);
  const result=iface.decodeFunctionResult(signature,answer)[0];
  return typeof result==="bigint"?result.toString():result;
}
async function survey(url,t,tag) {
  const [block,code,balance]=await Promise.all([
    rpc(url,"eth_getBlockByNumber",[tag,false]),
    rpc(url,"eth_getCode",[t.address,tag]),
    rpc(url,"eth_getBalance",[t.address,tag])
  ]);
  if(!block?.hash || !code || code==="0x")throw Error("Missing pinned block or deployed code");
  const codehash=ethers.keccak256(code);
  if(codehash!==t.expectedHash)throw Error("Deployed code hash differs from independently audited Umbral V2");
  const views={};
  for(const [key,sig,args] of [
    ["owner","owner()",[]],["totalSupply","totalSupply()",[]],
    ["mintedEver","mintedEver()",[]],["nextId","nextId()",[]],
    ["requiredReserveWei","requiredReserve()",[]],["surplusWei","surplus()",[]],
    ["mintPriceWei","MINT_PRICE()",[]],["refundWei","BURN_REFUND()",[]],
    ["maxSupply","MAX_SUPPLY()",[]],
    ["erc721","supportsInterface(bytes4)",["0x80ac58cd"]],
    ["strict8060","supportsInterface(bytes4)",["0x88495fe7"]]
  ])views[key]=await call(url,t.address,sig,args,tag);
  const liveCount=Number(views.totalSupply),ever=Number(views.mintedEver);
  if(!Number.isSafeInteger(liveCount) || liveCount<0 || liveCount>1000 ||
     !Number.isSafeInteger(ever) || ever<liveCount || ever>1000)throw Error("Invalid token-count bounds");
  const tokens=[];
  for(let i=0;i<liveCount;i++){
    const id=Number(await call(url,t.address,"tokenByIndex(uint256)",[i],tag));
    if(!Number.isSafeInteger(id)||id<1||id>ever)throw Error("Token enumeration out of bounds");
    const [holder,uri,wasBurned]=await Promise.all([
      call(url,t.address,"ownerOf(uint256)",[id],tag),
      call(url,t.address,"tokenURI(uint256)",[id],tag),
      call(url,t.address,"burned(uint256)",[id],tag)
    ]);
    if(wasBurned)throw Error("Live enumerated token is marked burned");
    tokens.push({id,holder,tokenURIHash:ethers.keccak256(ethers.toUtf8Bytes(uri)),uriLength:uri.length});
  }
  tokens.sort((a,b)=>a.id-b.id);
  if(new Set(tokens.map(x=>x.id)).size!==liveCount)throw Error("Duplicate token enumerated");
  const reserve=BigInt(views.refundWei)*BigInt(liveCount);
  if(BigInt(views.requiredReserveWei)!==reserve)throw Error("Reserve formula mismatch");
  if(BigInt(balance)<reserve)throw Error("LIVE CONTRACT UNDERFUNDED");
  if(BigInt(views.surplusWei)!==BigInt(balance)-reserve)throw Error("Surplus accounting mismatch");
  if(views.strict8060!==false)throw Error("Unexpected strict ERC8060 advertised");
  return {blockHash:block.hash,blockNo:Number.parseInt(tag,16),codehash,
    balanceWei:BigInt(balance).toString(),views,tokens};
}
async function explorerCreation(url,t) {
  // Third-party explorer is ONLY a discovery hint. Validate any hash with a public
  // onchain transaction receipt before calling it a confirmed deployment.
  const host=t.chain==="mainnet"?"https://eth.blockscout.com":"https://eth-sepolia.blockscout.com";
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
  try {
    const response=await fetch(host+"/api/v2/addresses/"+t.address,{signal:ctrl.signal});
    if(!response.ok)throw Error("Blockscout HTTP "+response.status);
    const info=await response.json();
    const hash=info.creation_tx_hash||info.creation_transaction_hash;
    if(!hash)return{status:"UNKNOWN_EXPLORER_HAS_NO_CREATION_HASH"};
    const [receipt,tx]=await Promise.all([
      rpc(url,"eth_getTransactionReceipt",[hash]),
      rpc(url,"eth_getTransactionByHash",[hash])
    ]);
    if(receipt?.contractAddress?.toLowerCase()!==t.address.toLowerCase())
      return{status:"UNKNOWN_EXPLORER_CLAIM_NOT_DIRECTLY_CONFIRMED",txHash:hash};
    if(!tx || tx.to!==null)return{status:"UNKNOWN_NON_DIRECT_CREATION",txHash:hash};
    return{status:"DIRECT_CREATE_TX_IDENTIFIED_VIA_RECEIPT",block:Number.parseInt(receipt.blockNumber,16),
      txHash:hash,creator:tx.from,txInputBytes:(tx.input?.length-2)/2,
      txInputHash:ethers.keccak256(tx.input),
      note:"Proof of deploy transaction only, NOT of original solc metadata, source paths or constructor arguments"};
  } catch(error) {
    return{status:"UNKNOWN_EXPLORER_OR_RPC_UNAVAILABLE",error:readable(error)};
  } finally {clearTimeout(timer);}
}
async function findCreation(url,t,blockNumber) {
  // eth_getCode needs archive support; any failure makes creation provenance UNKNOWN.
  let low=0,high=blockNumber,queries=0;
  while(low<high) {
    const mid=Math.floor((low+high)/2);
    let code;
    try{code=await rpc(url,"eth_getCode",[t.address,blockTag(mid)],13000);}
    catch(error){return{status:"UNKNOWN_ARCHIVE_UNAVAILABLE",error:readable(error),queries};}
    queries++;
    if(code && code!=="0x")high=mid;else low=mid+1;
  }
  let before;
  try{before=low===0?"0x":await rpc(url,"eth_getCode",[t.address,blockTag(low-1)]);}
  catch(error){return{status:"UNKNOWN_PARENT_BLOCK_UNAVAILABLE",candidateBlock:low,error:readable(error),queries};}
  if(before!=="0x")return{status:"UNKNOWN_NO_CREATION_BOUNDARY",candidateBlock:low,queries};
  let block;
  try{block=await rpc(url,"eth_getBlockByNumber",[blockTag(low),true]);}
  catch(error){return{status:"UNKNOWN_CREATION_BLOCK_UNAVAILABLE",candidateBlock:low,error:readable(error),queries};}
  if(!block?.transactions)return{status:"UNKNOWN_CREATION_BLOCK_UNAVAILABLE",candidateBlock:low,queries};
  // Direct CREATE from an EOA: reproduce deterministic address using tx sender+nonce.
  for(const tx of block.transactions){
    if(tx.to!==null)continue;
    const predicted=ethers.getCreateAddress({from:tx.from,nonce:BigInt(tx.nonce)});
    if(predicted.toLowerCase()===t.address.toLowerCase()){
      try {
        const receipt=await rpc(url,"eth_getTransactionReceipt",[tx.hash]);
        if(receipt?.contractAddress?.toLowerCase()!==t.address.toLowerCase())
          return{status:"UNKNOWN_CREATION_RECEIPT_MISMATCH",block:low,txHash:tx.hash,queries};
        return{status:"DIRECT_CREATE_TX_IDENTIFIED",block:low,txHash:tx.hash,
          creator:tx.from,txInputBytes:(tx.input?.length-2)/2,txInputHash:ethers.keccak256(tx.input),
          note:"Constructor arguments and original compiler input are NOT yet authenticated",queries};
      }catch(error){return{status:"UNKNOWN_CREATION_RECEIPT",block:low,txHash:tx.hash,error:readable(error),queries};}
    }
  }
  return{status:"CREATION_BLOCK_FOUND_FACTORY_OR_UNKNOWN_TX",block:low,
    note:"Direct EOA CREATE not identified; internal trace needed",queries};
}
(async()=>{
  const report={schema:"UMBRAL_V2_HOLDER_AND_CREATION_READONLY",timestamp:new Date().toISOString(),targets:[]};
  let failed=false;
  for(const t of targets){
    const nodes=[];
    for(const url of t.rpcs){
      try{
        const [chain,head]=await Promise.all([rpc(url,"eth_chainId",[]),rpc(url,"eth_blockNumber",[])]);
        if(Number(BigInt(chain))!==t.chainId)throw Error("Wrong chain");
        nodes.push({url,head:Number(BigInt(head))});
      }catch(error){nodes.push({url,error:readable(error)});}
    }
    const candidates=nodes.filter(x=>Number.isSafeInteger(x.head));
    if(candidates.length<2){report.targets.push({chain:t.chain,address:t.address,status:"INCONCLUSIVE_FEWER_THAN_TWO_RPCS",nodes});failed=true;continue;}
    const chosenBlock=Math.min(...candidates.map(x=>x.head))-4,tag=blockTag(chosenBlock);
    const snapshots=[],errors=[];
    for(const n of candidates){
      if(snapshots.length>=2)break;
      try{snapshots.push({url:n.url,data:await survey(n.url,t,tag)});}
      catch(error){errors.push({url:n.url,error:readable(error)});}
    }
    const comparable=snapshots.map(x=>JSON.stringify(x.data));
    const matches=snapshots.length===2&&comparable[0]===comparable[1];
    const status=matches?"TWO_RPC_FULL_HOLDER_AGREEMENT":snapshots.length<2?"INCONCLUSIVE_FEWER_SUCCESSFUL_RPCS":"INCONCLUSIVE_HOLDER_DISAGREEMENT";
    if(!matches)failed=true;
    let creation=snapshots.length?await findCreation(snapshots[0].url,t,chosenBlock):{status:"UNKNOWN_NO_SNAPSHOT"};
    if(snapshots.length && !creation.status.startsWith("DIRECT_CREATE")){
      const hint=await explorerCreation(snapshots[0].url,t);
      creation=hint.status==="DIRECT_CREATE_TX_IDENTIFIED_VIA_RECEIPT"?hint:{...creation,explorerHint:hint};
    }
    report.targets.push({chain:t.chain,chainId:t.chainId,address:t.address,status,
      pinnedBlock:chosenBlock,independentProviders:snapshots.map(x=>x.url),
      snapshot:snapshots[0]?.data||null,disagreements:matches?[]:snapshots.map(x=>({url:x.url,data:x.data})),
      rpcFailures:errors,rpcDiscovery:nodes,creation});
    console.log("UMBRAL_HOLDER_RESULT "+JSON.stringify({chain:t.chain,status,pinnedBlock:chosenBlock,
      live:snapshots[0]?.data?.views.totalSupply,balanceWei:snapshots[0]?.data?.balanceWei,
      holders:snapshots[0]?.data?.tokens,creation}));
  }
  fs.mkdirSync("audit-results",{recursive:true});
  fs.writeFileSync("audit-results/umbral-v2-holders-provenance.json",JSON.stringify(report,null,2)+"\n");
  if(failed)process.exitCode=2;
})().catch(e=>{console.error("AUDIT_FATAL",readable(e));process.exitCode=3;});
