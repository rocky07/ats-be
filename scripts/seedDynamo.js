/**
 * Seeds initial data from the old db.json defaults into DynamoDB.
 * Safe to run multiple times — uses PutItem which just overwrites.
 *
 *   node scripts/seedDynamo.js
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import 'dotenv/config';

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-2' }),
  { marshallOptions: { removeUndefinedValues: true } },
);

const put = (TableName, Item) => client.send(new PutCommand({ TableName, Item }));

async function main() {
  // Departments
  const departments = [
    { id: 'dept-1', name: 'Engineering' },
    { id: 'dept-2', name: 'Product Management' },
    { id: 'dept-3', name: 'Data Analytics' },
    { id: 'dept-4', name: 'Quality Assurance' },
    { id: 'dept-5', name: 'Design' },
    { id: 'dept-6', name: 'Operations' },
    { id: 'dept-7', name: 'Human Resources' },
    { id: 'dept-8', name: 'Sales' },
    { id: 'dept-9', name: 'Finance' },
  ];
  for (const d of departments) await put('BourntecATS-Departments', d);
  console.log(`Seeded ${departments.length} departments`);

  // Cards (Kanban pipeline board)
  const cards = [
    { id: 'card-1', title: 'Applied', content: 'John Doe - Java Engineer' },
    { id: 'card-2', title: 'Interviewing', content: 'Jane Smith - UI Dev' },
    { id: 'card-3', title: 'Offered', content: 'Alex Cooper - DevOps' },
  ];
  for (const c of cards) await put('BourntecATS-Cards', c);
  console.log(`Seeded ${cards.length} cards`);

  // Panel members
  const panelMembers = [
    { id: 'panel-1', name: 'Sarah Johnson', email: 'sarah.johnson@bourntec.com', role: 'Tech Lead', departments: ['Engineering'], regions: ['global'] },
    { id: 'panel-2', name: 'Mike Chen', email: 'mike.chen@bourntec.com', role: 'Senior Engineer', departments: ['Engineering', 'Product Management'], regions: ['us', 'india'] },
    { id: 'panel-3', name: 'Priya Patel', email: 'priya.patel@bourntec.com', role: 'HR Manager', departments: ['Human Resources'], regions: ['global'] },
  ];
  for (const m of panelMembers) await put('BourntecATS-PanelMembers', m);
  console.log(`Seeded ${panelMembers.length} panel members`);

  // Vendor groups
  const groups = ['Preferred Partners', 'IT Recruiters', 'Logistics'];
  for (const name of groups) await put('BourntecATS-VendorGroups', { name });
  console.log(`Seeded ${groups.length} vendor groups`);

  // Vendors
  const vendors = [
    { id: 'v-1', name: 'John Carter', email: 'john.carter@techstaff.com', phone: '', company: 'TechStaff Solutions', status: 'Active', group: 'IT Recruiters' },
    { id: 'v-2', name: 'Aisha Rahman', email: 'aisha@globalhire.com', phone: '', company: 'GlobalHire Inc.', status: 'Active', group: 'Preferred Partners' },
    { id: 'v-3', name: 'Miguel Santos', email: 'miguel.santos@nexustalent.com', phone: '', company: 'Nexus Talent', status: 'Pending', group: 'IT Recruiters' },
    { id: 'v-4', name: 'Wei Chen', email: 'wei.chen@brightpath.io', phone: '', company: 'BrightPath Consulting', status: 'Inactive', group: 'Logistics' },
    { id: 'v-5', name: 'Olivia Brown', email: 'olivia.brown@apexvendors.com', phone: '', company: 'Apex Vendors', status: 'Active', group: 'Preferred Partners' },
  ];
  for (const v of vendors) await put('BourntecATS-Vendors', v);
  console.log(`Seeded ${vendors.length} vendors`);

  // Default system settings
  await put('BourntecATS-Settings', {
    pk: 'SYSTEM',
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
  });
  console.log('Seeded system settings');

  console.log('\nSeed complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });
