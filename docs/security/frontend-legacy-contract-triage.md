# TEN.IO frontend: contract compatibility and legacy security boundary
**Audit status:** read-only, research findings. No production release or fund movement. Do not silently repoint a live mint UI.

## Source findings

- src/App.jsx exposes a LEGACY owner panel and calls withdrawAllSurplus/withdrawSurplus. Those privileged operations belong ONLY to the legacy ABI, NOT to new no-admin ERC-8060.
- src/web3/TENIOFragmentConnection.js imports src/web3/UmbralFragment.json, but src/App.jsx imports src/web3/ABI.json. They differ: only the former includes mintedEver and nextId. Reconcile before any product relaunch.
- contracts/UmbralFragmentV2.sol is zero bytes. The actual published historical solidity implementation is in contracts/UmbralFragmentV2_flat.sol. It is a flattened source artifact, not full source deployment provenance.
- UmbralFragmentV2_flat.sol defines MINT_PRICE=0.012 ETH, BURN_REFUND=0.01 ETH, MAX_SUPPLY=1000. It computes requiredReserve as totalSupply times 0.01 ETH and allows onlyOwner withdrawal of surplus. It allows onlyOwner to change baseURI for future mints.
- This V2 source does NOT implement valueOf(uint256) or advertise strict IERC721Value 0x88495fe7. It is not the strict ERC-8060 reference.
- The frontend uses VITE_CONTRACT_MAINNET and VITE_CONTRACT_SEPOLIA configured in .env. Neither matches the earlier reviewed historical TENIO Fragment addresses. Do not assume source identity; query code and economic views onchain.
- The tracked .env file has six public VITE_ variables, not observed private-key-named variables. This does NOT replace a repository history/secret audit.
- Frontend getOwnedFragments uses tokenOfOwnerByIndex (ERC721Enumerable). The proposed ERC8060NativeETHReference and TENIOImmutableCollection are ERC721 without Enumerable: new adapters must not blindly reuse that call.
- getStats currently may substitute default zeros for failed or unsupported reads. Zero rendered after an RPC failure is NOT proof of zero liabilities, protected ETH or safe withdrawal.
- Strict ERC-8060 (TEN-IO application draft PR #1) is a separate, nondeployed contract: https://github.com/ten-io-meta/TEN-IO/pull/1 . The new product must NEVER inherit old owner-withdraw controls.

## Priority integration decisions

1. Preserve the legacy frontend until deployment addresses/ABI/runtime are verified, without automatically enabling its mint or withdraw flows on unknown contracts.
2. Implement separate version-pinned adapters: one for verified Umbral V2 and one for strict no-admin ERC-8060. NEVER tell the latter to run legacy onlyOwner withdrawals.
3. Fail closed on wrong chain, no code, unsupported interface, wrong runtime identity, reverted query, or insolvency; NEVER substitute zero as successful proof.
4. Verify full source/compiled runtime, constructor inputs and chain/provenance of configured addresses. The read-only onchain script in this PR records critical observations.
5. Treat approval of this audit PR as distinct from deploying a new contract or changing a live mint interface.

**Limits:** bounded code and ABI review, not an independent full security audit or proof of historic token losses.

## Read-only onchain evidence (2026-11-19)

[GitHub Actions 44567371617](https://github.com/ten-io-meta/tenio-frontend-nuevo/actions/runs/44567371617) SUCCESS: both networks observed by two public RPC providers at fixed block heights, with matching deployed bytecode hashes and critical reserves. The exact JSON replies are saved as a GitHub Actions artifact.

| Field | Mainnet at 26,450,345 | Sepolia at 12,169,588 |
|---|---|---|
| Configured address | 0x841c6a8e1858fd7daf25824e4d305ff06bd7a525 | 0x47C049d0441dae4D06fd7E8d512e4E91B7E92e77 |
| Runtime codehash | 0x4ea55e352e81d0a52669ec97cc6d7ab871315cf54c0060ba615b30e932d0f74f | SAME |
| Ownable owner() | 0x75DA787FDA32092079dbe113c5c9DBC22CBBC455 | SAME |
| MINT_PRICE | 0.012 ETH | 0.012 test ETH |
| BURN_REFUND | 0.010 ETH | 0.010 test ETH |
| MAX_SUPPLY | 1,000 | 1,000 |
| totalSupply live | **7** | **7** |
| mintedEver | 11 | 26 |
| Required reserve | 0.070 ETH | 0.070 test ETH |
| Balance | 0.086 ETH | 0.076 test ETH |
| Computed withdrawable surplus (self-reported) | 0.016 ETH | 0.006 test ETH |
| supportsInterface strict ERC8060 | **false** | **false** |

Those snapshots are **not an audit of historical transfers, a code-to-source compiler identity proof, or evidence of universal safety**. Mainnet and Sepolia share the same executable runtime hash but retain independent balances, mints and owners. Positive solvency margin is a snapshot and the legacy owner can withdraw its computed surplus; it is **not the ownerless immutable new-product model**.

The deployed contract needs a second-stage reproducible compilation/constructor verification against UmbralFragmentV2_flat.sol before claiming full source provenance. No Mainnet mint/burn/withdrawal was invoked by this survey.
