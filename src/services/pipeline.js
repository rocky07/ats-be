import db from '../config/db.js';

export const getAllCards = () => {
  return db.data.cards;
};

