# Perimeter Protocol

This repository contains an audited, open-source reference implementation for the Perimeter Protocol that anyone can freely use to build unique credit applications using USDC.

## About Perimeter

A project by [Circle Research](https://www.circle.com/en/circle-research), Perimeter offers several important features, such as the ability to delegate loan management and monitoring, integration with [open identity standards](https://www.circle.com/en/verite), and the flexibility to accommodate different types of credit instruments. Perimeter stands out for not relying on a protocol token and its adaptability to various scenarios. Please read more about Perimeter [in the whitepaper](https://www.circle.com/hubfs/Circle%20Research/Whitepapers/Perimeter_Protocol_Circle_Research.pdf).

Please note: Perimeter Protocol is a Proof-of-Concept by Circle Research and is provided “as-is” as an open-source contribution. As a research project, it has not been productionized nor does Circle have intentions to productionize it. Anyone using or extending Perimeter Protocol does so at their own risk, and should carefully consider whether additional security audits, reviews, or testing are needed before production use.

## Smart Contract Architecture

Perimeter consists of a number of smart contracts including lending pools, loan constructs, and permissioning helpers.

![](./img/smart_contract_architecture.png)

- Protocol participants include protocol administrators, Pool Admins, Borrowers, and Lenders.

- Global protocol administrative roles (`Admin`, `Pauser`, `Deployer`, `Operator`) are defined through the singleton `ServiceConfiguration` contract.

- PoolAdmins create [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626) compliant lending pools through a `PoolFactory`. Pools manage the accounting related to deposits, withdrawals, loan funding, loan payments, and defaults.

- Borrowers create loans through a `LoanFactory`, which are tied to a pool. Each loan is self-contained, with its own lifecycle and maturation process according to its unique schedule and terms. Both open and fixed-term loans are available.

- Lenders deposit into pools to receive pool tokens at an exchange rate determined by the Pool and based on the Pool's current Net Asset Value (NAV). The NAV is computed based on the available liquidity, liquidity outstanding (deployed to loans), and expected interest at that given block.

The Perimeter architecture was designed with modularity in mind, allowing new `PoolFactory` and `LoanFactory` instances to be attached to the protocol through the global `ServiceConfiguration`, potentially creating Pools and Loans with new features.

### Upgradeability

Perimeter allows upgrades to be performed unilaterally by the global `Deployer` role. The following contracts are upgradeable by the `Deployer`:

- "Singleton" contracts like the `ServiceConfiguration`, `PoolAdminAccessControl`, and `ToSAcceptance` can be individually upgraded in-place through the [UUPS](https://docs.openzeppelin.com/contracts/4.x/api/proxy#transparent-vs-uups) pattern.

- The "1-to-N" contracts emitted by factories (`Pool`, `Loan`, `WithdrawController`, `Vault`, `PoolController`) are implemented as Beacon proxies, allowing a single transaction to update an implementation across all proxies simultaneously.

### Permissioning

As noted in the diagram, there are several layers of permissioning, which utilize a combination of [Verite](https://www.circle.com/en/verite)-based, privacy-preserving, decentralized identity credentials and standard allowlists, allowing Pool Admins to determine the appropriate permissioning strategy for their pools.

Specifically, for handling identity credentials, Perimeter follows a verifier pattern, in which trusted verifiers are registered with the protocol and can attest to verifying the privacy-preserving credentials off-chain. This verification result is then recorded on-chain, granting access for a period of time.

Perimeter applies permissioning in several places:

- Permissioning which accounts can create new Pools. This is gated through the `PoolAdminAccessControl`, a singleton contract which maintains a registry of Verite credential attestations for Pool Admins. The specific allowed credential schemas and trusted verifiers can be configured through the protocol `Operator`. Additionally, consenting to the protocol-wide Terms of Service is required, managed through the `ToSAcceptanceRegistry`.

- Permissioning lender access to Pools: a flexible `PoolAccessControl` contract allows individual Pool Admins to specify either a credential-based approach to permissioning or an allow list-based approach (or both) for their given Pool. Prior to enabling access, lenders must first mark their consent to the `ToSAcceptanceRegistry`.

## Getting started

Perimeter is written as a basic [Hardhat](https://hardhat.org/) project. To get started, install the dependencies:

```sh
npm install
```

Copy .env.example and update with appropriate values:

```sh
cp .env.example .env
```

## Running a localhost node

For local dev, it's helpful to test scripts against a network running locally.

```sh
npx hardhat node
npx hardhat run scripts/deploy.ts
```

## Generating Docs

Documentation is generated by [solidity-docgen](https://github.com/OpenZeppelin/solidity-docgen)

```sh
npm run docs

# or

npx hardhat docgen
```

## Testing

```sh
npm test

# or

npx hardhat test
```

### Gas usage reports

```sh
npm run test:gas

# or

REPORT_GAS=true npx hardhat test
```

### Code Coverage

```sh
npm run test:coverage

# or

npx hardhat coverage
```

## Hardhat Tasks

There are several hardhat tasks to allow for easy modification of the contracts.

Updating the ServiceConfiguration:

- setPaused
- setLiquidityAsset
- setLoanFactory
- setTosAcceptanceRegistry

You can find complete instructions for how to run each command by running the following:

```sh
npx hardhat setPaused --help
```

Here is an example command to pause a hypothetical contract:

```sh
npx hardhat setPaused --address 0x869076ca72531B5474F9182d735a3e3F2e365fc6 --paused true
```

## Getting a Verite Verification Result

Update the config in `scripts/verite-verify.ts` with the appropriate values, then run

```sh
npx hardhat run scripts/verite-verify.ts
```

This will print out a verification result that can be send to the `verify()` method on the given contract.

## Etherscan Verification

Contract source can be uploaded and verified to Etherscan. Update `.env` to include your Etherscan API key.

For each deployed contract, run the following:

```
npx hardhat verify --network goerli CONTRACT_ADDRESS
```

There are three contracts that require constructor arguments:

- WithdrawControllerFactory
- PoolControllerFactory
- PoolFactory

```
npx hardhat verify --network goerli CONTRACT_ADDRESS arg1 arg2 arg3
```

## Deployment

There are several deployment scripts available (see `scripts/deploy.ts`). These require a number of values to be set in an `.env` file in the root of the repository.

## Contributing

We welcome contributions, bug fixes, and feature suggestions to Perimeter. Please open an issue or a pull request with your ideas!
