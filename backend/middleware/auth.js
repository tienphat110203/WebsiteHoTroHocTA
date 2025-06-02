// middleware/auth.js
const jwt = require("jsonwebtoken");
const db = require("../db");

module.exports = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("x-auth-token");

    console.log("Auth middleware - Token present:", !!token);
    if (token) {
      console.log("Token:", token);
    }

    if (!token) {
      return res.status(401).json({ error: "No token, authorization denied" });
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token payload:", decoded);

      // Ensure req.user has the correct structure
      req.user = decoded.user;

      if (!req.user || !req.user.id) {
        console.error("Invalid token payload:", decoded);
        return res.status(401).json({ error: "Invalid token payload" });
      }

      // Check if user exists and is active
      const result = await db.query("SELECT is_active, role FROM users WHERE user_id = $1", [req.user.id]);

      if (result.rows.length === 0) {
        console.error("User not found for user_id:", req.user.id);
        return res.status(401).json({ error: "User not found" });
      }

      console.log("User data from database:", result.rows[0]);

      if (!result.rows[0].is_active) {
        return res.status(403).json({ error: "Account is inactive. Please contact support." });
      }

      // Ensure the role is set in req.user
      req.user.role = result.rows[0].role;
      console.log("Set req.user.role to:", req.user.role);

      // Map user_id to req.user.user_id
      req.user.user_id = req.user.id;

      next();
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return res.status(401).json({ error: "Token is invalid or expired" });
    }
  } catch (err) {
    console.error("Error in authentication:", err);
    res.status(500).json({ error: "Server error during authentication" });
  }
};