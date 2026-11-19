# Umbral V2 legacy / ERC-8060 strict adapter separation

**Status:** draft integration safety change, 2026-11-19. No onchain migration, no contract deployment or live website update.

## Contracts must not be mixed

| Profile | Deployment / scope | ABI and operations | Release policy |
| --- | --- | --- | --- |
| `legacy-umbral-v2` | Mainnet `0x841c6a8e1858fd7daf25824e4d305ff06bd7a525` on chain 1 | Existing `mintFragment`, owner-only `burn`, `tokenOfOwnerByIndex`, `requiredReserve`, historical owner-only surplus withdrawal | Preserve historical holders and live chain state |
| `legacy-umbral-v2` | Sepolia `0x47C049d0441dae4D06fd7E8d512e4E91B7E92e77` on chain 11155111 | Same deployed runtime and legacy ABI | Preserve historical holders and test chain |
| `strict-erc8060` | **No production contract configured** | New isolated `valueOf` / `burn` interface; only a *read-only* adapter exists | Block until independently verified deployment and explicit product migration plan |

Legacy pinned deployed runtime keccak256:
`0x4ea55e352e81d0a52669ec97cc6d7ab871315cf54c0060ba615b30e932d0f74f`.

The historic deployed contracts do **not** support draft ERC-8060 `0x88495fe7` and have an administrator-only calculated-surplus withdrawal function. This is **not** the no-admin ERC-8060 model. Source/holder provenance: [Umbral V2 PR #3](https://github.com/ten-io-meta/tenio-frontend-nuevo/pull/3).

## Mandatory safe behavior

1. Every historical financial and holder read must first check **wallet chain ID**, known address and **deployed runtime hash**. Read queries never trigger wallet network switching; only an explicit user action may request a network switch.
2. Failure reading `balanceOf`, `ownerOf`, `tokenOfOwnerByIndex`, `mintedEver`, `nextId`, `totalSupply`, `MAX_SUPPLY`, `MINT_PRICE`, `BURN_REFUND`, `requiredReserve`, `surplus` or ETH balance is **UNKNOWN / ERROR**, not zero. No partial enumeration and no inferred burn from `ownerOf` failure.
3. Read financial views at a common block number. Verify `nextId = mintedEver + 1`, live supply <= minted history <= max supply, reserve = live supply x refund, and surplus = max(balance - reserve, 0). If balance < reserve, block financial actions.
4. If the chain, account, address or RPC state changes, previous verified results become stale. Remove them until independently re-read; never show stale historic surplus as the current available balance.
5. The owner panel is specific to the **legacy** contract only, requires a verified current owner, and must not be copied to ERC-8060. A generic ERC-8060 interface claim alone does not establish economic backing, verified provenance or solvency.
6. Never silently repoint old NFTs to the new interface, burn them, renounce admin privileges on deployed historical contracts, or run an automatic migration. Any future migration requires voluntary opt-in and a separate audited process.

## Implementation and tests

- `src/web3/legacyUmbralV2.js` — profile, network/runtime verification and fail-closed accounting/owner reads.
- `src/web3/strict8060Reader.js` — **unused** read-only adapter; requires verified chain/address/runtime and strict ERC-165; contains no transaction methods or default deployment.
- `src/web3/TENIOFragmentConnection.js` — existing UI interface, now restricted to historical deployments.
- `src/App.jsx` / `src/components/FragmentStats.jsx` — show unavailable instead of a manufactured zero or burned token; block actions on unverified reads.
- `tests/legacyAdapters.test.mjs` — nine local safety tests including unknown versus legitimate zero.
- CI: `npm ci && node --test tests/legacyAdapters.test.mjs && npm run build && npm run lint`.

**CI result:** [run #44584081848](https://github.com/ten-io-meta/tenio-frontend-nuevo/actions/runs/44584081848) **SUCCESS**, 9/9 regression tests, build success, lint success. Static checks are not wallet-browser E2E tests.

## Remaining manual QA before merge / publish

- With no injected wallet, the dashboard displays unavailable data and transaction controls are disabled.
- With Ethereum Mainnet selected, only the verified legacy Mainnet address is used; with Sepolia, only the verified testnet address.
- With unsupported/wrong chain, no stats/owner/surplus are shown, and polling does **not** silently change the wallet network.
- Interrupted RPC, stale token ownership, bad runtime, or failed owner enumeration never appear as "zero tokens", "no debt" or "burned".
- Real owner/not-owner UI access, mint/burn/withdraw confirmation flow, and chain switch callbacks require manual browser review with no financial transactions on live Mainnet.
- **Dependency risk gate:** CI's `npm ci` log reports **53 dependency vulnerabilities (9 low, 13 moderate, 29 high, 2 critical)**. This is a lockfile-wide count, **not** confirmation that all affect the production bundle or are exploitable. Audit direct versus transitive production dependencies and patch carefully on a separate PR; avoid blind `npm audit fix --force`.

**Do not merge or deploy from this draft until the manual QA and security dependency triage are reviewed.**
