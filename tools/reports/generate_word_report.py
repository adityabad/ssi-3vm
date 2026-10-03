import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import os

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_styled_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=len(rows) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    # Header Row
    hdr_cells = table.rows[0].cells
    for i, header_text in enumerate(headers):
        hdr_cells[i].text = header_text
        set_cell_background(hdr_cells[i], "1F4E79") # Deep Navy
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=150, right=150)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        for run in p.runs:
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)
            run.font.size = Pt(10)
            run.font.name = 'Calibri'

    # Data Rows
    for r_idx, row_data in enumerate(rows):
        row_cells = table.rows[r_idx + 1].cells
        bg_color = "F2F4F7" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, cell_value in enumerate(row_data):
            row_cells[c_idx].text = str(cell_value)
            set_cell_background(row_cells[c_idx], bg_color)
            set_cell_margins(row_cells[c_idx], top=100, bottom=100, left=150, right=150)
            p = row_cells[c_idx].paragraphs[0]
            for run in p.runs:
                run.font.size = Pt(9.5)
                run.font.name = 'Calibri'

    # Column Widths
    if col_widths:
        for row in table.rows:
            for i, width in enumerate(col_widths):
                row.cells[i].width = Inches(width)

    doc.add_paragraph() # Spacing
    return table

def add_callout(doc, text, title="KEY NOTE", bg_hex="EBF1F5", border_hex="1F4E79"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_hex)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    cell.width = Inches(6.5)

    p = cell.paragraphs[0]
    r_title = p.add_run(f"📌 {title}: ")
    r_title.bold = True
    r_title.font.color.rgb = RGBColor(31, 78, 121)
    r_title.font.size = Pt(10)
    r_title.font.name = 'Calibri'

    r_text = p.add_run(text)
    r_text.font.size = Pt(9.5)
    r_text.font.name = 'Calibri'
    doc.add_paragraph()

def add_code_block(doc, code_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, "2B2B2B") # Dark terminal
    set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
    cell.width = Inches(6.5)

    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(code_text)
    r.font.name = 'Consolas'
    r.font.size = Pt(8.5)
    r.font.color.rgb = RGBColor(220, 220, 220)
    doc.add_paragraph()

def build_document():
    doc = docx.Document()

    # Set Margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Styles Setup
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(40, 40, 40)

    # Document Header Title
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_p.add_run("Decentralized Self-Sovereign Identity (SSI) 3-VM Enterprise Platform")
    title_run.bold = True
    title_run.font.size = Pt(22)
    title_run.font.color.rgb = RGBColor(31, 78, 121) # Deep Navy

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub_p.add_run("Comprehensive Technical Specification, Blockchain Engineering & Architecture Report")
    sub_run.font.size = Pt(13)
    sub_run.font.color.rgb = RGBColor(100, 100, 100)
    sub_run.italic = True

    meta_p = doc.add_paragraph()
    meta_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta_run = meta_p.add_run("Target: Academic & Industry Evaluation | Ecosystem Version: 2.0 | Date: September 2026")
    meta_run.font.size = Pt(9.5)
    meta_run.font.color.rgb = RGBColor(120, 120, 120)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # 1. Executive Summary
    h1 = doc.add_heading("1. Executive Summary & System Overview", level=1)
    h1.runs[0].font.color.rgb = RGBColor(31, 78, 121)

    p1 = doc.add_paragraph(
        "This document details the engineering design, cryptographic protocols, smart contract architecture, and network deployment "
        "of a decentralized Self-Sovereign Identity (SSI) multi-tenant platform. The implementation adheres strictly to the W3C Decentralized "
        "Identifiers (DIDs) v1.0 standard, W3C Verifiable Credentials (VCs) v1.1/2.0 data model, and DIDComm v2 peer-to-peer secure messaging specifications."
    )

    add_callout(
        doc,
        "The system operates with zero third-party verification callbacks. Verifiers validate academic degree credentials directly "
        "against the private Ethereum blockchain using asymmetric cryptography (ECDSA on secp256k1), with zero student personal data written on-chain.",
        title="CORE CRYPTOGRAPHIC PRINCIPLE"
    )

    # Table of Components
    comp_headers = ["Domain / Role", "Microservice", "Port", "Cryptographic Identity / Address", "Primary Function"]
    comp_rows = [
        ["Trust Root", "Geth PoA Blockchain", "8545", "Chain ID: 4321 (IP: 192.168.245.65)", "Decentralized DID & VC Registry Ledger"],
        ["Trust Root", "EthereumDIDRegistry", "On-Chain", "0x0130110D59e0b9475642D5c12dd616B3c4ede79A", "EIP-1056 On-Chain DID Resolution Standard"],
        ["Trust Root", "VCRegistry Contract", "On-Chain", "0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645", "ERC-2771 Gasless Multi-Tenant Revocation Registry"],
        ["Issuer VM", "Issuer Service & UI", "3000 / 5173", "did:ethr:4321:0xc17561... (MIT Tech)", "1-Click Bulk Issuance & SHA-256 PDF Hashing"],
        ["Messaging Relay", "DIDComm Mediator", "4000", "ws://localhost:4000 / HTTP Relay", "Asynchronous WebSocket & Offline Mailbox Router"],
        ["Holder VM", "Holder Agent & Wallet", "3001 / 5174", "did:ethr:4321:0x2199F9... (Student)", "Non-Custodial IndexedDB Key Vault & VP Generator"],
        ["Verifier Domain", "Verifier Agent & Portal", "8081 / 5175", "did:ethr:4321:0xVerifier...", "Ephemeral ZK & Stored Audit Signature Validator"]
    ]
    add_styled_table(doc, comp_headers, comp_rows, [1.1, 1.3, 0.7, 1.7, 1.7])

    # 2. Network Recovery & Diagnostics
    h2 = doc.add_heading("2. Ubuntu VM Network Recovery & Configuration", level=1)
    h2.runs[0].font.color.rgb = RGBColor(31, 78, 121)

    doc.add_paragraph(
        "During environment diagnostics, an IP subnet mismatch was detected between the host VMware NAT adapter (VMnet8) "
        "and the Ubuntu guest VM. The host NAT was listening on 192.168.245.0/24 (Gateway: 192.168.245.2), whereas the VM had a legacy static configuration on 192.168.233.x."
    )

    doc.add_paragraph("To permanently resolve this across all system reboots and shutdowns, the following automated configuration was applied:")
    add_code_block(doc,
        "# 1. Configure NetworkManager profile for ens33\n"
        "sudo nmcli connection modify ens33 ipv4.addresses 192.168.245.65/24 ipv4.gateway 192.168.245.2 ipv4.dns \"8.8.8.8 10.10.10.10\" ipv4.method manual connection.autoconnect yes\n"
        "sudo nmcli connection up ens33\n\n"
        "# 2. Write permanent Netplan configuration\n"
        "sudo bash -c 'cat <<EOF > /etc/netplan/01-netcfg.yaml\n"
        "network:\n"
        "  version: 2\n"
        "  renderer: NetworkManager\n"
        "  ethernets:\n"
        "    ens33:\n"
        "      dhcp4: false\n"
        "      addresses: [192.168.245.65/24]\n"
        "      routes: [{to: default, via: 192.168.245.2}]\n"
        "      nameservers: {addresses: [8.8.8.8, 10.10.10.10]}\n"
        "EOF'\n"
        "sudo chmod 600 /etc/netplan/01-netcfg.yaml\n"
        "sudo netplan apply\n\n"
        "# 3. Configure systemd-resolved DNS permanently\n"
        "sudo bash -c 'cat <<EOF > /etc/systemd/resolved.conf\n"
        "[Resolve]\n"
        "DNS=8.8.8.8 10.10.10.10\n"
        "FallbackDNS=1.1.1.1 8.8.4.4\n"
        "Domains=~.\n"
        "EOF'\n"
        "sudo systemctl restart systemd-resolved\n"
        "echo -e \"nameserver 8.8.8.8\\nnameserver 10.10.10.10\" | sudo tee /etc/resolv.conf"
    )

    # 3. Smart Contracts & Solidity Architecture
    h3 = doc.add_heading("3. Smart Contract Engineering Deep-Dive", level=1)
    h3.runs[0].font.color.rgb = RGBColor(31, 78, 121)

    doc.add_paragraph(
        "The decentralized trust layer comprises two core smart contracts deployed on the private Geth blockchain node:"
    )

    doc.add_heading("A. EthereumDIDRegistry (EIP-1056 Standard)", level=2)
    doc.add_paragraph(
        "Deployed at 0x0130110D59e0b9475642D5c12dd616B3c4ede79A, this contract eliminates the gas cost of deploying unique smart contracts for each user. "
        "It maintains an identity mapping table where Ethereum addresses can rotate owners, assign temporary delegates, and emit on-chain attributes via logs."
    )

    doc.add_heading("B. VCRegistry with ERC-2771 Gasless Forwarder", level=2)
    doc.add_paragraph(
        "Deployed at 0x7f347d1AFb2E5D47eD85FB67E8181d6DaBB37645, this contract supports enterprise multi-tenancy, batch verification, and gasless transactions. "
        "It uses inline Yul assembly to extract original signer addresses from calldata forwarded by an ERC-2771 paymaster relayer:"
    )
    add_code_block(doc,
        "function _msgSender() internal view returns (address sender) {\n"
        "    if (isTrustedForwarder(msg.sender)) {\n"
        "        // Extracts the 20-byte original signer address appended by Trusted Forwarder\n"
        "        assembly {\n"
        "            sender := shr(96, calldataload(sub(calldatasize(), 20)))\n"
        "        }\n"
        "    } else {\n"
        "        return msg.sender;\n"
        "    }\n"
        "}"
    )

    # 4. Cryptographic Proofs & Mathematical Formulations
    h4 = doc.add_heading("4. Cryptographic Proofs & Mathematical Verification", level=1)
    h4.runs[0].font.color.rgb = RGBColor(31, 78, 121)

    doc.add_paragraph(
        "Verification operates purely on elliptic curve mathematics (secp256k1) and pre-image hash checks without requiring any network call to university databases:"
    )

    math_headers = ["Verification Proof", "Mathematical Formulation", "Security & Integrity Guarantee"]
    math_rows = [
        [
            "Proof 1: Issuer Authenticity",
            "e = SHA256(Header || Payload)\nQ = r^-1 * (sR - eG)\nlast20Bytes(Keccak256(Q)) == VC.iss",
            "Guarantees the credential was authentically signed by the University private key (Non-repudiation)."
        ],
        [
            "Proof 2: Holder Cryptographic Binding",
            "e_vp = SHA256(VP_Header || VP_Payload)\nQ_h = r_vp^-1 * (s_vp*R - e_vp*G)\nlast20Bytes(Keccak256(Q_h)) == VC.sub",
            "Prevents credential theft. Proves the presenter is the actual subject/owner of the credential."
        ],
        [
            "Proof 3: Document Pre-Image Integrity",
            "SHA256(BinaryBuffer(Degree.pdf)) == VC.credentialSubject.documentHash",
            "Guarantees the physical/digital PDF certificate has not been altered by even 1 single bit."
        ],
        [
            "Proof 4: On-Chain Revocation Check",
            "VCRegistry.getVC(VC.id).revoked == false",
            "Ensures credentials revoked due to academic infractions or administrative updates are invalidated instantly."
        ]
    ]
    add_styled_table(doc, math_headers, math_rows, [1.8, 2.5, 2.2])

    # 5. W3C Data Models
    h5 = doc.add_heading("5. W3C Data Models: VC & VP JWT Specifications", level=1)
    h5.runs[0].font.color.rgb = RGBColor(31, 78, 121)

    doc.add_paragraph("The Verifiable Credential is encoded as a compact JWT with the ES256K algorithm:")
    add_code_block(doc,
        "{\n"
        "  \"header\": { \"alg\": \"ES256K\", \"typ\": \"JWT\" },\n"
        "  \"payload\": {\n"
        "    \"iss\": \"did:ethr:4321:0xc17561bfdf4ef0eb4dc749595b3367c246ac31efbdec11ea799874faf8a25843\",\n"
        "    \"sub\": \"did:ethr:4321:0x2199F989d38c64C5632f0590a98D65b71948F894\",\n"
        "    \"iat\": 1773090000,\n"
        "    \"vc\": {\n"
        "      \"@context\": [\"https://www.w3.org/2018/credentials/v1\"],\n"
        "      \"type\": [\"VerifiableCredential\", \"AcademicDegreeCredential\"],\n"
        "      \"credentialSubject\": {\n"
        "        \"studentId\": \"2026-CS-001\",\n"
        "        \"studentName\": \"Aarav Sharma\",\n"
        "        \"degreeName\": \"Bachelor of Science in Computer Science & AI\",\n"
        "        \"major\": \"Computer Science & AI\",\n"
        "        \"gpa\": \"3.95 / 4.0\",\n"
        "        \"graduationYear\": \"2026\",\n"
        "        \"institutionName\": \"MIT Institute of Technology\",\n"
        "        \"documentHash\": \"a6c5f789d33b4998e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934c\"\n"
        "      }\n"
        "    }\n"
        "  }\n"
        "}"
    )

    # 6. Microservices & Launchers
    h6 = doc.add_heading("6. Microservices Architecture & Daily Operations", level=1)
    h6.runs[0].font.color.rgb = RGBColor(31, 78, 121)

    doc.add_paragraph("The entire system can be launched in separate live terminal windows using the created launcher script:")
    add_code_block(doc,
        ":: From the repository root:\n"
        "scripts\\windows\\start-all.bat      :: Starts all 7 microservices in labeled windows\n"
        "scripts\\windows\\stop-all.bat       :: Stops all Node & Vite services cleanly"
    )

    # Output path
    output_path = os.path.join(REPO_ROOT, "docs", "reports", "SSI_3VM_MASTER_TECHNICAL_REPORT.docx")
    doc.save(output_path)
    print(f"Report saved to {output_path}")

if __name__ == "__main__":
    build_document()
