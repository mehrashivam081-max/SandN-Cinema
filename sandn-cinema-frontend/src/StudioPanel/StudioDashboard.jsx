import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './StudioDashboard.css'; 

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';
const SERVER_URL = 'https://sandn-cinema.onrender.com/';

const StudioDashboard = ({ user, onLogout }) => {
    // --- UI TABS STATES ---
    const [activeTab, setActiveTab] = useState('DASHBOARD');

    // --- DATA STATES ---
    const [studioProfile, setStudioProfile] = useState(user);
    const [clientMobile, setClientMobile] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState(''); 
    const [files, setFiles] = useState([]);
    const [feedFiles, setFeedFiles] = useState([]); 
    const [clients, setClients] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // ✅ NEW: SEARCH CLIENT STATE
    const [clientSearchQuery, setClientSearchQuery] = useState('');

    // --- FOLDER & FILE COUNTER STATES ---
    const [folderName, setFolderName] = useState('');
    const [useDateFolder, setUseDateFolder] = useState(false); // ✅ Added Date Append Logic
    
    // --- LIMIT & EXPIRY STATES ---
    const [expiryDays, setExpiryDays] = useState('');
    const [downloadLimit, setDownloadLimit] = useState('');

    const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);
    const [showMobileSuggestions, setShowMobileSuggestions] = useState(false);
    const [fileStats, setFileStats] = useState({ photos: 0, videos: 0, feedPhotos: 0, feedVideos: 0 }); 

    // --- UPLOAD PROGRESS TRACKER STATES ---
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [uploadETA, setUploadETA] = useState('');

    // ✅ NEW: STUDIO REMOVE TAB STATES
    const [studioRemoveMobile, setStudioRemoveMobile] = useState('');
    const [studioRemoveSearchSuggestions, setStudioRemoveSearchSuggestions] = useState(false);
    const [studioRemoveUserObj, setStudioRemoveUserObj] = useState(null);

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

    // ✅ SUPER SECURITY: Auto-Logout on Connection Lost
    useEffect(() => {
        const handleOffline = () => {
            alert("⚠️ Internet connection lost! For security reasons, your session has been locked.");
            sessionStorage.removeItem('user'); 
            localStorage.removeItem('user');
            if (onLogout) onLogout();
            else window.location.href = "/SandN-Cinema/"; 
        };
        window.addEventListener('offline', handleOffline);
        return () => window.removeEventListener('offline', handleOffline);
    }, [onLogout]);

    // ✅ SMART BROWSER BACK BUTTON (Prevent Logout inside Dashboard)
    useEffect(() => {
        window.history.pushState(null, null, window.location.href);
        const handlePopState = () => {
            window.history.pushState(null, null, window.location.href); // Prevent default back
            
            if (studioRemoveUserObj) {
                setStudioRemoveUserObj(null); // Step back from client data popup
            } else if (activeTab !== 'DASHBOARD') {
                setActiveTab('DASHBOARD'); // Return to main tab instead of logging out
            } else {
                console.log("At root of Studio dashboard. Logout prevented.");
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeTab, studioRemoveUserObj]);

    // ✅ ENTER KEY SUPPORT HELPER
    const handleKeyDown = (e, action) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            action(e);
        }
    };

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
                sessionStorage.setItem('user', JSON.stringify(res.data.data)); // Sync session
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

    // --- 2. DELETE CLIENT LOGIC (Entire Account) ---
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
                if (studioRemoveUserObj && studioRemoveUserObj.mobile === targetMobile) setStudioRemoveUserObj(null);
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
        const photos = selectedFiles.filter(file => file.type.startsWith('image/')).length;
        const videos = selectedFiles.filter(file => file.type.startsWith('video/')).length;
        setFileStats(prev => ({ ...prev, photos, videos }));
    };

    const handleFeedFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFeedFiles(selectedFiles);
        const feedPhotos = selectedFiles.filter(file => file.type.startsWith('image/')).length;
        const feedVideos = selectedFiles.filter(file => file.type.startsWith('video/')).length;
        setFileStats(prev => ({ ...prev, feedPhotos, feedVideos }));
    };

    const handleMobileChange = (e) => {
        const val = e.target.value;
        setClientMobile(val);
        setShowMobileSuggestions(true);

        const exactMatch = clients.find(c => c.mobile === val);
        if (exactMatch) {
            setClientName(exactMatch.name || exactMatch.studioName || '');
            setClientEmail(exactMatch.email || ''); 
        }
    };

    // 🚀 DIRECT CLOUDINARY UPLOAD FUNCTION
    const handleUpload = async (isFeed = false) => {
        if (!isFeed && (!clientMobile || clientMobile.length !== 10)) return alert("Please enter a valid 10-digit mobile number.");
        const currentFiles = isFeed ? feedFiles : files;
        if (currentFiles.length === 0) return alert("Please select files to upload.");

        // ✅ Date Append Logic (Subfolder)
        let baseFolder = folderName.trim() || 'Stranger Photography';
        let targetSubFolder = '';
        if (useDateFolder && !isFeed) {
            targetSubFolder = new Date().toLocaleDateString('en-GB').replace(/\//g, '-'); 
        }
        const displayFolder = targetSubFolder ? `${baseFolder} ➔ ${targetSubFolder}` : (isFeed ? 'Public Feed' : baseFolder);

        setLoading(true);
        setUploadProgress(0);
        setUploadSpeed('Starting Upload...');
        setUploadETA('Calculating...');

        const totalBytes = currentFiles.reduce((acc, file) => acc + file.size, 0);
        const loadedBytesArray = new Array(currentFiles.length).fill(0);
        const uploadedUrls = [];

        let startTime = Date.now();
        let lastTime = startTime;
        let lastTotalLoaded = 0;

        try {
            for (let i = 0; i < currentFiles.length; i++) {
                const file = currentFiles[i];
                const fd = new FormData();
                fd.append('file', file);
                fd.append('upload_preset', 'xgujeuol'); 

                const res = await axios.post('https://api.cloudinary.com/v1_1/dq1wfpqhs/auto/upload', fd, {
                    onUploadProgress: (progressEvent) => {
                        const { loaded } = progressEvent;
                        loadedBytesArray[i] = loaded;

                        const totalLoaded = loadedBytesArray.reduce((acc, val) => acc + val, 0);
                        const percentCompleted = Math.round((totalLoaded * 100) / totalBytes);
                        setUploadProgress(Math.min(percentCompleted, 99)); 

                        const currentTime = Date.now();
                        const timeElapsedLimit = (currentTime - lastTime) / 1000; 

                        if (timeElapsedLimit > 0.5) {
                            const bytesLoadedSinceLast = totalLoaded - lastTotalLoaded;
                            const speedBps = bytesLoadedSinceLast / timeElapsedLimit;
                            const speedKbps = speedBps / 1024;
                            const speedMbps = speedKbps / 1024;

                            if (speedMbps >= 1) setUploadSpeed(`${speedMbps.toFixed(2)} MB/s`);
                            else setUploadSpeed(`${speedKbps.toFixed(2)} KB/s`);

                            const bytesRemaining = totalBytes - totalLoaded;
                            const etaSeconds = bytesRemaining / speedBps;

                            if (etaSeconds > 60) setUploadETA(`${Math.floor(etaSeconds / 60)}m ${Math.floor(etaSeconds % 60)}s left`);
                            else if (etaSeconds > 0) setUploadETA(`${Math.floor(etaSeconds)}s left`);
                            else setUploadETA(`Almost done...`);

                            lastTotalLoaded = totalLoaded;
                            lastTime = currentTime;
                        }
                    }
                });
                
                uploadedUrls.push(res.data.secure_url);
            }

            setUploadProgress(100);
            setUploadSpeed('Finalizing...');
            setUploadETA('Saving Data to Server...');

            const payload = {
                mobile: isFeed ? studioProfile.mobile : clientMobile,
                name: isFeed ? studioProfile.studioName : (clientName || 'Client'),
                type: isFeed ? 'STUDIO' : 'USER',
                folderName: isFeed ? 'Public Feed Content' : baseFolder,
                subFolderName: targetSubFolder, 
                email: isFeed ? '' : clientEmail,
                expiryDays: isFeed ? '' : expiryDays,
                downloadLimit: isFeed ? '' : downloadLimit,
                addedBy: user.mobile,
                fileUrls: uploadedUrls 
            };

            const backendRes = await axios.post(`${API_BASE}/admin-add-user-cloud`, payload);

            if (backendRes.data.success) {
                setUploadETA('Complete!');
                setTimeout(() => {
                    alert(`✅ Success: ${backendRes.data.message}\n📩 Notification sent!`);
                    
                    // ✅ COMPLETE UI RESET LOGIC AFTER UPLOAD
                    setUploadProgress(0);
                    setUploadSpeed('');
                    setUploadETA('');

                    if (isFeed) {
                        setFeedFiles([]);
                        document.getElementById('feed-input-field').value = '';
                        setFileStats(prev => ({ ...prev, feedPhotos: 0, feedVideos: 0 }));
                    } else {
                        setClientMobile(''); setClientName(''); setClientEmail(''); setFolderName(''); 
                        setExpiryDays(''); setDownloadLimit(''); setUseDateFolder(false);
                        setFiles([]);
                        document.getElementById('file-input-field').value = '';
                        setFileStats(prev => ({ ...prev, photos: 0, videos: 0 }));
                    }
                    fetchClients();
                    if(studioRemoveUserObj && studioRemoveUserObj.mobile === clientMobile) searchUserForRemoval(clientMobile);
                    setLoading(false);
                }, 500);
            } else { 
                alert(`❌ Error from Database: ${backendRes.data.message}`); 
                setLoading(false);
            }
        } catch (error) { 
            alert("Upload Failed. Check internet connection."); 
            console.error(error);
            setLoading(false);
        } 
    };

    // --- 4. PROFILE UPDATE LOGIC ---
    const handleProfileUpdate = async (e) => {
        if(e) e.preventDefault();
        try {
            const res = await axios.post(`${API_BASE}/update-studio-profile`, { mobile: user.mobile, ...profileEdit });
            if (res.data.success) {
                alert("✅ Profile Updated Successfully!");
                fetchMyProfile();
            } else alert("Update failed.");
        } catch (error) { alert("Server error."); }
    };

    // ✅ NEW: STUDIO REMOVE SPECIFIC DATA LOGIC
    const searchUserForRemoval = (mobile) => {
        if(mobile.length !== 10) return alert("Please enter valid 10-digit mobile number.");
        const foundUser = clients.find(a => a.mobile === mobile);
        if (foundUser) {
            setStudioRemoveUserObj(foundUser);
            setStudioRemoveSearchSuggestions(false);
        } else {
            alert("No client found in your list with this mobile number.");
            setStudioRemoveUserObj(null);
        }
    };

    const handleAdvancedDelete = async (mobile, folderName, subFolderName = null, fileUrl = null) => {
        let msg = "Are you sure you want to delete this ";
        if (fileUrl) msg += "Specific File?";
        else if (subFolderName) msg += `Sub-Folder "${subFolderName}" and ALL its files?`;
        else msg += `Entire Main Folder "${folderName}" and ALL its contents?`;
        
        if (!window.confirm(`⚠️ WARNING: ${msg}\nThis action cannot be undone!`)) return;

        try {
            const res = await axios.post(`${API_BASE}/delete-specific-data`, { mobile, folderName, subFolderName, fileUrl });
            if (res.data.success) {
                alert("🗑️ Deleted successfully!");
                setStudioRemoveUserObj(prev => ({ ...prev, uploadedData: res.data.updatedData }));
                fetchClients(); 
            } else {
                alert(res.data.message || "Failed to delete.");
            }
        } catch (e) { alert("Error connecting to server."); }
    };

    const isVideo = (filePath) => {
        if (!filePath || typeof filePath !== 'string') return false;
        if (filePath.includes('/video/upload/')) return true; 
        return filePath.match(/\.(mp4|webm|ogg|mov)$/i);
    };

    const getCleanUrl = (filePath) => {
        if (!filePath) return '';
        if (filePath.startsWith('http')) return filePath; 
        return `${SERVER_URL}${filePath.replace(/\\/g, '/')}`; 
    };

    const filteredMobileSuggestions = clients.filter(c => c.mobile && c.mobile.includes(clientMobile));
    const filteredRemoveSuggestions = clients.filter(c => c.mobile && c.mobile.includes(studioRemoveMobile));
    const selectedClient = clients.find(c => c.mobile === clientMobile);
    
    // ✅ Apply Search Filter on Clients List
    const filteredClientsList = clients.filter(c => c.mobile && c.mobile.includes(clientSearchQuery));

    let existingFolders = [];
    if (selectedClient && selectedClient.uploadedData) {
        if(Array.isArray(selectedClient.uploadedData)){
             existingFolders = selectedClient.uploadedData.map(f => f.folderName).filter(Boolean);
        }
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
                        {/* ✅ SEARCH BAR IN HEADER */}
                        <div className="section-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
                            <h2 style={{margin: 0}}>👥 My Recent Clients</h2>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input 
                                    type="number" 
                                    placeholder="🔍 Search Mobile No..." 
                                    value={clientSearchQuery}
                                    onChange={(e) => setClientSearchQuery(e.target.value)}
                                    style={{ padding: '8px 15px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none', width: '180px' }}
                                />
                                <button className="refresh-btn" style={{padding: '8px 15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap'}} onClick={fetchClients} disabled={fetching}>
                                    {fetching ? '...' : '🔄 Refresh List'}
                                </button>
                            </div>
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
                                    {filteredClientsList.length > 0 ? (
                                        filteredClientsList.map((client, idx) => {
                                            let fileCount = 0;
                                            if(Array.isArray(client.uploadedData)) fileCount = client.uploadedData.length;
                                            return (
                                                <tr key={idx}>
                                                    <td className="bold-text" style={{fontWeight: 'bold'}}>{client.name}</td>
                                                    <td>{client.mobile}</td>
                                                    <td><span className="status-badge normal">{fileCount} Folders</span></td>
                                                    <td>{new Date(client.joinedDate).toLocaleDateString()}</td>
                                                    <td>
                                                        <button className="pdf-btn" style={{ padding: '6px 12px', fontSize: '12px', marginRight: '5px', background: '#34495e' }} onClick={() => { setStudioRemoveMobile(client.mobile); searchUserForRemoval(client.mobile); }}>
                                                            📂 Manage Data
                                                        </button>
                                                        <button className="pdf-btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#e74c3c' }} onClick={() => handleDeleteClient(client.mobile)}>
                                                            🗑️ Delete Client
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                                                {clientSearchQuery ? 'No clients found with this mobile number.' : 'No clients added yet. Start by uploading data.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* DATA MANAGER SECTION (Visible when "Manage Data" clicked) */}
                        {studioRemoveUserObj && (
                            <div className="update-creation-container" style={{ maxWidth: '900px', margin: '30px auto', background: '#f8f9fa', border: '1px solid #ddd' }}>
                                <h3 style={{ borderBottom: '2px solid #bdc3c7', paddingBottom: '10px', color: '#2c3e50', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>👤 Data for: {studioRemoveUserObj.name || studioRemoveUserObj.studioName} ({studioRemoveUserObj.mobile})</span>
                                    <button onClick={() => setStudioRemoveUserObj(null)} style={{background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer'}}>✖</button>
                                </h3>

                                {studioRemoveUserObj.uploadedData && studioRemoveUserObj.uploadedData.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                                        {studioRemoveUserObj.uploadedData.map((folder, fIdx) => (
                                            <div key={fIdx} style={{ background: '#fff', border: '1px solid #bdc3c7', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                                
                                                {/* MAIN FOLDER HEADER */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecf0f1', padding: '10px', borderRadius: '5px' }}>
                                                    <h4 style={{ margin: 0, color: '#2980b9' }}>📁 {folder.folderName}</h4>
                                                    <button onClick={() => handleAdvancedDelete(studioRemoveUserObj.mobile, folder.folderName)} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Delete Entire Folder</button>
                                                </div>

                                                {/* ROOT FILES IN MAIN FOLDER */}
                                                {folder.files && folder.files.length > 0 && (
                                                    <div style={{ padding: '10px', borderBottom: folder.subFolders?.length > 0 ? '1px dashed #ccc' : 'none' }}>
                                                        <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d' }}>Root Media Files:</p>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
                                                            {folder.files.map((fileUrl, idx) => (
                                                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fdfefe', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }}>
                                                                    <div style={{ width: '100%', height: '80px', background: '#000', marginBottom: '8px', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                                        {isVideo(fileUrl) ? (<><video src={getCleanUrl(fileUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white'}}>▶️</div></>) : <img src={getCleanUrl(fileUrl)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                                    </div>
                                                                    <button onClick={() => handleAdvancedDelete(studioRemoveUserObj.mobile, folder.folderName, null, fileUrl)} style={{ background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', padding: '3px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', width: '100%' }}>Delete File</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* SUB-FOLDERS (DATES) */}
                                                {folder.subFolders && folder.subFolders.length > 0 && (
                                                    <div style={{ padding: '10px' }}>
                                                        <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#8e44ad' }}>Date Sub-Folders:</p>
                                                        {folder.subFolders.map((sub, sIdx) => (
                                                            <div key={sIdx} style={{ marginBottom: '15px', borderLeft: '3px solid #9b59b6', paddingLeft: '10px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5eef8', padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
                                                                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>🗓️ {sub.name}</span>
                                                                    <button onClick={() => handleAdvancedDelete(studioRemoveUserObj.mobile, folder.folderName, sub.name)} style={{ background: '#e67e22', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Delete Sub-Folder</button>
                                                                </div>
                                                                {sub.files && sub.files.length > 0 ? (
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
                                                                        {sub.files.map((subFileUrl, fidx) => (
                                                                            <div key={fidx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }}>
                                                                                <div style={{ width: '100%', height: '80px', background: '#000', marginBottom: '8px', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                                                    {isVideo(subFileUrl) ? (<><video src={getCleanUrl(subFileUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white'}}>▶️</div></>) : <img src={getCleanUrl(subFileUrl)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                                                                </div>
                                                                                <button onClick={() => handleAdvancedDelete(studioRemoveUserObj.mobile, folder.folderName, sub.name, subFileUrl)} style={{ background: 'transparent', color: '#c0392b', border: '1px solid #c0392b', padding: '3px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', width: '100%' }}>Delete File</button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : <p style={{fontSize: '11px', color: '#aaa', margin: 0}}>Empty sub-folder.</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : <p style={{ textAlign: 'center', color: '#7f8c8d', padding: '30px 0' }}>No folders uploaded for this user yet.</p>}
                            </div>
                        )}
                    </div>
                )}

                {/* 🔴 TAB 2: UPLOAD CLIENT DATA */}
                {activeTab === 'UPLOAD' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📤 Upload Data for Client</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                
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
                                        onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))}
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
                                    <input type="text" placeholder="Full Name" value={clientName} onChange={(e) => setClientName(e.target.value)} className="custom-admin-input" onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))} />
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Client Email (For Notification) {clientEmail && selectedClient && <span style={{color: '#2ecc71', fontSize: '11px'}}>(Auto-filled)</span>}</label>
                                    <input type="email" placeholder="example@email.com (Optional)" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="custom-admin-input" onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))} />
                                    <p style={{fontSize:'11px', color:'#777', margin:'3px 0 0 0'}}>We will send a notification to this email once data is uploaded.</p>
                                </div>
                                
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
                                        onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))}
                                    />
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
                                    
                                    {/* ✅ SMART DATE APPEND CHECKBOX (Subfolder logic) */}
                                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input type="checkbox" id="useDateFolder" checked={useDateFolder} onChange={(e) => setUseDateFolder(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                        <label htmlFor="useDateFolder" style={{ fontSize: '12px', color: '#333', cursor: 'pointer', fontWeight: 'bold' }}>🗓️ Save inside Today's Date Sub-Folder</label>
                                    </div>
                                </div>

                                {/* ✅ EXPIRY AND LIMIT CONTROLS */}
                                <div style={{ display: 'flex', gap: '15px', background: '#fffdf5', padding: '15px', borderRadius: '8px', border: '1px solid #f1c40f' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4ac0d' }}>⏳ Expiry (Days)</label>
                                        <input type="number" placeholder="e.g. 30 (0 = Never)" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} className="custom-admin-input" style={{marginTop:'5px'}} onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4ac0d' }}>📥 Max Downloads</label>
                                        <input type="number" placeholder="e.g. 3 (0 = Unlimited)" value={downloadLimit} onChange={(e) => setDownloadLimit(e.target.value)} className="custom-admin-input" style={{marginTop:'5px'}} onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))} />
                                    </div>
                                </div>

                                <div style={{ border: '2px dashed #ccc', padding: '20px', borderRadius: '10px', textAlign: 'center', background: '#f9f9f9' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#444' }}>📁 Select Photos/Videos</label>
                                    <input id="file-input-field" type="file" multiple accept="image/*,video/*" onChange={handleFileChange} style={{ color: '#333' }} />
                                    
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

                                {loading && (
                                    <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>
                                            <span>{uploadProgress === 100 ? 'Saving to Database...' : `Cloud Upload... ${uploadProgress}%`}</span>
                                            <span style={{ color: '#3498db' }}>{uploadSpeed}</span>
                                        </div>
                                        <div style={{ width: '100%', background: '#eee', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
                                            <div style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #3498db, #2ecc71)', height: '100%', transition: 'width 0.3s ease' }}></div>
                                        </div>
                                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: '#e67e22', fontWeight: 'bold' }}>
                                            ⏳ {uploadETA}
                                        </div>
                                    </div>
                                )}
                                
                                <button onClick={() => handleUpload(false)} disabled={loading} className="global-update-btn" style={{ width: '100%', padding: '15px', fontSize: '16px', background: loading ? '#95a5a6' : '#2ecc71', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                    {loading ? 'Uploading to Cloud...' : '🚀 Upload & Notify Client'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 3: FEED MANAGEMENT */}
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
                                
                                {feedFiles.length > 0 && (
                                    <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                                        <div style={{ background: '#e8f8f5', color: '#27ae60', padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>📸 Photos: {fileStats.feedPhotos}</div>
                                        <div style={{ background: '#fdedec', color: '#c0392b', padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>🎥 Videos: {fileStats.feedVideos}</div>
                                    </div>
                                )}
                            </div>

                            {loading && (
                                <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', marginTop: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>
                                        <span>Publishing... {uploadProgress}%</span>
                                        <span style={{ color: '#d4af37' }}>{uploadSpeed}</span>
                                    </div>
                                    <div style={{ width: '100%', background: '#eee', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
                                        <div style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #f1c40f, #d4af37)', height: '100%', transition: 'width 0.3s ease' }}></div>
                                    </div>
                                    <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: '#e67e22', fontWeight: 'bold' }}>
                                        ⏳ {uploadETA}
                                    </div>
                                </div>
                            )}
                            
                            <button onClick={() => handleUpload(true)} disabled={loading} className="global-update-btn" style={{ width: '100%', padding: '15px', marginTop:'20px', background: loading ? '#bdc3c7' : 'linear-gradient(135deg, #d4af37, #f1c40f)', color:'#000', fontSize: '16px', fontWeight: 'bold', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                {loading ? 'Uploading to Cloud Server...' : '🔥 Upload to Global Feed'}
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
                                    <input type="text" value={profileEdit.studioName} onChange={e => setProfileEdit({...profileEdit, studioName: e.target.value})} className="custom-admin-input" onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#444'}}>Owner Name</label>
                                    <input type="text" value={profileEdit.ownerName} onChange={e => setProfileEdit({...profileEdit, ownerName: e.target.value})} className="custom-admin-input" onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#444'}}>Email Address</label>
                                    <input type="email" value={profileEdit.email} onChange={e => setProfileEdit({...profileEdit, email: e.target.value})} className="custom-admin-input" onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#444'}}>Location</label>
                                    <input type="text" value={profileEdit.location} onChange={e => setProfileEdit({...profileEdit, location: e.target.value})} className="custom-admin-input" onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#444'}}>New Password</label>
                                    <input type="password" placeholder="Leave blank to keep current password" value={profileEdit.password} onChange={e => setProfileEdit({...profileEdit, password: e.target.value})} className="custom-admin-input" onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
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