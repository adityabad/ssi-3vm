import { ethers } from 'ethers';
import fetch from 'node-fetch';
import vm from 'vm';
import fs from 'fs-extra';
import path from 'path';

async function loadSolc() {
    const response = await fetch('https://binaries.soliditylang.org/wasm/soljson-v0.8.26+commit.8a97fa7a.js');
    const script = await response.text();
    const sandbox = { module: { exports: {} }, self: {} };
    vm.createContext(sandbox);
    new vm.Script(script).runInContext(sandbox);
    return sandbox.module.exports;
}


async function main() {
    // 1. Setup a provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545'); // Ganache or local Ethereum node

    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Replace with a private key from your local node
    const wallet = new ethers.Wallet(privateKey, provider);

    // 2. Compile the contract
    const contractPath = path.resolve(__dirname, 'contracts', 'VCRegistry.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    const input = {
        language: 'Solidity',
        sources: {
            'VCRegistry.sol': {
                content: source,
            },
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    const contract = output.contracts['VCRegistry.sol']['VCRegistry'];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    // 3. Deploy the contract
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    console.log('Deploying VCRegistry contract...');
    const vcRegistry = await factory.deploy();
    await vcRegistry.deployed();

    console.log(`VCRegistry contract deployed to: ${vcRegistry.address}`);

    // 4. Save the contract address and ABI
    const artifacts = {
        address: vcRegistry.address,
        abi: abi,
    };

    fs.writeFileSync(
        path.resolve(__dirname, 'VCRegistry.json'),
        JSON.stringify(artifacts, null, 2)
    );

    console.log('Contract artifacts saved to VCRegistry.json');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
