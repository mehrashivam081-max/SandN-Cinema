import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './OwnerDashboard.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const OwnerDashboard = ({ user, onLogout }) => {
    // --- UI STATES ---
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);

    // --- UPLOAD DATA STATES (Your Old Logic) ---
    const [formData, setFormData] = useState({ type: 'USER', name: '', mobile: '', files: [] });
    const [previews, setPreviews] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // --- ADMIN SETTINGS STATES ---
    const [adminProfile, setAdminProfile] = useState({ name: user?.name || '', email: user?.email || '', password: user?.password || '' });
    const [subAdmin, setSubAdmin] = useState({ name: '', mobile: '', email: '', password: '' });

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await axios.post(`${API_BASE}/list-accounts`, { requesterRole: 'ADMIN' });
            if (res.data.success) setAccounts(res.data.data);
        } catch (error) { console.error("Failed to fetch accounts", error); }
    };

    // ==========================================
    // 🚀 1. UPLOAD DATA LOGIC
    // ==========================================
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFormData({ ...formData, files: selectedFiles });
        const filePreviews = selectedFiles.map(file => ({ url: URL.createObjectURL(file), type: file.type }));
        setPreviews(filePreviews);
    };

    const handleMobileChange = (e) => {
        const val = e.target.value;
        setFormData({ ...formData, mobile: val });
        setShowSuggestions(val.length > 0);
    };

    const handleSuggestionClick = (acc) => {
        setFormData({ ...formData, mobile: acc.mobile, name: acc.name || acc.studioName || '', type: acc.role || 'USER' });
        setShowSuggestions(false);
    };

    const handleAddManualUser = async (e) => {
        e.preventDefault();
        if (formData.mobile.length !== 10) return alert("Valid 10-digit mobile required!");
        setLoading(true);
        const data = new FormData();
        data.append('type', formData.type);
        data.append('name', formData.name);
        data.append('mobile', formData.mobile);
        data.append('addedBy', 'ADMIN'); 
        formData.files.forEach(file => data.append('mediaFiles', file));

        try {
            const res = await axios.post(`${API_BASE}/admin-add-user`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) {
                alert(`✅ Success: ${res.data.message}`);
                setFormData({ type: 'USER', name: '', mobile: '', files: [] }); 
                setPreviews([]); 
                fetchAccounts();
            } else { alert(res.data.message); }
        } catch (error) { alert("Server Error."); } 
        finally { setLoading(false); }
    };

    // ==========================================
    // 🚀 2. MANAGE ACCOUNTS LOGIC
    // ==========================================
    const handleDelete = async (mobile, role) => {
        if (!window.confirm(`Are you sure you want to delete this ${role}?`)) return;
        try {
            const res = await axios.post(`${API_BASE}/delete-account`, { targetMobile: mobile, targetRole: role });
            if (res.data.success) { alert("🗑️ Account deleted!"); fetchAccounts(); }
        } catch (error) { alert("Error deleting account."); }
    };

    const toggleStudioApproval = async (mobile, currentStatus) => {
        try {
            const res = await axios.post(`${API_BASE}/update-studio-approval`, { mobile, isFeedApproved: !currentStatus });
            if (res.data.success) {
                alert(res.data.message);
                fetchAccounts();
            }
        } catch (error) { alert("Failed to update approval."); }
    };

    // ==========================================
    // 🚀 3. ADMIN SETTINGS LOGIC
    // ==========================================
    const handleUpdateAdminProfile = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_BASE}/update-admin`, { mobile: user.mobile, ...adminProfile });
            if (res.data.success) alert("✅ Admin Profile Updated Successfully!");
            else alert("Update failed.");
        } catch (error) { alert("Server error."); }
    };

    const handleCreateSubAdmin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_BASE}/add-subadmin`, subAdmin);
            if (res.data.success) {
                alert("✅ Sub-Admin Created Successfully!");
                setSubAdmin({ name: '', mobile: '', email: '', password: '' });
                fetchAccounts();
            } else alert(res.data.message);
        } catch (error) { alert("Server error."); }
    };

    const filteredSuggestions = accounts.filter(acc => acc.mobile && acc.mobile.includes(formData.mobile));
    const isExistingAccount = accounts.some(acc => acc.mobile === formData.mobile);

    // Derived Stats
    const totalUsers = accounts.filter(a => a.role === 'USER').length;
    const totalStudios = accounts.filter(a => a.role === 'STUDIO').length;
    const totalAdmins = accounts.filter(a => a.role === 'ADMIN').length;

    return (
        <div className="owner-dashboard-container">
            {/* 👈 SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <h1 className="admin-title">SandN</h1>
                    <div className="subtitle-container"><p className="admin-subtitle">Super Admin</p></div>
                </div>
                
                {/* Admin Top Details */}
                <div style={{ background: '#0f3460', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
                    <h4 style={{ margin: 0, color: '#4dabf7' }}>Hello, {user?.name || 'Admin'}</h4>
                    <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#aeb6bf' }}>{user?.mobile}</p>
                </div>

                <ul className="sidebar-menu">
                    <li className={activeTab === 'DASHBOARD' ? 'active' : ''} onClick={() => setActiveTab('DASHBOARD')}>📊 Dashboard Overview</li>
                    <li className={activeTab === 'ACCOUNTS' ? 'active' : ''} onClick={() => setActiveTab('ACCOUNTS')}>👥 Manage Accounts</li>
                    <li className={activeTab === 'UPLOAD' ? 'active' : ''} onClick={() => setActiveTab('UPLOAD')}>📤 Upload Client Data</li>
                    <li className={activeTab === 'SETTINGS' ? 'active' : ''} onClick={() => setActiveTab('SETTINGS')}>⚙️ Admin Settings</li>
                </ul>
                <button onClick={onLogout} className="admin-logout-btn">Log Out</button>
            </aside>

            {/* 👉 MAIN CONTENT */}
            <main className="admin-main-content">
                
                {/* 🔴 TAB 1: DASHBOARD */}
                {activeTab === 'DASHBOARD' && (
                    <div className="view-section">
                        <div className="section-header"><h2>Overview Statistics</h2></div>
                        <div className="dashboard-stats-grid">
                            <div className="stat-card blue">
                                <h3>{accounts.length}</h3>
                                <p>Total Accounts</p>
                            </div>
                            <div className="stat-card green">
                                <h3>{totalUsers}</h3>
                                <p>Total Users</p>
                            </div>
                            <div className="stat-card purple">
                                <h3>{totalStudios}</h3>
                                <p>Total Studios</p>
                            </div>
                            <div className="stat-card red">
                                <h3>{totalAdmins}</h3>
                                <p>Admins/Sub-Admins</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 2: MANAGE ACCOUNTS */}
                {activeTab === 'ACCOUNTS' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📋 Manage Users & Studios</h2></div>
                        <div className="data-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Role</th>
                                        <th>Name</th>
                                        <th>Mobile</th>
                                        <th>Feed Approval (Studios)</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accounts.map((acc, index) => (
                                        <tr key={index}>
                                            <td>
                                                <span className={`status-badge ${acc.role === 'STUDIO' ? 'active' : acc.role === 'ADMIN' ? 'inactive' : 'normal'}`}>
                                                    {acc.role}
                                                </span>
                                            </td>
                                            <td>{acc.name || acc.studioName || acc.ownerName}</td>
                                            <td>{acc.mobile}</td>
                                            <td>
                                                {acc.role === 'STUDIO' ? (
                                                    <button 
                                                        onClick={() => toggleStudioApproval(acc.mobile, acc.isFeedApproved)}
                                                        style={{ background: acc.isFeedApproved ? '#2ecc71' : '#f1c40f', border: 'none', padding: '5px 10px', borderRadius: '5px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                                                        {acc.isFeedApproved ? '✅ Approved' : '🔒 Pending'}
                                                    </button>
                                                ) : <span style={{ color: '#ccc' }}>-</span>}
                                            </td>
                                            <td>
                                                <button onClick={() => handleDelete(acc.mobile, acc.role)} className="pdf-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 3: UPLOAD DATA */}
                {activeTab === 'UPLOAD' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📤 Manual Registration & Upload</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <form onSubmit={handleAddManualUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Mobile Number (Auto-suggest)</label>
                                    <input type="number" required value={formData.mobile} onChange={handleMobileChange} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                                    {showSuggestions && formData.mobile && filteredSuggestions.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none' }}>
                                            {filteredSuggestions.map((acc, idx) => (
                                                <li key={idx} onClick={() => handleSuggestionClick(acc)} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                                                    <strong>{acc.mobile}</strong> - {acc.name || acc.studioName}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Name</label>
                                    <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Role</label>
                                    <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
                                        <option value="USER">User</option>
                                        <option value="STUDIO">Studio</option>
                                    </select>
                                </div>
                                <div style={{ border: '2px dashed #ccc', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>📁 Upload Multiple Files</label>
                                    <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} />
                                    {previews.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px', justifyContent: 'center' }}>
                                            {previews.map((src, idx) => (
                                                <div key={idx} style={{ width: '60px', height: '60px', overflow: 'hidden', borderRadius: '5px', border: '1px solid #ddd' }}>
                                                    {src.type.startsWith('video/') ? <video src={src.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={src.url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button type="submit" disabled={loading} className="global-update-btn" style={{ width: '100%' }}>
                                    {loading ? 'Uploading...' : isExistingAccount ? '🚀 Append Data' : '🚀 Register & Upload'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 4: ADMIN SETTINGS (Profile & Sub-Admins) */}
                {activeTab === 'SETTINGS' && (
                    <div className="view-section">
                        <div className="section-header"><h2>⚙️ Admin Settings</h2></div>
                        <div className="studio-settings-grid">
                            {/* Edit Profile */}
                            <div className="setting-card">
                                <h3>Update My Profile</h3>
                                <form onSubmit={handleUpdateAdminProfile}>
                                    <div className="form-group" style={{ marginBottom: '10px' }}>
                                        <label>Admin Name</label>
                                        <input type="text" value={adminProfile.name} onChange={e => setAdminProfile({...adminProfile, name: e.target.value})} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '10px' }}>
                                        <label>Email Address</label>
                                        <input type="email" value={adminProfile.email} onChange={e => setAdminProfile({...adminProfile, email: e.target.value})} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '15px' }}>
                                        <label>New Password</label>
                                        <input type="password" value={adminProfile.password} onChange={e => setAdminProfile({...adminProfile, password: e.target.value})} />
                                    </div>
                                    <button type="submit" className="btn-save" style={{ width: '100%' }}>Save Profile</button>
                                </form>
                            </div>

                            {/* Create Sub-Admin */}
                            <div className="setting-card">
                                <h3>Create Sub-Admin</h3>
                                <p style={{ fontSize: '12px', color: '#888', marginBottom: '15px' }}>Sub-admins can manage accounts and uploads.</p>
                                <form onSubmit={handleCreateSubAdmin}>
                                    <div className="form-group" style={{ marginBottom: '10px' }}>
                                        <label>Name</label>
                                        <input type="text" required value={subAdmin.name} onChange={e => setSubAdmin({...subAdmin, name: e.target.value})} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '10px' }}>
                                        <label>Mobile Number</label>
                                        <input type="number" required value={subAdmin.mobile} onChange={e => setSubAdmin({...subAdmin, mobile: e.target.value})} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '10px' }}>
                                        <label>Email (Optional)</label>
                                        <input type="email" value={subAdmin.email} onChange={e => setSubAdmin({...subAdmin, email: e.target.value})} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '15px' }}>
                                        <label>Password</label>
                                        <input type="text" required value={subAdmin.password} onChange={e => setSubAdmin({...subAdmin, password: e.target.value})} />
                                    </div>
                                    <button type="submit" className="btn-save" style={{ width: '100%', background: '#27ae60' }}>+ Add Sub-Admin</button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default OwnerDashboard;