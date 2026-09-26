async function main() {
  // Get the signer (the account that will deploy)
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  // Deploy the contract
  //const EthereumDIDRegistry = await ethers.getContractFactory("VCRegistry");
  const EthereumDIDRegistry = await ethers.getContractFactory("EthereumDIDRegistry");
  const registry = await EthereumDIDRegistry.deploy();
  await registry.waitForDeployment();

  console.log("VCRegistry deployed to:", await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
