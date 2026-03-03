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
    
    // --- LOGOUT POPUP STATE ---
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);

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

    // --- SOCIAL LINKS & POLICY STATE ---
    const [socialLinks, setSocialLinks] = useState([]);
    const [newLink, setNewLink] = useState({ platform: 'Instagram', url: '' });
    const [policyData, setPolicyData] = useState({
        terms: "",
        privacy: "",
        bestForYou: ""
    });

    // --- DATABASE LIST STATES ---
    const [collabRequests, setCollabRequests] = useState([]);
    const [bookings, setBookings] = useState([]);

    // --- REVENUE DATA ---
    const calculatedTotal = accounts.length * 1500; 
    const [incomeData, setIncomeData] = useState({ total: calculatedTotal, transactions: [] });

    // 🟢 INITIAL FETCH
    useEffect(() => {
        fetchAccounts();
        fetchPlatformSettings(); // Fetch Social Links & Policies
        fetchBookings();         // Fetch Bookings
        fetchCollabs();          // Fetch Collabs
    }, []);

    useEffect(() => {
        setIncomeData(prev => ({ ...prev, total: accounts.length * 1500 }));
    }, [accounts]);


    // ==========================================
    // 🚀 API FETCH FUNCTIONS
    // ==========================================
    const fetchAccounts = async () => {
        try {
            const res = await axios.post(`${API_BASE}/list-accounts`, { requesterRole: 'ADMIN' });
            if (res.data.success) setAccounts(res.data.data);
        } catch (error) { console.error("Failed to fetch accounts", error); }
    };

    const fetchPlatformSettings = async () => {
        try {
            const res = await axios.get(`${API_BASE}/get-platform-settings`);
            if (res.data.success && res.data.data) {
                if (res.data.data.socialLinks) setSocialLinks(res.data.data.socialLinks);
                if (res.data.data.policies) setPolicyData(res.data.data.policies);
            }
        } catch(e) { console.log("No settings found yet"); }
    };

    const fetchBookings = async () => {
        try {
            const res = await axios.get(`${API_BASE}/get-bookings`);
            if (res.data.success) setBookings(res.data.data);
        } catch(e) { console.log("Failed to fetch bookings"); }
    };

    const fetchCollabs = async () => {
        try {
            const res = await axios.get(`${API_BASE}/get-collabs`);
            if (res.data.success) setCollabRequests(res.data.data);
        } catch(e) { console.log("Failed to fetch collabs"); }
    };


    // ==========================================
    // 🚀 ADMIN DP LOGIC
    // ==========================================
    const handleDpChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAdminDp(reader.result);
                localStorage.setItem('adminDp', reader.result);
            };
            reader.readAsDataURL(file);
        }
    };
    const removeDp = () => { setAdminDp(''); localStorage.removeItem('adminDp'); };

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
    // 🚀 ADMIN SETTINGS & SUB ADMIN
    // ==========================================
    const handleUpdateAdminProfile = async (e) => {
        e.preventDefault();
        try {
            const identifier = user?.mobile || "0000000000CODEIS*@OWNER*";
            const res = await axios.post(`${API_BASE}/update-admin`, { mobile: identifier, ...adminProfile });
            if (res.data.success) alert("✅ Admin Profile Updated Successfully!");
            else alert("Update failed: " + res.data.message);
        } catch (error) { alert("Server error updating profile."); }
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

    // ==========================================
    // 🚀 SOCIAL LINKS & POLICIES SAVING LOGIC
    // ==========================================
    const handleAddLink = () => {
        if (!newLink.url) return alert("Please enter URL");
        setSocialLinks(prev => {
            const exists = prev.find(link => link.platform === newLink.platform);
            if (exists) return prev.map(link => link.platform === newLink.platform ? { ...link, url: newLink.url } : link);
            return [...prev, newLink];
        });
        setNewLink({ platform: 'Instagram', url: '' });
    };

    const saveLinksToServer = async () => {
        try {
            await axios.post(`${API_BASE}/update-social-links`, { links: socialLinks });
            alert("✅ Links Saved to Database! Now visible on User Profile.");
        } catch (e) { alert("Error connecting to backend."); }
    };

    const handlePolicySave = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE}/update-policies`, { policies: policyData });
            alert("✅ Security & Privacy Policies Updated Successfully in Database!");
        } catch (e) { alert("Failed to save policies."); }
    };

    // ==========================================
    // 🚀 CRITERIA & BOOKING ACTION LOGIC
    // ==========================================
    const handleCollabAction = async (id, action) => {
        try {
            const res = await axios.post(`${API_BASE}/update-collab-status`, { collabId: id, status: action });
            if(res.data.success) {
                alert(`✅ Request ${action}. Email notification triggered!`);
                fetchCollabs(); // Refresh list
            }
        } catch(e) { alert("Failed to update collab status"); }
    };

    const handleBookingStatus = async (id, newStatus) => {
        try {
            const res = await axios.post(`${API_BASE}/update-booking-status`, { bookingId: id, status: newStatus });
            if(res.data.success) {
                alert(`✅ Booking marked as ${newStatus}!`);
                fetchBookings(); // Refresh list
            }
        } catch (e) { alert("Failed to update booking"); }
    };


    // --- FILTERING & DERIVED DATA ---
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
            
            {/* ✅ Custom Logout Confirmation Popup */}
            {showLogoutPopup && (
                <div className="popup-overlay-fixed" style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <div style={{background:'#fff', padding:'30px', borderRadius:'10px', textAlign:'center', color:'#333', boxShadow:'0 10px 25px rgba(0,0,0,0.5)'}}>
                        <h3 style={{marginBottom:'20px'}}>Are you sure you want to logout?</h3>
                        <div style={{display:'flex', gap:'15px', justifyContent:'center'}}>
                            <button onClick={() => onLogout()} style={{background:'#e74c3c', color:'#fff', padding:'10px 25px', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'16px'}}>Yes</button>
                            <button onClick={() => setShowLogoutPopup(false)} style={{background:'#bdc3c7', color:'#333', padding:'10px 25px', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'16px'}}>No</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 👈 SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="sidebar-header" style={{ paddingBottom: '10px' }}>
                    <h1 className="admin-title">SandN Cinema</h1>
                </div>
                
                {/* 📸 DP Section (UPDATED: Super Admin Bada, Name chhota) */}
                <div style={{ background: '#0f3460', padding: '20px 15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#ccc', margin: '0 auto 10px', overflow: 'hidden', border: '2px solid #4dabf7', cursor: 'pointer' }} onClick={() => dpInputRef.current.click()}>
                        {adminDp ? <img src={adminDp} alt="Admin DP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '30px', lineHeight: '70px' }}>👤</span>}
                    </div>
                    <input type="file" accept="image/*" ref={dpInputRef} style={{ display: 'none' }} onChange={handleDpChange} />
                    {adminDp && <span style={{ fontSize: '10px', color: '#ff4d4d', cursor: 'pointer', display: 'block', marginBottom: '10px' }} onClick={removeDp}>Remove DP</span>}
                    
                    {/* ✅ Super Admin Text (Big & Prominent) */}
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#fff', letterSpacing: '1px' }}>Super Admin</h3>
                    
                    {/* ✅ Name/Owner (Smaller below) */}
                    <p style={{ margin: 0, fontSize: '13px', color: '#4dabf7', fontWeight: 'bold' }}>{adminProfile.name}</p>
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
                    <li className={activeTab === 'SUB_ADMIN' ? 'active' : ''} onClick={() => setActiveTab('SUB_ADMIN')}>🧑‍💼 Sub-Admins</li> 
                    <li className={activeTab === 'SETTINGS' ? 'active' : ''} onClick={() => setActiveTab('SETTINGS')}>⚙️ Settings</li>
                </ul>
                <button onClick={() => setShowLogoutPopup(true)} className="admin-logout-btn">Log Out</button> 
            </aside>

            {/* 👉 MAIN CONTENT */}
            <main className="admin-main-content">
                
                {/* 🔴 TAB 1: DASHBOARD */}
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
                                    <tr><th>Client Name</th><th>Mobile</th><th>Date</th><th>Type</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {bookings.map(b => (
                                        <tr key={b._id}>
                                            <td><strong>{b.name}</strong></td>
                                            <td>{b.mobile || 'N/A'}</td>
                                            <td>{b.date}</td>
                                            <td>{b.type}</td>
                                            <td><span className={`status-badge ${b.status === 'Accepted' ? 'active' : b.status === 'Declined' ? 'inactive' : 'normal'}`}>{b.status}</span></td>
                                            <td>
                                                {b.status === 'Pending' && (
                                                    <>
                                                        <button onClick={() => handleBookingStatus(b._id, 'Accepted')} style={{background:'#2ecc71', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', marginRight:'5px', cursor:'pointer'}}>Accept</button>
                                                        <button onClick={() => handleBookingStatus(b._id, 'Declined')} style={{background:'#e74c3c', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', cursor:'pointer'}}>Decline</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {bookings.length === 0 && <tr><td colSpan="6" style={{textAlign:'center', padding:'20px'}}>No bookings yet.</td></tr>}
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
                                
                                <div style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Mobile Number (Auto-suggest)</label>
                                    <input type="number" placeholder="e.g. 9876543210" required value={formData.mobile} onChange={handleMobileChange} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="custom-admin-input" />
                                    {showSuggestions && formData.mobile && filteredSuggestions.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none' }}>
                                            {filteredSuggestions.map((acc, idx) => (
                                                <li key={idx} onMouseDown={() => handleSuggestionClick(acc)} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>{acc.mobile} - {acc.name || acc.studioName}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                
                                <div><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Name</label>
                                <input type="text" placeholder="Enter Full Name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="custom-admin-input" /></div>
                                
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Role</label>
                                    <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="custom-admin-input">
                                        <option value="USER">User</option><option value="STUDIO">Studio</option>
                                    </select>
                                </div>
                                
                                <div style={{ background: '#ebf5fb', padding: '15px', borderRadius: '8px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>📂 Folder Name</label>
                                    <input type="text" placeholder="Leave blank for 'Stranger Photography' or type name" value={formData.folderName} onChange={(e) => { setFormData({ ...formData, folderName: e.target.value }); setShowFolderSuggestions(true); }} className="custom-admin-input" />
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

                {/* 🔴 TAB 5: CRITERIA & TRAFFIC */}
                {activeTab === 'CRITERIA' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📈 Platform Criteria & Traffic</h2></div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                            <div className="setting-card" style={{background: '#f8f9f9'}}>
                                <h3 style={{color:'#2980b9'}}>📊 Traffic Status</h3>
                                <p>Real-time analytics of platform visitors.</p>
                                <div style={{ marginTop: '15px' }}>
                                    <p><strong>Total Accounts:</strong> {accounts.length}</p>
                                    <p><strong>Today's Visitors:</strong> 1,240 (Simulated)</p>
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
                                        <tr key={req._id}>
                                            <td>{req.name}</td><td>{req.brand}</td><td>{req.email}</td>
                                            <td><span className={`status-badge ${req.status === 'Accepted' ? 'active' : req.status === 'Declined' ? 'inactive' : 'normal'}`}>{req.status}</span></td>
                                            <td>
                                                {req.status === 'Pending' && (
                                                    <>
                                                        <button onClick={() => handleCollabAction(req._id, 'Accepted')} style={{background:'#2ecc71', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', marginRight:'5px', cursor:'pointer'}}>Accept</button>
                                                        <button onClick={() => handleCollabAction(req._id, 'Declined')} style={{background:'#e74c3c', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', cursor:'pointer'}}>Decline</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {collabRequests.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>No new collab requests.</td></tr>}
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Platform</label>
                                    <select value={newLink.platform} onChange={(e) => setNewLink({...newLink, platform: e.target.value})} className="custom-admin-input">
                                        <option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Facebook">Facebook</option><option value="WhatsApp">WhatsApp</option><option value="Twitter">Twitter</option>
                                    </select>
                                </div>
                                <div><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Profile URL</label><input type="text" placeholder="e.g. https://instagram.com/sandncinema" value={newLink.url} onChange={(e) => setNewLink({...newLink, url: e.target.value})} className="custom-admin-input" /></div>
                                <button onClick={handleAddLink} className="global-update-btn">➕ Add to List</button>
                            </div>
                            
                            <button onClick={saveLinksToServer} className="global-update-btn" style={{background: '#27ae60', marginBottom: '30px', width: '100%'}}>💾 SAVE ALL TO DATABASE</button>

                            <h4>Current Links Saved</h4>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {socialLinks.filter(l => l.url !== '').map((link, i) => (
                                    <li key={i} style={{ background:'#f9f9f9', padding:'10px', marginBottom:'5px', display:'flex', justifyContent:'space-between' }}><strong>{link.platform}</strong><a href={link.url} target="_blank" rel="noreferrer">{link.url.substring(0, 20)}...</a></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 7: SECURITY POLICY */}
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

                {/* 🔴 TAB 9: SUB ADMINS */}
                {activeTab === 'SUB_ADMIN' && (
                    <div className="view-section">
                        <div className="section-header"><h2>🧑‍💼 Manage Sub-Admins</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '500px', margin: '0 auto' }}>
                            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Sub-admins have limited access to manage user data.</p>
                            <form onSubmit={handleCreateSubAdmin} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Name</label><input type="text" required placeholder="Enter Sub-Admin Name" value={subAdmin.name} onChange={e => setSubAdmin({...subAdmin, name: e.target.value})} className="custom-admin-input" /></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Mobile Number</label><input type="number" required placeholder="Enter 10-digit number" value={subAdmin.mobile} onChange={e => setSubAdmin({...subAdmin, mobile: e.target.value})} className="custom-admin-input" /></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Email (Optional)</label><input type="email" placeholder="example@email.com" value={subAdmin.email} onChange={e => setSubAdmin({...subAdmin, email: e.target.value})} className="custom-admin-input" /></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Password</label><input type="text" required placeholder="Set a secure password" value={subAdmin.password} onChange={e => setSubAdmin({...subAdmin, password: e.target.value})} className="custom-admin-input" /></div>
                                <button type="submit" className="global-update-btn" style={{ background: '#27ae60', padding: '15px', marginTop:'10px' }}>+ Add Sub-Admin</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 10: SETTINGS */}
                {activeTab === 'SETTINGS' && (
                    <div className="view-section">
                        <div className="section-header"><h2>⚙️ Admin Profile Settings</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '500px', margin: '0 auto' }}>
                            <form onSubmit={handleUpdateAdminProfile} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Admin Name</label><input type="text" placeholder="Update your name" value={adminProfile.name} onChange={e => setAdminProfile({...adminProfile, name: e.target.value})} className="custom-admin-input"/></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Email Address</label><input type="email" placeholder="Update email" value={adminProfile.email} onChange={e => setAdminProfile({...adminProfile, email: e.target.value})} className="custom-admin-input" /></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>New Password</label><input type="password" placeholder="Leave blank to keep current password" value={adminProfile.password} onChange={e => setAdminProfile({...adminProfile, password: e.target.value})} className="custom-admin-input" /></div>
                                <button type="submit" className="global-update-btn" style={{padding: '15px', marginTop:'10px'}}>💾 Save Profile Details</button>
                            </form>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default OwnerDashboard;