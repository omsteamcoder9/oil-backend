// appfolder/controller/userController.js
import User from '../models/userModel.js';

/**
 * Get profile for current logged-in user
 */
export const getProfile = async (req, reply) => {
  const userId = req.user.id;
  const user = await User.findById(userId).select('-password');
  if (!user) return reply.status(404).send({ message: 'User not found' });
  return reply.send(user);
};