import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, 'db.json');

// 1. Define your structure in one central place
const defaultData = {
  cards: [
    { id: 'card-1', title: 'Applied', content: 'John Doe - Java Engineer' },
    { id: 'card-2', title: 'Interviewing', content: 'Jane Smith - UI Dev' },
    { id: 'card-3', title: 'Offered', content: 'Alex Cooper - DevOps' }
  ],
  requirements: [
    { id: 'req-1', title: 'Java Engineer', department: 'Project Manager', openDate: '2023-01-01', description: 'Experience with Java and Spring framework' },
    { id: 'req-2', title: 'UI Developer', department: 'Design', openDate: '2023-01-01', description: 'Experience with React and JavaScript' },
    { id: 'req-3', title: 'DevOps Engineer', department: 'Operations', openDate: '2023-01-01', description: 'Experience with AWS and CI/CD pipelines' },
    { id: 'req-4', title: 'DevOps Engineer', department: 'Operations', openDate: '2023-01-01', description: 'Experience with AWS and CI/CD pipelines' },
    { id: 'req-5', title: 'DevOps Engineer', department: 'Operations', openDate: '2023-01-01', description: 'Experience with AWS and CI/CD pipelines' },
    { id: 'req-6', title: 'DevOps Engineer', department: 'Operations', openDate: '2023-01-01', description: 'Experience with AWS and CI/CD pipelines' },
    { id: 'req-7', title: 'DevOps Engineer', department: 'Operations', openDate: '2023-01-01', description: 'Experience with AWS and CI/CD pipelines' },
    { id: 'req-8', title: 'DevOps Engineer', department: 'Operations', openDate: '2023-01-01', description: 'Experience with AWS and CI/CD pipelines' },
    
  ],
  candidates: [],
  departments: [
    { id: 'dept-1', name: 'Engineering' },
    { id: 'dept-2', name: 'Product Management' },
    { id: 'dept-3', name: 'Data Analytics' },
    { id: 'dept-4', name: 'Quality Assurance' },
    { id: 'dept-5', name: 'Design' },
    { id: 'dept-6', name: 'Operations' },
    { id: 'dept-7', name: 'Human Resources' },
    { id: 'dept-8', name: 'Sales' },
    { id: 'dept-9', name: 'Finance' },
  ],
  pipelines: [],
  dashboardStats: { totalInterviews: 0, offersExtended: 0 },
  panelMembers: [
    { id: 'panel-1', name: 'Sarah Johnson', email: 'sarah.johnson@bourntec.com', role: 'Tech Lead', departments: ['Engineering'], regions: ['global'] },
    { id: 'panel-2', name: 'Mike Chen', email: 'mike.chen@bourntec.com', role: 'Senior Engineer', departments: ['Engineering', 'Product Management'], regions: ['us', 'india'] },
    { id: 'panel-3', name: 'Priya Patel', email: 'priya.patel@bourntec.com', role: 'HR Manager', departments: ['Human Resources'], regions: ['global'] },
  ],
  interviews: [],
  users: [],
  systemSettings: {
    companyName: 'Bourntec ATS',
    defaultTimezone: 'America/New_York',
    anthropicApiKey: '',
    smtp: { host: '', port: 587, user: '', pass: '', from: '' },
    msGraph: { tenantId: '', clientId: '', clientSecret: '', organizerEmail: '' },
    cognito: { userPoolId: '', clientId: '', region: 'us-east-1' },
    jobBoards: {
      linkedinCompany: { enabled: false, accessToken: '', organizationId: '', autoPost: false },
      linkedinJobs: { enabled: false, clientId: '', clientSecret: '', organizationId: '', autoPost: false },
      monster: { enabled: false, apiToken: '', autoPost: false },
      naukri: { enabled: false, apiToken: '', username: '', password: '', autoPost: false },
      indeed: { enabled: false, publisherId: '', apiKey: '', autoPost: false },
    },
  },
  userSettings: [],
  vendors: [
    { id: 'v-1', name: 'John Carter', email: 'john.carter@techstaff.com', phone: '', company: 'TechStaff Solutions', status: 'Active', group: 'IT Recruiters' },
    { id: 'v-2', name: 'Aisha Rahman', email: 'aisha@globalhire.com', phone: '', company: 'GlobalHire Inc.', status: 'Active', group: 'Preferred Partners' },
    { id: 'v-3', name: 'Miguel Santos', email: 'miguel.santos@nexustalent.com', phone: '', company: 'Nexus Talent', status: 'Pending', group: 'IT Recruiters' },
    { id: 'v-4', name: 'Wei Chen', email: 'wei.chen@brightpath.io', phone: '', company: 'BrightPath Consulting', status: 'Inactive', group: 'Logistics' },
    { id: 'v-5', name: 'Olivia Brown', email: 'olivia.brown@apexvendors.com', phone: '', company: 'Apex Vendors', status: 'Active', group: 'Preferred Partners' },
  ],
  vendorGroups: ['Preferred Partners', 'IT Recruiters', 'Logistics'],
};

const adapter = new JSONFile(file);

// 2. Create the reusable DB instance
const db = new Low(adapter, defaultData);

// 3. Create the bootloader function to run at app startup
export const initDatabase = async () => {
  await db.read();
  if (!db.data) {
    db.data = defaultData;
    await db.write();
    console.log('Database initialized with default schema.');
  }
};
export default db;
