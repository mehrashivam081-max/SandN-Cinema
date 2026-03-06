import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StudioDashboard.css'; 

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const StudioDashboard = ({ user, onLogout }) => {
    // --- UI TABS STATES ---
    const [activeTab, setActiveTab] = useState('DASHBOARD');

    // --- DATA STATES ---
    const [studioProfile, setStudioProfile] = useState(user);
    const [clientMobile, setClientMobile] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState(''); // ✅ NEW: Added Email for Notification
    const [files, setFiles] = useState([]);
    const [feedFiles, setFeedFiles] = useState([]); 
    const [clients, setClients] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // --- FOLDER & FILE COUNTER STATES (NEW) ---
    const [folderName, setFolderName] = useState('');
    const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);
    const [showMobileSuggestions, setShowMobileSuggestions] = useState(false);
    const [fileStats, setFileStats] = useState({ photos: 0, videos: 0, feedPhotos: 0, feedVideos: 0 }); // ✅ Counter State

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

    // --- 3. UPLOAD LOGIC & COUNTERS ---
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(selectedFiles);
        // ✅ Count Photos and Videos separately
        const photos = selectedFiles.filter(file => file.type.startsWith('image/')).length;
        const videos = selectedFiles.filter(file => file.type.startsWith('video/')).length;
        setFileStats(prev => ({ ...prev, photos, videos }));
    };

    const handleFeedFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFeedFiles(selectedFiles);
        // ✅ Count Feed Content separately
        const feedPhotos = selectedFiles.filter(file => file.type.startsWith('image/')).length;
        const feedVideos = selectedFiles.filter(file => file.type.startsWith('video/')).length;
        setFileStats(prev => ({ ...prev, feedPhotos, feedVideos }));
    };

    // ✅ MOBILE AUTO-FILL LOGIC
    const handleMobileChange = (e) => {
        const val = e.target.value;
        setClientMobile(val);
        setShowMobileSuggestions(true);

        // Auto-fill silently if exactly 10 digits match an existing client
        const exactMatch = clients.find(c => c.mobile === val);
        if (exactMatch) {
            setClientName(exactMatch.name || exactMatch.studioName || '');
            setClientEmail(exactMatch.email || ''); // Ensure email is picked up if available
        }
    };

    const handleUpload = async (isFeed = false) => {
        if (!isFeed && (!clientMobile || clientMobile.length !== 10)) return alert("Please enter a valid 10-digit mobile number.");
        const currentFiles = isFeed ? feedFiles : files;
        if (currentFiles.length === 0) return alert("Please select files to upload.");

        setLoading(true);
        const formDataPayload = new FormData();
        
        if (isFeed) {
            formDataPayload.append('mobile', studioProfile.mobile);
            formDataPayload.append('name', studioProfile.studioName);
            formDataPayload.append('type', 'STUDIO');
            formDataPayload.append('folderName', 'Public Feed Content'); 
        } else {
            formDataPayload.append('mobile', clientMobile);
            formDataPayload.append('name', clientName || 'Client');
            formDataPayload.append('type', 'USER');
            formDataPayload.append('folderName', folderName);
            formDataPayload.append('email', clientEmail); // ✅ Pass Email for Notification
        }
        
        formDataPayload.append('addedBy', user.mobile); 

        for (let i = 0; i < currentFiles.length; i++) {
            formDataPayload.append('mediaFiles', currentFiles[i]);
        }

        try {
            const res = await axios.post(`${API_BASE}/admin-add-user`, formDataPayload, { headers: { 'Content-Type': 'multipart/form-data' } });

            if (res.data.success) {
                alert(`✅ Success: ${res.data.message}\n📩 Notification sent to Client on Email & WhatsApp!`);
                if (isFeed) {
                    setFeedFiles([]);
                    document.getElementById('feed-input-field').value = '';
                    setFileStats(prev => ({ ...prev, feedPhotos: 0, feedVideos: 0 }));
                } else {
                    setClientMobile(''); setClientName(''); setClientEmail(''); setFolderName(''); setFiles([]);
                    document.getElementById('file-input-field').value = '';
                    setFileStats(prev => ({ ...prev, photos: 0, videos: 0 }));
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

    // ✅ DYNAMIC SUGGESTIONS
    const filteredMobileSuggestions = clients.filter(c => c.mobile && c.mobile.includes(clientMobile));
    const selectedClient = clients.find(c => c.mobile === clientMobile);
    let existingFolders = [];
    if (selectedClient && selectedClient.uploadedData) {
        existingFolders = selectedClient.uploadedData.map(f => f.folderName).filter(Boolean);
    }
    const filteredFolderSuggestions = existingFolders.filter(fName => fName.toLowerCase().includes(folderName.toLowerCase()));


    return (
        <div className="owner-dashboard-container"> 
            
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <h1 className="admin-title">Studio Panel</h1>
                </div>
                
                <div style={{ background: '#0f3460', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
                    <h4 style={{ margin: 0, color: '#4dabf7' }}>{studioProfile.studioName || user.ownerName}</h4>
                    <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#aeb6bf' }}>{studioProfile.mobile}</p>
                    
                    {studioProfile.isFeedApproved && (
                        <span style={{ display:'inline-block', marginTop:'10px', background:'#2ecc71', color:'#fff', fontSize:'11px', padding:'3px 8px', borderRadius:'10px', fontWeight: 'bold' }}>✓ Verified Creator</span>
                    )}
                </div>

                <ul className="sidebar-menu">
                    <li className={activeTab === 'DASHBOARD' ? 'active' : ''} onClick={() => setActiveTab('DASHBOARD')}>👥 My Clients</li>
                    <li className={activeTab === 'UPLOAD' ? 'active' : ''} onClick={() => setActiveTab('UPLOAD')}>📤 Upload Client Data</li>
                    
                    {studioProfile.isFeedApproved && (
                        <li className={activeTab === 'FEED' ? 'active' : ''} onClick={() => setActiveTab('FEED')}>🌟 Feed Management</li>
                    )}

                    <li className={activeTab === 'REVENUE' ? 'active' : ''} onClick={() => setActiveTab('REVENUE')}>💰 Revenue</li>
                    <li className={activeTab === 'PROFILE' ? 'active' : ''} onClick={() => setActiveTab('PROFILE')}>⚙️ Studio Profile</li>
                </ul>
                <button onClick={onLogout} className="admin-logout-btn">Log Out</button>
            </aside>

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

                {/* 🔴 TAB 2: UPLOAD CLIENT DATA (UPGRADED WITH AUTO-FILL, EMAIL & COUNTERS) */}
                {activeTab === 'UPLOAD' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📤 Upload Data for Client</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                
                                {/* ✅ MOBILE WITH AUTO-SUGGEST */}
                                <div style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Client Mobile</label>
                                    <input 
                                        type="number" 
                                        placeholder="10-Digit Number" 
                                        value={clientMobile} 
                                        onChange={handleMobileChange}
                                        onFocus={() => setShowMobileSuggestions(true)} 
                                        onBlur={() => setTimeout(() => setShowMobileSuggestions(false), 200)}
                                        className="custom-admin-input" 
                                    />
                                    {showMobileSuggestions && clientMobile && filteredMobileSuggestions.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', borderRadius: '5px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                                            {filteredMobileSuggestions.map((c, idx) => (
                                                <li key={idx} onMouseDown={() => {
                                                    setClientMobile(c.mobile);
                                                    setClientName(c.name || 'Client');
                                                    setClientEmail(c.email || '');
                                                    setShowMobileSuggestions(false);
                                                }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#333' }}>
                                                    📞 <strong>{c.mobile}</strong> - {c.name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Client Name {selectedClient && <span style={{color: '#2ecc71', fontSize: '11px'}}>(Auto-filled)</span>}</label>
                                    <input type="text" placeholder="Full Name" value={clientName} onChange={(e) => setClientName(e.target.value)} className="custom-admin-input" />
                                </div>

                                {/* ✅ CLIENT EMAIL FOR NOTIFICATION */}
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Client Email (For Notification) {clientEmail && selectedClient && <span style={{color: '#2ecc71', fontSize: '11px'}}>(Auto-filled)</span>}</label>
                                    <input type="email" placeholder="example@email.com (Optional)" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="custom-admin-input" />
                                    <p style={{fontSize:'11px', color:'#777', margin:'3px 0 0 0'}}>We will send a notification to this email once data is uploaded.</p>
                                </div>
                                
                                {/* ✅ FOLDER NAME INPUT WITH WARNING */}
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
                                    {/* DEFAULT FOLDER ALERT */}
                                    {(!folderName || folderName.trim() === '') && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#e67e22', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span>⚠️</span> Default folder "Stranger Photography" will be used.
                                        </div>
                                    )}

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

                                {/* ✅ FILE UPLOAD WITH REAL-TIME COUNT */}
                                <div style={{ border: '2px dashed #ccc', padding: '20px', borderRadius: '10px', textAlign: 'center', background: '#f9f9f9' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#444' }}>📁 Select Photos/Videos</label>
                                    <input id="file-input-field" type="file" multiple accept="image/*,video/*" onChange={handleFileChange} style={{ color: '#333' }} />
                                    
                                    {/* DYNAMIC FILE COUNTERS */}
                                    {files.length > 0 && (
                                        <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                                            <div style={{ background: '#e8f8f5', border: '1px solid #2ecc71', color: '#27ae60', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                                📸 Photos: {fileStats.photos}
                                            </div>
                                            <div style={{ background: '#fdedec', border: '1px solid #e74c3c', color: '#c0392b', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                                🎥 Videos: {fileStats.videos}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                <button onClick={() => handleUpload(false)} disabled={loading} className="global-update-btn" style={{ width: '100%', padding: '15px', fontSize: '16px' }}>
                                    {loading ? 'Uploading & Sending Notification...' : '🚀 Upload & Notify Client'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 3: FEED MANAGEMENT (NEW TAB for Approved Studios) */}
                {activeTab === 'FEED' && studioProfile.isFeedApproved && (
                    <div className="view-section">
                        <div className="section-header"><h2>🌟 Feed Management</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto', textAlign:'center' }}>
                            <div style={{background: '#fffdf5', border: '1px solid #f1c40f', padding: '20px', borderRadius: '10px', marginBottom: '25px'}}>
                                <h3 style={{color: '#d4ac0d', marginTop: 0}}>Grow Your Audience</h3>
                                <p style={{color:'#555', fontSize: '14px', lineHeight: '1.5'}}>
                                    Upload your best shots (images or short 1-min clips) here. These will be randomly featured on SandN Cinema's main public trending page!
                                </p>
                            </div>
                            
                            <div style={{ border: '2px dashed #d4af37', padding: '30px', borderRadius: '10px', background: '#fafafa' }}>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '15px', fontSize:'18px', color: '#8e6b1e' }}>📸 Select Feed Content</label>
                                <input id="feed-input-field" type="file" multiple accept="image/*,video/mp4,video/mov" onChange={handleFeedFileChange} style={{marginTop: '10px'}}/>
                                
                                {/* FEED FILE COUNTERS */}
                                {feedFiles.length > 0 && (
                                    <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                                        <div style={{ background: '#e8f8f5', color: '#27ae60', padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>📸 Photos: {fileStats.feedPhotos}</div>
                                        <div style={{ background: '#fdedec', color: '#c0392b', padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>🎥 Videos: {fileStats.feedVideos}</div>
                                    </div>
                                )}
                            </div>
                            
                            <button onClick={() => handleUpload(true)} disabled={loading} className="global-update-btn" style={{ width: '100%', padding: '15px', marginTop:'20px', background:'linear-gradient(135deg, #d4af37, #f1c40f)', color:'#000', fontSize: '16px', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)' }}>
                                {loading ? 'Uploading to Server...' : '🔥 Upload to Global Feed'}
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