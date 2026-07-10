import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { logFootprint } from '../utils/footprint.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hims-super-secret-key-9988';

/**
 * Login handler
 */
const login = async (req, res, db) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username.trim()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const requiresReset = user.username.toLowerCase() === 'superadmin';
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        name: user.name,
        allowed_sections: user.allowed_sections,
        requiresReset
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Record login footprint
    await logFootprint(user.id, 'LOGIN', `User ${user.username} logged in successfully.`);

    res.json({
      token,
      requiresReset,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        allowed_sections: user.allowed_sections
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
};

/**
 * Logout handler
 */
const logout = async (req, res) => {
  if (req.user) {
    try {
      await logFootprint(req.user.id, 'LOGOUT', `User ${req.user.username} logged out.`);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout log error:', error);
      res.status(500).json({ error: 'Failed to record logout' });
    }
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
};

/**
 * Get current session user profile info
 */
const getMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
};

/**
 * List all users (Restricted to SUPER_ADMIN)
 */
const getUsers = async (req, res, db) => {
  try {
    const [rows] = await db.execute('SELECT id, name, username, role, allowed_sections, created_at FROM users ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create a new user (Restricted to SUPER_ADMIN)
 */
const createUser = async (req, res, db) => {
  const { name, username, password, role, allowedSections } = req.body;

  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: 'Name, username, password, and role are required' });
  }

  if (!['SUPER_ADMIN', 'ADMIN', 'USER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be SUPER_ADMIN, ADMIN, or USER.' });
  }

  // allowedSections should be an array of strings, e.g. ['WAREHOUSE', 'SALES']
  const sectionsStr = Array.isArray(allowedSections) ? allowedSections.join(',') : 'WAREHOUSE';

  try {
    // Check if username is taken
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await db.execute(
      'INSERT INTO users (name, username, password_hash, role, allowed_sections) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), username.trim().toLowerCase(), passwordHash, role, sectionsStr]
    );

    // Log footprint
    await logFootprint(
      req.user.id, 
      'CREATE_USER', 
      `Created user account: "${username}" with role: "${role}" and allowed sections: "${sectionsStr}".`
    );

    res.status(201).json({
      message: 'User created successfully',
      userId: result.insertId
    });

  } catch (error) {
    console.error('Create User Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Assign role and allowed sections to user (Restricted to SUPER_ADMIN)
 */
const updateUserRole = async (req, res, db) => {
  const { id } = req.params;
  const { role, allowedSections } = req.body;

  if (!role || !['SUPER_ADMIN', 'ADMIN', 'USER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be SUPER_ADMIN, ADMIN, or USER.' });
  }

  // Prevent superadmin from demoting themselves (if they target their own id)
  if (parseInt(id) === req.user.id && role !== 'SUPER_ADMIN') {
    return res.status(400).json({ error: 'Super Admins cannot demote their own roles.' });
  }

  const sectionsStr = Array.isArray(allowedSections) ? allowedSections.join(',') : 'WAREHOUSE';

  try {
    // Fetch old details to log changes
    const [oldRows] = await db.execute('SELECT username, role, allowed_sections FROM users WHERE id = ?', [id]);
    if (oldRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const oldUser = oldRows[0];

    const [result] = await db.execute(
      'UPDATE users SET role = ?, allowed_sections = ? WHERE id = ?', 
      [role, sectionsStr, id]
    );

    // Log footprint
    await logFootprint(
      req.user.id, 
      'ROLE_CHANGE', 
      `Updated user "${oldUser.username}" privileges. Role: "${oldUser.role}" -> "${role}"; Sections: "${oldUser.allowed_sections}" -> "${sectionsStr}".`
    );

    res.json({ message: 'User privileges updated successfully' });

  } catch (error) {
    console.error('Update User Role Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a user (Restricted to SUPER_ADMIN)
 */
const deleteUser = async (req, res, db) => {
  const { id } = req.params;

  // Prevent Super Admin from deleting themselves
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Super Admins cannot delete their own accounts.' });
  }

  try {
    // Fetch details to log deletion
    const [userRows] = await db.execute('SELECT username FROM users WHERE id = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const username = userRows[0].username;

    const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);

    // Log footprint
    await logFootprint(
      req.user.id, 
      'DELETE_USER', 
      `Deleted user account "${username}" (User ID: ${id}).`
    );

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * List all user footprints/activities (Restricted to SUPER_ADMIN)
 */
const getFootprints = async (req, res, db) => {
  try {
    const [rows] = await db.execute(`
      SELECT f.id, u.name as user_name, u.username, f.action_type, f.details, f.timestamp 
      FROM footprints f
      JOIN users u ON f.user_id = u.id
      ORDER BY f.timestamp DESC
      LIMIT 250
    `);
    res.json(rows);
  } catch (error) {
    console.error('Get Footprints Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const resetDefaultAdmin = async (req, res, db) => {
  const { newUsername, newPassword } = req.body;

  if (!newUsername || !newPassword) {
    return res.status(400).json({ error: 'New username and password are required' });
  }

  const cleanedUsername = newUsername.trim().toLowerCase();
  if (cleanedUsername === 'superadmin') {
    return res.status(400).json({ error: 'New username cannot be "superadmin". Please select a custom username.' });
  }
  if (newPassword === 'admin1234') {
    return res.status(400).json({ error: 'New password cannot be the default "admin1234". Please choose a secure password.' });
  }

  try {
    // Check if username is taken by another user
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ? AND id != ?', [cleanedUsername, req.user.id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update user in DB
    await db.execute(
      'UPDATE users SET username = ?, password_hash = ? WHERE id = ?',
      [cleanedUsername, passwordHash, req.user.id]
    );

    // Fetch the updated user
    const [updatedRows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = updatedRows[0];

    // Generate a fresh JWT token without requiresReset flag
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        name: user.name,
        allowed_sections: user.allowed_sections 
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Log footprint
    await logFootprint(user.id, 'RESET_DEFAULT_CREDENTIALS', `Default superadmin credentials changed to custom username: ${user.username}.`);

    res.json({
      message: 'Credentials updated successfully!',
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        allowed_sections: user.allowed_sections
      }
    });

  } catch (error) {
    console.error('Reset Default Admin Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res, db) => {
  const { newUsername, newPassword, name } = req.body;

  if (!newUsername) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const cleanedUsername = newUsername.trim().toLowerCase();
  if (cleanedUsername === 'superadmin') {
    return res.status(400).json({ error: 'Username cannot be "superadmin". Please choose a custom username.' });
  }

  try {
    // Check if username is taken by someone else
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ? AND id != ?', [cleanedUsername, req.user.id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    let passwordHash = null;
    if (newPassword && newPassword.trim()) {
      if (newPassword === 'admin1234') {
        return res.status(400).json({ error: 'Password cannot be "admin1234". Please choose a secure password.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(newPassword, salt);
    }

    // Prepare update query
    let query = 'UPDATE users SET username = ?';
    let params = [cleanedUsername];

    if (name && name.trim()) {
      query += ', name = ?';
      params.push(name.trim());
    }

    if (passwordHash) {
      query += ', password_hash = ?';
      params.push(passwordHash);
    }

    query += ' WHERE id = ?';
    params.push(req.user.id);

    await db.execute(query, params);

    // Fetch the updated user
    const [updatedRows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = updatedRows[0];

    // Generate a fresh JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role, 
        name: user.name,
        allowed_sections: user.allowed_sections 
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Log footprint
    await logFootprint(user.id, 'PROFILE_UPDATE', `User updated their own credentials. Username: ${user.username}.`);

    res.json({
      message: 'Profile credentials updated successfully!',
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        allowed_sections: user.allowed_sections
      }
    });

  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  login,
  logout,
  getMe,
  getUsers,
  createUser,
  updateUserRole,
  deleteUser,
  getFootprints,
  resetDefaultAdmin,
  updateProfile
};
