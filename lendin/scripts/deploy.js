const hre = require("hardhat");

async function main() {
  // 1. Get the deployer's account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // 2. Deploy the MockStakeToken (MST)
  const Token = await hre.ethers.getContractFactory("MockStakeToken");
  const token = await Token.deploy();
  await token.waitForDeployment(); // Wait for the transaction to be mined

  const tokenAddress = await token.getAddress();
  console.log(`MockStakeToken (MST) deployed to: ${tokenAddress}`);

  // 3. Deploy the LendingCircle, passing the token's address to its constructor
  const LendingCircle = await hre.ethers.getContractFactory("LendingCircle"); // <-- Make sure this matches your .sol file name
  const lendingCircle = await LendingCircle.deploy(tokenAddress); // Pass the token address
  await lendingCircle.waitForDeployment();

  const circleAddress = await lendingCircle.getAddress();
  console.log(`LendingCircle deployed to: ${circleAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});