/**
 * Run once to create all DynamoDB tables for BourntecATS.
 * Uses the local AWS CLI credentials — no explicit keys needed.
 *
 *   node scripts/createDynamoTables.js
 */
import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import 'dotenv/config';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-2' });

const tables = [
  {
    TableName: 'BourntecATS-Candidates',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'BourntecATS-Requirements',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'BourntecATS-Departments',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'BourntecATS-Pipelines',
    KeySchema: [{ AttributeName: 'requirementId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'requirementId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'BourntecATS-Cards',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'BourntecATS-Interviews',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'candidateId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'candidateId-index',
        KeySchema: [{ AttributeName: 'candidateId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'BourntecATS-PanelMembers',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    // PK = requirementId (one exam per requirement; upsert replaces in place)
    TableName: 'BourntecATS-Exams',
    KeySchema: [{ AttributeName: 'requirementId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'requirementId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    // PK = examId + candidateId composite
    TableName: 'BourntecATS-ExamSubmissions',
    KeySchema: [
      { AttributeName: 'examId', KeyType: 'HASH' },
      { AttributeName: 'candidateId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'examId', AttributeType: 'S' },
      { AttributeName: 'candidateId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'BourntecATS-Users',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
      { AttributeName: 'cognitoSub', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'email-index',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'cognitoSub-index',
        KeySchema: [{ AttributeName: 'cognitoSub', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    // pk = "SYSTEM" for system settings, "USER#<userId>" for per-user settings
    TableName: 'BourntecATS-Settings',
    KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'pk', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'BourntecATS-Vendors',
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    // Each group is a single item { name: "Group Name" }
    TableName: 'BourntecATS-VendorGroups',
    KeySchema: [{ AttributeName: 'name', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'name', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function main() {
  const { TableNames: existing } = await client.send(new ListTablesCommand({}));
  console.log('Existing tables:', existing);

  for (const def of tables) {
    if (existing.includes(def.TableName)) {
      console.log(`  SKIP  ${def.TableName} (already exists)`);
      continue;
    }
    try {
      await client.send(new CreateTableCommand(def));
      console.log(`  CREATE ${def.TableName}`);
    } catch (err) {
      console.error(`  ERROR  ${def.TableName}: ${err.message}`);
    }
  }

  console.log('\nDone. Tables may take a few seconds to become ACTIVE.');
}

main().catch((err) => { console.error(err); process.exit(1); });
