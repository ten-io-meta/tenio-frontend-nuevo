import { formatEther, getAddress, keccak256 } from "ethers";

// These are immutable historical deployments, NOT strict ERC-8060 deployments.
// Addresses and identical runtime hash were corroborated on two RPC providers.
export const LEGACY_UMBRAL_V2 = Object.freeze({
  mainnet: Object.freeze({
    chainId: 1n,
    address: "0x841c6a8e1858fd7daf25824e4d305ff06bd7a525",
  }),
  sepolia: Object.freeze({
    chainId: 11155111n,
    address: "0x47C049d0441dae4D06fd7E8d512e4E91B7E92e77",
  }),
});
export const LEGACY_RUNTIME_HASH =
  "0x4ea55e352e81d0a52669ec97cc6d7ab871315cf54c0060ba615b30e932d0f74f";

export function legacyDeploymentForAddress(address) {
  if (!address) throw new Error("Umbral V2: contract address unavailable");
  const checked = getAddress(address);
  const found = Object.values(LEGACY_UMBRAL_V2).find(
    (item) => getAddress(item.address) === checked
  );
  if (!found) throw new Error("Umbral V2: unverified contract address");
  return found;
}

export async function verifyLegacyReader(provider, address) {
  const target = legacyDeploymentForAddress(address);
  const network = await provider.getNetwork();
  if (BigInt(network.chainId) !== target.chainId) {
    throw new Error(
      "Umbral V2: wrong wallet network. Select the matching chain in MetaMask. No balance was read."
    );
  }
  const code = await provider.getCode(target.address);
  if (!code || code === "0x" || keccak256(code).toLowerCase() !== LEGACY_RUNTIME_HASH) {
    throw new Error("Umbral V2: deployed runtime unverified; financial actions disabled");
  }
  return target;
}

function asBigInt(value, label) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") {
    throw new Error("Umbral V2: missing or invalid " + label);
  }
  try {
    const number = BigInt(value);
    if (number < 0n) throw new Error("negative");
    return number;
  } catch {
    throw new Error("Umbral V2: invalid " + label);
  }
}
function safeCount(value, label) {
  const n = asBigInt(value, label);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Umbral V2: unsafe " + label);
  return Number(n);
}
function eth(value) {
  return Number(formatEther(value));
}

// Strict reads only. NEVER replace RPC failures with 0, arbitrary fallback
// supply caps, or a mint-event count that might be partial/pruned.
export async function readLegacyStats(contract, provider, address) {
  const target = await verifyLegacyReader(provider, address);
  const blockTag = await provider.getBlockNumber();
  const opts = { blockTag };
  const [
    liveRaw, mintedRaw, nextRaw, priceRaw, refundRaw, maxRaw,
    requiredRaw, surplusRaw, balanceRaw,
  ] = await Promise.all([
    contract.totalSupply(opts),
    contract.mintedEver(opts),
    contract.nextId(opts),
    contract.MINT_PRICE(opts),
    contract.BURN_REFUND(opts),
    contract.MAX_SUPPLY(opts),
    contract.requiredReserve(opts),
    contract.surplus(opts),
    provider.getBalance(target.address, blockTag),
  ]);
  return validateLegacySnapshot({
    address: target.address,
    chainId: Number(target.chainId),
    blockNumber: blockTag,
    liveRaw, mintedRaw, nextRaw, priceRaw, refundRaw, maxRaw,
    requiredRaw, surplusRaw, balanceRaw,
  });
}

export function validateLegacySnapshot({
  address, chainId, blockNumber, liveRaw, mintedRaw, nextRaw,
  priceRaw, refundRaw, maxRaw, requiredRaw, surplusRaw, balanceRaw,
}) {
  const live = safeCount(liveRaw, "live supply");
  const minted = safeCount(mintedRaw, "minted history");
  const nextId = safeCount(nextRaw, "next token ID");
  const cap = safeCount(maxRaw, "maximum supply");
  const refund = asBigInt(refundRaw, "refund");
  const price = asBigInt(priceRaw, "mint price");
  const required = asBigInt(requiredRaw, "required reserve");
  const surplus = asBigInt(surplusRaw, "surplus");
  const balance = asBigInt(balanceRaw, "contract balance");
  if (nextId !== minted + 1 || minted < live || cap < minted || price < refund || refund === 0n) {
    throw new Error("Umbral V2: inconsistent issuance/redeem accounting; data unavailable");
  }
  if (required !== BigInt(live) * refund || surplus !== (balance > required ? balance - required : 0n)) {
    throw new Error("Umbral V2: reserve/surplus mismatch; data unavailable");
  }
  if (balance < required) {
    throw new Error("Umbral V2: insufficient reserve detected; transactions disabled");
  }
  return {
    kind: "legacy-umbral-v2",
    address,
    chainId,
    blockNumber,
    maxSupply: cap,
    mintedHistoric: minted,
    supplyLive: live,
    burned: minted - live,
    availableToMint: cap - minted,
    mintPrice: eth(price),
    burnRefund: eth(refund),
    requiredReserveEth: eth(required),
    contractBalanceEth: eth(balance),
    withdrawableEth: eth(surplus),
  };
}

export async function readLegacyOwned(contract, provider, address, holder) {
  await verifyLegacyReader(provider, address);
  const checkedHolder = getAddress(holder);
  const blockTag = await provider.getBlockNumber();
  const opts = { blockTag };
  const count = safeCount(await contract.balanceOf(checkedHolder, opts), "owner balance");
  if (count > 1000) throw new Error("Umbral V2: owner balance exceeds verified cap");
  const ids = [];
  for (let i = 0; i < count; i++) {
    const id = safeCount(
      await contract.tokenOfOwnerByIndex(checkedHolder, i, opts),
      "token ID"
    );
    if (id < 1 || ids.includes(id)) {
      throw new Error("Umbral V2: invalid or duplicate token in enumeration");
    }
    const owner = getAddress(await contract.ownerOf(id, opts));
    if (owner !== checkedHolder) throw new Error("Umbral V2: owner enumeration mismatch");
    ids.push(id);
  }
  return ids;
}
