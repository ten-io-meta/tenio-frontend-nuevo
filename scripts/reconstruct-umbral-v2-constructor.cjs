"use strict";
// Read-only reconstruction of the constructor arguments for the confirmed Sepolia CREATE transaction.
// Does not claim original full metadata/source-tree identity.
const fs=require("node:fs"),crypto=require("node:crypto"),solc=require("solc"),{ethers}=require("ethers");
const sourcePath="contracts/UmbralFragmentV2_flat.sol";
const raw=fs.readFileSync(sourcePath);
const source=(raw[0]===0xff&&raw[1]===0xfe?raw.toString("utf16le"):raw.toString("utf8")).replace(/^\uFEFF/,"");
const address="0x47C049d0441dae4D06fd7E8d512e4E91B7E92e77";
const txHash="0x3b732000dd75e323d33ded51c137f0deb8a718ae1344e2521b086f14c6d04e61";
const url="https://ethereum-sepolia-rpc.publicnode.com";
let id=0;
async function rpc(method,params){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
   const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({jsonrpc:"2.0",id:++id,method,params}),signal:ctrl.signal});
   if(!response.ok)throw Error("RPC HTTP "+response.status);
   const body=await response.json();
   if(body.error)throw Error("RPC "+body.error.message);
   return body.result;
 }finally{clearTimeout(timer);}
}
function sha(x){return crypto.createHash("sha256").update(x).digest("hex");}
(async()=>{
 const input={language:"Solidity",sources:{[sourcePath]:{content:source}},settings:{
   optimizer:{enabled:true,runs:200},viaIR:false,evmVersion:"cancun",
   outputSelection:{"*":{"*":["evm.bytecode.object"]}}
 }};
 const compiled=JSON.parse(solc.compile(JSON.stringify(input)));
 const errors=(compiled.errors||[]).filter(x=>x.severity==="error");
 if(errors.length)throw Error(errors.map(x=>x.formattedMessage).join("\n").slice(0,800));
 const initcode=compiled.contracts?.[sourcePath]?.UmbralFragmentV2?.evm?.bytecode?.object?.toLowerCase();
 if(!initcode||!/^([0-9a-f]{2})+$/.test(initcode))throw Error("Cannot reproduce creation bytecode");
 const [chainId,tx,receipt]=await Promise.all([
   rpc("eth_chainId",[]),rpc("eth_getTransactionByHash",[txHash]),rpc("eth_getTransactionReceipt",[txHash])
 ]);
 if(Number(BigInt(chainId))!==11155111)throw Error("Wrong chain");
 console.log("SEPOLIA_CREATE_RPC_FIELDS "+JSON.stringify({hasTransaction:!!tx,transactionTo:tx?.to,
   transactionHash:tx?.hash,hasReceipt:!!receipt,receiptContract:receipt?.contractAddress,
   receiptBlock:receipt?.blockNumber,expected:address}));
 if(!tx||tx.to!==null||!receipt||receipt.contractAddress?.toLowerCase()!==address.toLowerCase())
   throw Error("Direct creation receipt is NOT confirmed");
 const original=tx.input?.slice(2).toLowerCase();
 if(!original||original.length<=initcode.length)throw Error("Invalid constructor suffix length");
 const byteLen=initcode.length/2,initialPrefix=initcode.slice(0,256);
 if(original.slice(0,256)!==initialPrefix)
    throw Error("Initial creation instructions do not match this compiled source");
 const constructorHex=original.slice(initcode.length);
 if(constructorHex.length%64!==0)throw Error("Noncanonical ABI-aligned constructor length");
 const abi=ethers.AbiCoder.defaultAbiCoder();
 const [baseURI,initialOwner]=abi.decode(["string","address"],"0x"+constructorHex);
 const encoded=abi.encode(["string","address"],[baseURI,initialOwner]).slice(2).toLowerCase();
 if(encoded!==constructorHex)throw Error("Decoded constructor is not canonical ABI");
 const report={schema:"UMBRAL_V2_SEPOLIA_CONSTRUCTOR_RECONSTRUCTION",chainId:11155111,
   transaction:txHash,contract:address,creator:tx.from,blockNumber:Number(BigInt(receipt.blockNumber)),
   localSolc:solc.version(),sourceFile:sourcePath,compilerSettings:input.settings,
   compiledCreationByteLength:byteLen,transactionInputByteLength:original.length/2,
   initial256HexCharsMatch:true,constructorByteLength:constructorHex.length/2,
   decoded:{baseURI,initialOwner},constructorSHA256:sha(Buffer.from(constructorHex,"hex")),
   caveat:"Creator, receipt and ABI suffix are verified against this transaction. Matching creation prelude and constructor suffix do NOT prove exact original full initcode, metadata, source paths, or full source provenance. Continue to rely on independent executable-runtime bytecode match."};
 fs.mkdirSync("audit-results",{recursive:true});
 fs.writeFileSync("audit-results/umbral-v2-sepolia-constructor.json",JSON.stringify(report,null,2)+"\n");
 console.log("UMBRAL_SEPOLIA_CONSTRUCTOR "+JSON.stringify({transaction:txHash,blockNumber:report.blockNumber,
   initialOwner,baseURILength:baseURI.length,baseURIHash:ethers.keccak256(ethers.toUtf8Bytes(baseURI)),
   compiledCreationByteLength:byteLen,transactionInputByteLength:original.length/2,
   constructorByteLength:constructorHex.length/2}));
})().catch(e=>{console.error("CONSTRUCTOR_RECONSTRUCTION_INCONCLUSIVE",e.stack||String(e));process.exitCode=2;});
