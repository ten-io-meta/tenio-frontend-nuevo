import { explainChainReadError } from "../src/web3/explainChainReadError.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LEGACY_UMBRAL_V2, legacyDeploymentForAddress, verifyLegacyReader,
  validateLegacySnapshot,
} from "../src/web3/legacyUmbralV2.js";
import { createVerifiedStrict8060Reader } from "../src/web3/strict8060Reader.js";

const eth = (n) => BigInt(Math.round(n * 1000)) * 10n ** 15n;
const base = () => ({
  address: LEGACY_UMBRAL_V2.mainnet.address, chainId: 1,
  blockNumber: 26450613,
  liveRaw: 7n, mintedRaw: 11n, nextRaw: 12n,
  priceRaw: eth(0.012), refundRaw: eth(0.01), maxRaw: 1000n,
  requiredRaw: eth(0.07), surplusRaw: eth(0.016), balanceRaw: eth(0.086),
});

test("known Umbral V2 snapshot has seven live tokens and accounted reserves", () => {
  const stats = validateLegacySnapshot(base());
  assert.equal(stats.kind, "legacy-umbral-v2");
  assert.equal(stats.mintedHistoric, 11);
  assert.equal(stats.supplyLive, 7);
  assert.equal(stats.burned, 4);
  assert.equal(stats.availableToMint, 989);
  assert.equal(stats.requiredReserveEth, 0.07);
  assert.equal(stats.contractBalanceEth, 0.086);
  assert.equal(stats.withdrawableEth, 0.016);
});

test("a legitimate zero minted-supply snapshot stays distinguishable from unavailable", () => {
  const x = base();
  Object.assign(x, {
    liveRaw: 0n, mintedRaw: 0n, nextRaw: 1n,
    requiredRaw: 0n, surplusRaw: 0n, balanceRaw: 0n,
  });
  const s = validateLegacySnapshot(x);
  assert.equal(s.supplyLive, 0);
  assert.equal(s.mintedHistoric, 0);
});

test("missing RPC data is never interpreted as zero", () => {
  assert.throws(() => validateLegacySnapshot({ ...base(), liveRaw: undefined }));
  assert.throws(() => validateLegacySnapshot({ ...base(), requiredRaw: null,
    // null would otherwise coerce to 0 using BigInt(null), so check explicitly.
  }));
});

test("inconsistent reserve/surplus and apparent insolvency abort display", () => {
  assert.throws(() => validateLegacySnapshot({...base(), requiredRaw: eth(0.01)}), /reserve/);
  assert.throws(() => validateLegacySnapshot({...base(), surplusRaw: 0n}), /surplus/);
  assert.throws(() => validateLegacySnapshot({...base(), balanceRaw: eth(0.06),
    surplusRaw: 0n}), /insufficient reserve|mismatch/i);
  assert.throws(() => validateLegacySnapshot({...base(), nextRaw: 11n}), /inconsistent/);
});

test("wrong and unknown addresses cannot resolve to a historic contract", () => {
  assert.equal(legacyDeploymentForAddress(LEGACY_UMBRAL_V2.sepolia.address).chainId, 11155111n);
  assert.throws(() => legacyDeploymentForAddress("0x0000000000000000000000000000000000000001"), /unverified/i);
  assert.throws(() => legacyDeploymentForAddress(null), /unavailable/i);
});

test("legacy verification rejects wrong wallet network before checking code", async () => {
  let codeRead = false;
  const provider = {
    async getNetwork() { return { chainId: 11155111n }; },
    async getCode() { codeRead = true; return "0x6000"; },
  };
  await assert.rejects(
    verifyLegacyReader(provider, LEGACY_UMBRAL_V2.mainnet.address), /wrong wallet network/i
  );
  assert.equal(codeRead, false);
});

test("unattested executable fails closed on the expected network", async () => {
  const provider = {
    async getNetwork() { return { chainId: 1n }; },
    async getCode() { return "0x6000"; },
  };
  await assert.rejects(
    verifyLegacyReader(provider, LEGACY_UMBRAL_V2.mainnet.address), /runtime unverified/i
  );
});

test("new ERC-8060 adapter stays disabled without complete independent deployment pin", async () => {
  await assert.rejects(
    createVerifiedStrict8060Reader({}, {}),
    /verified deployment configuration required/
  );
});

test("regression: financial and holder read paths contain no catch-to-zero", () => {
  const connection = readFileSync("src/web3/TENIOFragmentConnection.js", "utf8");
  assert.equal(/\.catch\(\(\)\s*=>\s*0n?\)/.test(connection), false);
  assert.equal(/getStats[\s\S]*countMintsViaEvents/.test(connection), false);
  assert.equal(/return ADDR_SEPOLIA;\s*\n}/.test(connection), false);
});

test("RPC exceptions never leak raw transaction JSON into the visible message", () => {
  const payload = '{"error":{"code":-32005,"message":"Simulated RPC unavailable"},"params":["eth_getCode"]}';
  const message = explainChainReadError(new Error("could not coalesce error "+payload));
  assert.match(message, /Datos no disponibles/);
  assert.equal(message.includes("eth_getCode"), false);
  assert.equal(message.includes("error"), false);
});

test("inconsistent reserves and wrong runtime have actionable and distinct messages", () => {
  assert.match(explainChainReadError(new Error("insufficient reserve")), /Reserva insuficiente/);
  assert.match(explainChainReadError(new Error("runtime unverified")), /código del contrato/);
  assert.match(explainChainReadError(new Error("wrong wallet network"), "en"), /Wrong wallet network/);
  assert.match(explainChainReadError(new Error("unknown"), "es", true), /titularidad|qué NFT/);
});
