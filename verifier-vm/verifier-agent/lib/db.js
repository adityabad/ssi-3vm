import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_FILE = join(__dirname, '../data/verifier_db.json');

const SEED_CAMPAIGN = {
  id: "camp_software_eng_2026",
  title: "Graduate Software Engineer Mass Hiring 2026",
  company_name: "TechCorp Global Solutions",
  verifier_did: "did:ethr:4321:0xVerifierAdmin8888",
  created_at: new Date().toISOString()
};

class VerifierDatabase {
  constructor() {
    this.data = {
      campaigns: [SEED_CAMPAIGN],
      submissions: []
    };
    this.initialized = false;
  }

  async init() {
    try {
      await fs.mkdir(dirname(DB_FILE), { recursive: true });
      const content = await fs.readFile(DB_FILE, 'utf-8');
      this.data = JSON.parse(content);
    } catch (e) {
      console.log('[Verifier DB] Initializing verifier database with default mass hiring campaign...');
      this.data = {
        campaigns: [SEED_CAMPAIGN],
        submissions: []
      };
      await this.save();
    }
    this.initialized = true;
  }

  async save() {
    await fs.writeFile(DB_FILE, JSON.stringify(this.data, null, 2));
  }

  async getCampaigns() {
    if (!this.initialized) await this.init();
    return this.data.campaigns;
  }

  async getCampaignById(id) {
    if (!this.initialized) await this.init();
    return this.data.campaigns.find(c => c.id === id);
  }

  async createCampaign(campaign) {
    if (!this.initialized) await this.init();
    this.data.campaigns.unshift(campaign);
    await this.save();
    return campaign;
  }

  async addSubmission(submission) {
    if (!this.initialized) await this.init();
    this.data.submissions.unshift(submission);
    await this.save();
    return submission;
  }

  async getSubmissions(campaignId) {
    if (!this.initialized) await this.init();
    return this.data.submissions.filter(s => s.campaign_id === campaignId);
  }

  async updateSubmissionVerification(submissionId, status, details) {
    if (!this.initialized) await this.init();
    const sub = this.data.submissions.find(s => s.id === submissionId);
    if (sub) {
      sub.status = status;
      sub.verification_details = details;
      sub.verified_at = new Date().toISOString();
      await this.save();
    }
    return sub;
  }
}

export const verifierDb = new VerifierDatabase();
