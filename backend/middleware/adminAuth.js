// middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('x-auth-token');
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    
    // Check if user exists and is an admin
    const result = await db.query('SELECT role FROM users WHERE user_id = $1', [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    if (result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    
    next();
  } catch (err) {
    console.error('Error in admin authentication:', err);
    res.status(401).json({ error: 'Token is not valid' });
  }
};