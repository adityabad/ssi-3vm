// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VCRegistry with Paymaster & Bulk Verification Support
 * @notice Enterprise Multi-Tenant Registry supporting ERC-2771 Gasless Meta-Transactions and Bulk Verification.
 */
contract VCRegistry {
    struct VC {
        address issuer;
        bytes issuerSignature;
        bool revoked;
        string tenantId;
    }

    struct HolderSignature {
        address holder;
        bytes signature;
    }

    mapping(string => VC) private VCs;
    mapping(bytes32 => HolderSignature) private holderSignatures;
    
    // ERC-2771 Trusted Forwarder for Paymaster / Gasless transactions
    address public trustedForwarder;
    address public owner;

    // Only addresses the owner has registered may anchor credentials
    mapping(address => bool) public registeredIssuers;

    event VCIssued(string vcId, address indexed issuer, string tenantId);
    event VCRevoked(string vcId, address indexed issuer);
    event HolderSignatureStored(bytes32 indexed vpHash, address indexed holder);
    event TrustedForwarderUpdated(address indexed newForwarder);
    event IssuerRegistered(address indexed issuer, bool allowed);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner");
        _;
    }

    modifier onlyRegisteredIssuer() {
        require(registeredIssuers[_msgSender()], "Sender is not a registered issuer");
        _;
    }

    modifier onlyIssuer(string memory vcId) {
        require(VCs[vcId].issuer == _msgSender(), "Only the issuer can perform this action");
        _;
    }

    function setTrustedForwarder(address forwarder) external onlyOwner {
        trustedForwarder = forwarder;
        emit TrustedForwarderUpdated(forwarder);
    }

    function setRegisteredIssuer(address issuer, bool allowed) external onlyOwner {
        registeredIssuers[issuer] = allowed;
        emit IssuerRegistered(issuer, allowed);
    }

    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == trustedForwarder;
    }

    function _msgSender() internal view returns (address sender) {
        if (isTrustedForwarder(msg.sender)) {
            // The assembly code extracts the sender address appended by the Trusted Forwarder
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            return msg.sender;
        }
    }

    function issueVC(string memory vcId, bytes memory issuerSignature) public onlyRegisteredIssuer {
        issueVCTenant(vcId, issuerSignature, "default");
    }

    function issueVCTenant(string memory vcId, bytes memory issuerSignature, string memory tenantId) public onlyRegisteredIssuer {
        require(VCs[vcId].issuer == address(0), "VC already exists");
        address issuer = _msgSender();
        VCs[vcId] = VC(issuer, issuerSignature, false, tenantId);
        emit VCIssued(vcId, issuer, tenantId);
    }

    function revokeVC(string memory vcId) public onlyIssuer(vcId) {
        VCs[vcId].revoked = true;
        emit VCRevoked(vcId, _msgSender());
    }

    function getVC(string memory vcId) public view returns (address, bytes memory, bool, string memory) {
        VC memory vc = VCs[vcId];
        return (vc.issuer, vc.issuerSignature, vc.revoked, vc.tenantId);
    }

    function storeHolderSignature(bytes32 vpHash, bytes memory signature) public {
        require(holderSignatures[vpHash].holder == address(0), "Holder signature already stored");
        address holder = _msgSender();
        holderSignatures[vpHash] = HolderSignature(holder, signature);
        emit HolderSignatureStored(vpHash, holder);
    }

    function getHolderSignature(bytes32 vpHash) public view returns (address, bytes memory) {
        HolderSignature memory hs = holderSignatures[vpHash];
        return (hs.holder, hs.signature);
    }

    function verify(
        string memory vcId,
        address issuer,
        bytes memory issuerSignature,
        bytes32 vpHash,
        address holder,
        bytes memory holderSignature
    ) public view returns (bool, string memory) {
        VC memory vc = VCs[vcId];
        if (vc.issuer == address(0)) {
            return (false, "VC does not exist");
        }
        if (vc.revoked) {
            return (false, "VC has been revoked");
        }
        if (vc.issuer != issuer) {
            return (false, "Mismatched issuer");
        }
        if (keccak256(vc.issuerSignature) != keccak256(issuerSignature)) {
            return (false, "Mismatched issuer signature");
        }

        HolderSignature memory hs = holderSignatures[vpHash];
        if (hs.holder == address(0)) {
            return (false, "Holder signature not found");
        }
        if (hs.holder != holder) {
            return (false, "Mismatched holder");
        }
        if (keccak256(hs.signature) != keccak256(holderSignature)) {
            return (false, "Mismatched holder signature");
        }

        return (true, "Verification successful");
    }

    /**
     * @notice Bulk verification endpoint to check multiple VCs in a single call.
     */
    function batchVerify(string[] memory vcIds) public view returns (bool[] memory results, bool[] memory revocations) {
        results = new bool[](vcIds.length);
        revocations = new bool[](vcIds.length);
        for (uint256 i = 0; i < vcIds.length; i++) {
            VC memory vc = VCs[vcIds[i]];
            results[i] = (vc.issuer != address(0));
            revocations[i] = vc.revoked;
        }
    }
}

