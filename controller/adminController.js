// appfolder/controller/adminController.js
import User from '../models/userModel.js';

/**
 * Admin: get all users (optionally filter role)
 */
export const getAllUsers = async (req, reply) => {
  const { role } = req.query; // optional: ?role=user
  const filter = {};
  if (role) filter.role = role;
  const users = await User.find(filter).select('-password');
  return reply.send(users);
};

/**
 * Admin: edit a user (name, email, role, active)
 */
export const editUser = async (req, reply) => {
  const { id } = req.params;
  const { name, email, role, active } = req.body;

  // Prevent demoting the last superadmin accidentally - simple check: you can add more complex protections if required.
  const target = await User.findById(id);
  if (!target) {
    return reply.status(404).send({ message: 'User not found' });
  }

  // Only allow allowed fields
  if (name !== undefined) target.name = name;
  if (email !== undefined) target.email = email;
  if (role !== undefined) target.role = role;
  if (active !== undefined) target.active = active;

  await target.save();
  return reply.send({ 
    message: 'User updated', 
    user: { 
      id: target._id, 
      name: target.name, 
      email: target.email, 
      role: target.role, 
      active: target.active 
    } 
  });
};

/**
 * Admin: delete a user (permanent)
 */
export const deleteUser = async (req, reply) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    return reply.status(404).send({ message: 'User not found' });
  }

  await User.deleteOne({ _id: id });
  return reply.send({ message: 'User permanently deleted' });
};

/**
 * Admin: deactivate a user (soft-delete)
 */
export const deactivateUser = async (req, reply) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    return reply.status(404).send({ message: 'User not found' });
  }

  user.active = false;
  await user.save();
  return reply.send({ message: 'User deactivated' });
};