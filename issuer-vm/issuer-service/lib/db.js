import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_FILE = join(__dirname, '../data/database.json');

export const DEFAULT_TEMPLATES = [
  {
    id: "template_bsc_degree",
    name: "Bachelor / Master of Science Degree",
    category: "Academic Degrees",
    type: ["VerifiableCredential", "AcademicDegreeCredential"],
    icon: "🎓",
    accentColor: "#2563eb",
    description: "Official University Degree awarded for undergraduate and graduate academic programs with honors and major verification.",
    isSelectiveDisclosureDefault: false,
    fields: [
      { key: "studentName", label: "Student Full Name", type: "text", required: true, default: "Alex Rivera", zkSelectable: true },
      { key: "degreeName", label: "Degree Title", type: "text", required: true, default: "Bachelor of Science in Computer Science & AI", zkSelectable: true },
      { key: "major", label: "Specialization / Major", type: "text", required: true, default: "Artificial Intelligence & Distributed Systems", zkSelectable: true },
      { key: "gpa", label: "Cumulative GPA", type: "text", required: true, default: "3.95 / 4.0", zkSelectable: true },
      { key: "graduationYear", label: "Graduation Year", type: "number", required: true, default: 2026, zkSelectable: true },
      { key: "institutionName", label: "Issuing Institution", type: "text", required: true, default: "MIT Institute of Technology", zkSelectable: false },
      { key: "studentId", label: "University Student ID", type: "text", required: true, default: "2026-CS-8842", zkSelectable: true },
      { key: "honors", label: "Academic Distinction / Honors", type: "text", required: false, default: "Summa Cum Laude", zkSelectable: true }
    ]
  },
  {
    id: "template_transcript",
    name: "Official Academic Transcript",
    category: "Academic Transcripts",
    type: ["VerifiableCredential", "AcademicTranscriptCredential"],
    icon: "📜",
    accentColor: "#059669",
    description: "Comprehensive academic transcript with total completed credits, semester GPA, and dean's list distinction.",
    isSelectiveDisclosureDefault: false,
    fields: [
      { key: "studentName", label: "Student Full Name", type: "text", required: true, default: "Sarah Chen", zkSelectable: true },
      { key: "studentId", label: "Student Roll No", type: "text", required: true, default: "2025-EE-1920", zkSelectable: true },
      { key: "program", label: "Academic Program", type: "text", required: true, default: "Electrical & Computer Engineering", zkSelectable: true },
      { key: "cumulativeCredits", label: "Total Completed Credits", type: "number", required: true, default: 128, zkSelectable: true },
      { key: "gpa", label: "Cumulative GPA", type: "text", required: true, default: "3.88 / 4.0", zkSelectable: true },
      { key: "academicStanding", label: "Academic Standing", type: "text", required: true, default: "Dean's Honor Roll (Top 5%)", zkSelectable: true },
      { key: "institutionName", label: "Issuing Institution", type: "text", required: true, default: "MIT Institute of Technology", zkSelectable: false }
    ]
  },
  {
    id: "template_exec_cert",
    name: "Executive Professional Certification",
    category: "Professional Certifications",
    type: ["VerifiableCredential", "ExecutiveCertificationCredential"],
    icon: "💼",
    accentColor: "#7c3aed",
    description: "Industry-recognized professional credential certifying specialized domain mastery and continuing education units.",
    isSelectiveDisclosureDefault: false,
    fields: [
      { key: "recipientName", label: "Professional Name", type: "text", required: true, default: "Marcus Vance", zkSelectable: true },
      { key: "certificateTitle", label: "Certification Title", type: "text", required: true, default: "Executive Lead Architect in Decentralized Identity & ZKP", zkSelectable: true },
      { key: "certificationId", label: "License / Certification ID", type: "text", required: true, default: "CERT-ZKP-9021", zkSelectable: true },
      { key: "ceuCredits", label: "Continuing Education Units (CEU)", type: "number", required: true, default: 45, zkSelectable: true },
      { key: "skillTags", label: "Verified Competency Skills", type: "text", required: true, default: "W3C VC, Ethereum DID, Circom ZK-SNARKs, Elliptic-Curve Cryptography", zkSelectable: true },
      { key: "expiryDate", label: "Validity / Expiry Date", type: "date", required: false, default: "2029-12-31", zkSelectable: true },
      { key: "issuingBody", label: "Issuing Authority", type: "text", required: true, default: "MIT Advanced Cryptography Labs", zkSelectable: false }
    ]
  },
  {
    id: "template_student_id",
    name: "Student Campus ID & Digital Access Badge",
    category: "Identity & Access",
    type: ["VerifiableCredential", "StudentIDCredential", "CampusAccessCredential"],
    icon: "🪪",
    accentColor: "#ea580c",
    description: "Digital campus badge for physical access, library checkout, dormitory clearance, and student discounts.",
    isSelectiveDisclosureDefault: true,
    fields: [
      { key: "studentName", label: "Student Full Name", type: "text", required: true, default: "Aarav Sharma", zkSelectable: true },
      { key: "rollNumber", label: "Student ID / Badge No", type: "text", required: true, default: "2026-CS-001", zkSelectable: true },
      { key: "department", label: "Academic Department", type: "text", required: true, default: "School of Engineering & AI", zkSelectable: true },
      { key: "accessLevel", label: "Campus Facility Clearance", type: "text", required: true, default: "Tier-3 All Campus & Research Labs", zkSelectable: true },
      { key: "dormitory", label: "Assigned Residential Hall", type: "text", required: false, default: "Next House #402", zkSelectable: true },
      { key: "validThrough", label: "Valid Until", type: "date", required: true, default: "2027-06-30", zkSelectable: true },
      { key: "isActiveStudent", label: "Active Enrolled Status", type: "boolean", required: true, default: true, zkSelectable: true }
    ]
  },
  {
    id: "template_research_fellowship",
    name: "Research Fellowship & Internship Certificate",
    category: "Research & Internships",
    type: ["VerifiableCredential", "ResearchFellowshipCredential"],
    icon: "🔬",
    accentColor: "#0891b2",
    description: "Proof of research completion, grant fellowship contribution, or industrial laboratory internship.",
    isSelectiveDisclosureDefault: false,
    fields: [
      { key: "fellowName", label: "Fellow / Intern Name", type: "text", required: true, default: "Ananya Iyer", zkSelectable: true },
      { key: "projectTitle", label: "Research Project Title", type: "text", required: true, default: "Privacy-Preserving ZK-Rollup Architectures for Decentralized Identity", zkSelectable: true },
      { key: "laboratory", label: "Research Laboratory", type: "text", required: true, default: "MIT CSAIL Cryptography Group", zkSelectable: true },
      { key: "principalInvestigator", label: "Principal Investigator / Supervisor", type: "text", required: true, default: "Dr. Ronald L. Rivest", zkSelectable: false },
      { key: "durationMonths", label: "Fellowship Duration (Months)", type: "number", required: true, default: 12, zkSelectable: true },
      { key: "publicationRef", label: "Publication / Paper DOI", type: "text", required: false, default: "DOI:10.1145/ssi.zkp.2026", zkSelectable: true }
    ]
  },
  {
    id: "template_zkp_predicate",
    name: "ZK Selective-Disclosure Eligibility Credential",
    category: "Zero-Knowledge Proofs",
    type: ["VerifiableCredential", "ZKPEligibilityCredential"],
    icon: "🛡️",
    accentColor: "#d97706",
    description: "Privacy-preserving credential designed for predicate-based ZKP verification (e.g. proof of age >= 21 or GPA >= 3.5 without revealing exact DOB/GPA).",
    isSelectiveDisclosureDefault: true,
    fields: [
      { key: "holderHandle", label: "Anonymous Holder Pseudonym", type: "text", required: true, default: "student-zk-0x87", zkSelectable: true },
      { key: "isOver21", label: "Age Eligibility (Predicate >= 21)", type: "boolean", required: true, default: true, zkSelectable: true },
      { key: "gpaOverThreshold", label: "Honor Roll (GPA >= 3.5)", type: "boolean", required: true, default: true, zkSelectable: true },
      { key: "activeStudent", label: "Currently Enrolled", type: "boolean", required: true, default: true, zkSelectable: true },
      { key: "citizenshipCode", label: "Country ISO Code", type: "text", required: false, default: "USA", zkSelectable: true },
      { key: "issuingAuthority", label: "Issuing Authority", type: "text", required: true, default: "MIT Verifiable Identity Registry", zkSelectable: false }
    ]
  }
];

const INITIAL_SEED_STUDENTS = [
  { id: "STU-1001", roll_number: "2026-CS-001", name: "Aarav Sharma", email: "aarav.sharma@mit.edu", degree: "Bachelor of Science", major: "Computer Science & AI", gpa: "3.95 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1002", roll_number: "2026-CS-002", name: "Priya Patel", email: "priya.patel@mit.edu", degree: "Bachelor of Engineering", major: "Software Systems", gpa: "3.88 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1003", roll_number: "2026-CS-003", name: "Rohan Verma", email: "rohan.verma@mit.edu", degree: "Master of Science", major: "Data Science & Machine Learning", gpa: "3.92 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1004", roll_number: "2026-CS-004", name: "Ananya Iyer", email: "ananya.iyer@mit.edu", degree: "Bachelor of Science", major: "Cybersecurity & Blockchain", gpa: "3.90 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1005", roll_number: "2026-CS-005", name: "Vikram Malhotra", email: "vikram.m@mit.edu", degree: "Bachelor of Science", major: "Robotics & Automation", gpa: "3.82 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1006", roll_number: "2026-CS-006", name: "Sneha Reddy", email: "sneha.reddy@mit.edu", degree: "Master of Technology", major: "Cloud Computing Architecture", gpa: "3.98 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1007", roll_number: "2026-CS-007", name: "Kabir Das", email: "kabir.das@mit.edu", degree: "Bachelor of Technology", major: "Artificial Intelligence", gpa: "3.85 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1008", roll_number: "2026-CS-008", name: "Diya Nair", email: "diya.nair@mit.edu", degree: "Bachelor of Science", major: "Information Technology", gpa: "3.79 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1009", roll_number: "2026-CS-009", name: "Arjun Gupta", email: "arjun.g@mit.edu", degree: "Master of Science", major: "Distributed Systems", gpa: "3.94 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1010", roll_number: "2026-CS-010", name: "Meera Joshi", email: "meera.j@mit.edu", degree: "Bachelor of Engineering", major: "Computer Engineering", gpa: "3.89 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1011", roll_number: "2026-CS-011", name: "Siddharth Rao", email: "siddharth.r@mit.edu", degree: "Bachelor of Technology", major: "Full Stack Software Systems", gpa: "3.84 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1012", roll_number: "2026-CS-012", name: "Kavya Menon", email: "kavya.menon@mit.edu", degree: "Master of Science", major: "Machine Learning & NLP", gpa: "3.96 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1013", roll_number: "2026-CS-013", name: "Aditya Roy", email: "aditya.roy@mit.edu", degree: "Bachelor of Science", major: "Computer Science & Cryptography", gpa: "3.78 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1014", roll_number: "2026-CS-014", name: "Ishaan Mehta", email: "ishaan.mehta@mit.edu", degree: "Master of Technology", major: "Cyber Physical Systems", gpa: "3.91 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1015", roll_number: "2026-CS-015", name: "Tara Choudhury", email: "tara.c@mit.edu", degree: "Bachelor of Engineering", major: "Software Architecture", gpa: "3.87 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1016", roll_number: "2026-CS-016", name: "Devansh Saxena", email: "devansh.s@mit.edu", degree: "Bachelor of Science", major: "Artificial Intelligence & Ethics", gpa: "3.82 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1017", roll_number: "2026-CS-017", name: "Riya Kapoor", email: "riya.kapoor@mit.edu", degree: "Master of Science", major: "Big Data Analytics", gpa: "3.93 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1018", roll_number: "2026-CS-018", name: "Yash Singhania", email: "yash.s@mit.edu", degree: "Bachelor of Technology", major: "Internet of Things (IoT)", gpa: "3.75 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1019", roll_number: "2026-CS-019", name: "Anishka Bhatia", email: "anishka.b@mit.edu", degree: "Bachelor of Science", major: "Computer Vision & Graphics", gpa: "3.89 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1020", roll_number: "2026-CS-020", name: "Karan Johar", email: "karan.j@mit.edu", degree: "Master of Science", major: "Quantum Computing & Information", gpa: "3.97 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1021", roll_number: "2026-CS-021", name: "Sanya Agarwal", email: "sanya.a@mit.edu", degree: "Bachelor of Science", major: "Information Security", gpa: "3.86 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1022", roll_number: "2026-CS-022", name: "Nikhil Deshmukh", email: "nikhil.d@mit.edu", degree: "Bachelor of Engineering", major: "DevOps & Cloud Infrastructure", gpa: "3.80 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1023", roll_number: "2026-CS-023", name: "Bhavna Swaminathan", email: "bhavna.s@mit.edu", degree: "Master of Technology", major: "Autonomous Systems", gpa: "3.95 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1024", roll_number: "2026-CS-024", name: "Manav Sharma", email: "manav.s@mit.edu", degree: "Bachelor of Technology", major: "Software Security & Testing", gpa: "3.77 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1025", roll_number: "2026-CS-025", name: "Pooja Hegde", email: "pooja.h@mit.edu", degree: "Bachelor of Science", major: "Computational Biology", gpa: "3.88 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1026", roll_number: "2026-CS-026", name: "Amanpreet Singh", email: "aman.singh@mit.edu", degree: "Master of Science", major: "High Performance Computing", gpa: "3.92 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1027", roll_number: "2026-CS-027", name: "Shreya Ghoshal", email: "shreya.g@mit.edu", degree: "Bachelor of Engineering", major: "Embedded Systems", gpa: "3.83 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1028", roll_number: "2026-CS-028", name: "Harsh Vardhan", email: "harsh.v@mit.edu", degree: "Bachelor of Science", major: "Distributed Databases", gpa: "3.81 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1029", roll_number: "2026-CS-029", name: "Nidhi Tripathi", email: "nidhi.t@mit.edu", degree: "Master of Science", major: "Generative AI & LLMs", gpa: "3.99 / 4.0", graduation_year: "2026", status: "UNISSUED" },
  { id: "STU-1030", roll_number: "2026-CS-030", name: "Varun Dhawan", email: "varun.d@mit.edu", degree: "Bachelor of Technology", major: "Mobile Computing & PWA", gpa: "3.76 / 4.0", graduation_year: "2026", status: "UNISSUED" }
];

class Database {
  constructor() {
    this.data = {
      students: [],
      issuance_batches: [],
      claims: [],
      templates: [],
      issued_credentials: []
    };
    this.initialized = false;
  }

  async init() {
    try {
      await fs.mkdir(dirname(DB_FILE), { recursive: true });
      const content = await fs.readFile(DB_FILE, 'utf-8');
      this.data = JSON.parse(content);
      
      // Ensure collections exist
      if (!this.data.templates || this.data.templates.length === 0) {
        this.data.templates = [...DEFAULT_TEMPLATES];
        await this.save();
      }
      if (!this.data.issued_credentials) {
        this.data.issued_credentials = [];
        await this.save();
      }
      if (!this.data.students || this.data.students.length === 0) {
        this.data.students = INITIAL_SEED_STUDENTS;
        await this.save();
      }
    } catch (e) {
      console.log('[DB] Initializing new database file with seed student roster and default templates...');
      this.data = {
        students: INITIAL_SEED_STUDENTS,
        issuance_batches: [],
        claims: [],
        templates: [...DEFAULT_TEMPLATES],
        issued_credentials: []
      };
      await this.save();
    }
    this.initialized = true;
  }

  async save() {
    await fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2));
  }

  // --- Student Methods ---
  async getStudents(statusFilter = 'ALL') {
    if (!this.initialized) await this.init();
    if (statusFilter === 'ALL') return this.data.students;
    return this.data.students.filter(s => s.status === statusFilter);
  }

  async getStudentById(id) {
    if (!this.initialized) await this.init();
    return this.data.students.find(s => s.id === id);
  }

  async updateStudentStatus(id, status) {
    if (!this.initialized) await this.init();
    const student = this.data.students.find(s => s.id === id);
    if (student) {
      student.status = status;
      await this.save();
    }
    return student;
  }

  // --- Batch & Claim Methods ---
  async createBatch(batchRecord) {
    if (!this.initialized) await this.init();
    this.data.issuance_batches.unshift(batchRecord);
    await this.save();
    return batchRecord;
  }

  async createClaim(claimRecord) {
    if (!this.initialized) await this.init();
    this.data.claims.push(claimRecord);
    await this.save();
    return claimRecord;
  }

  async getClaimByToken(token) {
    if (!this.initialized) await this.init();
    return this.data.claims.find(c => c.claim_token === token);
  }

  async markClaimed(token, holderDid) {
    if (!this.initialized) await this.init();
    const claim = this.data.claims.find(c => c.claim_token === token);
    if (claim) {
      claim.is_claimed = true;
      claim.holder_did = holderDid;
      claim.claimed_at = new Date().toISOString();
      
      const student = this.data.students.find(s => s.id === claim.student_id);
      if (student) student.status = "CLAIMED";
      
      await this.save();
    }
    return claim;
  }

  async getBatches() {
    if (!this.initialized) await this.init();
    return this.data.issuance_batches;
  }

  // --- Template Methods ---
  async getTemplates() {
    if (!this.initialized) await this.init();
    return this.data.templates || [];
  }

  async getTemplateById(id) {
    if (!this.initialized) await this.init();
    return (this.data.templates || []).find(t => t.id === id);
  }

  async createTemplate(templateData) {
    if (!this.initialized) await this.init();
    if (!this.data.templates) this.data.templates = [];
    
    const newTemplate = {
      id: templateData.id || `custom_template_${randomBytes(4).toString('hex')}`,
      name: templateData.name || "Custom Credential Template",
      category: templateData.category || "Custom Templates",
      type: Array.isArray(templateData.type) ? templateData.type : ["VerifiableCredential", templateData.type || "CustomCredential"],
      icon: templateData.icon || "📜",
      accentColor: templateData.accentColor || "#2563eb",
      description: templateData.description || "Custom Institutional Verifiable Credential Schema",
      isSelectiveDisclosureDefault: Boolean(templateData.isSelectiveDisclosureDefault),
      fields: Array.isArray(templateData.fields) ? templateData.fields : [],
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    this.data.templates.push(newTemplate);
    await this.save();
    return newTemplate;
  }

  async deleteTemplate(id) {
    if (!this.initialized) await this.init();
    const prevLen = (this.data.templates || []).length;
    this.data.templates = (this.data.templates || []).filter(t => t.id !== id);
    if (this.data.templates.length !== prevLen) {
      await this.save();
      return true;
    }
    return false;
  }

  // --- Issued Credentials Ledger Methods ---
  async getIssuedCredentials() {
    if (!this.initialized) await this.init();
    return this.data.issued_credentials || [];
  }

  async createIssuedCredentialRecord(record) {
    if (!this.initialized) await this.init();
    if (!this.data.issued_credentials) this.data.issued_credentials = [];
    
    const newRecord = {
      vcId: record.vcId,
      subjectDid: record.subjectDid,
      templateId: record.templateId || "template_bsc_degree",
      templateName: record.templateName || "Academic Credential",
      title: record.title || "Verifiable Credential",
      claims: record.claims || {},
      vcJwt: record.vcJwt,
      status: "ACTIVE", // ACTIVE or REVOKED
      issuedAt: new Date().toISOString(),
      revokedAt: null
    };

    this.data.issued_credentials.unshift(newRecord);
    await this.save();
    return newRecord;
  }

  async updateCredentialStatus(vcId, status) {
    if (!this.initialized) await this.init();
    const cred = (this.data.issued_credentials || []).find(c => c.vcId === vcId);
    if (cred) {
      cred.status = status;
      if (status === "REVOKED") {
        cred.revokedAt = new Date().toISOString();
      }
      await this.save();
      return cred;
    }
    return null;
  }
}

export const db = new Database();
