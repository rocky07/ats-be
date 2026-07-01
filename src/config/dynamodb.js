import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const raw = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-2' });
export const docClient = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

export async function dbGet(table, key) {
  const { Item } = await docClient.send(new GetCommand({ TableName: table, Key: key }));
  return Item ?? null;
}

export async function dbPut(table, item) {
  await docClient.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}

export async function dbDelete(table, key) {
  await docClient.send(new DeleteCommand({ TableName: table, Key: key }));
}

export async function dbScan(table) {
  const items = [];
  let lastKey;
  do {
    const { Items, LastEvaluatedKey } = await docClient.send(
      new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }),
    );
    items.push(...(Items ?? []));
    lastKey = LastEvaluatedKey;
  } while (lastKey);
  return items;
}

export async function dbQuery(table, indexName, keyConditionExpression, expressionAttributeValues, expressionAttributeNames) {
  const items = [];
  let lastKey;
  do {
    const { Items, LastEvaluatedKey } = await docClient.send(
      new QueryCommand({
        TableName: table,
        IndexName: indexName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ExclusiveStartKey: lastKey,
      }),
    );
    items.push(...(Items ?? []));
    lastKey = LastEvaluatedKey;
  } while (lastKey);
  return items;
}
