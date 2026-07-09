import React, { useState, useEffect } from 'react';

/**
 * CategoryManager Component
 * Allows adding and viewing sub-categories to manage product segregations.
 * Gated delete operations to SUPER_ADMIN only.
 */
const CategoryManager = ({ onCategoryAdded }) => {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Retrieve user session info to check for SUPER_ADMIN role
  const currentUser = JSON.parse(localStorage.getItem('hims_user') || '{}');
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('hims_token');
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, parentId: parentId || null }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Category created successfully!' });
        setName('');
        setParentId('');
        fetchCategories();
        if (onCategoryAdded) onCategoryAdded();
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create category');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id, catName) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete category "${catName}"?\n\nAny products assigned to this category will automatically be marked as "Unassigned" (Null).`)) {
      return;
    }

    try {
      const token = localStorage.getItem('hims_token');
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `Category "${catName}" deleted successfully.` });
        fetchCategories();
        if (onCategoryAdded) onCategoryAdded();
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to delete category');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="category-manager-container card mt-20">
      <h2>Category Management</h2>

      <form onSubmit={handleSubmit} className="category-form">
        <div className="form-group">
          <label>Category Name</label>
          <input
            type="text"
            placeholder="e.g., Allen Wrenches, Sockets..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Parent Category (Optional Sub-Category)</label>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">-- None (Top Level) --</option>
            {categories.filter(c => !c.parent_id).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'Adding...' : 'ADD CATEGORY'}
        </button>
      </form>

      {message && <p className={`msg ${message.type}`}>{message.text}</p>}

      <div className="category-list-section">
        <h3>Current Category Tree</h3>
        <ul className="cat-tree">
          {categories.filter(c => !c.parent_id).map(parent => (
            <li key={parent.id} className="parent-li">
              <div className="category-item-row">
                <strong>{parent.name}</strong>
                {isSuperAdmin && (
                  <button 
                    onClick={() => handleDeleteCategory(parent.id, parent.name)} 
                    className="btn-delete-cat"
                    title="Delete Parent Category"
                  >
                    🗑️
                  </button>
                )}
              </div>
              <ul className="sub-ul">
                {categories.filter(sub => sub.parent_id === parent.id).map(sub => (
                  <li key={sub.id} className="sub-li">
                    <div className="category-item-row">
                      <span>{sub.name}</span>
                      {isSuperAdmin && (
                        <button 
                          onClick={() => handleDeleteCategory(sub.id, sub.name)} 
                          className="btn-delete-cat"
                          title="Delete Sub-category"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <style jsx>{`
        .category-manager-container { padding: 0; background: transparent; }
        .category-form { display: grid; grid-template-columns: 1fr 1fr 180px; gap: 15px; align-items: flex-end; margin-bottom: 20px; }
        @media (max-width: 768px) { .category-form { grid-template-columns: 1fr; } }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-group label { font-size: 11px; font-weight: bold; text-transform: uppercase; color: var(--hw-steel); letter-spacing: 0.02em; }
        .form-group input, .form-group select { padding: 8px 10px; border: 1px solid var(--hw-border); background-color: var(--hw-panel-bg); color: var(--hw-slate-dark); border-radius: 4px; font-size: 13px; outline: none; }
        .btn-submit { background: var(--hw-orange); color: white; border: none; padding: 10px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; height: 36px; width: 100%; text-transform: uppercase; font-size: 12px; letter-spacing: 0.02em; transition: background 0.2s; }
        .btn-submit:hover:not(:disabled) { background: #ea580c; }
        .btn-submit:disabled { background: var(--hw-border); color: var(--hw-steel); cursor: not-allowed; }
        
        .msg { font-size: 13px; font-weight: bold; margin: 10px 0; }
        .success { color: var(--hw-green, green); }
        .error { color: var(--hw-red, red); }
        
        .category-list-section { margin-top: 25px; border-top: 1px solid var(--hw-border); padding-top: 15px; }
        .cat-tree { padding-left: 15px; list-style: square; color: var(--hw-slate-dark); }
        .parent-li { margin-bottom: 12px; font-size: 14px; }
        .sub-ul { padding-left: 20px; list-style: circle; color: var(--hw-steel); font-size: 13px; margin-top: 4px; }
        .sub-li { margin-bottom: 6px; }
        
        .category-item-row { 
          display: inline-flex; 
          align-items: center; 
          gap: 8px; 
        }
        .btn-delete-cat { 
          background: transparent !important; 
          border: none !important; 
          font-size: 12px !important; 
          cursor: pointer; 
          opacity: 0.4; 
          padding: 2px 4px !important; 
          transition: opacity 0.2s, transform 0.2s; 
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn-delete-cat:hover { 
          opacity: 1; 
          transform: scale(1.15); 
        }
      `}</style>
    </div>
  );
};

export default CategoryManager;
