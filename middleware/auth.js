import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

export const protect = async (req, reply) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return reply.status(401).send({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return reply.status(401).send({
          success: false,
          message: 'User not found'
        });
      }
      
      return; // Continue to next handler
    } catch (error) {
      return reply.status(401).send({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    reply.status(500).send({
      success: false,
      message: error.message
    });
  }
};

// ✅ Admin middleware
export const admin = (req, reply) => {
  if (req.user && req.user.role === 'admin') {
    return; // Continue to next handler
  } else {
    return reply.status(403).send({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};

// ✅ Role-based middleware generator
export const authorize = (...roles) => {
  return (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return reply.status(403).send({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }

    return; // Continue to next handler
  };
};

// ✅ Combined protect + admin middleware
export const protectAndAdmin = [protect, admin];