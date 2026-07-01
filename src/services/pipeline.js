import { dbScan } from '../config/dynamodb.js';

export const getAllCards = () => dbScan('BourntecATS-Cards');
