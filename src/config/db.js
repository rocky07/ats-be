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
  pipelines: [],
  dashboardStats: { totalInterviews: 0, offersExtended: 0 }
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
