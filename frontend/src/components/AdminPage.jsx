import { useState, useEffect } from 'react';
import { adminApi } from '../api';

export function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(null);
  const [showDelete, setShowDelete] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user' });
  const [resetPw, setResetPw] = useState('');
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUsers = () => {
    setLoading(true);
    adminApi.getUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(loadUsers, []);

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    admins: users.filter(u => u.role === 'admin').length,
    viewers: users.filter(u => u.role === 'viewer').length,
  };

  const handleCreate = async () => {
    if (!form.username || !form.email || !form.password) { setFormErr('All fields required'); return; }
    setSaving(true); setFormErr('');
    try {
      await adminApi.createUser(form);
      setShowCreate(false);
      setForm({ username: '', email: '', password: '', role: 'user' });
      loadUsers();
    } catch (err) {
      setFormErr(err.message.includes('409') ? 'Username or email already exists' : 'Failed to create user');
    } finally { setSaving(false); }
  };

  const handleRoleChange = async (userId, role) => {
    try { await adminApi.updateRole(userId, role); loadUsers(); } catch {}
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'deactivated' : 'active';
    try { await adminApi.updateStatus(userId, newStatus); loadUsers(); } catch {}
  };

  const handleResetPassword = async () => {
    if (!resetPw || resetPw.length < 6) { setFormErr('Min 6 characters'); return; }
    setSaving(true); setFormErr('');
    try {
      await adminApi.resetPassword(showReset, resetPw);
      setShowReset(null); setResetPw('');
    } catch { setFormErr('Failed to reset password'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try { await adminApi.deleteUser(showDelete); setShowDelete(null); loadUsers(); }
    catch (err) { setFormErr(err.message.includes('400') ? 'Cannot delete your own account' : 'Failed'); }
    finally { setSaving(false); }
  };

  const StatCard = ({ label, value, color }) => (
    <div className="card stat-card" style={{ padding: '16px' }}>
      <div className="card-title" style={{ marginBottom: '8px' }}>{label}</div>
      <div className="card-value" style={{ fontSize: '1.6rem', color }}>{value}</div>
    </div>
  );

  const Modal = ({ title, children, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h2>Admin Panel</h2>
        <p>Manage users, roles, and access control.</p>
      </div>

      {/* Stats */}
      <div className="admin-stats-grid">
        <StatCard label="Total Users" value={stats.total} color="var(--text-0)" />
        <StatCard label="Active" value={stats.active} color="var(--green-bright)" />
        <StatCard label="Admins" value={stats.admins} color="var(--cyan)" />
        <StatCard label="Viewers" value={stats.viewers} color="var(--amber)" />
      </div>

      {/* User Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Users
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="create-user-btn"
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add User
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-2)' }}>Loading users...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>2FA</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-0)' }}>{u.username}</td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                        style={{ background: 'var(--bg-3)', color: 'var(--text-0)', border: '1px solid var(--border)',
                          borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', fontFamily: 'var(--mono)', cursor: 'pointer' }}>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td>
                      <span className={`status-badge ${u.status || 'active'}`}>{u.status || 'active'}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {u.totp_enabled ? (
                        <span style={{ color: 'var(--green)', fontSize: '0.82rem' }}>✓</span>
                      ) : (
                        <span style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button className="btn-icon" onClick={() => handleStatusToggle(u.id, u.status || 'active')}
                          title={u.status === 'active' ? 'Deactivate' : 'Activate'}>
                          <svg viewBox="0 0 24 24">
                            {u.status === 'deactivated' ? (
                              <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                            ) : (
                              <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                            )}
                          </svg>
                        </button>
                        <button className="btn-icon" onClick={() => { setShowReset(u.id); setResetPw(''); setFormErr(''); }} title="Reset password">
                          <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        </button>
                        <button className="btn-icon danger" onClick={() => { setShowDelete(u.id); setFormErr(''); }} title="Delete user">
                          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <Modal title="Create New User" onClose={() => setShowCreate(false)}>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Username</label>
            <input type="text" className="form-input" value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })} id="admin-new-username" />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} id="admin-new-email" />
          </div>
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} id="admin-new-password" />
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Role</label>
            <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              style={{ cursor: 'pointer', background: 'var(--bg-2)', color: 'var(--text-0)' }} id="admin-new-role">
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          {formErr && <div style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: '10px' }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn-danger" style={{ padding: '8px 16px' }} onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving} style={{ padding: '8px 16px' }}>
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {showReset && (
        <Modal title="Reset User Password" onClose={() => setShowReset(null)}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">New Password</label>
            <input type="password" className="form-input" value={resetPw}
              onChange={e => { setResetPw(e.target.value); setFormErr(''); }} id="admin-reset-pw" />
          </div>
          {formErr && <div style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: '10px' }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn-danger" style={{ padding: '8px 16px' }} onClick={() => setShowReset(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleResetPassword} disabled={saving} style={{ padding: '8px 16px' }}>
              {saving ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDelete && (
        <Modal title="Delete User" onClose={() => setShowDelete(null)}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-1)', marginBottom: '20px' }}>
            Are you sure you want to delete this user? This action cannot be undone.
          </p>
          {formErr && <div style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: '10px' }}>{formErr}</div>}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={() => setShowDelete(null)}>Cancel</button>
            <button className="btn-danger" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
