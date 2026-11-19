# Umbral V2 frontend — pinned dependency and development-tool security review

**Date:** 2026-11-19. **Scope:** GitHub branch `audit/frontend-dependencies-ui-e2e-v1`, stacked on [PR #4](https://github.com/ten-io-meta/tenio-frontend-nuevo/pull/4) through [PR #5](https://github.com/ten-io-meta/tenio-frontend-nuevo/pull/5). No contracts, holders, addresses, ETH, live website, deployment or wallet keys are modified.

## Applied to GitHub

This branch's committed `package.json` and `package-lock.json` now fix:
- `ethers: 6.17.0` (exact direct version);
- transitive `ws: 8.21.0` (installed lockfile version);
- removal of dev-only `truffle-flattener` and its orphaned dependency graph. The historical `contracts/UmbralFragmentV2_flat.sol` is retained; do not remove its security/provenance evidence.

This reproduces the previously tested candidate. The **one-shot guarded CI** also required a clean npm production-only advisory report (0 findings), no critical findings, passing 9 deterministic tests, Vite build and ESLint before committing the two files. The elevated workflow removes itself from the committed branch.

### Latest classified audit

| Tree | Before | Audited candidate after targeted change |
| --- | ---: | ---: |
| Critical | 2 | 0 |
| High | 29 | 28 |
| Moderate | 13 | 4 |
| Low | 9 | 9 |
| **Total** | **53** | **41** |
| **npm audit --omit=dev** | **2** | **0** |

- [Baseline full versus production-only audit](https://github.com/ten-io-meta/tenio-frontend-nuevo/actions/runs/44587307146)
- [Production dependency upgrade candidate](https://github.com/ten-io-meta/tenio-frontend-nuevo/actions/runs/44587827123)
- [Lockfile candidate with dev flattener removal](https://github.com/ten-io-meta/tenio-frontend-nuevo/actions/runs/44589298424)

The counts represent npm advisory records/affected packages for that dated lockfile. They can change with the npm advisory database. `npm audit --omit=dev` is *not* a runtime exploitability proof or an audit of deployed bytecode.

## Remaining 41 findings — developer tooling review

These are **not harmless** merely because `--omit=dev` returns zero: dangerous archives, malicious source maps or other untrusted files used by build tooling can threaten a developer/CI machine.

| Group | Observed affected package families | Priority and safe action |
| --- | --- | --- |
| Dev server / build pipeline | `vite`, `rollup`, `postcss`, `browserslist`, `nanoid`, `source-map-js` | **High**: upgrade compatible Vite/bundler graph in a *separate* reviewed PR; do not expose the Vite dev server publicly or process untrusted source maps until tested |
| Hardhat contract tooling | `hardhat`, `@nomicfoundation/hardhat-*`, `@nomicfoundation/ignition-core`, `adm-zip`, `zod`, `undici`, `bn.js` | **High**: isolate to reproducible audited contract-tool versions; avoid automatically downgrading Hardhat 3 or changing Solidity compilation settings. Validate exact bytecode/test reproducibility after every change |
| Filesystem/CLI and parser transitives | `@humanfs/node`, `glob`, `minimatch`, `brace-expansion`, `picomatch`, `js-yaml`, `ajv`, `flatted`, `lodash`, `lodash-es` | **High/medium** depending on input: avoid running build/CI tasks over attacker-controlled paths/configs; update through compatible ancestor constraints |
| Test tooling | `mocha`, `diff`, `serialize-javascript`, `@babel/core`, `elliptic` | **Medium/high**: stage test-runner and plugins upgrade separately, rerun complete suites and check Node compatibility |

Representative advisories in this snapshot include:
- `vite`: [GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583) (dev server).
- `rollup`: [GHSA-mw96-cpmx-2vgc](https://github.com/advisories/GHSA-mw96-cpmx-2vgc) (file write).
- `adm-zip`: [GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85) (archive allocation).
- `undici`: [GHSA-2mjp-6q6p-2qxm](https://github.com/advisories/GHSA-2mjp-6q6p-2qxm) (HTTP parsing).
- `minimatch`: [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) (DoS).

**Important:** This table is a triage categorization, not a finding that our application has exercised an exploitable code path. Machine-readable exact versions, affected transitive paths and upstream advisory links are archived as `frontend-dependency-security-review` and `frontend-candidate-no-legacy-flattener` artifacts in GitHub Actions.

## Required release checks

1. On the **committed** lockfile, run `npm ci`, `npm audit --omit=dev`, `node --test tests/legacyAdapters.test.mjs`, `npm run build` and `npm run lint`.
2. Execute all seven local Chrome EIP-1193 mocked UI scenarios, and verify **zero transactions** and no accidental redirect from legacy V2 to strict ERC-8060. Previous passing pre-fix simulation: [run 44590789965](https://github.com/ten-io-meta/tenio-frontend-nuevo/actions/runs/44590789965).
3. Independently review the UI manually with a real browser on Mainnet/Sepolia for disconnected, wrong chain, unreadable RPC and denied user network switch **without authorizing onchain writes**. No public deployment or merge until this gate is satisfied.
4. Revisit remaining 41 development advisories as separate, carefully reviewed updates. **Never run `npm audit fix --force` on this wallet/contract source tree.**
5. No historical NFT migration, burn, mint, owner withdrawal, ETH transfer, contract deployment or live website update is authorized by this dependency change.
