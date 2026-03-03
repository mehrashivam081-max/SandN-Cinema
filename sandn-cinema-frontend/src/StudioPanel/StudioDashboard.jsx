import React, { useState, useEffect } from 'react';
import axios from 'axios';
// Hum yahan wahi purani CSS classes use kar rahe hain taaki layout Admin jaisa hi aaye
import './StudioDashboard.css'; 

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const StudioDashboard = ({ user, onLogout }) => {
    // --- UI TABS STATES ---
    const [activeTab, setActiveTab] = useState('DASHBOARD');

    // --- DATA STATES ---
    const [studioProfile, setStudioProfile] = useState(user);
    const [clientMobile, setClientMobile] = useState('');
    const [clientName, setClientName] = useState('');
    const [files, setFiles] = useState([]);
    const [feedFiles, setFeedFiles] = useState([]); 
    const [clients, setClients] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // --- FOLDER STATES ---
    const [folderName, setFolderName] = useState('');
    const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);

    // --- PROFILE EDIT STATES ---
    const [profileEdit, setProfileEdit] = useState({
        studioName: user.studioName || '',
        ownerName: user.ownerName || '',
        email: user.email || '',
        password: '',
        location: user.location || ''
    });

    // --- 1. FETCH LOGIC ---
    useEffect(() => {
        if (user && user.mobile) {
            fetchMyProfile();
            fetchClients();
        }
    }, [user]);

    const fetchMyProfile = async () => {
        try {
            const res = await axios.post(`${API_BASE}/search-account`, { mobile: user.mobile });
            if(res.data.success) {
                setStudioProfile(res.data.data);
                setProfileEdit({
                    studioName: res.data.data.studioName || '',
                    ownerName: res.data.data.ownerName || '',
                    email: res.data.data.email || '',
                    password: '',
                    location: res.data.data.location || ''
                });
            }
        } catch (e) {}
    };

    const fetchClients = async () => {
        setFetching(true);
        try {
            const res = await axios.post(`${API_BASE}/list-accounts`, {
                requesterRole: 'STUDIO',
                requesterMobile: user.mobile
            });
            if (res.data.success) {
                setClients(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch clients:", error);
        } finally {
            setFetching(false);
        }
    };

    // --- 2. DELETE CLIENT LOGIC ---
    const handleDeleteClient = async (targetMobile) => {
        if (!window.confirm(`Are you sure you want to delete client ${targetMobile}? This will remove their account and all uploaded data.`)) return;

        try {
            const res = await axios.post(`${API_BASE}/delete-account`, {
                targetMobile: targetMobile,
                targetRole: 'USER' 
            });

            if (res.data.success) {
                alert("✅ Client deleted successfully.");
                fetchClients(); 
            } else {
                alert("❌ Failed to delete: " + res.data.message);
            }
        } catch (error) {
            alert("Error connecting to server.");
        }
    };

    // --- 3. UPLOAD LOGIC ---
    const handleFileChange = (e) => setFiles(e.target.files);
    const handleFeedFileChange = (e) => setFeedFiles(e.target.files);

    const handleUpload = async (isFeed = false) => {
        if (!isFeed && (!clientMobile || clientMobile.length !== 10)) return alert("Please enter a valid 10-digit mobile number.");
        const currentFiles = isFeed ? feedFiles : files;
        if (currentFiles.length === 0) return alert("Please select files to upload.");

        setLoading(true);
        const formData = new FormData();
        
        if (isFeed) {
            // Uploading to Public Feed Folder
            formData.append('mobile', studioProfile.mobile);
            formData.append('name', studioProfile.studioName);
            formData.append('type', 'STUDIO');
            formData.append('folderName', 'Public Feed Content'); 
        } else {
            // Regular Client Upload
            formData.append('mobile', clientMobile);
            formData.append('name', clientName || 'Client');
            formData.append('type', 'USER');
            formData.append('folderName', folderName); 
        }
        
        formData.append('addedBy', user.mobile); 

        for (let i = 0; i < currentFiles.length; i++) {
            formData.append('mediaFiles', currentFiles[i]);
        }

        try {
            const res = await axios.post(`${API_BASE}/admin-add-user`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

            if (res.data.success) {
                alert(`✅ Success: ${res.data.message}`);
                if (isFeed) {
                    setFeedFiles([]);
                    document.getElementById('feed-input-field').value = '';
                } else {
                    setClientMobile(''); setClientName(''); setFolderName(''); setFiles([]);
                    document.getElementById('file-input-field').value = '';
                }
                fetchClients();
            } else { alert(`❌ Error: ${res.data.message}`); }
        } catch (error) { alert("Upload Failed. Backend check karein."); } 
        finally { setLoading(false); }
    };

    // --- 4. PROFILE UPDATE LOGIC ---
    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_BASE}/update-studio-profile`, { mobile: user.mobile, ...profileEdit });
            if (res.data.success) {
                alert("✅ Profile Updated Successfully!");
                fetchMyProfile();
            } else alert("Update failed.");
        } catch (error) { alert("Server error."); }
    };

    // ✅ FOLDER AUTO-SUGGEST LOGIC
    const selectedClient = clients.find(c => c.mobile === clientMobile);
    let existingFolders = [];
    if (selectedClient && selectedClient.uploadedData) {
        existingFolders = selectedClient.uploadedData.map(f => f.folderName).filter(Boolean);
    }
    const filteredFolderSuggestions = existingFolders.filter(fName => fName.toLowerCase().includes(folderName.toLowerCase()));


    return (
        // ✅ Admin Panel jaisa Layout Structure
        <div className="owner-dashboard-container"> 
            
            {/* 👈 SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <h1 className="admin-title">Studio Panel</h1>
                </div>
                
                {/* Studio Info Card in Sidebar */}
                <div style={{ background: '#0f3460', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
                    <h4 style={{ margin: 0, color: '#4dabf7' }}>{studioProfile.studioName || user.ownerName}</h4>
                    <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#aeb6bf' }}>{studioProfile.mobile}</p>
                    
                    {/* ✅ Verification Badge (Green if Approved) */}
                    {studioProfile.isFeedApproved && (
                        <span style={{ display:'inline-block', marginTop:'10px', background:'#2ecc71', color:'#fff', fontSize:'11px', padding:'3px 8px', borderRadius:'10px', fontWeight: 'bold' }}>✓ Verified Creator</span>
                    )}
                </div>

                <ul className="sidebar-menu">
                    <li className={activeTab === 'DASHBOARD' ? 'active' : ''} onClick={() => setActiveTab('DASHBOARD')}>👥 My Clients</li>
                    <li className={activeTab === 'UPLOAD' ? 'active' : ''} onClick={() => setActiveTab('UPLOAD')}>📤 Upload Client Data</li>
                    
                    {/* ✅ FEED TAB (Admin se approve hone par hi dikhega) */}
                    {studioProfile.isFeedApproved && (
                        <li className={activeTab === 'FEED' ? 'active' : ''} onClick={() => setActiveTab('FEED')}>🌟 Public Feed Upload</li>
                    )}

                    <li className={activeTab === 'REVENUE' ? 'active' : ''} onClick={() => setActiveTab('REVENUE')}>💰 Revenue</li>
                    <li className={activeTab === 'PROFILE' ? 'active' : ''} onClick={() => setActiveTab('PROFILE')}>⚙️ Studio Profile</li>
                </ul>
                <button onClick={onLogout} className="admin-logout-btn">Log Out</button>
            </aside>

            {/* 👉 MAIN CONTENT (TABS) */}
            <main className="admin-main-content">

                {/* 🔴 TAB 1: CLIENTS DASHBOARD */}
                {activeTab === 'DASHBOARD' && (
                    <div className="view-section">
                        <div className="section-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h2>👥 My Recent Clients</h2>
                            <button className="refresh-btn" style={{padding: '8px 15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer'}} onClick={fetchClients} disabled={fetching}>
                                {fetching ? '...' : '🔄 Refresh List'}
                            </button>
                        </div>
                        <div className="data-table-container" style={{ marginTop: '20px' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Client Name</th>
                                        <th>Mobile Number</th>
                                        <th>Uploaded Folders</th>
                                        <th>Joined Date</th>
                                        <th>Actions</th> 
                                    </tr>
                                </thead>
                                <tbody>
                                    {clients.length > 0 ? (
                                        clients.map((client, idx) => {
                                            // Folder count logic
                                            let fileCount = client.uploadedData ? client.uploadedData.length : 0;
                                            return (
                                                <tr key={idx}>
                                                    <td className="bold-text" style={{fontWeight: 'bold'}}>{client.name}</td>
                                                    <td>{client.mobile}</td>
                                                    <td><span className="status-badge normal">{fileCount} Folders</span></td>
                                                    <td>{new Date(client.joinedDate).toLocaleDateString()}</td>
                                                    <td>
                                                        <button className="pdf-btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDeleteClient(client.mobile)}>
                                                            🗑️ Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>No clients added yet. Start by uploading data.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 2: UPLOAD CLIENT DATA */}
                {activeTab === 'UPLOAD' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📤 Upload Data for Client</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Client Mobile</label>
                                    <input type="number" placeholder="10-Digit Number" value={clientMobile} onChange={(e) => setClientMobile(e.target.value)} className="custom-admin-input" />
                                </div>
                                
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Client Name</label>
                                    <input type="text" placeholder="Full Name" value={clientName} onChange={(e) => setClientName(e.target.value)} className="custom-admin-input" />
                                </div>
                                
                                {/* ✅ FOLDER NAME INPUT WITH AUTO-SUGGEST */}
                                <div style={{ background: '#ebf5fb', padding: '15px', borderRadius: '8px', border: '1px solid #bce0fd', position: 'relative' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#2b5876' }}>📂 Folder Name</label>
                                    <p style={{ fontSize: '11px', color: '#555', margin: '5px 0 10px 0' }}>Type to select existing or create new.</p>
                                    <input 
                                        type="text" 
                                        placeholder="e.g., Wedding, Pre-Wedding" 
                                        value={folderName} 
                                        onChange={(e) => { setFolderName(e.target.value); setShowFolderSuggestions(true); }} 
                                        onFocus={() => setShowFolderSuggestions(true)} 
                                        onBlur={() => setTimeout(() => setShowFolderSuggestions(false), 200)} 
                                        className="custom-admin-input" 
                                    />
                                    {showFolderSuggestions && existingFolders.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', borderRadius: '5px' }}>
                                            {filteredFolderSuggestions.map((folder, idx) => (
                                                <li key={idx} onMouseDown={() => { setFolderName(folder); setShowFolderSuggestions(false); }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#333' }}>
                                                    📁 <strong>{folder}</strong>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div style={{ border: '2px dashed #ccc', padding: '15px', borderRadius: '10px', textAlign: 'center', background: '#f9f9f9' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#444' }}>📁 Select Photos/Videos</label>
                                    <input id="file-input-field" type="file" multiple onChange={handleFileChange} style={{ color: '#333' }} />
                                </div>
                                
                                <button onClick={() => handleUpload(false)} disabled={loading} className="global-update-btn" style={{ width: '100%', padding: '15px', fontSize: '16px' }}>
                                    {loading ? 'Uploading...' : '🚀 Upload & Notify Client'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 3: UPLOAD TO FEED (Only if Approved) */}
                {activeTab === 'FEED' && studioProfile.isFeedApproved && (
                    <div className="view-section">
                        <div className="section-header"><h2>🌟 Public Feed Upload</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto', textAlign:'center' }}>
                            <p style={{color:'#555', marginBottom:'20px'}}>Upload your best shots here to be featured on SandN Cinema's public trending page!</p>
                            
                            <div style={{ border: '2px dashed #d4af37', padding: '30px', borderRadius: '10px', background: '#fffdf5' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '15px', fontSize:'18px', color: '#8e6b1e' }}>📸 Select Content for Feed</label>
                                <input id="feed-input-field" type="file" multiple accept="image/*,video/*" onChange={handleFeedFileChange} />
                            </div>
                            
                            <button onClick={() => handleUpload(true)} disabled={loading} className="global-update-btn" style={{ width: '100%', padding: '15px', marginTop:'20px', background:'#d4af37', color:'#000', fontSize: '16px' }}>
                                {loading ? 'Publishing to Feed...' : '🔥 Publish to Feed'}
                            </button>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 4: REVENUE */}
                {activeTab === 'REVENUE' && (
                    <div className="view-section">
                        <div className="section-header"><h2>💰 Business Revenue</h2></div>
                        <div className="dashboard-stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="stat-card green" style={{ padding: '30px', textAlign:'center' }}>
                                <p style={{ color: '#555', fontWeight: 'bold', marginBottom: '10px' }}>Today's Earnings</p>
                                <h3 style={{ fontSize: '40px', color: '#27ae60' }}>₹ 0</h3>
                            </div>
                            <div className="stat-card blue" style={{ padding: '30px', textAlign:'center' }}>
                                <p style={{ color: '#555', fontWeight: 'bold', marginBottom: '10px' }}>Total Earnings</p>
                                <h3 style={{ fontSize: '40px', color: '#3498db' }}>₹ 0</h3>
                            </div>
                        </div>
                        <div style={{textAlign:'center', marginTop:'30px'}}>
                            <button className="global-update-btn" style={{ background: '#e67e22', padding: '15px 40px', fontSize: '16px' }}>🏦 Withdraw Funds</button>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 5: PROFILE SETTINGS */}
                {activeTab === 'PROFILE' && (
                    <div className="view-section">
                        <div className="section-header"><h2>⚙️ Studio Profile Details</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#444'}}>Studio Name</label>
                                    <input type="text" value={profileEdit.studioName} onChange={e => setProfileEdit({...profileEdit, studioName: e.target.value})} className="custom-admin-input"/>
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#444'}}>Owner Name</label>
                                    <input type="text" value={profileEdit.ownerName} onChange={e => setProfileEdit({...profileEdit, ownerName: e.target.value})} className="custom-admin-input"/>
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#444'}}>Email Address</label>
                                    <input type="email" value={profileEdit.email} onChange={e => setProfileEdit({...profileEdit, email: e.target.value})} className="custom-admin-input"/>
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#444'}}>Location</label>
                                    <input type="text" value={profileEdit.location} onChange={e => setProfileEdit({...profileEdit, location: e.target.value})} className="custom-admin-input"/>
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#444'}}>New Password</label>
                                    <input type="password" placeholder="Leave blank to keep current password" value={profileEdit.password} onChange={e => setProfileEdit({...profileEdit, password: e.target.value})} className="custom-admin-input"/>
                                </div>
                                
                                <button type="submit" className="global-update-btn" style={{ width: '100%', padding: '15px', background: '#2ecc71', fontSize: '16px', marginTop: '10px' }}>
                                    💾 Save Profile Details
                                </button>
                            </form>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default StudioDashboard;