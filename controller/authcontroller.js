// controllers/authController.js
import User from '../models/userModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendRegistrationEmail, sendPasswordResetEmail, sendPasswordResetConfirmation } from '../controller/emailController.js';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '365d',
  });
};

// Register User
export const register = async (req, reply) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return reply.status(400).send({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10)
    });

    if (user) {
      const token = generateToken(user._id);
      
      // Send registration email
      try {
        await sendRegistrationEmail(user);
        console.log('✅ Registration email sent to:', user.email);
      } catch (emailError) {
        console.error('❌ Registration email failed:', emailError);
        // Don't throw error, just log it since registration was successful
      }

      reply.status(201).send({
        success: true,
        message: 'User registered successfully',
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token
        }
      });
    }
  } catch (error) {
    reply.status(400).send({
      success: false,
      message: error.message
    });
  }
};

// Login User
export const login = async (req, reply) => {
  try {
    const { email, password } = req.body;

    // Check if user exists and password is correct
    const user = await User.findOne({ email });
    
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = generateToken(user._id);
      
      reply.send({
        success: true,
        message: 'Login successful',
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token
        }
      });
    } else {
      reply.status(401).send({
        success: false,
        message: 'Invalid email or password'
      });
    } 
  } catch (error) {
    reply.status(400).send({
      success: false,
      message: error.message
    });
  }
};

// Get User Profile
export const getProfile = async (req, reply) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    reply.send({
      success: true,
      data: user
    });
  } catch (error) {
    reply.status(400).send({
      success: false,
      message: error.message
    });
  }
};

// // Set password for guest user and convert to regular user
// export const setGuestPassword = async (req, reply) => {
//   try {
//     const { email, password } = req.body;

//     // Validate input
//     if (!email || !password) {
//       return reply.status(400).send({
//         success: false,
//         message: 'Please provide email and password'
//       });
//     }

//     if (password.length < 6) {
//       return reply.status(400).send({
//         success: false,
//         message: 'Password must be at least 6 characters long'
//       });
//     }

//     // Find the guest user by email
//     const user = await User.findOne({ email });
    
//     if (!user) {
//       return reply.status(404).send({
//         success: false,
//         message: 'User not found with this email'
//       });
//     }

//     // Check if user is a guest (based on role or isGuest field)
//     if (user.role !== 'guest') {
//       return reply.status(400).send({
//         success: false,
//         message: 'This user is already a registered user'
//       });
//     }

//     // Check if password already set (optional security check)
//     if (user.password && user.password !== '') {
//       return reply.status(400).send({
//         success: false,
//         message: 'Password already set for this user'
//       });
//     }

//     // Hash the password using bcrypt
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Update the user with the new hashed password and change role
//     user.password = hashedPassword;
//     user.role = 'user'; // Convert guest to regular user
//     user.updatedAt = new Date();
    
//     await user.save();

//     // Generate token for immediate login (optional)
//     const token = generateToken(user._id);

//     reply.status(200).send({
//       success: true,
//       message: 'Password set successfully! You are now a registered user.',
//       data: {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//         token // Include token if you want auto-login
//       }
//     });

//   } catch (error) {
//     console.error('Set guest password error:', error);
//     reply.status(500).send({
//       success: false,
//       message: 'Server error while setting password',
//       error: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };

// Forgot Password - Send Reset Email
export const forgotPassword = async (req, reply) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return reply.status(400).send({
        success: false,
        message: 'Please provide an email address'
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    
    // Always return success even if user doesn't exist (for security)
    if (!user) {
      return reply.send({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { id: user._id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create reset URL - get first origin from allowed origins
    const baseUrl = process.env.ALLOWED_ORIGINS?.split(',')[0];
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    console.log('✅ Reset URL:', resetUrl);
    
    // Send reset email
    try {
      await sendPasswordResetEmail(user, resetUrl);
      console.log('✅ Password reset email sent to:', user.email);
    } catch (emailError) {
      console.error('❌ Password reset email failed:', emailError);
      return reply.status(500).send({
        success: false,
        message: 'Failed to send reset email. Please try again.'
      });
    }

    reply.send({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    reply.status(500).send({
      success: false,
      message: 'Server error during password reset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reset Password - Validate token and set new password
export const resetPassword = async (req, reply) => {
  try {
    const { token, newPassword } = req.body;

    // Validate input
    if (!token || !newPassword) {
      return reply.status(400).send({
        success: false,
        message: 'Reset token and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return reply.status(400).send({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if token is a password reset token
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid token type');
      }
    } catch (tokenError) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid or expired reset token. Please request a new password reset.'
      });
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return reply.status(404).send({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    user.password = hashedPassword;
    user.updatedAt = new Date();
    
    await user.save();

    // Send confirmation email
    try {
      await sendPasswordResetConfirmation(user);
      console.log('✅ Password reset confirmation sent to:', user.email);
    } catch (emailError) {
      console.error('❌ Password reset confirmation email failed:', emailError);
      // Don't fail the request if confirmation email fails
    }

    reply.send({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    reply.status(500).send({
      success: false,
      message: 'Server error during password reset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};