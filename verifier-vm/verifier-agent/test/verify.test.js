// Runs verifyFullPresentation against a mock JSON-RPC node standing in for Geth.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as ethers from 'ethers';
import { createVerifiableCredentialJwt, createVerifiablePresentationJwt } from 'did-jwt-vc';
import { ES256KSigner, createJWT, hexToBytes } from 'did-jwt';

const DID_REGISTRY = '0x0130110D59e0b9475642D5c12dd616B3c4ede79A';
const VC_REGISTRY = '0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645';
const registryIface = new ethers.Interface([
  'function isValidVC(bytes32 vcId) view returns (bool)',
  'function getVC(bytes32 vcId) view returns (tuple(address issuer, address subject, bool active, uint256 issuedAt))',
]);

const issuerWallet = ethers.Wallet.createRandom();
const rogueWallet = ethers.Wallet.createRandom();
const holderWallet = ethers.Wallet.createRandom();
const otherHolderWallet = ethers.Wallet.createRandom();
const didOf = (w) => `did:ethr:4321:${w.address}`;
const signerOf = (w) => ({ did: didOf(w), signer: ES256KSigner(hexToBytes(w.privateKey), true), alg: 'ES256K-R' });

// vcId (bytes32) -> { issuer, active }
const onChain = new Map();
const register = (vcId, issuer, active = true) => onChain.set(ethers.id(vcId), { issuer: issuer.address, active });

function handleCall({ to, data }) {
  if (to.toLowerCase() === DID_REGISTRY.toLowerCase()) {
    return ethers.zeroPadValue('0x', 32); // changed(address) = 0: no on-chain DID updates
  }
  const call = registryIface.parseTransaction({ data });
  const rec = onChain.get(call.args[0]) || { issuer: ethers.ZeroAddress, active: false };
  if (call.name === 'isValidVC') return registryIface.encodeFunctionResult('isValidVC', [rec.active]);
  return registryIface.encodeFunctionResult('getVC', [[rec.issuer, ethers.ZeroAddress, rec.active, 0]]);
}

let server;
let verifyFullPresentation;

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const reqs = JSON.parse(body);
      const answer = (r) => {
        let result;
        if (r.method === 'eth_chainId') result = '0x10e1';
        else if (r.method === 'net_version') result = '4321';
        else if (r.method === 'eth_blockNumber') result = '0x1';
        else if (r.method === 'eth_call') result = handleCall(r.params[0]);
        else return { jsonrpc: '2.0', id: r.id, error: { code: -32601, message: r.method } };
        return { jsonrpc: '2.0', id: r.id, result };
      };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(Array.isArray(reqs) ? reqs.map(answer) : answer(reqs)));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.RPC_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.ETHR_DID_REGISTRY_ADDRESS = DID_REGISTRY;
  process.env.VC_REGISTRY_ADDRESS = VC_REGISTRY;
  process.env.TRUSTED_ISSUER_DIDS = didOf(issuerWallet);
  ({ verifyFullPresentation } = await import('../lib/verify.js'));
});

after(() => server.close());

const issue = (issuer, subject, vcId) =>
  createVerifiableCredentialJwt(
    {
      sub: didOf(subject),
      nbf: Math.floor(Date.now() / 1000),
      jti: vcId,
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'AcademicDegreeCredential'],
        credentialSubject: { degreeName: 'BSc', gpa: '3.9', vcId },
      },
    },
    signerOf(issuer)
  );

const present = (holder, vcJwts) =>
  createVerifiablePresentationJwt(
    {
      aud: 'did:ethr:4321:0xVerifierNode',
      vp: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: vcJwts,
      },
    },
    signerOf(holder)
  );

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const isVerified = (r) => Boolean(r.vp.isValid && r.vcs.length > 0 && r.vcs.every((v) => v.isValid));

test('accepts a signed presentation of a trusted, anchored credential', async () => {
  register('vc-ok', issuerWallet);
  const r = await verifyFullPresentation(await present(holderWallet, [await issue(issuerWallet, holderWallet, 'vc-ok')]));
  assert.equal(isVerified(r), true, JSON.stringify(r.vcs.map((v) => v.error)));
});

test('rejects a presentation with a fake holder signature', async () => {
  register('vc-unsigned-vp', issuerWallet);
  const vc = await issue(issuerWallet, holderWallet, 'vc-unsigned-vp');
  const vp = `eyJhbGciOiJFUzI1NksifQ.${b64({ iss: didOf(holderWallet), vp: { verifiableCredential: [vc] } })}.holder_vp_signature`;
  const r = await verifyFullPresentation(vp);
  assert.equal(isVerified(r), false);
  assert.match(r.vp.error, /signature/i);
});

test('rejects a credential whose claims were edited after signing', async () => {
  register('vc-tampered', issuerWallet);
  const [h, p, s] = (await issue(issuerWallet, holderWallet, 'vc-tampered')).split('.');
  const payload = JSON.parse(Buffer.from(p, 'base64url'));
  payload.vc.credentialSubject.gpa = '4.0';
  const r = await verifyFullPresentation(await present(holderWallet, [`${h}.${b64(payload)}.${s}`]));
  assert.equal(isVerified(r), false);
  assert.match(r.vcs[0].error, /signature/i);
});

test('rejects a plain JSON credential object', async () => {
  const vcObj = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential'],
    issuer: { id: didOf(issuerWallet) },
    issuanceDate: new Date().toISOString(),
    credentialSubject: { id: didOf(holderWallet), degreeName: 'PhD' },
    proof: { type: 'Forged' },
  };
  const r = await verifyFullPresentation(await present(holderWallet, [vcObj]));
  assert.equal(isVerified(r), false);
});

test('rejects a self-issued credential even if the rogue issuer anchored it', async () => {
  register('vc-rogue', rogueWallet);
  const r = await verifyFullPresentation(await present(holderWallet, [await issue(rogueWallet, holderWallet, 'vc-rogue')]));
  assert.equal(isVerified(r), false);
  assert.match(r.vcs[0].error, /not a trusted issuer/);
});

test('rejects a credential id anchored on-chain by a different address', async () => {
  register('vc-squatted', rogueWallet);
  const r = await verifyFullPresentation(await present(holderWallet, [await issue(issuerWallet, holderWallet, 'vc-squatted')]));
  assert.equal(isVerified(r), false);
  assert.match(r.vcs[0].error, /registered on-chain by/);
});

test('rejects a revoked or unregistered credential', async () => {
  register('vc-revoked', issuerWallet, false);
  for (const id of ['vc-revoked', 'vc-missing']) {
    const r = await verifyFullPresentation(await present(holderWallet, [await issue(issuerWallet, holderWallet, id)]));
    assert.equal(isVerified(r), false, id);
  }
});

test('rejects a credential presented by someone other than its subject', async () => {
  register('vc-stolen', issuerWallet);
  const r = await verifyFullPresentation(await present(otherHolderWallet, [await issue(issuerWallet, holderWallet, 'vc-stolen')]));
  assert.equal(isVerified(r), false);
  assert.match(r.vcs[0].error, /does not match presenting holder/);
});

test('rejects a presentation with no credentials', async () => {
  const { did, signer, alg } = signerOf(holderWallet);
  const vp = await createJWT(
    { vp: { '@context': ['https://www.w3.org/2018/credentials/v1'], type: ['VerifiablePresentation'], verifiableCredential: [] } },
    { issuer: did, signer },
    { alg }
  );
  const r = await verifyFullPresentation(vp);
  assert.equal(isVerified(r), false);
  assert.match(r.vp.error ?? '', /./);
});

test('rejects the wallet\'s current selective-disclosure format', async () => {
  register('vc-sd', issuerWallet);
  const sdVc = `eyJhbGciOiJFUzI1NksifQ.${b64({ iss: didOf(issuerWallet), sub: didOf(holderWallet), jti: 'vc-sd', selectiveDisclosure: true, vc: { credentialSubject: { degreeName: 'BSc' } } })}.sd_issuer_proof`;
  const vp = `eyJhbGciOiJFUzI1NksifQ.${b64({ iss: didOf(holderWallet), presentationMode: 'selective', vp: { verifiableCredential: [sdVc] } })}.holder_sd_vp_signature`;
  const r = await verifyFullPresentation(vp);
  assert.equal(isVerified(r), false);
  assert.equal(r.isSelectiveDisclosure, true);
});
