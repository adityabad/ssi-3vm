# SSI 3-VM

A Self-Sovereign Identity (SSI) demo for academic credentials. A university (issuer) signs a W3C Verifiable Credential, the student (holder) keeps it in their own wallet, and an employer (verifier) checks it against DIDs and a `VCRegistry` contract on a private Ethereum (Geth) chain. Messages between parties go through a DIDComm mediator.

## Repository layout

```
.
├── issuer-vm/                 VM 2: the issuing institution
│   ├── issuer-service/        Express API that signs and anchors VCs (port 3000)
│   └── issuer-dashboard/      React/Vite admin UI (port 5173)
├── holder-vm/                 VM 3: the student
│   ├── holder-agent/          DIDComm pack/unpack agent (port 3001)
│   └── holder-wallet/         React/Vite wallet UI (port 5174)
├── verifier-vm/               VM 4: the employer
│   ├── verifier-agent/        Express API that verifies VPs/VCs (port 8081)
│   └── verifier-wallet/       React/Vite verifier portal (port 5175)
├── didcomm-mediator/          DIDComm mailbox relay over WebSocket (port 4000)
├── blockchain/                VM 1: VCRegistry contract and DID/VC scripts (Geth on 8545)
├── deploy/nginx/              Reverse proxy config for the public deployment
├── scripts/windows/           start-all.bat / stop-all.bat for local development
├── tests/
│   ├── e2e/                   Part 1 functional tests and Part 2 performance benchmarks
│   └── results/               JSON output written by those runs
├── tools/reports/             Python scripts that build the Word reports in docs/reports
├── docs/
│   ├── architecture/          Technical specification and design deep dives
│   ├── deployment/            VM networking, Geth and contract deployment guide
│   ├── planning/              Implementation plans and roadmap
│   ├── reports/               Generated Word reports
│   └── testing/               Test evidence pages, screenshots and workshop material
└── docker-compose.yml         Mediator, issuer, holder agent, verifier, Postgres, Redis
```

## Running locally

With Docker:

```
docker compose up --build
```

On Windows without Docker, install dependencies in each service folder (`npm install`), then run `scripts\windows\start-all.bat`. It opens one window per service; `scripts\windows\stop-all.bat` stops them.

Services read secrets such as `ISSUER_PK` and `RPC_URL` from environment variables or a `.env` file, which is git-ignored.

## Tests

The end-to-end runners talk to a running issuer service (`localhost:3000`) and mediator (`localhost:4000`) and borrow dependencies from `issuer-vm/issuer-service/node_modules`:

```
node tests/e2e/run_part1_tests.mjs   # functional tests  -> tests/results/part1_test_results.json
node tests/e2e/run_part2_tests.mjs   # benchmarks        -> tests/results/part2_benchmark_results.json
```

## Reports

```
pip install python-docx
python tools/reports/generate_testing_plan_doc.py   # testing evidence reports -> docs/reports/
python tools/reports/generate_word_report.py        # master technical report  -> docs/reports/
```
