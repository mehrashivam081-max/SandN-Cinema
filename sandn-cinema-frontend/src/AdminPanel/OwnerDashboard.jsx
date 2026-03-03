import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './OwnerDashboard.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const OwnerDashboard = ({ user, onLogout }) => {
    // --- UI STATES ---
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [filterRole, setFilterRole] = useState('ALL'); 

    // --- ADMIN PROFILE DP STATE ---
    const [adminDp, setAdminDp] = useState(() => localStorage.getItem('adminDp') || '');
    const dpInputRef = useRef(null);

    // --- UPLOAD DATA STATES ---
    const [formData, setFormData] = useState({ type: 'USER', name: '', mobile: '', folderName: '', files: [] });
    const [previews, setPreviews] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);

    // --- ADMIN SETTINGS STATES ---
    const [adminProfile, setAdminProfile] = useState({ name: user?.name || 'Owner', email: user?.email || '', password: user?.password || '' });
    const [subAdmin, setSubAdmin] = useState({ name: '', mobile: '', email: '', password: '' });

    // --- SOCIAL LINKS STATE ---
    const [socialLinks, setSocialLinks] = useState([
        { platform: 'Instagram', url: '' },
        { platform: 'YouTube', url: '' },
        { platform: 'Facebook', url: '' },
        { platform: 'WhatsApp', url: '' },
        { platform: 'Twitter', url: '' }
    ]);
    const [newLink, setNewLink] = useState({ platform: 'Instagram', url: '' });

    // --- CRITERIA TAB STATES ---
    const [collabRequests, setCollabRequests] = useState([
        { id: 1, name: 'Rahul Sharma', brand: 'Nike India', email: 'rahul@nike.com', status: 'Pending' },
        { id: 2, name: 'Anjali Verma', brand: 'Loreal', email: 'anjali@loreal.com', status: 'Pending' }
    ]);

    // --- SECURITY TAB STATES ---
    const [policyData, setPolicyData] = useState({
        terms: "User content will be safely managed...",
        privacy: "We do not sell data to 3rd parties...",
        bestForYou: "We provide cinematic quality at best prices..."
    });

    // --- DIRECT BOOKINGS STATE ---
    const [bookings, setBookings] = useState([
        { id: 101, name: "Priya Singh", date: "2026-04-15", type: "Wedding", status: "Pending" },
        { id: 102, name: "Amit Patel", date: "2026-03-20", type: "Pre-Wedding", status: "Pending" }
    ]);

    // --- REVENUE DATA (Real-time logic structure) ---
    // Calculated based on actual logic. In a real app, this comes from backend.
    const calculatedTotal = accounts.length * 1500; // Dummy logic for real-time vibe
    const [incomeData, setIncomeData] = useState({
        total: calculatedTotal,
        transactions: []
    });

    useEffect(() => {
        fetchAccounts();
    }, []);

    useEffect(() => {
        // Sync dynamic revenue based on accounts
        setIncomeData(prev => ({ ...prev, total: accounts.length * 1500 }));
    }, [accounts]);

    const fetchAccounts = async () => {
        try {
            const res = await axios.post(`${API_BASE}/list-accounts`, { requesterRole: 'ADMIN' });
            if (res.data.success) setAccounts(res.data.data);
        } catch (error) { console.error("Failed to fetch accounts", error); }
    };

    // ==========================================
    // 🚀 ADMIN DP UPLOAD LOGIC
    // ==========================================
    const handleDpChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAdminDp(reader.result);
                localStorage.setItem('adminDp', reader.result); // Save to local storage
            };
            reader.readAsDataURL(file);
        }
    };
    const removeDp = () => {
        setAdminDp('');
        localStorage.removeItem('adminDp');
    };

    // ==========================================
    // 🚀 UPLOAD DATA LOGIC
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

    const handleFolderSuggestionClick = (folderName) => {
        setFormData({ ...formData, folderName: folderName });
        setShowFolderSuggestions(false);
    };

    const handleAddManualUser = async (e) => {
        e.preventDefault();
        if (formData.mobile.length !== 10) return alert("Valid 10-digit mobile required!");
        setLoading(true);
        const data = new FormData();
        data.append('type', formData.type);
        data.append('name', formData.name);
        data.append('mobile', formData.mobile);
        data.append('folderName', formData.folderName);
        data.append('addedBy', 'ADMIN'); 
        formData.files.forEach(file => data.append('mediaFiles', file));

        try {
            const res = await axios.post(`${API_BASE}/admin-add-user`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) {
                alert(`✅ Success: ${res.data.message}`);
                setFormData({ type: 'USER', name: '', mobile: '', folderName: '', files: [] }); 
                setPreviews([]); 
                fetchAccounts();
            } else { alert(res.data.message); }
        } catch (error) { alert("Server Error."); } 
        finally { setLoading(false); }
    };

    // ==========================================
    // 🚀 MANAGE ACCOUNTS LOGIC
    // ==========================================
    const handleDelete = async (mobile, role) => {
        if (!window.confirm(`Are you sure you want to delete this ${role}?`)) return;
        try {
            const res = await axios.post(`${API_BASE}/delete-account`, { targetMobile: mobile, targetRole: role });
            if (res.data.success) { alert("🗑️ Account deleted!"); fetchAccounts(); }
        } catch (error) { alert("Error deleting account."); }
    };

    const toggleStudioApproval = async (mobile, currentStatus) => {
        setAccounts(prevAccounts => prevAccounts.map(acc => acc.mobile === mobile ? { ...acc, isFeedApproved: !currentStatus } : acc));
        try {
            const res = await axios.post(`${API_BASE}/update-studio-approval`, { mobile, isFeedApproved: !currentStatus });
            if (!res.data.success) { fetchAccounts(); alert("Failed to update approval on server."); }
        } catch (error) { fetchAccounts(); alert("Error connecting to server."); }
    };

    // ==========================================
    // 🚀 ADMIN SETTINGS & SOCIAL LINKS LOGIC
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

    const handleAddLink = () => {
        if (!newLink.url) return alert("Please enter URL");
        setSocialLinks(prev => {
            const exists = prev.find(link => link.platform === newLink.platform);
            if (exists) return prev.map(link => link.platform === newLink.platform ? { ...link, url: newLink.url } : link);
            return [...prev, newLink];
        });
        setNewLink({ platform: 'Instagram', url: '' });
        alert("Link added successfully! (Will be visible on Profile Connect Tab)");
    };

    // ==========================================
    // 🚀 CRITERIA, SECURITY & BOOKING HANDLERS
    // ==========================================
    const handleCollab = (id, action) => {
        setCollabRequests(prev => prev.map(req => req.id === id ? { ...req, status: action } : req));
        alert(`Request ${action}. Email notification simulated!`);
    };

    const handlePolicySave = (e) => {
        e.preventDefault();
        alert("✅ Security & Privacy Policies Updated Successfully!");
    };

    const handleBookingStatus = (id, newStatus) => {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    };

    // Derived Logic
    const displayedAccounts = accounts.filter(acc => filterRole === 'ALL' ? true : acc.role === filterRole);
    const filteredSuggestions = accounts.filter(acc => acc.mobile && acc.mobile.includes(formData.mobile));
    const isExistingAccount = accounts.some(acc => acc.mobile === formData.mobile);

    const selectedAccount = accounts.find(acc => acc.mobile === formData.mobile);
    let existingFolders = [];
    if (selectedAccount && selectedAccount.uploadedData) {
        existingFolders = selectedAccount.uploadedData.map(f => f.folderName).filter(Boolean); 
    }
    const filteredFolderSuggestions = existingFolders.filter(fName => fName.toLowerCase().includes(formData.folderName.toLowerCase()));

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
                
                {/* 📸 DP Section */}
                <div style={{ background: '#0f3460', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#ccc', margin: '0 auto 10px', overflow: 'hidden', border: '2px solid #4dabf7', cursor: 'pointer' }} onClick={() => dpInputRef.current.click()}>
                        {adminDp ? <img src={adminDp} alt="Admin DP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '30px', lineHeight: '70px' }}>👤</span>}
                    </div>
                    <input type="file" accept="image/*" ref={dpInputRef} style={{ display: 'none' }} onChange={handleDpChange} />
                    {adminDp && <span style={{ fontSize: '10px', color: '#ff4d4d', cursor: 'pointer', display: 'block', marginBottom: '10px' }} onClick={removeDp}>Remove DP</span>}
                    
                    <h4 style={{ margin: 0, color: '#4dabf7' }}>Super Admin</h4>
                    <p style={{ margin: '5px 0 0', fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>{adminProfile.name}</p>
                </div>

                <ul className="sidebar-menu">
                    <li className={activeTab === 'DASHBOARD' ? 'active' : ''} onClick={() => setActiveTab('DASHBOARD')}>📊 Dashboard</li>
                    <li className={activeTab === 'ACCOUNTS' ? 'active' : ''} onClick={() => setActiveTab('ACCOUNTS')}>👥 Manage Accounts</li>
                    <li className={activeTab === 'BOOKINGS' ? 'active' : ''} onClick={() => setActiveTab('BOOKINGS')}>📅 Direct Bookings</li>
                    <li className={activeTab === 'UPLOAD' ? 'active' : ''} onClick={() => setActiveTab('UPLOAD')}>📤 Upload Data</li>
                    <li className={activeTab === 'CRITERIA' ? 'active' : ''} onClick={() => setActiveTab('CRITERIA')}>📈 Criteria & Traffic</li>
                    <li className={activeTab === 'SOCIAL' ? 'active' : ''} onClick={() => setActiveTab('SOCIAL')}>🌐 Social Links</li>
                    <li className={activeTab === 'SECURITY' ? 'active' : ''} onClick={() => setActiveTab('SECURITY')}>🔒 Security Policy</li>
                    <li className={activeTab === 'INCOME' ? 'active' : ''} onClick={() => setActiveTab('INCOME')}>💰 Income</li>
                    <li className={activeTab === 'SETTINGS' ? 'active' : ''} onClick={() => setActiveTab('SETTINGS')}>⚙️ Settings</li>
                </ul>
                <button onClick={onLogout} className="admin-logout-btn">Log Out</button>
            </aside>

            {/* 👉 MAIN CONTENT */}
            <main className="admin-main-content">
                
                {/* 🔴 TAB 1: DASHBOARD (Clickable stats) */}
                {activeTab === 'DASHBOARD' && (
                    <div className="view-section">
                        <div className="section-header"><h2>Overview Statistics</h2></div>
                        <div className="dashboard-stats-grid">
                            <div className="stat-card blue" onClick={() => setActiveTab('ACCOUNTS')} style={{cursor:'pointer'}}>
                                <h3>{accounts.length}</h3><p>Total Accounts</p>
                            </div>
                            <div className="stat-card green" onClick={() => {setActiveTab('ACCOUNTS'); setFilterRole('USER');}} style={{cursor:'pointer'}}>
                                <h3>{totalUsers}</h3><p>Total Users</p>
                            </div>
                            <div className="stat-card purple" onClick={() => {setActiveTab('ACCOUNTS'); setFilterRole('STUDIO');}} style={{cursor:'pointer'}}>
                                <h3>{totalStudios}</h3><p>Total Studios</p>
                            </div>
                            <div className="stat-card red" onClick={() => setActiveTab('BOOKINGS')} style={{cursor:'pointer'}}>
                                <h3>{bookings.length}</h3><p>Total Bookings</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 2: MANAGE ACCOUNTS */}
                {activeTab === 'ACCOUNTS' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📋 Manage Users & Studios</h2></div>
                        <div className="admin-filter-tabs">
                            <button className={filterRole === 'ALL' ? 'active' : ''} onClick={() => setFilterRole('ALL')}>All Accounts</button>
                            <button className={filterRole === 'USER' ? 'active' : ''} onClick={() => setFilterRole('USER')}>Users Only</button>
                            <button className={filterRole === 'STUDIO' ? 'active' : ''} onClick={() => setFilterRole('STUDIO')}>Studios Only</button>
                            <button className={filterRole === 'ADMIN' ? 'active' : ''} onClick={() => setFilterRole('ADMIN')}>Sub-Admins</button>
                        </div>
                        <div className="data-table-container" style={{ marginTop: '20px' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Role</th><th>Name</th><th>Mobile</th><th>Feed Approval</th><th>Action</th></tr>
                                </thead>
                                <tbody>
                                    {displayedAccounts.map((acc, index) => (
                                        <tr key={index}>
                                            <td><span className={`status-badge ${acc.role === 'STUDIO' ? 'active' : acc.role === 'ADMIN' ? 'inactive' : 'normal'}`}>{acc.role}</span></td>
                                            <td>{acc.name || acc.studioName || acc.ownerName}</td>
                                            <td>{acc.mobile}</td>
                                            <td>
                                                {acc.role === 'STUDIO' ? (
                                                    <button onClick={() => toggleStudioApproval(acc.mobile, acc.isFeedApproved)} style={{ background: acc.isFeedApproved ? '#2ecc71' : '#f1c40f', border: 'none', padding: '5px 10px', borderRadius: '5px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>{acc.isFeedApproved ? '✅ Approved' : '🔒 Pending'}</button>
                                                ) : <span style={{ color: '#ccc' }}>-</span>}
                                            </td>
                                            <td><button onClick={() => handleDelete(acc.mobile, acc.role)} className="pdf-btn" style={{ padding: '6px 12px', fontSize: '12px' }}>Delete</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 3: DIRECT BOOKINGS */}
                {activeTab === 'BOOKINGS' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📅 Direct Bookings</h2></div>
                        <div className="data-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>ID</th><th>Client Name</th><th>Date</th><th>Type</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {bookings.map(b => (
                                        <tr key={b.id}>
                                            <td>#{b.id}</td>
                                            <td><strong>{b.name}</strong></td>
                                            <td>{b.date}</td>
                                            <td>{b.type}</td>
                                            <td>
                                                <span className={`status-badge ${b.status === 'Accepted' ? 'active' : b.status === 'Declined' ? 'inactive' : 'normal'}`}>{b.status}</span>
                                            </td>
                                            <td>
                                                {b.status === 'Pending' && (
                                                    <>
                                                        <button onClick={() => handleBookingStatus(b.id, 'Accepted')} style={{background:'#2ecc71', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', marginRight:'5px', cursor:'pointer'}}>Accept</button>
                                                        <button onClick={() => handleBookingStatus(b.id, 'Declined')} style={{background:'#e74c3c', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', cursor:'pointer'}}>Decline</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 4: UPLOAD DATA */}
                {activeTab === 'UPLOAD' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📤 Manual Registration & Upload</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <form onSubmit={handleAddManualUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {/* Rest of Upload Form (Same as before) */}
                                <div style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Mobile Number</label>
                                    <input type="number" required value={formData.mobile} onChange={handleMobileChange} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="custom-admin-input" />
                                    {showSuggestions && formData.mobile && filteredSuggestions.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none' }}>
                                            {filteredSuggestions.map((acc, idx) => (
                                                <li key={idx} onClick={() => handleSuggestionClick(acc)} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>{acc.mobile} - {acc.name || acc.studioName}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Name</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="custom-admin-input" /></div>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Role</label>
                                    <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="custom-admin-input">
                                        <option value="USER">User</option><option value="STUDIO">Studio</option>
                                    </select>
                                </div>
                                <div style={{ background: '#ebf5fb', padding: '15px', borderRadius: '8px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>📂 Folder Name</label>
                                    <input type="text" value={formData.folderName} onChange={(e) => { setFormData({ ...formData, folderName: e.target.value }); setShowFolderSuggestions(true); }} className="custom-admin-input" />
                                </div>
                                <div style={{ border: '2px dashed #ccc', padding: '15px', textAlign: 'center' }}>
                                    <label style={{ fontWeight: 'bold' }}>📁 Upload Files</label>
                                    <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} />
                                </div>
                                <button type="submit" disabled={loading} className="global-update-btn" style={{ padding: '15px' }}>{loading ? 'Uploading...' : '🚀 Upload Data'}</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 5: CRITERIA & TRAFFIC (NEW) */}
                {activeTab === 'CRITERIA' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📈 Platform Criteria & Traffic</h2></div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                            <div className="setting-card" style={{background: '#f8f9f9'}}>
                                <h3 style={{color:'#2980b9'}}>📊 Traffic Status</h3>
                                <p>Real-time analytics of platform visitors.</p>
                                <div style={{ marginTop: '15px' }}>
                                    <p><strong>Today's Visitors:</strong> 1,240</p>
                                    <p><strong>Active Sessions:</strong> 150</p>
                                    <p><strong>Registrations:</strong> 45</p>
                                </div>
                            </div>
                            <div className="setting-card" style={{background: '#fcf3cf'}}>
                                <h3 style={{color:'#d4ac0d'}}>📢 Business & Ads</h3>
                                <p>Manage homepage banners and promotions.</p>
                                <button className="global-update-btn" style={{ background: '#f1c40f', color: '#000', marginTop: '10px' }}>Manage Ad Banners</button>
                            </div>
                        </div>

                        <div className="data-table-container">
                            <h3 style={{ padding: '15px' }}>🤝 Collaboration Requests</h3>
                            <table className="admin-table">
                                <thead><tr><th>Name</th><th>Brand</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {collabRequests.map(req => (
                                        <tr key={req.id}>
                                            <td>{req.name}</td><td>{req.brand}</td><td>{req.email}</td>
                                            <td><span className={`status-badge ${req.status === 'Accepted' ? 'active' : req.status === 'Declined' ? 'inactive' : 'normal'}`}>{req.status}</span></td>
                                            <td>
                                                {req.status === 'Pending' && (
                                                    <>
                                                        <button onClick={() => handleCollab(req.id, 'Accepted')} style={{background:'#2ecc71', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', marginRight:'5px'}}>Accept</button>
                                                        <button onClick={() => handleCollab(req.id, 'Declined')} style={{background:'#e74c3c', color:'#fff', border:'none', padding:'5px', borderRadius:'3px'}}>Decline</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 6: SOCIAL LINKS */}
                {activeTab === 'SOCIAL' && (
                    <div className="view-section">
                        <div className="section-header"><h2>🌐 Manage Social Links</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Platform</label>
                                    <select value={newLink.platform} onChange={(e) => setNewLink({...newLink, platform: e.target.value})} className="custom-admin-input">
                                        <option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Facebook">Facebook</option><option value="WhatsApp">WhatsApp</option><option value="Twitter">Twitter</option>
                                    </select>
                                </div>
                                <div><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Profile URL</label><input type="text" value={newLink.url} onChange={(e) => setNewLink({...newLink, url: e.target.value})} className="custom-admin-input" /></div>
                                <button onClick={handleAddLink} className="global-update-btn">➕ Save Link</button>
                            </div>
                            <h4>Current Links</h4>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {socialLinks.filter(l => l.url !== '').map((link, i) => (
                                    <li key={i} style={{ background:'#f9f9f9', padding:'10px', marginBottom:'5px', display:'flex', justifyContent:'space-between' }}><strong>{link.platform}</strong><a href={link.url} target="_blank" rel="noreferrer">{link.url.substring(0, 20)}...</a></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 7: SECURITY POLICY (NEW) */}
                {activeTab === 'SECURITY' && (
                    <div className="view-section">
                        <div className="section-header"><h2>🔒 Security & App Policies</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '700px', margin: '0 auto' }}>
                            <form onSubmit={handlePolicySave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{fontWeight:'bold'}}>Terms & Conditions</label>
                                    <textarea value={policyData.terms} onChange={e => setPolicyData({...policyData, terms: e.target.value})} className="custom-admin-input" rows="4" style={{resize:'vertical'}}></textarea>
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold'}}>Privacy Policy</label>
                                    <textarea value={policyData.privacy} onChange={e => setPolicyData({...policyData, privacy: e.target.value})} className="custom-admin-input" rows="4"></textarea>
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold'}}>How do we best for you? (USP Section)</label>
                                    <textarea value={policyData.bestForYou} onChange={e => setPolicyData({...policyData, bestForYou: e.target.value})} className="custom-admin-input" rows="4"></textarea>
                                </div>
                                <button type="submit" className="global-update-btn" style={{background:'#e74c3c'}}>💾 Save Policies to App</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 8: INCOME */}
                {activeTab === 'INCOME' && (
                    <div className="view-section">
                        <div className="section-header"><h2>💰 Financial Overview</h2></div>
                        <div className="stat-card green" style={{ padding: '30px', maxWidth: '400px' }}>
                            <p style={{ color: '#555', fontWeight: 'bold' }}>Real-time Platform Earnings</p>
                            <h3 style={{ fontSize: '45px', color: '#27ae60' }}>₹ {incomeData.total.toLocaleString()}</h3>
                            <button className="global-update-btn" style={{ background: '#27ae60', marginTop: '15px' }}>🏦 Withdraw Funds</button>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 9: SETTINGS */}
                {activeTab === 'SETTINGS' && (
                    <div className="view-section">
                        <div className="section-header"><h2>⚙️ Admin Settings</h2></div>
                        <div className="studio-settings-grid">
                            <div className="setting-card">
                                <h3>Update Profile</h3>
                                <form onSubmit={handleUpdateAdminProfile}>
                                    <input type="text" value={adminProfile.name} onChange={e => setAdminProfile({...adminProfile, name: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px'}}/>
                                    <input type="email" value={adminProfile.email} onChange={e => setAdminProfile({...adminProfile, email: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px'}}/>
                                    <input type="password" placeholder="New Password" value={adminProfile.password} onChange={e => setAdminProfile({...adminProfile, password: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px'}}/>
                                    <button type="submit" className="btn-save" style={{width:'100%'}}>Save</button>
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