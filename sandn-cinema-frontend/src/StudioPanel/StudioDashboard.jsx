import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StudioDashboard.css';

// ✅ API BASE URL - Render link for production
const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const StudioDashboard = ({ user, onLogout }) => {
    // --- 1. STATES ---
    const [studioProfile, setStudioProfile] = useState(user); // ✅ Added for live profile tracking
    const [clientMobile, setClientMobile] = useState('');
    const [clientName, setClientName] = useState('');
    const [files, setFiles] = useState([]);
    const [feedFiles, setFeedFiles] = useState([]); // ✅ Added for feed upload
    const [clients, setClients] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // ✅ NAYE STATES FOLDER LOGIC KE LIYE
    const [folderName, setFolderName] = useState('');
    const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);

    // ✅ Profile Edit States
    const [profileEdit, setProfileEdit] = useState({
        studioName: user.studioName || '',
        ownerName: user.ownerName || '',
        email: user.email || '',
        password: '',
        location: user.location || ''
    });

    // --- 2. FETCH LOGIC ---
    useEffect(() => {
        if (user && user.mobile) {
            fetchMyProfile();
            fetchClients();
        }
    }, [user]);

    // ✅ Fetch Latest Profile Info (For feed approval check)
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

    // --- 3. DELETE CLIENT LOGIC ---
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

    // --- 4. UPLOAD LOGIC ---
    const handleFileChange = (e) => {
        setFiles(e.target.files);
    };

    const handleFeedFileChange = (e) => {
        setFeedFiles(e.target.files);
    };

    const handleUpload = async (isFeed = false) => {
        if (!isFeed && (!clientMobile || clientMobile.length !== 10)) {
            return alert("Please enter a valid 10-digit mobile number.");
        }
        
        const currentFiles = isFeed ? feedFiles : files;
        if (currentFiles.length === 0) {
            return alert("Please select files to upload.");
        }

        setLoading(true);

        const formData = new FormData();
        
        if (isFeed) {
            // Uploading to Studio's own account inside "Public Feed Content" folder
            formData.append('mobile', studioProfile.mobile);
            formData.append('name', studioProfile.studioName);
            formData.append('type', 'STUDIO');
            formData.append('folderName', 'Public Feed Content'); 
        } else {
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
            const res = await axios.post(`${API_BASE}/admin-add-user`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                alert(`✅ Success: ${res.data.message}`);
                if(isFeed) {
                    setFeedFiles([]);
                    document.getElementById('feed-input-field').value = '';
                } else {
                    setClientMobile('');
                    setClientName('');
                    setFolderName(''); 
                    setFiles([]);
                    document.getElementById('file-input-field').value = '';
                }
                fetchClients();
            } else {
                alert(`❌ Error: ${res.data.message}`);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload Failed. Backend check karein.");
        } finally {
            setLoading(false);
        }
    };

    // --- 5. PROFILE UPDATE LOGIC ---
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
    // Find if the currently typed mobile number exists in clients list
    const selectedClient = clients.find(c => c.mobile === clientMobile);
    let existingFolders = [];
    if (selectedClient && selectedClient.uploadedData) {
        existingFolders = selectedClient.uploadedData.map(f => f.folderName).filter(Boolean);
    }
    const filteredFolderSuggestions = existingFolders.filter(fName => fName.toLowerCase().includes(folderName.toLowerCase()));


    return (
        <div className="studio-container">
            {/* --- HEADER --- */}
            <div className="studio-header">
                <div className="header-info">
                    <h2>🎬 Studio Panel</h2>
                    <p>Welcome, <strong>{studioProfile.studioName || user.ownerName}</strong></p>
                    {/* ✅ Verification Badge */}
                    {studioProfile.isFeedApproved && (
                        <span style={{ display:'inline-block', marginTop:'5px', background:'#2ecc71', color:'#fff', fontSize:'11px', padding:'3px 8px', borderRadius:'10px' }}>✓ Approved Feed Creator</span>
                    )}
                </div>
                <button className="logout-btn-studio" onClick={onLogout}>Logout</button>
            </div>
            
            <div className="studio-grid">
                
                {/* --- UPLOAD CARD --- */}
                <div className="studio-card upload-section">
                    <h3>📤 Upload Client Data</h3>
                    <div className="input-group">
                        <label>Client Mobile</label>
                        <input 
                            type="number"
                            placeholder="e.g. 9876543210" 
                            value={clientMobile}
                            onChange={(e) => setClientMobile(e.target.value)}
                        />
                    </div>
                    
                    <div className="input-group">
                        <label>Client Name</label>
                        <input 
                            type="text"
                            placeholder="Enter Client Name" 
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                        />
                    </div>

                    {/* ✅ FOLDER NAME INPUT WITH AUTO-SUGGEST */}
                    <div className="input-group" style={{ position: 'relative' }}>
                        <label>📂 Folder Name (Optional)</label>
                        <p style={{ fontSize: '11px', color: '#888', margin: '-3px 0 8px 0' }}>Leave blank for "Stranger Photography".</p>
                        <input 
                            type="text"
                            placeholder="e.g., Wedding, Birthday Party" 
                            value={folderName}
                            onChange={(e) => {
                                setFolderName(e.target.value);
                                setShowFolderSuggestions(true);
                            }}
                            onFocus={() => setShowFolderSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowFolderSuggestions(false), 200)}
                        />
                        {/* Dropdown for folder suggestions */}
                        {showFolderSuggestions && existingFolders.length > 0 && (
                            <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', borderRadius: '5px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                {filteredFolderSuggestions.length > 0 ? filteredFolderSuggestions.map((folder, idx) => (
                                    <li key={idx} onMouseDown={() => {
                                        setFolderName(folder);
                                        setShowFolderSuggestions(false);
                                    }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#333' }}>
                                        📁 <strong>{folder}</strong>
                                    </li>
                                )) : (
                                    <li style={{ padding: '10px', color: '#888', fontStyle: 'italic', fontSize: '12px' }}>✨ Create new folder: "{folderName}"</li>
                                )}
                            </ul>
                        )}
                    </div>
                    
                    <div className="input-group">
                        <label>Media Files (Photos/Videos)</label>
                        <input 
                            id="file-input-field"
                            type="file" 
                            multiple 
                            onChange={handleFileChange}
                            className="file-input-custom"
                        />
                    </div>
                    
                    <button 
                        className="action-btn upload-btn" 
                        onClick={() => handleUpload(false)} 
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Upload & Notify Client'}
                    </button>
                </div>

                {/* --- FEED UPLOAD CARD (ONLY IF APPROVED) --- */}
                {studioProfile.isFeedApproved && (
                    <div className="studio-card" style={{ background: '#fffdf5', border: '1px solid #f1c40f' }}>
                        <h3>🌟 Public Feed Upload</h3>
                        <p style={{ fontSize: '12px', color: '#555', marginBottom: '15px' }}>Upload your best shots here to be featured on SandN Cinema's public trending page!</p>
                        
                        <div className="input-group">
                            <label>Media Files for Feed</label>
                            <input 
                                id="feed-input-field"
                                type="file" 
                                multiple 
                                onChange={handleFeedFileChange}
                                className="file-input-custom"
                            />
                        </div>
                        
                        <button 
                            className="action-btn" 
                            style={{ background: '#d4af37', color: '#000', width: '100%', marginTop: '10px' }}
                            onClick={() => handleUpload(true)} 
                            disabled={loading}
                        >
                            {loading ? 'Publishing...' : '🔥 Publish to Feed'}
                        </button>
                    </div>
                )}

                {/* --- REVENUE CARD --- */}
                <div className="studio-card revenue-section">
                    <h3>💰 Business Revenue</h3>
                    <div className="revenue-stats">
                        <div className="stat-box">
                            <span>Today</span>
                            <h4>₹ 0</h4>
                        </div>
                        <div className="stat-box">
                            <span>Total Earnings</span>
                            <h4>₹ 0</h4>
                        </div>
                    </div>
                    <button className="action-btn withdraw-btn">Withdraw Funds</button>
                </div>

                {/* --- PROFILE SETTINGS CARD --- */}
                <div className="studio-card">
                    <h3>⚙️ Studio Profile Details</h3>
                    <form onSubmit={handleProfileUpdate}>
                        <div className="input-group">
                            <label>Studio Name</label>
                            <input type="text" value={profileEdit.studioName} onChange={e => setProfileEdit({...profileEdit, studioName: e.target.value})} />
                        </div>
                        <div className="input-group">
                            <label>Owner Name</label>
                            <input type="text" value={profileEdit.ownerName} onChange={e => setProfileEdit({...profileEdit, ownerName: e.target.value})} />
                        </div>
                        <div className="input-group">
                            <label>Email Address</label>
                            <input type="email" value={profileEdit.email} onChange={e => setProfileEdit({...profileEdit, email: e.target.value})} />
                        </div>
                        <div className="input-group">
                            <label>Location</label>
                            <input type="text" value={profileEdit.location} onChange={e => setProfileEdit({...profileEdit, location: e.target.value})} />
                        </div>
                        <div className="input-group">
                            <label>New Password</label>
                            <input type="password" placeholder="Leave blank to keep current" value={profileEdit.password} onChange={e => setProfileEdit({...profileEdit, password: e.target.value})} />
                        </div>
                        <button type="submit" className="action-btn" style={{ background: '#2ecc71', width: '100%', marginTop: '10px' }}>
                            💾 Save Profile Details
                        </button>
                    </form>
                </div>

            </div>

            {/* --- CLIENTS LIST TABLE --- */}
            <div className="clients-list-container">
                <div className="list-header">
                    <h3>👥 My Recent Clients</h3>
                    <button className="refresh-btn" onClick={fetchClients} disabled={fetching}>
                        {fetching ? '...' : '🔄 Refresh'}
                    </button>
                </div>
                
                <div className="table-responsive">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Client Name</th>
                                <th>Mobile Number</th>
                                <th>Uploaded Items</th>
                                <th>Joined Date</th>
                                <th>Status</th> {/* ✅ Status back in header */}
                                <th>Actions</th> {/* ✅ Actions for Delete */}
                            </tr>
                        </thead>
                        <tbody>
                            {clients.length > 0 ? (
                                clients.map((client, idx) => {
                                    // Handle both new folder structure and old plain string array structure to count files safely
                                    let fileCount = 0;
                                    if (client.uploadedData) {
                                        if (client.uploadedData.length > 0 && typeof client.uploadedData[0] === 'object') {
                                            fileCount = client.uploadedData.reduce((acc, folder) => acc + (folder.files ? folder.files.length : 0), 0);
                                        } else {
                                            fileCount = client.uploadedData.length;
                                        }
                                    }

                                    return (
                                        <tr key={idx}>
                                            <td className="bold-text">{client.name}</td>
                                            <td>{client.mobile}</td>
                                            <td><span className="badge">{fileCount} Files</span></td>
                                            <td>{new Date(client.joinedDate).toLocaleDateString()}</td>
                                            <td><span className="status-active">Active</span></td> {/* ✅ Active status is here */}
                                            <td>
                                                <button 
                                                    className="delete-btn-table" 
                                                    onClick={() => handleDeleteClient(client.mobile)}
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" className="empty-msg">No clients added yet. Start by uploading data.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StudioDashboard;