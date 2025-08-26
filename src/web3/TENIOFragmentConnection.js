// TENIOFragmentConnection.js
// v7.2 – asegura red también en lecturas, NaN-proof, offsets y vídeo con fallback

import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import ABI from "./UmbralFragment.json";

// ---------- ENV ----------
const FIXED_ADDR   = import.meta.env.VITE_CONTRACT_ADDRESS?.trim();
const ADDR_SEPOLIA = import.meta.env.VITE_CONTRACT_SEPOLIA?.trim();
const ADDR_MAINNET = import.meta.env.VITE_CONTRACT_MAINNET?.trim();

const OFFSET_MAINNET = Number(import.meta.env.VITE_MINT_OFFSET_MAINNET ?? 0);
const OFFSET_SEPOLIA = Number(import.meta.env.VITE_MINT_OFFSET_SEPOLIA ?? 0);

const DEFAULT_IMAGE_IPFS = import.meta.env.VITE_DEFAULT_NFT_IMAGE_IPFS?.trim();
const VIDEO_IPFS         = import.meta.env.VITE_UMBRAL_VIDEO_IPFS?.trim();

// ---------- Utils ----------
const toNum = (v, d = 0) => {
  try {
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "number") return Number.isFinite(v) ? v : d;
    if (v == null) return d;
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  } catch { return d; }
};
const clampMin = (x, m = 0) => (x < m ? m : x);

function ipfsPath(ipfsUrl) {
  if (!ipfsUrl) return "";
  return ipfsUrl.startsWith("ipfs://") ? ipfsUrl.slice(7) : ipfsUrl;
}

// ---------- Video ----------
export async function getHeroVideoHttp() {
  const path = ipfsPath(VIDEO_IPFS);
  if (!path) return "";
  const candidates = [
    `https://ipfs.io/ipfs/${path}`,
    `https://cloudflare-ipfs.com/ipfs/${path}`,
    `https://gateway.pinata.cloud/ipfs/${path}`,
  ];
  for (const url of candidates) {
    try { const r = await fetch(url, { method: "HEAD" }); if (r.ok) return url; } catch {}
  }
  return candidates[0];
}

// ---------- Provider ----------
export function hasWindowEthereum() {
  return typeof window !== "undefined" && window.ethereum;
}
export async function getAccounts() {
  if (!hasWindowEthereum()) throw new Error("No Ethereum provider");
  return await window.ethereum.request({ method: "eth_requestAccounts" });
}
export async function getChainId() {
  if (!hasWindowEthereum()) return null;
  return await window.ethereum.request({ method: "eth_chainId" });
}

// ---------- Net helpers ----------
function inferExpectedNetworkFromAddress(addr) {
  if (!addr) return null;
  const a = addr.toLowerCase();
  if (ADDR_SEPOLIA && a === ADDR_SEPOLIA.toLowerCase()) return "sepolia";
  if (ADDR_MAINNET && a === ADDR_MAINNET.toLowerCase()) return "mainnet";
  return null;
}

export async function ensureNetwork(expected /* "sepolia" | "mainnet" */) {
  if (!expected) return;
  if (!hasWindowEthereum()) throw new Error("No provider");
  const wanted = expected === "sepolia" ? "0xaa36a7" : "0x1";
  const current = (await window.ethereum.request({ method: "eth_chainId" }))?.toLowerCase();
  if (current !== wanted) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: wanted }],
      });
    } catch {
      throw new Error(`Cambia la red en MetaMask a ${expected} para continuar.`);
    }
  }
}

// ---------- Dirección activa por red ----------
export function getActiveAddressFromChain(chainIdHex, explicit = null) {
  if (FIXED_ADDR) return FIXED_ADDR;
  if (explicit === "sepolia") return ADDR_SEPOLIA;
  if (explicit === "mainnet") return ADDR_MAINNET;

  const hex = (chainIdHex || "").toLowerCase();
  if (hex === "0xaa36a7") return ADDR_SEPOLIA;
  if (hex === "0x1")      return ADDR_MAINNET;
  return ADDR_SEPOLIA;
}

// ---------- Offsets ----------
export function getCounterOffset(chainIdHex, explicit = null) { // compat con tu App
  if (explicit === "sepolia") return OFFSET_SEPOLIA;
  if (explicit === "mainnet") return OFFSET_MAINNET;
  const hex = (chainIdHex || "").toLowerCase();
  if (hex === "0xaa36a7") return OFFSET_SEPOLIA;
  if (hex === "0x1")      return OFFSET_MAINNET;
  return 0;
}
function visualOffset(activeAddr, chainIdHex, explicit) {
  if (explicit === "sepolia") return OFFSET_SEPOLIA;
  if (explicit === "mainnet") return OFFSET_MAINNET;

  const a = (activeAddr || "").toLowerCase();
  if (ADDR_SEPOLIA && a === (ADDR_SEPOLIA || "").toLowerCase()) return OFFSET_SEPOLIA;
  if (ADDR_MAINNET && a === (ADDR_MAINNET || "").toLowerCase()) return OFFSET_MAINNET;

  const hex = (chainIdHex || "").toLowerCase();
  if (hex === "0xaa36a7") return OFFSET_SEPOLIA;
  if (hex === "0x1")      return OFFSET_MAINNET;
  return 0;
}

function requireAddress(addr, label = "contract") {
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Falta dirección de ${label}`);
  }
  return addr;
}

// ---------- Instancias (LECTURAS ahora también aseguran red) ----------
export async function getReadContract(activeAddr, expectedNet = null) {
  requireAddress(activeAddr);
  if (!hasWindowEthereum()) throw new Error("No provider");
  if (expectedNet) await ensureNetwork(expectedNet);
  const provider = new BrowserProvider(window.ethereum);
  return new Contract(activeAddr, ABI, await provider);
}

export async function getWriteContract(activeAddr, explicitExpected = null) {
  requireAddress(activeAddr);
  if (!hasWindowEthereum()) throw new Error("No provider");
  const inferred = inferExpectedNetworkFromAddress(activeAddr);
  await ensureNetwork(explicitExpected || inferred);
  const browser = new BrowserProvider(window.ethereum);
  const signer  = await browser.getSigner();
  return new Contract(activeAddr, ABI, signer);
}

// ---------- Fallback: conteo por eventos ----------
async function countMintsViaEvents(contract) {
  try {
    const filter = contract.filters.Transfer("0x0000000000000000000000000000000000000000");
    const events = await contract.queryFilter(filter, 0, "latest");
    return events.length;
  } catch { return null; }
}

// ---------- Lecturas ----------
export async function getStats(activeAddr, chainIdHex = null, explicit = null) {
  const expected = explicit || inferExpectedNetworkFromAddress(activeAddr);
  const c = await getReadContract(activeAddr, expected);

  const [
    totalSupplyRaw,
    mintPriceRaw,
    burnRefundRaw,
    maxSupplyRaw,
    requiredReserveRaw,
    contractEthBalanceRaw,
  ] = await Promise.all([
    c.totalSupply?.().catch(() => 0n),
    c.MINT_PRICE?.().catch(() => 0n),
    c.BURN_REFUND?.().catch(() => 0n),
    c.MAX_SUPPLY?.().catch(() => 1000n),
    c.requiredReserve?.().catch?.(() => 0n) ?? 0n,
    (async () => {
      try {
        const addr = await c.getAddress();
        const p = new BrowserProvider(window.ethereum);
        return await p.getBalance(addr);
      } catch { return 0n; }
    })(),
  ]);

  let mintedHistoric = 0;
  try {
    const next =
      (await c._nextId?.().catch(() => null)) ??
      (await c.nextId?.().catch(() => null)) ??
      (await c.mintedEver?.().catch(() => null));
    if (next != null) mintedHistoric = toNum(next) - 1;
    else {
      const byEvents = await countMintsViaEvents(c);
      mintedHistoric = byEvents != null ? toNum(byEvents) : toNum(totalSupplyRaw);
    }
  } catch {
    const byEvents = await countMintsViaEvents(c);
    mintedHistoric = byEvents != null ? toNum(byEvents) : toNum(totalSupplyRaw);
  }
  mintedHistoric = clampMin(toNum(mintedHistoric, 0));

  const vivos        = clampMin(toNum(totalSupplyRaw, 0));
  const burned       = mintedHistoric >= vivos ? mintedHistoric - vivos : 0;
  const requiredEth  = toNum(Number(formatEther(requiredReserveRaw || 0n)), 0);
  const balanceEth   = toNum(Number(formatEther(contractEthBalanceRaw || 0n)), 0);
  const maxSupply    = clampMin(toNum(maxSupplyRaw, 1000));
  const excess       = clampMin(balanceEth - requiredEth, 0);

  const offset = visualOffset(activeAddr, chainIdHex, explicit);
  const histWithOffset = clampMin(mintedHistoric + offset, 0);
  const available      = clampMin(maxSupply - histWithOffset, 0);

  return {
    address: activeAddr,
    maxSupply,
    mintedHistoric: histWithOffset,
    supplyLive: vivos,
    burned,
    mintPrice: toNum(Number(formatEther(mintPriceRaw || 0n)), 0),
    burnRefund: toNum(Number(formatEther(burnRefundRaw || 0n)), 0),
    requiredReserveEth: requiredEth,
    contractBalanceEth: balanceEth,
    withdrawableEth: excess,
    availableToMint: available,
  };
}

// ---------- Owned / URI ----------
export async function getOwnedFragments(activeAddr, ownerAddr) {
  const c = await getReadContract(activeAddr, inferExpectedNetworkFromAddress(activeAddr));
  const balance = toNum(await c.balanceOf(ownerAddr).catch(() => 0n), 0);
  const ids = [];
  for (let i = 0; i < balance; i++) {
    try { ids.push(toNum(await c.tokenOfOwnerByIndex(ownerAddr, i), 0)); } catch {}
  }
  return ids;
}
export async function getTokenURI(activeAddr, tokenId) {
  const c = await getReadContract(activeAddr, inferExpectedNetworkFromAddress(activeAddr));
  return await c.tokenURI(tokenId);
}

// ---------- Escrituras ----------
export async function mintNext(activeAddr, metadataCidOrPath) {
  const c = await getWriteContract(activeAddr);
  const price = await c.MINT_PRICE();
  const tx = await c.mintFragment(metadataCidOrPath, { value: price });
  return await tx.wait();
}
export async function burn(activeAddr, tokenId) {
  const c = await getWriteContract(activeAddr);
  const tx = await c.burn(tokenId);
  return await tx.wait();
}
export async function withdrawAllSurplus(activeAddr) {
  const c = await getWriteContract(activeAddr);
  const to = await c.runner.getAddress();
  const tx = await c.withdrawAllSurplus(to);
  return await tx.wait();
}
export async function withdrawSurplus(activeAddr, amountEth) {
  const c = await getWriteContract(activeAddr);
  const to = await c.runner.getAddress();
  const tx = await c.withdrawSurplus(to, parseEther(String(amountEth)));
  return await tx.wait();
}

// ---------- MetaMask: watch asset ----------
export async function addToMetamask(activeAddr, tokenId, tokenUri) {
  if (!hasWindowEthereum()) throw new Error("No provider");
  const imgPath = ipfsPath(DEFAULT_IMAGE_IPFS);
  const image   = imgPath ? `https://ipfs.io/ipfs/${imgPath}` : undefined;
  try {
    await window.ethereum.request({
      method: "wallet_watchAsset",
      params: { type: "ERC721", options: { address: activeAddr, tokenId: String(tokenId), image } },
    });
  } catch (e) { console.warn("watchAsset error", e); }
}

export const __env = {
  FIXED_ADDR,
  ADDR_SEPOLIA,
  ADDR_MAINNET,
  OFFSET_MAINNET,
  OFFSET_SEPOLIA,
};
