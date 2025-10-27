# Decentralized Lending Circle DApp

This is a Hardhat project for a decentralized resource "Lending Circle" DApp. It's the backend and smart contract logic for an application that allows users to borrow/share academic resources (like textbooks or digital files) by staking an ERC-20 token as a deposit.

The core of the system is an incentive mechanism:

  * **On-Time Returns:** Users get their full stake back, plus a small reward.
  * **Late Returns:** Users have a daily penalty deducted from their stake. This penalty is then paid into a central `rewardPool` to fund the rewards for on-time users, making the system self-sustaining.

## Backend Tech Stack

  * **Hardhat:** Ethereum development environment for compiling, testing, and deploying.
  * **Solidity:** Language for writing the smart contracts.
  * **Ethers.js:** Library for interacting with the Ethereum blockchain.
  * **Chai:** Assertion library for unit testing.
  * **OpenZeppelin Contracts:** For secure, standard contract implementations (like ERC-20).

-----

## 🚀 Getting Started: A Clean, Pitfall-Free Setup

This project uses a specific, stable set of dependencies (Hardhat v2.x.x) to avoid common `npm` conflicts (`ERESOLVE` errors) and issues related to ES Modules (`"type": "module"`).

Please follow these steps exactly to ensure a smooth setup.

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
# Navigate into the project directory
cd lendin
```

### Step 2: Install Dependencies

This is the most critical step. The `package-lock.json` file included in this repository contains the exact working versions of all dependencies.

```bash
npm install
```

This command *should* install everything perfectly.

\<details\>
\<summary\>\<strong\>⚠️ Troubleshooting: If `npm install` fails...\</strong\>\</summary\>

If you get `ERESOLVE` or other dependency errors, it likely means your local `npm` cache is conflicting with the project's locked versions. To fix this, run a "clean slate" install:

```bash
# 1. (Optional) Clear the npm cache
npm cache clean --force

# 2. Delete old modules and the lock file
rm -rf node_modules
rm -f package-lock.json

# 3. Re-install the known-good stack
npm install hardhat@^2.22.6 @nomicfoundation/hardhat-toolbox@^4.0.0 @openzeppelin/contracts
```

This will rebuild your `node_modules` from scratch using the stable versions this project was built on.

\</details\>

-----

## 🛠️ Usage & Available Scripts

All core backend logic is complete and tested. Here is how to run the project.

### 1\. Compile the Contracts

This will compile all `.sol` files in the `/contracts` folder and generate the necessary ABI files in the `/artifacts` folder.

```bash
npx hardhat compile
```

### 2\. Run the Unit Tests

This will run the complete test suite located in `test/LendingCircle.test.js`. The tests cover all functions, including `addResource`, `borrowResource`, and the complex `returnResource` logic (penalties and rewards).

```bash
npx hardhat test
```

You should see **13 passing tests**. If all tests pass, your backend logic is 100% correct and ready.

### 3\. Start a Local Blockchain Node

This command starts a local Hardhat node that simulates the Ethereum blockchain. It will provide you with 20 test accounts, each funded with 10,000 test ETH.

```bash
npx hardhat node
```

Keep this terminal window running.

### 4\. Deploy to Your Local Node

In a **new terminal window** (while the node is still running), run the deployment script. This will deploy both the `MockStakeToken` and the `LendingCircle` contracts to your local node.

```bash
npx hardhat run scripts/deploy.js --network localhost
```

The script will log the new contract addresses to your console, which you will need for the frontend.

**Example Output:**

```
Deploying contracts with the account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
...
MockStakeToken (MST) deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
LendingCircle deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

-----

## 📁 Project Structure

Here is a brief overview of the key files and directories:

```
/
├── contracts/
│   ├── LendingCircle.sol    # The main DApp logic (staking, borrowing, returning)
│   └── MockStakeToken.sol   # A simple ERC-20 token for testing
│
├── scripts/
│   └── deploy.js            # Script to deploy both contracts
│
├── test/
│   └── LendingCircle.test.js  # Unit tests for all contract functions
│
├── hardhat.config.js      # Hardhat project configuration
├── package.json           # Project dependencies and scripts
└── .gitignore             # Files and folders to ignore for Git
```

## Next Steps

The smart contract backend is fully implemented and tested. The next phase of this project is to build a React/Next.js frontend to provide a user interface for:

  * Connecting a wallet (e.g., MetaMask).
  * Viewing available resources.
  * Approving and borrowing resources (staking tokens).
  * Viewing active borrows and returning resources.