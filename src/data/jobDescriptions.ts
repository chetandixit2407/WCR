import { JobDescription } from '../types';

export const WHITE_COLLAR_JOB_DESCRIPTIONS: Record<string, JobDescription> = {
  'sales_manager': {
    id: 'jd-sm',
    title: 'Sales Manager / Team Leader (Luxury Residential Real Estate)',
    department: 'Luxury & Ultra-Luxury Residential Advisory',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 4,
    maxExperienceYears: 9,
    minRealEstateExpYears: 3,
    budgetBand: '14 - 22 LPA Fixed',
    oteBand: '25 - 40 LPA OTE with squad closing incentives',
    marketFocus: 'Gurugram Luxury Corridors (Golf Course Rd, Golf Course Ext Rd, SPR, Dwarka Expressway) & Dubai Luxury Communities',
    noticePeriodExpectation: 'Immediate to 30 days max',
    keyResponsibilities: [
      'Lead, coach and drive target achievement for a squad of 8 to 15 luxury sales consultants',
      'Drive monthly gross booking targets of ₹20–40 Cr across tier-1 developer inventory (DLF, M3M, Godrej, Emaar, Sobha, SmartWorld)',
      'Personally step in for high-ticket HNI/UHNI negotiations, pricing objections, and final deal closures',
      'Track pipeline metrics: daily qualified lead distribution, site visit ratios, and closure conversions',
      'Conduct regular pipeline reviews and mentor underperforming team members on luxury sales techniques'
    ],
    requiredSkills: [
      'Squad Leadership & Target Accountability',
      'High-Ticket Luxury Negotiation & Closing (₹4 Cr – ₹20 Cr+)',
      'Deep Mastery of Gurugram Micro-Markets & Developer Projects',
      'HNI/UHNI Buyer Psychology and Objections Handling'
    ],
    roleSpecificQuestions: [
      'How large was the sales team you were directly managing, and how were leads allocated?',
      'Out of your team’s total monthly closures, approximately how much was your direct personal contribution versus deals where you stepped in at negotiation?',
      'Can you walk me through one of your last five major high-ticket closures (e.g. ₹5 Cr+)? At what stage did you get involved and what was the key client objection?',
      'Suppose one of your top consultants has an HNI client stuck on price between two competing luxury projects. How would you coach them to demonstrate value without immediately discounting?'
    ]
  },
  'sales_executive': {
    id: 'jd-se',
    title: 'Sales Executive / Senior Sales Consultant (Luxury Residential)',
    department: 'Luxury & Ultra-Luxury Residential Advisory',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 1.5,
    maxExperienceYears: 5,
    minRealEstateExpYears: 1,
    budgetBand: '8 - 15 LPA Fixed',
    oteBand: '18 - 28 LPA OTE with transaction commissions',
    marketFocus: 'Gurugram Luxury Residential Corridors (Golf Course Ext, SPR, Dwarka Expressway, New Gurugram)',
    noticePeriodExpectation: 'Immediate to 30 days',
    keyResponsibilities: [
      'Engage high-intent luxury buyer leads, conduct consultative discovery calls, and schedule on-site visits',
      'Present luxury residential configurations (₹3 Cr – ₹15 Cr+) across M3M, DLF, Godrej, Emaar, and Sobha',
      'Manage end-to-end client journey: requirement gathering, site tour, comparative analysis, and booking facilitation',
      'Achieve personal monthly gross booking target of ₹3 Cr – ₹8 Cr in luxury residential inventory'
    ],
    requiredSkills: [
      'Consultative Luxury Property Selling & Discovery',
      'Gurugram Micro-Market & Infrastructure Expertise',
      'High-Conversion Site Visit Execution',
      'HNI Relationship Building and Follow-up Discipline'
    ],
    roleSpecificQuestions: [
      'How many years have you been handling direct luxury residential property sales in Gurgaon?',
      'What has been your typical monthly qualified lead-to-site-visit and booking conversion rate?',
      'Which specific developers and projects (e.g. DLF, M3M, Godrej, Emaar) have you actively closed in the last 6 to 12 months?',
      'Suppose an HNI buyer has completed a site visit, likes the layout, but says they want to hold off for an upcoming launch. How do you handle that follow-up conversation?'
    ]
  },
  'pre_sales': {
    id: 'jd-presales',
    title: 'Pre-Sales Executive / Pre-Sales Manager',
    department: 'Inbound Lead Qualification & Pre-Sales Operations',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 1,
    maxExperienceYears: 4,
    minRealEstateExpYears: 1,
    budgetBand: '5 - 10 LPA Fixed',
    oteBand: '8 - 15 LPA OTE with site visit incentive bonuses',
    marketFocus: 'Delhi NCR & NRI Inbound Campaigns for Gurugram Luxury Residential',
    noticePeriodExpectation: 'Immediate to 30 days',
    keyResponsibilities: [
      'Handle 60–100 daily inbound and digital campaign leads for luxury residential launches',
      'Perform detailed buyer profiling (budget, timeline, configuration, investor vs end-user)',
      'Brief clients on project USPs, payment plans, and location advantages',
      'Generate qualified, high-intent site visits and execute seamless handover to on-site closing managers'
    ],
    requiredSkills: [
      'Telephonic Lead Qualification & Discovery',
      'Luxury Real Estate Pitching & Objection Handling',
      'CRM Pipeline Hygiene & SLA Follow-ups',
      'Site Visit Conversion Focus'
    ],
    roleSpecificQuestions: [
      'How many calls or leads were you typically handling on a daily basis?',
      'What specific criteria did you use to differentiate a casual inquiry from a genuine qualified HNI buyer?',
      'How many qualified site visits were you typically generating each week or month?',
      'Suppose a lead says: "Just send me the brochure on WhatsApp, I will decide later." How do you handle that objection to qualify them and book a site visit?'
    ]
  },
  'business_development': {
    id: 'jd-bdm',
    title: 'Business Development Executive / Manager (Channel & Corporate)',
    department: 'Channel Partner Alliances & Wealth Network',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 2,
    maxExperienceYears: 6,
    minRealEstateExpYears: 1.5,
    budgetBand: '9 - 18 LPA Fixed',
    oteBand: '18 - 30 LPA OTE with CP override incentives',
    marketFocus: 'Delhi NCR Channel Partner Networks & Corporate Wealth Alliances',
    noticePeriodExpectation: 'Immediate to 30 days',
    keyResponsibilities: [
      'Empanel, activate, and manage relationships with tier-1 Channel Partners and wealth brokers across NCR',
      'Drive self-generated business pipelines through broker briefings, roadshows, and launch events',
      'Form corporate alliances with top MNCs in DLF Cyber City, Golf Course Road, and Horizon Center for executive luxury home buying',
      'Ensure high active engagement from channel partners on luxury residential inventories'
    ],
    requiredSkills: [
      'Channel Partner Network Development & Broker Engagement',
      'Self-Generated Luxury Lead Sourcing',
      'Corporate Presentation & NRI Roadshow Organization',
      'Pipeline Forecasting and Deal Structuring'
    ],
    roleSpecificQuestions: [
      'What percentage of your closed business was self-generated versus company-provided leads?',
      'How many active Channel Partners did you manage in your personal network in Gurgaon?',
      'Suppose your pipeline is dry for the next two weeks and company leads are low. What proactive steps do you take to generate immediate luxury sales opportunities?'
    ]
  },
  'closing_manager': {
    id: 'jd-closing',
    title: 'Closing Manager / Luxury Sales Specialist',
    department: 'High-Ticket Closing & HNI Negotiations',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 4,
    maxExperienceYears: 8,
    minRealEstateExpYears: 3,
    budgetBand: '12 - 20 LPA Fixed',
    oteBand: '25 - 40 LPA OTE with high-ticket closing commissions',
    marketFocus: 'Gurugram Ultra-Luxury (₹5 Cr – ₹25 Cr+) & Dubai Freehold Portfolios',
    noticePeriodExpectation: 'Immediate to 30 days',
    keyResponsibilities: [
      'Conduct final-stage negotiation and closing meetings for high-ticket luxury residential properties',
      'Address complex buyer objections around pricing, payment plans, builder track record, and ROI expectations',
      'Structure custom payment schedules with developers (DLF, M3M, Godrej, Emaar, Sobha)',
      'Convert site visits into confirmed bookings on the same day or within 48-hour closing windows'
    ],
    requiredSkills: [
      'Ultra-Luxury Closing & Table Negotiations',
      'High-Ticket Buyer Objection Deconstruction',
      'Developer Inventory & Floor Plan Expertise',
      'HNI/UHNI Investor Consultation'
    ],
    roleSpecificQuestions: [
      'What was the highest single-ticket luxury residential property you personally closed?',
      'What was your exact role from the client’s site visit through table negotiation and final booking token?',
      'Suppose a luxury client likes a ₹7 crore apartment but is aggressively comparing it with another project and asking for a heavy discount. How do you lead that negotiation to close without eroding margin?'
    ]
  },
  'relationship_manager': {
    id: 'jd-rm',
    title: 'Relationship Manager (Ultra-Luxury & NRI Clients)',
    department: 'Private Client Group & Ultra-Luxury Advisory',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 3,
    maxExperienceYears: 7,
    minRealEstateExpYears: 2,
    budgetBand: '10 - 18 LPA Fixed',
    oteBand: '20 - 32 LPA OTE with portfolio advisory commissions',
    marketFocus: 'Ultra-Luxury Residential (₹7 Cr – ₹30 Cr+) & Dubai Prime Communities (Palm, Downtown, Dubai Hills)',
    noticePeriodExpectation: 'Immediate to 30 days',
    keyResponsibilities: [
      'Manage portfolio relationships for UHNI business owners, CXOs, and NRI investors in Delhi NCR and Middle East',
      'Deliver tailored wealth and real estate asset allocation advisory across premier luxury developments',
      'Drive repeat purchases and high-value referrals from existing private client network',
      'Facilitate virtual walkthroughs and documentation for overseas NRI buyers'
    ],
    requiredSkills: [
      'Private Client & UHNI Advisory',
      'Cross-Border / Dubai Real Estate Knowledge',
      'Discreet and Professional High-Net-Worth Communication',
      'Luxury Portfolio Asset Allocation'
    ],
    roleSpecificQuestions: [
      'What proportion of your client base consists of HNIs, UHNIs, or overseas NRI investors?',
      'What kind of luxury ticket sizes (e.g. ₹5 Cr, ₹10 Cr+) have you managed in Gurgaon or Dubai communities like Palm Jumeirah or Dubai Hills?',
      'How do you establish trust and conduct virtual consultative presentations for NRI buyers who cannot visit in person?'
    ]
  },
  'hr_recruiter': {
    id: 'jd-hr',
    title: 'HR Recruiter / Talent Acquisition Specialist',
    department: 'Human Resources & Talent Acquisition',
    location: '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101',
    minExperienceYears: 2,
    maxExperienceYears: 5,
    minRealEstateExpYears: 1,
    budgetBand: '6 - 10 LPA Fixed',
    oteBand: '8 - 14 LPA with recruitment hiring incentives',
    marketFocus: 'Real Estate Talent Sourcing across Gurugram & Delhi NCR',
    noticePeriodExpectation: 'Immediate to 30 days',
    keyResponsibilities: [
      'Source, screen, and headhunt top-performing luxury real estate sales consultants and team leaders',
      'Conduct rigorous voice and telephonic screening on sales achievements, Gurgaon market depth, and CTC expectations',
      'Coordinate interview schedules with Sales Directors and Department Heads at Sector 67 Gurugram HQ',
      'Manage candidate pipeline, ATS tracking, and post-interview follow-ups'
    ],
    requiredSkills: [
      'Real Estate Talent Sourcing & Headhunting',
      'Candidate Telephonic & Voice Screening',
      'Offer Negotiation & Onboarding SLAs',
      'Portal Sourcing (Naukri, LinkedIn, Referrals)'
    ],
    roleSpecificQuestions: [
      'How many years of candidate sourcing and screening experience do you have in real estate?',
      'What is your monthly closure run-rate for sales consultant and managerial profiles?',
      'Which sourcing channels have yielded your highest quality real estate hires in Gurgaon?'
    ]
  }
};

export function getWhiteCollarJobDescription(roleName?: string): JobDescription {
  const r = (roleName || '').toLowerCase();
  if (r.includes('hr') || r.includes('recruit') || r.includes('talent') || r.includes('acquisition') || r.includes('people')) {
    return WHITE_COLLAR_JOB_DESCRIPTIONS['hr_recruiter'];
  }
  if (r.includes('clos') || r.includes('specialist') || r.includes('luxury sales')) {
    return WHITE_COLLAR_JOB_DESCRIPTIONS['closing_manager'];
  }
  if (r.includes('relationship') || r.includes('rm') || r.includes('nri') || r.includes('ultra')) {
    return WHITE_COLLAR_JOB_DESCRIPTIONS['relationship_manager'];
  }
  if (r.includes('pre-sales') || r.includes('presales') || r.includes('tele') || r.includes('inbound')) {
    return WHITE_COLLAR_JOB_DESCRIPTIONS['pre_sales'];
  }
  if (r.includes('business') || r.includes('bd') || r.includes('channel') || r.includes('corporate') || r.includes('alliance')) {
    return WHITE_COLLAR_JOB_DESCRIPTIONS['business_development'];
  }
  if (r.includes('lead') || r.includes('manager') || r.includes('head') || r.includes('vp') || r.includes('director')) {
    return WHITE_COLLAR_JOB_DESCRIPTIONS['sales_manager'];
  }
  return WHITE_COLLAR_JOB_DESCRIPTIONS['sales_executive'];
}

