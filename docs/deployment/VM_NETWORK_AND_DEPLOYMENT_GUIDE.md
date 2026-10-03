# SSI 3-VM System Setup, Network Recovery & Deployment Guide

This document contains complete reference instructions, commands for network & internet recovery, Geth configuration, and deployed smart contract details.

---

## 1. Ubuntu VM Network & Internet Recovery

### 🔍 Root Cause of Internet Loss
- **Subnet Mismatch**: VMware NAT adapter (`VMnet8`) on the Windows host was assigned to subnet `192.168.245.0/24` with Gateway `192.168.245.2`, while the Ubuntu VM had an old static IP on `192.168.233.x`.
- **DNS Resolver Overwrite**: Ubuntu's `systemd-resolved` was missing public nameservers (`8.8.8.8`, `10.10.10.10`).

---

### 🚀 Permanent Fix (Survives Reboots & Shutdowns)

Run this block in your **Ubuntu VM Terminal**:

```bash
# 1. Configure NetworkManager profile for ens33
sudo nmcli connection modify ens33 ipv4.addresses 192.168.245.65/24 ipv4.gateway 192.168.245.2 ipv4.dns "8.8.8.8 10.10.10.10" ipv4.method manual connection.autoconnect yes
sudo nmcli connection up ens33

# 2. Write permanent Netplan configuration
sudo bash -c 'cat <<EOF > /etc/netplan/01-netcfg.yaml
network:
  version: 2
  renderer: NetworkManager
  ethernets:
    ens33:
      dhcp4: false
      addresses:
        - 192.168.245.65/24
      routes:
        - to: default
          via: 192.168.245.2
      nameservers:
        addresses: [8.8.8.8, 10.10.10.10]
EOF'
sudo chmod 600 /etc/netplan/01-netcfg.yaml
sudo netplan apply

# 3. Configure systemd-resolved DNS permanently
sudo bash -c 'cat <<EOF > /etc/systemd/resolved.conf
[Resolve]
DNS=8.8.8.8 10.10.10.10
FallbackDNS=1.1.1.1 8.8.4.4
Domains=~.
EOF'
sudo systemctl restart systemd-resolved
echo -e "nameserver 8.8.8.8\nnameserver 10.10.10.10" | sudo tee /etc/resolv.conf
```

---

### 🧪 How to Test VM Internet Connection

Inside Ubuntu terminal:
```bash
# Test direct IP ping
ping -c 3 8.8.8.8

# Test DNS domain resolution
ping -c 3 google.com
```

---

### 💻 Windows Host Flush & Reset Commands (Run in CMD as Administrator)

If you ever experience host-level network issues or VMware adapter disconnection, open **Command Prompt as Administrator** on Windows:

```cmd
:: 1. Flush DNS and Reset Network Stack
ipconfig /flushdns
ipconfig /release
ipconfig /renew
netsh winsock reset
netsh int ip reset

:: 2. Restart VMware Networking Services
net start VMnetDHCP
net stop "VMware NAT Service" && net start "VMware NAT Service"
```

---

## 2. Blockchain & Geth Node Configuration

### Active Network Details
- **VM Static IP**: `192.168.245.65`
- **RPC URL**: `http://192.168.245.65:8545`
- **Chain ID**: `4321`

### Recommended Geth Startup Command (Inside Ubuntu VM)
Make sure Geth allows external connections by binding to `0.0.0.0`:

```bash
geth --datadir ~/Desktop/singlenode/data \
     --networkid 4321 \
     --http \
     --http.addr "0.0.0.0" \
     --http.port 8545 \
     --http.corsdomain "*" \
     --http.api "eth,net,web3,personal,miner" \
     --allow-insecure-unlock \
     --nodiscover \
     --mine \
     --miner.threads=1
```

---

## 3. Deployed Smart Contracts

Both contracts are verified and deployed on your private Geth blockchain:

| Contract Name | Contract Address | Environment Variable | On-Chain Status |
| :--- | :--- | :--- | :---: |
| **Ethereum DID Registry** | `0x0130110D59e0b9475642D5c12dd616B3c4ede79A` | `ETHR_DID_REGISTRY_ADDRESS` | **DEPLOYED** ✅ (9.6 KB) |
| **VC Registry** | `0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645` | `VC_REGISTRY_ADDRESS` / `VC_REGISTRY_ADDR` | **DEPLOYED** ✅ (7.7 KB) |

### Test Contract Deployment via RPC (Ubuntu or Host)
```bash
# Test DID Registry Bytecode
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x0130110D59e0b9475642D5c12dd616B3c4ede79A", "latest"],"id":1}' \
  http://192.168.245.65:8545

# Test VC Registry Bytecode
curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645", "latest"],"id":1}' \
  http://192.168.245.65:8545
```

---

## 4. SSI Microservices Architecture & Endpoints

| Service | Directory | Port | URL |
| :--- | :--- | :---: | :--- |
| **DIDComm Mediator** | `didcomm-mediator/` | `4000` | `http://127.0.0.1:4000` |
| **Issuer Service** | `issuer-vm/issuer-service/` | `3000` | `http://127.0.0.1:3000` |
| **Holder Agent** | `holder-vm/holder-agent/` | `3001` | `http://127.0.0.1:3001` |
| **Verifier Service** | `verifier-vm/verifier-agent/` | `8081` | `http://127.0.0.1:8081` |
| **PostgreSQL DB** | Docker (`postgres:15`) | `5432` | `localhost:5432` |
| **Redis Cache** | Docker (`redis:7`) | `6379` | `localhost:6379` |

---

## 5. Daily Operations Cheat Sheet

### Start All Microservices
From `ssi-3vm` workspace root:
```bash
docker compose up -d
```

### View Service Logs
```bash
docker compose logs -f issuer-service
docker compose logs -f didcomm-mediator
```

### Stop All Services
```bash
docker compose down
```
