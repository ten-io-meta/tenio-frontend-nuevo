import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { Interface, keccak256, parseEther, toBeHex } from "ethers";

// This test has NO wallet, keys, signer, network write, mint, burn or withdrawal.
// One public eth_getCode read fetches the independently pinned runtime; after
// that every browser EIP-1193 call is intercepted by a local in-memory mock.
const abi=JSON.parse(readFileSync("src/web3/UmbralFragment.json","utf8"));
const iface=new Interface(abi);
const contract="0x841c6a8e1858fd7daf25824e4d305ff06bd7a525";
const runtimeHash="0x4ea55e352e81d0a52669ec97cc6d7ab871315cf54c0060ba615b30e932d0f74f";
const holder="0x0Bf36a1e3c84e9D24A8cC499d9C2980faE040916";
const other="0x75DA787FDA32092079dbe113c5c9DBC22CBBC455";
const block=26450613;
const host="http://127.0.0.1:4173";
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const rpcs=["https://ethereum-rpc.publicnode.com","https://eth.drpc.org","https://eth.llamarpc.com"];
async function verifiedRuntime() {
  for(const endpoint of rpcs) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8500);
    try {
      const res=await fetch(endpoint,{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_getCode",params:[contract,"0x"+block.toString(16)]}),
        signal:controller.signal
      });
      if(!res.ok)continue;
      const data=await res.json();
      if(data.error||!data.result||data.result==="0x")continue;
      if(keccak256(data.result).toLowerCase()===runtimeHash) {
        console.log("CONTROLLED_UI_RUNTIME_VERIFIED "+JSON.stringify({endpoint,block,bytes:(data.result.length-2)/2}));
        return data.result;
      }
    }catch(error){ console.log("CONTROLLED_UI_RPC_RETRY "+endpoint+" "+String(error.message).slice(0,100)); }
    finally{clearTimeout(timer);}
  }
  throw new Error("INCONCLUSIVE: no public RPC supplied verified historic runtime; controlled healthy-path test cannot be faked");
}
function scenario(extra={}) {
  return {chain:"0x1",accounts:[holder],code:"0x",mode:"healthy",calls:[],switches:0,writes:0,...extra};
}
function reply(state,method,params,runtime) {
  state.calls.push(method);
  if(method==="eth_sendTransaction"||method==="eth_sendRawTransaction"||method==="personal_sign"||
     method==="eth_sign"||method==="eth_signTypedData_v4") {
    state.writes++;
    throw new Error("CONTROLLED_UI_FORBIDDEN_WRITE");
  }
  if(method==="eth_chainId")return state.chain;
  if(method==="net_version")return String(parseInt(state.chain,16));
  if(method==="eth_accounts"||method==="eth_requestAccounts")return state.accounts;
  if(method==="wallet_switchEthereumChain") {
    state.switches++;
    throw new Error("Controlled wallet: user did not approve switching");
  }
  if(state.mode==="offline" && ["eth_getCode","eth_call","eth_getBalance","eth_blockNumber"].includes(method))
    throw new Error("Simulated RPC unavailable");
  if(method==="eth_getCode")return state.mode==="unverified"?"0x6000":runtime;
  if(method==="eth_blockNumber")return "0x"+block.toString(16);
  if(method==="eth_getBalance")return toBeHex(parseEther(state.mode==="insolvent"?"0.06":"0.086"));
  if(method==="eth_call") {
    const call=iface.parseTransaction({data:params?.[0]?.data});
    if(!call)throw new Error("Unknown contract function");
    const name=call.name;
    const values={
      owner:other, totalSupply:7n, mintedEver:11n, nextId:12n,
      MINT_PRICE:parseEther("0.012"), BURN_REFUND:parseEther("0.01"),
      MAX_SUPPLY:1000n,requiredReserve:parseEther("0.07"),
      surplus:parseEther(state.mode==="insolvent"?"0":"0.016"),
    };
    if(name==="balanceOf") values.balanceOf=state.accounts.length?(state.accounts[0].toLowerCase()===other.toLowerCase()?1n:2n):0n;
    if(name==="tokenOfOwnerByIndex") values.tokenOfOwnerByIndex=state.accounts[0]?.toLowerCase()===other.toLowerCase()?8n:(Number(call.args[1])===0?2n:3n);
    if(name==="ownerOf") values.ownerOf=state.accounts[0]||holder;
    if(name==="tokenURI")values.tokenURI="ipfs://mock/test.json";
    if(!(name in values))throw new Error("Unrecognized read: "+name);
    return iface.encodeFunctionResult(call.fragment,[values[name]]);
  }
  throw new Error("Unrecognized provider method: "+method);
}
async function waitForLocalServer(child) {
  for(let i=0;i<100;i++) {
    if(child.exitCode!==null)throw new Error("Vite exited early "+child.exitCode);
    try {
      const r=await fetch(host,{signal:AbortSignal.timeout(900)});
      if(r.ok)return;
    }catch {}
    await sleep(200);
  }
  throw new Error("Vite controlled frontend did not start");
}
async function preparePage(browser,state,runtime) {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    if(url.hostname==="127.0.0.1")return route.continue();
    return route.abort(); // block IPFS and any external HTTP from the UI test
  });
  if(state) {
    await page.exposeFunction("__controlledRpc",async (method,params)=>reply(state,method,params,runtime));
    await page.addInitScript(()=>{
      const listeners=new Map();
      window.ethereum={
        request:({method,params})=>window.__controlledRpc(method,params||[]),
        on:(event,callback)=>{
          if(!listeners.has(event))listeners.set(event,new Set());
          listeners.get(event).add(callback);
        },
        removeListener:(event,callback)=>listeners.get(event)?.delete(callback),
        emit:(event,data)=>{for(const callback of listeners.get(event)||[])callback(data);},
      };
    });
  }
  await page.goto(host,{waitUntil:"domcontentloaded"});
  return page;
}
async function waitText(page,text) {
  await page.waitForFunction(value=>document.body.innerText.includes(value),text,{timeout:13000});
}
async function assertControlsOff(page) {
  assert.equal(await page.getByRole("button",{name:/mintear fragmento/i}).isDisabled(),true);
  assert.equal(await page.getByRole("button",{name:"Quemar",exact:true}).isDisabled(),true);
  assert.equal(await page.locator(".owner").count(),0);
}
async function runCase(name,fn) {
  await fn();
  console.log("CONTROLLED_UI_PASS "+name);
}
let server,browser;
try {
  const runtime=await verifiedRuntime();
  server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","4173","--strictPort"],{
    stdio:["ignore","ignore","ignore"],env:{...process.env,CI:"true"}
  });
  await waitForLocalServer(server);
  browser=await chromium.launch({channel:"chrome",headless:true,args:["--no-sandbox"]});
  mkdirSync("audit-results/browser", {recursive:true});

  await runCase("NO_WALLET_UNKNOWN_NOT_ZERO",async()=>{
    const page=await preparePage(browser,null,runtime);
    await waitText(page,"Red no admitida");
    assert.match(await page.locator(".stats").innerText(),/—/);
    assert.equal((await page.locator(".owned").innerText()).includes("No tienes fragmentos"),false);
    await assertControlsOff(page);
    await page.screenshot({path:"audit-results/browser/disconnected-wallet.png",fullPage:true});
    await page.close();
  });

  await runCase("UNSUPPORTED_CHAIN_NO_IMPLICIT_SWITCH",async()=>{
    const state=scenario({chain:"0x89"});
    const page=await preparePage(browser,state,runtime);
    await waitText(page,"Red no admitida");
    await assertControlsOff(page);
    assert.equal(state.switches,0);assert.equal(state.writes,0);
    await page.close();
  });

  await runCase("WRONG_RUNTIME_FAIL_CLOSED",async()=>{
    const state=scenario({mode:"unverified"});
    const page=await preparePage(browser,state,runtime);
    await waitText(page,"El código del contrato no coincide");
    await assertControlsOff(page);
    assert.equal(state.writes,0);await page.close();
  });

  await runCase("RPC_DOWN_NO_FAKE_ZERO",async()=>{
    const state=scenario({mode:"offline"});
    const page=await preparePage(browser,state,runtime);
    await waitText(page,"No se pudo consultar la blockchain");
    assert.match(await page.locator(".stats").innerText(),/—/);
    await assertControlsOff(page);
    assert.equal(state.switches,0);assert.equal(state.writes,0);
    await page.screenshot({path:"audit-results/browser/rpc-unavailable.png",fullPage:true});
    await page.close();
  });

  await runCase("VERIFIED_LEGACY_UI_NO_ERC8060_REPOINT",async()=>{
    const state=scenario();
    const page=await preparePage(browser,state,runtime);
    await waitText(page,"Tus fragmentos (2)");
    const panel=await page.locator(".stats").innerText();
    assert.match(panel,/0\.012/);
    assert.match(panel,/0\.01/);
    assert.match(panel,/Vivos \(holders\):\s*7/);
    assert.equal(state.calls.includes("eth_getBalance"),true);
    assert.equal(await page.getByText("UMBRAL V2 HISTÓRICO", {exact:false}).count(),1);
    assert.equal(await page.locator(".addr").innerText(),contract);
    assert.equal(await page.locator(".owner").count(),0);
    await waitText(page,"PREVIEW · SOLO LECTURA");
    await assertControlsOff(page);
    assert.equal(state.switches,0);assert.equal(state.writes,0);
    await page.screenshot({path:"audit-results/browser/verified-historical-nfts.png",fullPage:true});

    state.accounts=[];
    await page.evaluate(()=>window.ethereum.emit("accountsChanged",[]));
    await waitText(page,"Conectado: No conectado");
    assert.equal((await page.locator(".owned").innerText()).includes("No tienes fragmentos"),false);
    await assertControlsOff(page);
    await page.close();
  });

  await runCase("OWNER_PANEL_PREVIEW_FINANCIAL_WRITES_DISABLED",async()=>{
    const state=scenario({accounts:[other]});
    const page=await preparePage(browser,state,runtime);
    await waitText(page,"Tus fragmentos (1)");
    await waitText(page,"Panel de Owner");
    const panel=page.locator(".owner");
    assert.equal(await panel.count(),1);
    assert.equal(await panel.getByRole("button",{name:/Retirar excedente/}).isDisabled(),true);
    assert.equal(await panel.getByRole("button",{name:/Retirar parcial/}).isDisabled(),true);
    await assertControlsOff(page);
    assert.equal(state.writes,0);
    await page.close();
  });

  await runCase("INSOLVENT_SNAPSHOT_BLOCKS_FINANCIAL_ACTIONS",async()=>{
    const state=scenario({mode:"insolvent"});
    const page=await preparePage(browser,state,runtime);
    await waitText(page,"Reserva insuficiente detectada");
    await assertControlsOff(page);
    assert.equal(state.writes,0);await page.close();
  });

  await runCase("USER_CLICK_REJECTED_CHAIN_SWITCH_NO_WRITE",async()=>{
    const state=scenario();
    const page=await preparePage(browser,state,runtime);
    await waitText(page,"Tus fragmentos (2)");
    assert.equal(state.switches,0);
    await page.getByRole("button",{name:"Usar Sepolia"}).click();
    await waitText(page,"Red de wallet incorrecta");
    assert.equal(state.switches,1);
    assert.equal(state.writes,0);
    await page.close();
  });

  console.log("CONTROLLED_UI_SUMMARY 8 scenarios, 0 onchain writes, mock EIP-1193 in local Chromium");
} catch(error) {
  console.error("CONTROLLED_UI_FAILURE "+(error.stack||String(error)));
  process.exitCode=1;
} finally {
  if(browser)await browser.close();
  if(server && server.exitCode===null)server.kill("SIGTERM");
}
