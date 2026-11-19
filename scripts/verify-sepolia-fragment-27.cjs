"use strict";
// Public Sepolia eth_call-only token verification. NO signers, private keys,
// transaction submission, mint, burn or withdrawals.
const { Interface, getAddress } = require("ethers");
const address = "0x47C049d0441dae4D06fd7E8d512e4E91B7E92e77";
const expected = "0x75DA787FDA32092079dbe113c5c9DBC22CBBC455";
const id=27n;
const abi=new Interface([
 "function ownerOf(uint256) view returns (address)",
 "function mintedEver() view returns (uint256)",
 "function nextId() view returns (uint256)",
 "function totalSupply() view returns (uint256)",
 "function tokenURI(uint256) view returns (string)"
]);
const urls=[
 "https://ethereum-sepolia-rpc.publicnode.com",
 "https://sepolia.drpc.org",
 "https://1rpc.io/sepolia"
];
async function rpc(url, method, params, wait=12000){
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),wait);
 try{
 const res=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:ctrl.signal});
 if(!res.ok)throw Error("HTTP "+res.status);
 const d=await res.json();if(d.error)throw Error(d.error.message);
 if(!d.result)throw Error("missing result for "+method);
 return d.result;
 }finally{clearTimeout(timer)}
}
async function verify(url){
 const hex=await rpc(url,"eth_blockNumber",[]);
 const block="0x"+BigInt(hex).toString(16);
 const call=async(name,args=[])=>{
  const data=abi.encodeFunctionData(name,args);
  const raw=await rpc(url,"eth_call",[{to:address,data},block]);
  return abi.decodeFunctionResult(name,raw)[0];
 };
 const owner=getAddress(await call("ownerOf",[id]));
 const mintedEver=Number(await call("mintedEver"));
 const nextId=Number(await call("nextId"));
 const supply=Number(await call("totalSupply"));
 const uri=await call("tokenURI",[id]);
 if(mintedEver<27||nextId<28||supply<1)throw Error("contract state inconsistent with minted #27");
 return {network:"Sepolia",block:parseInt(hex,16),address,tokenId:id.toString(),
  owner,ownerMatchesScreenshot:owner.toLowerCase()===expected.toLowerCase(),
  mintedEver,nextId,liveSupply:supply,tokenURIBytes:uri.length,
  note:"onchain read-only at one pinned block; no writes"};
}
(async()=>{
 for(const url of urls){
  try{const evidence=await verify(url);console.log("SEPOLIA_TOKEN27_VERIFIED "+JSON.stringify(evidence));return}
  catch(e){console.log("SEPOLIA_RPC_RETRY "+url+" "+String(e.message).slice(0,160))}
 }
 console.error("SEPOLIA_TOKEN27_INCONCLUSIVE no public RPC verified the read");
 process.exitCode=2;
})();
