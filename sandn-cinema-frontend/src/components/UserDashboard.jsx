import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserDashboard.css';
import { calculateDailyReward } from '../utils/coinLogic';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';
const SERVER_URL = 'https://sandn-cinema.onrender.com/';

const UserDashboard = ({ user, userData, onLogout }) => {
    // --- UI STATES ---
    const [currentTab, setCurrentTab] = useState('HOME'); 
    const [loading, setLoading] = useState(true);
    
    // --- USER SYNCED DATA (REAL-TIME) ---
    const [syncUser, setSyncUser] = useState(user || {});
    const [wallet, setWallet] = useState(user?.wallet || { coins: 0, currentStreak: 0, history: [] });
    const [editName, setEditName] = useState(user?.name || '');
    
    // --- FOLDER & MEDIA STATES ---
    const [folders, setFolders] = useState([]);
    const [activeFolder, setActiveFolder] = useState(null); 
    const [mediaFilter, setMediaFilter] = useState('ALL'); 

    // ✅ PREVIEW & UPLOADER PROFILE STATES
    const [previewMedia, setPreviewMedia] = useState(null); 
    const [uploaderProfile, setUploaderProfile] = useState(null);

    // ✅ NEW MONETIZATION STATES (Pay per View/Download)
    const [purchaseModal, setPurchaseModal] = useState({ show: false, file: null, cost: 0, type: '' });
    const [adLoading, setAdLoading] = useState(false);

    // ✅ LIVE DOWNLOAD STATES
    const [downloadingFile, setDownloadingFile] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [downloadETA, setDownloadETA] = useState('');

    // --- PROFILE STATES ---
    const [profileImage, setProfileImage] = useState(user?.profileImage || null);
    const [editProfileMode, setEditProfileMode] = useState(false);
    const [profileData, setProfileData] = useState({
        email: user?.email || '',
        location: user?.location || ''
    });

    const [rewardPopup, setRewardPopup] = useState({ show: false, type: '', coins: 0, streak: 0 });

    const DEFAULT_FOLDER = { folderName: 'Stranger Photography', files: [], isDefault: true, uploadedBy: 'SandN Cinema', uploaderRole: 'VIP Studio', imageCost: 5, videoCost: 10 };

    // 🟢 FETCH LOGIC 
    useEffect(() => {
        console.log("🔥 DASHBOARD LOAD HUA. User Data:", user);
        const fetchRealTimeData = async () => {
            if (!user || !user.mobile) {
                setFolders([DEFAULT_FOLDER]);
                setLoading(false);
                return; 
            }

            setLoading(true);
            try {
                // Fetch user data stricly to get updated wallet balance
                const res = await axios.post(`${API_BASE}/search-account`, { mobile: user.mobile });
                
                if (res.data.success) {
                    const dbData = res.data.data;
                    setSyncUser(dbData);
                    setEditName(dbData.name || '');
                    setProfileData({ email: dbData.email || '', location: dbData.location || '' });
                    if(dbData.wallet) setWallet(dbData.wallet);
                    
                    let fetchedFolders = dbData.uploadedData || [];
                    if (!Array.isArray(fetchedFolders)) {
                        fetchedFolders = (typeof fetchedFolders === 'object' && fetchedFolders !== null) ? Object.values(fetchedFolders) : [];
                    }

                    fetchedFolders = fetchedFolders.map(folder => {
                        if (typeof folder === 'string') return null; 
                        return {
                            ...folder,
                            files: Array.isArray(folder.files) ? folder.files : (typeof folder.files === 'string' ? [folder.files] : [])
                        };
                    }).filter(Boolean);

                    const customFolders = fetchedFolders.filter(f => f && f.folderName && f.folderName.trim().toLowerCase() !== 'stranger photography');
                    const backendDefaultFolder = fetchedFolders.find(f => f && f.folderName && f.folderName.trim().toLowerCase() === 'stranger photography');
                    
                    const finalDefaultFolder = backendDefaultFolder 
                        ? { ...DEFAULT_FOLDER, ...backendDefaultFolder, files: backendDefaultFolder.files || [] } 
                        : DEFAULT_FOLDER;
                    
                    setFolders([finalDefaultFolder, ...customFolders]);
                    localStorage.setItem('user', JSON.stringify({ ...user, name: dbData.name }));
                } else {
                    setFolders([DEFAULT_FOLDER]); 
                }
            } catch (error) {
                console.error("Fetch error:", error);
                setFolders([DEFAULT_FOLDER]); 
            } finally {
                setLoading(false);
            }
        };

        fetchRealTimeData();
        
        const currentUserData = userData || user || {};
        const rewardResult = calculateDailyReward({ ...currentUserData, wallet });
        
        if (rewardResult.rewardAdded) {
            setRewardPopup({ show: true, type: 'EARNED', coins: 1, streak: rewardResult.currentStreak });
            setWallet(rewardResult);
            setTimeout(() => setRewardPopup({ show: false }), 4000); 
        } else if (rewardResult.streakReset && rewardResult.currentStreak === 1) {
            setRewardPopup({ show: true, type: 'MISSED', coins: 0, streak: 1 });
            setWallet(rewardResult);
            setTimeout(() => setRewardPopup({ show: false }), 4000);
        }
    }, [user?.mobile]); 

    // --- HELPERS ---
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

    // --- PROFILE HANDLERS ---
    const handleDPChange = (e) => {
        const file = e.target.files[0];
        if (file) setProfileImage(URL.createObjectURL(file)); 
    };

    const handleRemoveDP = () => setProfileImage(null);

    const handleSaveProfile = () => {
        alert("Profile Updated Successfully!");
        setEditProfileMode(false);
        const updatedLocalUser = { ...syncUser, name: editName, email: profileData.email, location: profileData.location };
        setSyncUser(updatedLocalUser);
        localStorage.setItem('user', JSON.stringify(updatedLocalUser));
    };

    // ✅ NEW: Trigger Purchase Modal before preview/download
    const triggerMonetization = (filePath) => {
        if (!activeFolder) return;

        // ✅ ADMIN PANEL SE DECIDE KIYI HUYI COST YAHAN USE HOGI
        const fileType = isVideo(filePath) ? 'Video' : 'Photo';
        const fileCost = fileType === 'Video' ? (activeFolder.videoCost || 10) : (activeFolder.imageCost || 5);

        setPurchaseModal({
            show: true,
            file: filePath,
            cost: fileCost,
            type: fileType
        });
    };

    // ✅ NEW logic to determine cost based on admin panel config per folder
    const getCostLabel = (filePath) => {
        if(!activeFolder) return '';
        const isVid = isVideo(filePath);
        return isVid ? `${activeFolder.videoCost || 10} Coins` : `${activeFolder.imageCost || 5} Coins`;
    };

    // ✅ NEW logic: Process Purchase with Coins
    const processCoinPurchase = async () => {
        if (wallet.coins < purchaseModal.cost) {
            alert("Not enough coins! Watch Ads to earn or buy more.");
            return;
        }

        setLoading(true);
        try {
            // ✅ API to deduct coins from backend
            const res = await axios.post(`${API_BASE}/deduct-coins`, {
                mobile: user.mobile,
                amount: purchaseModal.cost,
                reason: `Unlocking ${purchaseModal.type} in folder ${activeFolder.folderName}`
            });

            if (res.data.success) {
                // Update local wallet state
                setWallet(res.data.wallet);
                // Open Preview
                setPreviewMedia(purchaseModal.file);
                // Close Modal
                setPurchaseModal({ show: false, file: null, cost: 0, type: '' });
                alert(`${purchaseModal.type} Unlocked Successfully! 🎉`);
            } else {
                alert(res.data.message || "Purchase failed.");
            }
        } catch (e) {
            console.error("Purchase error", e);
            alert("Server Error during purchase.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ NEW logic: Watch Ad to earn coins
    const startWatchAdFlow = () => {
        setAdLoading(true);
        alert("Starting Ad Video... (Please watch completely to earn 1 Coin)");
        
        // Simulating ad network behavior (e.g., Google AdMob/AdSense)
        setTimeout(async () => {
            try {
                // ✅ API to add 1 coin after watching ad
                const res = await axios.post(`${API_BASE}/add-coins`, {
                    mobile: user.mobile,
                    amount: 1,
                    reason: "Watched Ad Video"
                });

                if (res.data.success) {
                    setWallet(res.data.wallet); // Sync wallet balance
                    alert("Reward Received! +1 Coin added to your wallet. 🪙");
                }
            } catch (e) {
                console.error("Ad reward error", e);
            } finally {
                setAdLoading(false);
            }
        }, 5000); // Simulate 5 second ad
    };

    // 🚀 LIVE DOWNLOAD (Kept original logic, just called after monetization check if needed)
    const handleDownload = async (filePath) => {
        setDownloadingFile(filePath);
        setDownloadProgress(0);
        setDownloadSpeed('Calculating...');
        setDownloadETA('...');

        const url = getCleanUrl(filePath);
        let startTime = Date.now();
        let lastLoadedBytes = 0;
        let lastTime = startTime;

        try {
            const response = await axios({
                url, method: 'GET', responseType: 'blob', 
                onDownloadProgress: (progressEvent) => {
                    const { loaded, total } = progressEvent;
                    if(total) {
                        const percentCompleted = Math.round((loaded * 100) / total);
                        setDownloadProgress(percentCompleted);

                        const currentTime = Date.now();
                        const timeElapsedLimit = (currentTime - lastTime) / 1000; 

                        if (timeElapsedLimit > 0.5) {
                            const bytesLoadedSinceLast = loaded - lastLoadedBytes;
                            const speedBps = bytesLoadedSinceLast / timeElapsedLimit;
                            const speedKbps = speedBps / 1024;
                            const speedMbps = speedKbps / 1024;

                            if (speedMbps >= 1) setDownloadSpeed(`${speedMbps.toFixed(2)} MB/s`);
                            else setDownloadSpeed(`${speedKbps.toFixed(2)} KB/s`);

                            const bytesRemaining = total - loaded;
                            const etaSeconds = bytesRemaining / speedBps;

                            if (etaSeconds > 60) setDownloadETA(`${Math.floor(etaSeconds / 60)}m ${Math.floor(etaSeconds % 60)}s left`);
                            else if (etaSeconds > 0) setDownloadETA(`${Math.floor(etaSeconds)}s left`);
                            else setDownloadETA(`Almost done...`);

                            lastLoadedBytes = loaded;
                            lastTime = currentTime;
                        }
                    }
                }
            });

            const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = urlBlob;
            const fileName = filePath.substring(filePath.lastIndexOf('/') + 1) || 'SandN_Cinema_Media';
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(urlBlob);

            setDownloadingFile(null);
            
            if (activeFolder && activeFolder.downloadLimit > 0) {
                const newCount = (activeFolder.downloadCount || 0) + 1;
                setActiveFolder({ ...activeFolder, downloadCount: newCount });
                setFolders(folders.map(f => f.folderName === activeFolder.folderName ? { ...f, downloadCount: newCount } : f));
                axios.post(`${API_BASE}/update-download-count`, { mobile: user.mobile, folderName: activeFolder.folderName }).catch(err => console.log("Failed to sync count", err));
            }

        } catch (error) {
            console.error("Download failed", error);
            alert("Download Failed. Try again.");
            setDownloadingFile(null);
        }
    };


    // --- RENDER TABS ---
    const renderContent = () => {
        if (currentTab === 'SERVICES') return <div className="tab-placeholder"><h2>Our Services</h2><p>Booking modules coming soon...</p></div>;
        if (currentTab === 'BOOKINGS') return <div className="tab-placeholder"><h2>Booking History</h2><p>No past bookings found.</p></div>;
        if (currentTab === 'HISTORY') return renderHistoryTab();
        if (currentTab === 'PROFILE') return renderProfileTab();
        return renderHomeTab();
    };

    const renderHistoryTab = () => {
        const historyData = wallet?.history || [
            { date: new Date().toLocaleDateString(), action: "Daily Login Reward", amount: "+1 Coin", type: "credit" },
            { date: "01/03/2026", action: "Account Registered", amount: "0", type: "neutral" }
        ];

        return (
            <div className="history-tab-vip" style={{padding: '20px', paddingBottom: '80px'}}>
                <div className="section-header" style={{marginBottom: '20px'}}>
                    <h2 style={{color: '#fff', fontSize: '20px', margin: 0}}>📜 Transaction History</h2>
                    <p style={{color: '#aaa', fontSize: '12px', margin: '5px 0 0 0'}}>Your platform activity and coin logs.</p>
                </div>
                
                <div className="history-list">
                    {historyData.map((item, idx) => (
                        <div key={idx} style={{ background: '#1a1a2e', padding: '15px', borderRadius: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: item.type === 'credit' ? '4px solid #f1c40f' : '4px solid #3498db' }}>
                            <div>
                                <h4 style={{margin: '0 0 5px 0', color: '#fff', fontSize: '15px'}}>{item.action}</h4>
                                <span style={{color: '#888', fontSize: '11px'}}>{item.date}</span>
                            </div>
                            <div style={{fontWeight: 'bold', color: item.type === 'credit' ? '#f1c40f' : '#fff', fontSize: '16px'}}>{item.amount}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderProfileTab = () => (
        <div className="profile-tab-vip">
            <h2>Your Profile</h2>
            <div className="profile-card-vip">
                <div className="dp-section">
                    <div className="dp-circle">{profileImage ? <img src={profileImage} alt="DP" /> : <span>{editName ? editName.charAt(0).toUpperCase() : 'U'}</span>}</div>
                    {editProfileMode && (
                        <div className="dp-controls">
                            <label className="dp-btn upload">Change<input type="file" accept="image/*" hidden onChange={handleDPChange}/></label>
                            <button className="dp-btn remove" onClick={handleDPChange}>Remove</button>
                        </div>
                    )}
                </div>

                <div className="profile-details">
                    <label>Registered Mobile No.</label>
                    <input type="text" value={syncUser?.mobile || ''} disabled className="vip-input disabled" />

                    <label>Full Name</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!editProfileMode} className={`vip-input ${!editProfileMode ? 'disabled' : ''}`} />

                    <label>Email Address</label>
                    <input type="email" value={profileData.email} onChange={(e) => setProfileData({...profileData, email: e.target.value})} disabled={!editProfileMode} placeholder="Add your email" className={`vip-input ${!editProfileMode ? 'disabled' : ''}`} />

                    <label>Location / City</label>
                    <input type="text" value={profileData.location} onChange={(e) => setProfileData({...profileData, location: e.target.value})} disabled={!editProfileMode} placeholder="e.g. Indore" className={`vip-input ${!editProfileMode ? 'disabled' : ''}`} />

                    {editProfileMode ? (
                        <button className="vip-btn-gold mt-20" onClick={handleSaveProfile} style={{background: '#2ecc71', color: '#fff', border: 'none'}}>Save Changes</button>
                    ) : (
                        <button className="vip-btn-outline mt-20" onClick={() => setEditProfileMode(true)}>Edit Profile</button>
                    )}
                </div>
            </div>
            <button className="logout-btn-full mt-20" onClick={onLogout} style={{background: '#e74c3c'}}>Logout Securely</button>
        </div>
    );

    const renderHomeTab = () => {
        if (activeFolder) {
            const displayedMedia = (activeFolder.files || []).filter(item => {
                if (mediaFilter === 'PHOTOS') return !isVideo(item);
                if (mediaFilter === 'VIDEOS') return isVideo(item);
                return true;
            });

            const hasExpiry = activeFolder.expiryDate;
            const isExpired = hasExpiry && new Date(activeFolder.expiryDate) < new Date();
            const hasLimit = activeFolder.downloadLimit > 0;
            const currentDownloads = activeFolder.downloadCount || 0;
            const isLimitReached = hasLimit && currentDownloads >= activeFolder.downloadLimit;
            const canDownload = !isExpired && !isLimitReached;

            return (
                <div className="folder-gallery-view">
                    <div className="folder-header-nav">
                        <button onClick={() => { setActiveFolder(null); setMediaFilter('ALL'); }} className="back-btn">⬅ Back to Folders</button>
                        <h3>{activeFolder.folderName}</h3>
                    </div>

                    {(hasExpiry || hasLimit) && (
                        <div style={{ background: isExpired || isLimitReached ? '#fdedec' : '#fffdf5', border: `1px solid ${isExpired || isLimitReached ? '#e74c3c' : '#f1c40f'}`, padding: '10px', borderRadius: '8px', marginBottom: '15px', marginTop: '10px' }}>
                            {hasExpiry && <p style={{ margin: 0, fontSize: '12px', color: isExpired ? '#c0392b' : '#d4ac0d', fontWeight: 'bold' }}>{isExpired ? '🚫 This folder has Expired and will be deleted.' : `⏳ Expires on: ${new Date(activeFolder.expiryDate).toLocaleDateString()}`}</p>}
                            {hasLimit && !isExpired && <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: isLimitReached ? '#c0392b' : '#d4ac0d', fontWeight: 'bold' }}>📥 Downloads: {currentDownloads} of {activeFolder.downloadLimit} {isLimitReached ? '(Limit Reached)' : 'left'}</p>}
                        </div>
                    )}

                    <div className="filter-group-vip">
                        <button className={`filter-btn-vip ${mediaFilter === 'ALL' ? 'active' : ''}`} onClick={() => setMediaFilter('ALL')}>All Items</button>
                        <button className={`filter-btn-vip ${mediaFilter === 'PHOTOS' ? 'active' : ''}`} onClick={() => setMediaFilter('PHOTOS')}>Photos</button>
                        <button className={`filter-btn-vip ${mediaFilter === 'VIDEOS' ? 'active' : ''}`} onClick={() => setMediaFilter('VIDEOS')}>Videos</button>
                    </div>

                    <div className="ud-grid-vip mt-20">
                        {displayedMedia.length > 0 ? displayedMedia.map((filePath, idx) => (
                            <div key={idx} className="gallery-item-vip" style={{ display: 'flex', flexDirection: 'column', background: '#1a1a2e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333' }}>
                                
                                {/* 1. MEDIA CLICK AREA (Triggers Monetization Modal first) */}
                                <div style={{ position: 'relative', height: '180px', cursor: 'pointer', overflow: 'hidden', background: '#000' }} onClick={() => triggerMonetization(filePath)}>
                                    {isVideo(filePath) ? (
                                        <>
                                            <video src={getCleanUrl(filePath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '16px'}}>▶️</div>
                                        </>
                                    ) : (
                                        <img src={getCleanUrl(filePath)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}

                                    {/* Download Progress Overlay */}
                                    {downloadingFile === filePath && (
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.85)', padding: '10px', textAlign: 'center', zIndex: 10 }}>
                                            <div style={{color: '#3498db', fontWeight: 'bold', fontSize: '12px', marginBottom: '5px'}}>{downloadProgress}% - {downloadSpeed}</div>
                                            <div style={{ width: '100%', background: '#eee', height: '4px', borderRadius: '5px', overflow: 'hidden' }}>
                                                <div style={{ width: `${downloadProgress}%`, background: '#3498db', height: '100%', transition: '0.2s' }}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 2. UPLOADER & PRICE STRIP */}
                                <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
                                    
                                    <div 
                                        onClick={() => setUploaderProfile({
                                            name: activeFolder.uploadedBy || 'SandN Cinema',
                                            role: activeFolder.uploaderRole || 'Premium Studio Partner',
                                            email: activeFolder.uploaderEmail || 'contact@sandncinema.com'
                                        })}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                    >
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(45deg, #f1c40f, #e67e22)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                            {(activeFolder.uploadedBy || 'S')[0].toUpperCase()}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '9px', color: '#888', lineHeight: '1.2' }}>Uploaded by</span>
                                            <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', lineHeight: '1.2' }}>{activeFolder.uploadedBy || 'SandN Cinema'}</span>
                                        </div>
                                    </div>

                                    {/* Price Badge */}
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ display: 'block', fontSize: '9px', color: '#aaa' }}>To Unlock</span>
                                        <span style={{ fontSize: '11px', color: '#f1c40f', fontWeight: 'bold', background: 'rgba(241,196,15,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                            🪙 {getCostLabel(filePath)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )) : <div className="no-data-vip">Folder is empty. Media not uploaded yet.</div>}
                    </div>
                </div>
            );
        }

        return (
            <div className="folders-view">
                <div className="welcome-banner">
                    <h1>Your Digital Memories</h1>
                    <p>Select a folder to view your curated albums.</p>
                </div>
                
                {loading ? <div className="loading-state-vip">Fetching latest albums...</div> : (
                    <div className="folders-grid">
                        {folders.map((folder, index) => {
                            const isExpired = folder.expiryDate && new Date(folder.expiryDate) < new Date();
                            const isLimitReached = folder.downloadLimit > 0 && folder.downloadCount >= folder.downloadLimit;
                            const isLocked = isExpired || isLimitReached;

                            return (
                                <div key={index} className="folder-card" onClick={() => setActiveFolder(folder)} style={{ opacity: isLocked ? 0.7 : 1 }}>
                                    <div className="folder-icon">{isLocked ? '🔒' : '📁'}</div>
                                    <h4>{folder.folderName}</h4>
                                    <p>{folder.files?.length || 0} Items</p>
                                    {folder.isDefault && <span className="default-badge">Premium</span>}
                                    {isExpired && <span style={{display:'block', fontSize:'11px', color:'#e74c3c', marginTop:'5px'}}>Expired</span>}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="ud-container-vip">

            {/* ✅ NEW: PURCHASE CONFIRMATION MODAL (Coins vs Ads) */}
            {purchaseModal.show && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '90%', maxWidth: '350px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'popIn 0.3s ease' }}>
                        
                        <div style={{fontSize: '50px', marginBottom: '15px'}}>🔒</div>
                        <h2 style={{ color: '#333', margin: '0 0 10px 0' }}>Unlock {purchaseModal.type}</h2>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '25px' }}>This is a premium file. Choose how you want to access it below.</p>
                        
                        <div style={{ background: '#f4f6f9', padding: '15px', borderRadius: '15px', marginBottom: '20px', textAlign: 'left' }}>
                            <p style={{margin: '0 0 8px 0', color: '#555', fontSize: '13px', display: 'flex', justifyContent: 'space-between'}}>
                                <span>Item Type:</span> <strong style={{color: '#333'}}>{purchaseModal.type}</strong>
                            </p>
                            <p style={{margin: '0 0 8px 0', color: '#555', fontSize: '13px', display: 'flex', justifyContent: 'space-between'}}>
                                <span>Your Balance:</span> <strong style={{color: wallet.coins >= purchaseModal.cost ? '#2ecc71' : '#e74c3c'}}>🪙 {wallet.coins} Coins</strong>
                            </p>
                            <p style={{margin: 0, color: '#555', fontSize: '13px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '8px', marginTop: '8px'}}>
                                <span>Unlock Cost:</span> <strong style={{color: '#f1c40f', fontSize: '16px'}}>🪙 {purchaseModal.cost} Coins</strong>
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Option 1: Pay with Coins */}
                            <button 
                                onClick={processCoinPurchase}
                                disabled={loading || wallet.coins < purchaseModal.cost}
                                style={{ width: '100%', padding: '15px', fontSize: '15px', borderRadius: '12px', border: 'none', background: wallet.coins >= purchaseModal.cost ? '#3498db' : '#ccc', color: '#fff', cursor: wallet.coins >= purchaseModal.cost ? 'pointer' : 'not-allowed', fontWeight: 'bold', transition: '0.3s' }}
                            >
                                {loading ? 'Processing...' : `Pay ${purchaseModal.cost} Coins to Unlock`}
                            </button>

                            {/* Option 2: Watch Ad to Earn 1 Coin */}
                            <button 
                                onClick={startWatchAdFlow}
                                disabled={adLoading || loading}
                                style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '12px', border: '2px solid #2ecc71', background: 'transparent', color: '#2ecc71', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {adLoading ? '🍿 Loading Ad...' : '🎬 Watch Ad to Earn 1 Coin'}
                            </button>
                        </div>

                        <p onClick={() => setPurchaseModal({ show: false, file: null, cost: 0, type: '' })} style={{ marginTop: '25px', color: '#999', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}>
                            Cancel & Go Back
                        </p>
                    </div>
                </div>
            )}
            
            {/* ✅ MEDIA PREVIEW MODAL (With direct download option after unlock) */}
            {previewMedia && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                    <button onClick={() => setPreviewMedia(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>✖</button>

                    {isVideo(previewMedia) ? (
                        <video src={getCleanUrl(previewMedia)} controls autoPlay style={{ maxWidth: '95%', maxHeight: '75vh', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
                    ) : (
                        <img src={getCleanUrl(previewMedia)} style={{ maxWidth: '95%', maxHeight: '75vh', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', objectFit: 'contain' }} />
                    )}

                    <div style={{ marginTop: '25px', width: '90%', maxWidth: '300px' }}>
                        {downloadingFile === previewMedia ? (
                            <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '12px', textAlign: 'center' }}>
                                <div style={{color: '#fff', fontWeight: 'bold', fontSize: '12px', marginBottom: '5px'}}>{downloadProgress}% - {downloadSpeed}</div>
                                <div style={{ width: '100%', background: 'rgba(255,255,255,0.2)', height: '5px', borderRadius: '5px', overflow: 'hidden' }}>
                                    <div style={{ width: `${downloadProgress}%`, background: '#3498db', height: '100%', transition: '0.2s' }}></div>
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={() => handleDownload(previewMedia)} 
                                style={{ background: '#2ecc71', color: '#fff', padding: '12px 25px', borderRadius: '30px', fontSize: '15px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', width: '100%', boxShadow: '0 5px 15px rgba(46, 204, 113, 0.4)' }}
                            >
                                ⬇️ Download Original Quality
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ✅ UPLOADER (STUDIO/ADMIN) ID POPUP MODAL */}
            {uploaderProfile && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.75)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)' }} onClick={() => setUploaderProfile(null)}>
                    <div style={{ background: 'linear-gradient(145deg, #1a1a2e, #16213e)', padding: '30px', borderRadius: '25px', width: '300px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
                        
                        <div style={{ width: '85px', height: '85px', background: 'linear-gradient(45deg, #f1c40f, #e67e22)', borderRadius: '50%', margin: '0 auto 15px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '35px', color: '#000', fontWeight: 'bold', border: '4px solid #1a1a2e', boxShadow: '0 0 20px rgba(241, 196, 15, 0.3)' }}>
                            {uploaderProfile.name.charAt(0).toUpperCase()}
                        </div>
                        
                        <h2 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '22px' }}>{uploaderProfile.name}</h2>
                        <span style={{ background: 'rgba(52, 152, 219, 0.2)', color: '#3498db', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #3498db' }}>
                            ✓ {uploaderProfile.role}
                        </span>

                        <div style={{ marginTop: '25px', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '15px' }}>
                            <p style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '13px', display: 'flex', gap: '8px' }}><span>📧</span> <span style={{color: '#fff'}}>{uploaderProfile.email}</span></p>
                            <p style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '13px', display: 'flex', gap: '8px' }}><span>🔒</span> <span style={{color: '#2ecc71'}}>Verified Secure Upload</span></p>
                            <p style={{ margin: 0, color: '#aaa', fontSize: '13px', display: 'flex', gap: '8px' }}><span>📸</span> <span>Photography & Videography</span></p>
                        </div>

                        <button onClick={() => setUploaderProfile(null)} style={{ marginTop: '25px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer', width: '100%', fontWeight: 'bold', transition: '0.3s' }}>
                            Close Window
                        </button>
                    </div>
                </div>
            )}

            {/* 🎁 PROFESSIONAL COIN ANIMATION POPUP */}
            {rewardPopup.show && (
                <div className="reward-popup-overlay">
                    <div className={`reward-popup-box ${rewardPopup.type === 'EARNED' ? 'earned' : 'missed'}`}>
                        <div className="reward-icon">{rewardPopup.type === 'EARNED' ? '🪙' : '💔'}</div>
                        <h2 style={{color:'#fff', margin:'0 0 10px 0'}}>{rewardPopup.type === 'EARNED' ? 'Daily Reward!' : 'Streak Broken!'}</h2>
                        <p style={{color:'#aaa', margin:'0 0 20px 0', fontSize:'14px'}}>{rewardPopup.type === 'EARNED' ? `You earned +${rewardPopup.coins} Coin.` : 'You missed a day. Start again!'}</p>
                        <div style={{background:'#f1c40f', color:'#000', padding:'5px 15px', borderRadius:'20px', fontWeight:'bold', display:'inline-block'}}>
                            🔥 {rewardPopup.streak} Day Streak
                        </div>
                    </div>
                </div>
            )}

            <header className="ud-header-vip">
                <div className="brand-logo-vip">
                    <h2>SandN Cinema</h2><span className="vip-badge-tag">VIP</span>
                </div>
                <div className="ud-coin-badge-vip" title="Your Reward Coins">
                    <span className="coin-val-vip">{wallet.coins}</span><span className="coin-label-vip">COINS</span>
                </div>
            </header>

            <main className="user-main-content">
                {renderContent()}
            </main>

            <nav className="bottom-nav-bar" style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 5px' }}>
                <button className={`nav-item ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => { setCurrentTab('HOME'); setActiveFolder(null); setMediaFilter('ALL'); }}>
                    🏠<span>Home</span>
                </button>
                <button className={`nav-item ${currentTab === 'SERVICES' ? 'active' : ''}`} onClick={() => setCurrentTab('SERVICES')}>
                    📸<span>Services</span>
                </button>
                <button className={`nav-item ${currentTab === 'BOOKINGS' ? 'active' : ''}`} onClick={() => setCurrentTab('BOOKINGS')}>
                    📅<span>Bookings</span>
                </button>
                <button className={`nav-item ${currentTab === 'HISTORY' ? 'active' : ''}`} onClick={() => setCurrentTab('HISTORY')}>
                    📜<span>History</span>
                </button>
                <button className={`nav-item ${currentTab === 'PROFILE' ? 'active' : ''}`} onClick={() => setCurrentTab('PROFILE')}>
                    👤<span>{(editName || 'User').split(' ')[0]}</span>
                </button>
            </nav>
        </div>
    );
};

export default UserDashboard;