import db from '../config/db.js';

/**
 * Utility to log user footprints/activities into the database.
 * @param {number} userId - The database ID of the user performing the action.
 * @param {string} actionType - The type of action (e.g. 'LOGIN', 'LOGOUT', 'CREATE_PRODUCT', etc.)
 * @param {string} details - A human-readable description of what they did.
 */
export const logFootprint = async (userId, actionType, details) => {
  if (!userId) return;
  try {
    await db.execute(
      'INSERT INTO footprints (user_id, action_type, details) VALUES (?, ?, ?)',
      [userId, actionType, details]
    );
  } catch (error) {
    console.error('Failed to log user footprint:', error);
  }
};
