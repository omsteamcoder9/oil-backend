// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';

// ✅ FIXED: Protect middleware with proper return
export const protect = async (req, reply) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return reply.status(401).send({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return reply.status(401).send({
        success: false,
        message: 'User not found'
      });
    }

    // Attach user to request
    req.user = user;
    return; // ✅ Continue to next handler

  } catch (error) {
    console.error('❌ Auth error:', error);
    return reply.status(401).send({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// ✅ FIXED: Admin middleware
export const admin = async (req, reply) => {
  if (!req.user) {
    return reply.status(401).send({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  if (req.user.role !== 'admin') {
    return reply.status(403).send({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  return; // ✅ Continue to next handler
};

// ✅ FIXED: Role-based middleware
export const authorize = (...roles) => {
  return async (req, reply) => {
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

    return; // ✅ Continue to next handler
  };
};

// ✅ Combined protect + admin middleware for routes
export const protectAndAdmin = [protect, admin];