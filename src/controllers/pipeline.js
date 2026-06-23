import * as pipelineService from '../services/pipeline.js';

export const getPipelineCards = async (req, res) => {
  try {
    const cards = await pipelineService.getAllCards();
    res.json(cards);
  } catch (error) {
    console.error('Error fetching pipeline cards:', error);
    res.status(500).json({ error: 'Failed to retrieve pipeline cards' });
  }
};