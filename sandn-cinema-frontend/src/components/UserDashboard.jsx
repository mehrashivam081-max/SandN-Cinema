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
    // ✅ Added unlockedFiles array to wallet state
    const [wallet, setWallet] = useState(user?.wallet || { coins: 0, currentStreak: 0, history: [], claimedEvents: [], unlockedFiles: [] });
    const [editName, setEditName] = useState(user?.name || '');
    
    // --- FOLDER & MEDIA STATES ---
    const [folders, setFolders] = useState([]);
    
    // ✅ Sub-folder Navigation Logic
    const [activeFolder, setActiveFolder] = useState(null); // Main Folder
    const [activeSubFolder, setActiveSubFolder] = useState(null); // Date-wise Sub Folder

    const [mediaFilter, setMediaFilter] = useState('ALL'); 

    // ✅ NEW: MULTI-SELECT STATES
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMediaFiles, setSelectedMediaFiles] = useState([]);

    // --- PREVIEW & UPLOADER PROFILE STATES ---
    const [previewMedia, setPreviewMedia] = useState(null); 
    const [uploaderProfile, setUploaderProfile] = useState(null);

    // ✅ ADVANCED MEDIA INTERFACE STATES (Share, Collab, Download)
    const [selectedMedia, setSelectedMedia] = useState(null); 
    const [showCollabModal, setShowCollabModal] = useState(false);

    // ✅ MONETIZATION STATES (Pay per View/Download)
    const [purchaseModal, setPurchaseModal] = useState({ show: false, file: null, files: [], cost: 0, type: '', isBatch: false });
    const [adLoading, setAdLoading] = useState(false);

    // ✅ WALLET MODAL & GLOBAL CHARGES STATES
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [walletTab, setWalletTab] = useState('BUY'); // 'BUY' or 'FREE'
    const [coinPackages, setCoinPackages] = useState([]);
    const [miniEvents, setMiniEvents] = useState([]);

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

    const DEFAULT_FOLDER = { folderName: 'Stranger Photography', files: [], subFolders: [], isDefault: true, uploadedBy: 'SandN Cinema', uploaderRole: 'VIP Studio', imageCost: 5, videoCost: 10, unlockValidity: 'Permanent' };

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

    // ✅ SMART BROWSER BACK BUTTON (Native App Experience)
    useEffect(() => {
        window.history.pushState(null, null, window.location.href);

        const handlePopState = () => {
            window.history.pushState(null, null, window.location.href);

            if (selectedMedia) {
                setSelectedMedia(null);
            } else if (purchaseModal.show) {
                setPurchaseModal({ show: false, file: null, files: [], cost: 0, type: '', isBatch: false });
            } else if (showWalletModal) {
                setShowWalletModal(false);
            } else if (showCollabModal) {
                setShowCollabModal(false);
            } else if (activeSubFolder) {
                setActiveSubFolder(null);
                setIsSelectionMode(false);
                setSelectedMediaFiles([]);
            } else if (activeFolder) {
                setActiveFolder(null);
                setMediaFilter('ALL');
                setIsSelectionMode(false);
                setSelectedMediaFiles([]);
            } else if (currentTab !== 'HOME') {
                setCurrentTab('HOME');
            } else {
                console.log("At root of dashboard. Logout prevented.");
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [activeFolder, activeSubFolder, currentTab, selectedMedia, purchaseModal, showWalletModal, showCollabModal]);


    // 🟢 FETCH LOGIC 
    useEffect(() => {
        const fetchRealTimeData = async () => {
            let activeUser = user || JSON.parse(sessionStorage.getItem('user'));
            if (!activeUser || !activeUser.mobile) {
                setFolders([DEFAULT_FOLDER]);
                setLoading(false);
                return; 
            }

            setLoading(true);
            try {
                // Fetch user data
                const res = await axios.post(`${API_BASE}/search-account`, { mobile: activeUser.mobile });
                
                if (res.data.success) {
                    const dbData = res.data.data;
                    setSyncUser(dbData);
                    setEditName(dbData.name || '');
                    setProfileData({ email: dbData.email || '', location: dbData.location || '' });
                    if(dbData.wallet) {
                        setWallet({ ...dbData.wallet, unlockedFiles: dbData.wallet.unlockedFiles || [] });
                    }
                    
                    let fetchedFolders = dbData.uploadedData || [];
                    if (!Array.isArray(fetchedFolders)) {
                        fetchedFolders = (typeof fetchedFolders === 'object' && fetchedFolders !== null) ? Object.values(fetchedFolders) : [];
                    }

                    fetchedFolders = fetchedFolders.map(folder => {
                        if (typeof folder === 'string') return null; 
                        return {
                            ...folder,
                            files: Array.isArray(folder.files) ? folder.files : (typeof folder.files === 'string' ? [folder.files] : []),
                            // Ensure subFolders array exists
                            subFolders: Array.isArray(folder.subFolders) ? folder.subFolders : [],
                            unlockValidity: folder.unlockValidity || '24 Hours' // Validity fetched from admin settings
                        };
                    }).filter(Boolean);

                    const customFolders = fetchedFolders.filter(f => f && f.folderName && f.folderName.trim().toLowerCase() !== 'stranger photography');
                    const backendDefaultFolder = fetchedFolders.find(f => f && f.folderName && f.folderName.trim().toLowerCase() === 'stranger photography');
                    
                    const finalDefaultFolder = backendDefaultFolder 
                        ? { ...DEFAULT_FOLDER, ...backendDefaultFolder, files: backendDefaultFolder.files || [], subFolders: backendDefaultFolder.subFolders || [] } 
                        : DEFAULT_FOLDER;
                    
                    setFolders([finalDefaultFolder, ...customFolders]);
                    sessionStorage.setItem('user', JSON.stringify({ ...activeUser, name: dbData.name })); // Sync session
                } else {
                    setFolders([DEFAULT_FOLDER]); 
                }

                // ✅ FETCH GLOBAL PACKAGES & EVENTS
                const platformRes = await axios.get(`${API_BASE}/get-platform-settings`);
                if (platformRes.data.success && platformRes.data.data) {
                    setCoinPackages(platformRes.data.data.coinPackages || []);
                    setMiniEvents(platformRes.data.data.miniEvents || []);
                }

            } catch (error) {
                console.error("Fetch error:", error);
                setFolders([DEFAULT_FOLDER]); 
            } finally {
                setLoading(false);
            }
        };

        fetchRealTimeData();
        
        const currentUserData = userData || user || JSON.parse(sessionStorage.getItem('user')) || {};
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

    // ✅ CHECK IF FILE IS UNLOCKED (VALIDITY CHECK)
    const isFileUnlocked = (filePath) => {
        if (!wallet.unlockedFiles) return false;
        const unlockedEntry = wallet.unlockedFiles.find(f => f.fileUrl === filePath);
        if (!unlockedEntry) return false;
        
        if (unlockedEntry.expiry === 'Permanent') return true;
        return new Date(unlockedEntry.expiry) > new Date(); // True if not expired
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
        sessionStorage.setItem('user', JSON.stringify(updatedLocalUser));
    };

    // ✅ NEW: BATCH SELECTION HELPERS
    const toggleSelection = (filePath) => {
        setSelectedMediaFiles(prev => prev.includes(filePath) ? prev.filter(f => f !== filePath) : [...prev, filePath]);
    };

    const getBatchCost = () => {
        let total = 0;
        selectedMediaFiles.forEach(file => {
            if (!isFileUnlocked(file)) {
                total += isVideo(file) ? (activeFolder?.videoCost || 10) : (activeFolder?.imageCost || 5);
            }
        });
        return total;
    };

    const triggerBatchMonetization = () => {
        const lockedFiles = selectedMediaFiles.filter(f => !isFileUnlocked(f));
        if (lockedFiles.length === 0) return alert("All selected files are already unlocked!");
        setPurchaseModal({ show: true, files: lockedFiles, file: null, cost: getBatchCost(), type: `${lockedFiles.length} Selected Items`, isBatch: true });
    };

    const triggerMonetization = (filePath) => {
        if (!activeFolder) return;
        const fileType = isVideo(filePath) ? 'Video' : 'Photo';
        const fileCost = fileType === 'Video' ? (activeFolder.videoCost || 10) : (activeFolder.imageCost || 5);

        setPurchaseModal({ show: true, file: filePath, files: [filePath], cost: fileCost, type: fileType, isBatch: false });
    };

    // ✅ OPEN NEW MEDIA INTERFACE (Share, Collab, Unlock)
    const openMediaInterface = (filePath) => {
        if (!activeFolder) return;
        const fileType = isVideo(filePath) ? 'Video' : 'Photo';
        const fileCost = fileType === 'Video' ? (activeFolder.videoCost || 10) : (activeFolder.imageCost || 5);
        
        setSelectedMedia({
            url: filePath,
            type: fileType,
            cost: fileCost,
            isUnlocked: isFileUnlocked(filePath)
        });
    };

    const getCostLabel = (filePath) => {
        if(!activeFolder) return '';
        const isVid = isVideo(filePath);
        return isVid ? `${activeFolder.videoCost || 10} Coins` : `${activeFolder.imageCost || 5} Coins`;
    };

    // ✅ Process Purchase with Coins and Update Unlock Status (Supports BATCH & SINGLE)
    const processCoinPurchase = async () => {
        const targetCost = purchaseModal.cost || selectedMedia?.cost;
        const targetFiles = purchaseModal.isBatch ? purchaseModal.files : (purchaseModal.file ? [purchaseModal.file] : [selectedMedia?.url]);
        const targetType = purchaseModal.type || selectedMedia?.type;

        if (wallet.coins < targetCost) {
            alert("Not enough coins! Watch Ads to earn or buy more.");
            setShowWalletModal(true); 
            return;
        }

        setLoading(true);
        try {
            // Determine Expiry based on Admin Folder Setting
            let expiryDate = 'Permanent';
            if (activeFolder?.unlockValidity === '24 Hours') {
                expiryDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString();
            } else if (activeFolder?.unlockValidity === '7 Days') {
                expiryDate = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            }

            // Use the Batch Deduction API for single and multiple files
            const res = await axios.post(`${API_BASE}/deduct-coins-batch`, {
                mobile: syncUser.mobile,
                amount: targetCost,
                filesToUnlock: targetFiles,
                expiryDate: expiryDate,
                reason: `Unlocking ${targetType}`
            });

            if (res.data.success) {
                const newUnlockedFiles = targetFiles.map(fileUrl => ({ fileUrl, unlockTime: new Date().toISOString(), expiry: expiryDate }));
                const updatedWallet = { ...res.data.wallet, unlockedFiles: [...(res.data.wallet.unlockedFiles || []), ...newUnlockedFiles] };
                
                setWallet(updatedWallet); 
                
                if (purchaseModal.isBatch) {
                    setIsSelectionMode(false);
                    setSelectedMediaFiles([]);
                } else if (selectedMedia) {
                    setSelectedMedia(prev => ({ ...prev, isUnlocked: true }));
                }

                setPurchaseModal({ show: false, file: null, files: [], cost: 0, type: '', isBatch: false });
                alert(`${targetType} Unlocked Successfully! 🎉`);
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

    // ✅ NATIVE SHARE API LOGIC
    const handleNativeShare = async () => {
        if (!selectedMedia) return;
        const shareData = {
            title: 'SandN Cinema - Digital Memories',
            text: 'Check out this amazing moment captured beautifully by @sandncinema! ✨📸 #SandNCinema #Photography #Cinematography',
            url: getCleanUrl(selectedMedia.url)
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
                alert("Thanks for sharing and supporting us! ❤️");
            } else {
                navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                alert("Link and Description copied to clipboard! You can paste it on any social media like WhatsApp, Instagram, or Facebook.");
            }
        } catch (err) { console.log('Share dismissed or failed', err); }
    };

    // ✅ Watch Ad to earn coins
    const startWatchAdFlow = () => {
        setAdLoading(true);
        alert("Starting Ad Video... (Please watch completely to earn 1 Coin)");
        
        setTimeout(async () => {
            try {
                const res = await axios.post(`${API_BASE}/add-coins`, {
                    mobile: syncUser.mobile,
                    amount: 1,
                    reason: "Watched Ad Video"
                });

                if (res.data.success) {
                    setWallet(res.data.wallet); 
                    alert("Reward Received! +1 Coin added to your wallet. 🪙");
                }
            } catch (e) {
                console.error("Ad reward error", e);
            } finally {
                setAdLoading(false);
            }
        }, 5000); 
    };

    // ✅ REAL MONEY PACKAGE PURCHASE
    const handleBuyPackage = async (pkg) => {
        if (!window.confirm(`Proceed to pay ₹${pkg.price} for ${pkg.coins} Coins?`)) return;
        
        setLoading(true);
        setTimeout(async () => {
            try {
                const res = await axios.post(`${API_BASE}/purchase-coins`, {
                    mobile: syncUser.mobile, coinsToAdd: pkg.coins, pricePaid: pkg.price
                });
                if (res.data.success) {
                    setWallet(res.data.wallet);
                    alert(`✅ Payment Successful!\n${res.data.message}`);
                }
            } catch (e) { alert("Payment Failed. Try again."); }
            setLoading(false);
        }, 2000);
    };

    // ✅ CLAIM MINI EVENT
    const handleClaimEvent = async (ev) => {
        if (!window.confirm(`Did you complete this task?\n"${ev.title}"`)) return;
        
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/claim-event`, {
                mobile: syncUser.mobile, eventId: ev.id || ev.title, rewardCoins: ev.reward, eventTitle: ev.title
            });
            if (res.data.success) {
                setWallet(res.data.wallet);
                alert(`✅ Task Verified!\n${res.data.message}`);
            } else {
                alert(res.data.message); 
            }
        } catch (e) { alert("Error claiming reward."); }
        setLoading(false);
    };

    // 🚀 LIVE DOWNLOAD
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
                axios.post(`${API_BASE}/update-download-count`, { mobile: syncUser.mobile, folderName: activeFolder.folderName }).catch(err => console.log("Failed to sync count", err));
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
            { date: new Date().toLocaleDateString(), action: "Account Registered", amount: "0", type: "neutral" }
        ];

        return (
            <div className="history-tab-vip" style={{padding: '20px', paddingBottom: '80px'}}>
                <div className="section-header" style={{marginBottom: '20px'}}>
                    <h2 style={{color: '#fff', fontSize: '20px', margin: 0}}>📜 Transaction History</h2>
                    <p style={{color: '#aaa', fontSize: '12px', margin: '5px 0 0 0'}}>Your platform activity and coin logs.</p>
                </div>
                
                <div className="history-list">
                    {historyData.map((item, idx) => (
                        <div key={idx} style={{ background: '#1a1a2e', padding: '15px', borderRadius: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: item.type === 'credit' ? '4px solid #f1c40f' : item.type === 'debit' ? '4px solid #e74c3c' : '4px solid #3498db' }}>
                            <div>
                                <h4 style={{margin: '0 0 5px 0', color: '#fff', fontSize: '15px'}}>{item.action}</h4>
                                <span style={{color: '#888', fontSize: '11px'}}>{item.date}</span>
                            </div>
                            <div style={{fontWeight: 'bold', color: item.type === 'credit' ? '#f1c40f' : item.type === 'debit' ? '#e74c3c' : '#fff', fontSize: '16px'}}>{item.amount}</div>
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
                            <button className="dp-btn remove" onClick={handleRemoveDP}>Remove</button>
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
        // ✅ SCENARIO 1: Viewing Media inside a Folder (or Sub-folder)
        if (activeFolder && (!activeFolder.subFolders || activeFolder.subFolders.length === 0 || activeSubFolder)) {
            
            let filesToDisplay = [];
            let currentFolderName = '';

            if (activeSubFolder) {
                filesToDisplay = activeSubFolder.files || [];
                currentFolderName = `${activeFolder.folderName} ➔ ${activeSubFolder.name}`;
            } else {
                filesToDisplay = activeFolder.files || [];
                currentFolderName = activeFolder.folderName;
            }

            const displayedMedia = filesToDisplay.filter(item => {
                if (mediaFilter === 'PHOTOS') return !isVideo(item);
                if (mediaFilter === 'VIDEOS') return isVideo(item);
                return true;
            });

            const hasExpiry = activeFolder.expiryDate;
            const isExpired = hasExpiry && new Date(activeFolder.expiryDate) < new Date();
            const hasLimit = activeFolder.downloadLimit > 0;
            const currentDownloads = activeFolder.downloadCount || 0;
            const isLimitReached = hasLimit && currentDownloads >= activeFolder.downloadLimit;

            return (
                <div className="folder-gallery-view">
                    <div className="folder-header-nav">
                        <button onClick={() => { 
                            if(activeSubFolder) { setActiveSubFolder(null); setIsSelectionMode(false); setSelectedMediaFiles([]); }
                            else { setActiveFolder(null); setMediaFilter('ALL'); setIsSelectionMode(false); setSelectedMediaFiles([]); } 
                        }} className="back-btn">⬅ Back</button>
                        <h3 style={{fontSize: '16px'}}>{currentFolderName}</h3>
                    </div>

                    {(hasExpiry || hasLimit) && (
                        <div style={{ background: isExpired || isLimitReached ? '#fdedec' : '#fffdf5', border: `1px solid ${isExpired || isLimitReached ? '#e74c3c' : '#f1c40f'}`, padding: '10px', borderRadius: '8px', marginBottom: '15px', marginTop: '10px' }}>
                            {hasExpiry && <p style={{ margin: 0, fontSize: '12px', color: isExpired ? '#c0392b' : '#d4ac0d', fontWeight: 'bold' }}>{isExpired ? '🚫 Expired & Locked.' : `⏳ Expires on: ${new Date(activeFolder.expiryDate).toLocaleDateString()}`}</p>}
                            {hasLimit && !isExpired && <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: isLimitReached ? '#c0392b' : '#d4ac0d', fontWeight: 'bold' }}>📥 Downloads: {currentDownloads} of {activeFolder.downloadLimit} {isLimitReached && '(Limit Reached)'}</p>}
                        </div>
                    )}

                    {/* ✅ MULTI-SELECT & FILTER BAR */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <div className="filter-group-vip" style={{margin: 0}}>
                            <button className={`filter-btn-vip ${mediaFilter === 'ALL' ? 'active' : ''}`} onClick={() => setMediaFilter('ALL')}>All</button>
                            <button className={`filter-btn-vip ${mediaFilter === 'PHOTOS' ? 'active' : ''}`} onClick={() => setMediaFilter('PHOTOS')}>Photos</button>
                            <button className={`filter-btn-vip ${mediaFilter === 'VIDEOS' ? 'active' : ''}`} onClick={() => setMediaFilter('VIDEOS')}>Videos</button>
                        </div>
                        <button onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedMediaFiles([]); }} style={{ background: isSelectionMode ? '#e74c3c' : 'transparent', color: isSelectionMode ? '#fff' : '#3498db', border: `1px solid ${isSelectionMode ? '#e74c3c' : '#3498db'}`, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                            {isSelectionMode ? 'Cancel Select' : '☑️ Multi-Select'}
                        </button>
                    </div>

                    {/* ✅ FLOATING BATCH UNLOCK BAR */}
                    {isSelectionMode && selectedMediaFiles.length > 0 && (
                        <div style={{ background: '#f1c40f', padding: '12px 15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', position: 'sticky', top: '10px', zIndex: 50, boxShadow: '0 10px 20px rgba(0,0,0,0.3)' }}>
                            <span style={{ color: '#000', fontWeight: 'bold', fontSize: '13px' }}>{selectedMediaFiles.length} Selected</span>
                            <button onClick={triggerBatchMonetization} style={{ background: '#1a1a2e', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                🔓 Unlock ({getBatchCost()} Coins)
                            </button>
                        </div>
                    )}

                    <div className="ud-grid-vip mt-20">
                        {displayedMedia.length > 0 ? displayedMedia.map((filePath, idx) => {
                            const isUnlocked = isFileUnlocked(filePath);
                            const isSelected = selectedMediaFiles.includes(filePath);
                            
                            return (
                                <div key={idx} className="gallery-item-vip" style={{ display: 'flex', flexDirection: 'column', background: '#1a1a2e', borderRadius: '12px', overflow: 'hidden', border: isSelected ? '3px solid #3498db' : (isUnlocked ? '1px solid #2ecc71' : '1px solid #333') }}>
                                    
                                    {/* 1. MEDIA CLICK AREA */}
                                    <div style={{ position: 'relative', height: '180px', cursor: 'pointer', overflow: 'hidden', background: '#000' }} onClick={() => isSelectionMode ? toggleSelection(filePath) : openMediaInterface(filePath)}>
                                        
                                        {/* CHECKBOX FOR SELECTION */}
                                        {isSelectionMode && (
                                            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 20, background: '#fff', borderRadius: '50%', padding: '2px', display: 'flex', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
                                                <input type="checkbox" checked={isSelected} readOnly style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#3498db' }} />
                                            </div>
                                        )}

                                        {isVideo(filePath) ? (
                                            <>
                                                <video src={getCleanUrl(filePath)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '16px'}}>▶️</div>
                                            </>
                                        ) : (
                                            <img src={getCleanUrl(filePath)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isUnlocked ? 'none' : 'blur(2px)' }} />
                                        )}

                                        {!isUnlocked && !isSelectionMode && (
                                            <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: '#f1c40f', padding: '5px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>
                                                🔒 Locked
                                            </div>
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
                                                role: activeFolder.uploaderRole || 'Premium Studio',
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

                                        {/* Badge Area */}
                                        <div style={{ textAlign: 'right' }}>
                                            {isUnlocked ? (
                                                <span style={{ fontSize: '11px', color: '#2ecc71', fontWeight: 'bold', background: 'rgba(46,204,113,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    ✅ Unlocked
                                                </span>
                                            ) : (
                                                <>
                                                    <span style={{ display: 'block', fontSize: '9px', color: '#aaa' }}>To Unlock</span>
                                                    <span style={{ fontSize: '11px', color: '#f1c40f', fontWeight: 'bold', background: 'rgba(241,196,15,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        🪙 {getCostLabel(filePath)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        }) : <div className="no-data-vip">Folder is empty. Media not uploaded yet.</div>}
                    </div>
                </div>
            );
        }

        // ✅ SCENARIO 2: Viewing Sub-Folders inside a Main Folder
        if (activeFolder && activeFolder.subFolders && activeFolder.subFolders.length > 0 && !activeSubFolder) {
            return (
                <div className="folders-view">
                    <div className="folder-header-nav">
                        <button onClick={() => { setActiveFolder(null); setMediaFilter('ALL'); }} className="back-btn">⬅ Back to Main Folders</button>
                        <h3>{activeFolder.folderName}</h3>
                    </div>
                    
                    {/* Display Root Files if any exist along with sub-folders */}
                    {activeFolder.files && activeFolder.files.length > 0 && (
                        <div className="folder-card" onClick={() => setActiveSubFolder({ name: "Root Media Files", files: activeFolder.files })} style={{ background: '#2c3e50', border: '1px solid #3498db', marginBottom: '20px' }}>
                            <div className="folder-icon">📁</div><h4>General Uploads</h4><p>{activeFolder.files.length} Items</p>
                        </div>
                    )}

                    <div className="folders-grid">
                        {activeFolder.subFolders.map((sub, index) => (
                            <div key={index} className="folder-card" onClick={() => setActiveSubFolder(sub)}>
                                <div className="folder-icon">🗓️</div>
                                <h4>{sub.name}</h4>
                                <p>{sub.files?.length || 0} Items</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // ✅ SCENARIO 3: Viewing Main Folders List (Default View)
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

                            // Calculate total files (Root files + all Subfolder files)
                            let totalFiles = folder.files ? folder.files.length : 0;
                            if (folder.subFolders) {
                                folder.subFolders.forEach(sf => totalFiles += (sf.files ? sf.files.length : 0));
                            }

                            return (
                                <div key={index} className="folder-card" onClick={() => setActiveFolder(folder)} style={{ opacity: isLocked ? 0.7 : 1 }}>
                                    <div className="folder-icon">{isLocked ? '🔒' : '📁'}</div>
                                    <h4>{folder.folderName}</h4>
                                    <p>{totalFiles} Total Items</p>
                                    {folder.subFolders && folder.subFolders.length > 0 && <p style={{fontSize: '10px', color: '#3498db', marginTop: '2px'}}>🗓️ Contains Date Folders</p>}
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

            {/* ✅ WALLET & COIN TOP-UP MODAL */}
            {showWalletModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: '#1a1a2e', width: '90%', maxWidth: '400px', borderRadius: '25px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', border: '1px solid #333' }}>
                        
                        {/* Header */}
                        <div style={{ background: 'linear-gradient(90deg, #f1c40f, #e67e22)', padding: '20px', textAlign: 'center', position: 'relative' }}>
                            <button onClick={() => setShowWalletModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.2)', border: 'none', color: '#fff', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                            <h2 style={{ color: '#000', margin: '0 0 5px 0', fontSize: '24px' }}>My Wallet</h2>
                            <div style={{ display: 'inline-block', background: '#000', color: '#f1c40f', padding: '8px 20px', borderRadius: '30px', fontSize: '20px', fontWeight: 'bold', border: '2px solid #fff' }}>
                                🪙 {wallet.coins} Coins
                            </div>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
                            <button onClick={() => setWalletTab('BUY')} style={{ flex: 1, padding: '15px', background: walletTab === 'BUY' ? '#2c3e50' : 'transparent', color: walletTab === 'BUY' ? '#f1c40f' : '#888', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>💰 Buy Coins</button>
                            <button onClick={() => setWalletTab('FREE')} style={{ flex: 1, padding: '15px', background: walletTab === 'FREE' ? '#2c3e50' : 'transparent', color: walletTab === 'FREE' ? '#2ecc71' : '#888', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>🎁 Free Coins</button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                            
                            {/* BUY COINS TAB */}
                            {walletTab === 'BUY' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <p style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', margin: '0 0 10px 0' }}>Select a package to instantly recharge your wallet.</p>
                                    
                                    {coinPackages.length > 0 ? coinPackages.map((pkg, idx) => (
                                        <div key={idx} style={{ background: '#0f172a', border: '1px solid #444', borderRadius: '15px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                                            {pkg.tag && <div style={{ position: 'absolute', top: 0, left: 0, background: '#e74c3c', color: '#fff', fontSize: '10px', padding: '2px 10px', fontWeight: 'bold', borderBottomRightRadius: '10px' }}>{pkg.tag}</div>}
                                            
                                            <div style={{ marginTop: pkg.tag ? '10px' : '0' }}>
                                                <div style={{ color: '#f1c40f', fontSize: '22px', fontWeight: 'bold' }}>🪙 {pkg.coins}</div>
                                                <div style={{ color: '#888', fontSize: '12px' }}>Digital Coins</div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleBuyPackage(pkg)} disabled={loading}
                                                style={{ background: '#3498db', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '15px', boxShadow: '0 4px 10px rgba(52, 152, 219, 0.4)' }}
                                            >
                                                {loading ? '...' : `Pay ₹${pkg.price}`}
                                            </button>
                                        </div>
                                    )) : <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No packages available right now.</div>}
                                </div>
                            )}

                            {/* FREE COINS TAB */}
                            {walletTab === 'FREE' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <p style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', margin: '0 0 10px 0' }}>Complete tasks to earn free coins without paying!</p>
                                    
                                    {/* Default AD Watch Card */}
                                    <div style={{ background: '#0f172a', border: '1px solid #2ecc71', borderRadius: '15px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>🎬 Watch Short Ad</div>
                                            <div style={{ color: '#2ecc71', fontSize: '12px', fontWeight: 'bold' }}>Reward: +1 Coin</div>
                                        </div>
                                        <button onClick={startWatchAdFlow} disabled={adLoading || loading} style={{ background: 'transparent', border: '2px solid #2ecc71', color: '#2ecc71', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            {adLoading ? '🍿 Loading...' : 'Watch Now'}
                                        </button>
                                    </div>

                                    {/* Admin Mini Events */}
                                    {miniEvents.map((ev, idx) => {
                                        const isClaimed = wallet.claimedEvents?.includes(ev.id || ev.title);
                                        return (
                                            <div key={idx} style={{ background: '#0f172a', border: '1px solid #444', opacity: isClaimed ? 0.6 : 1, borderRadius: '15px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{ev.title}</div>
                                                    <div style={{ color: '#f1c40f', fontSize: '12px', fontWeight: 'bold' }}>Reward: +{ev.reward} Coins</div>
                                                </div>
                                                
                                                {isClaimed ? (
                                                    <span style={{ color: '#aaa', fontWeight: 'bold', fontSize: '12px', padding: '8px 10px', background: '#333', borderRadius: '8px' }}>✅ Claimed</span>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        {ev.link && <a href={ev.link} target="_blank" rel="noreferrer" style={{ background: '#3498db', color: '#fff', textAlign: 'center', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', textDecoration: 'none', fontWeight: 'bold' }}>1. Open Link</a>}
                                                        <button onClick={() => handleClaimEvent(ev)} disabled={loading} style={{ background: '#f1c40f', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>2. Claim Coin</button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* ✅ DETAILED PURCHASE CONFIRMATION MODAL (Z-INDEX FIXED TO 9999999) */}
            {purchaseModal.show && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '90%', maxWidth: '350px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', animation: 'popIn 0.3s ease' }}>
                        
                        <div style={{fontSize: '50px', marginBottom: '15px'}}>🔒</div>
                        <h2 style={{ color: '#333', margin: '0 0 10px 0' }}>Unlock {purchaseModal.type}</h2>
                        <p style={{ color: '#666', fontSize: '14px', marginBottom: '25px' }}>
                            {purchaseModal.isBatch ? "Unlock all selected items at once." : "This is a premium file. Access it using your wallet coins."}
                        </p>
                        
                        <div style={{ background: '#f4f6f9', padding: '15px', borderRadius: '15px', marginBottom: '20px', textAlign: 'left' }}>
                            <p style={{margin: '0 0 8px 0', color: '#555', fontSize: '13px', display: 'flex', justifyContent: 'space-between'}}>
                                <span>Your Balance:</span> <strong style={{color: wallet.coins >= purchaseModal.cost ? '#2ecc71' : '#e74c3c'}}>🪙 {wallet.coins} Coins</strong>
                            </p>
                            <p style={{margin: 0, color: '#555', fontSize: '13px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: '8px', marginTop: '8px'}}>
                                <span>Total Cost:</span> <strong style={{color: '#f1c40f', fontSize: '16px'}}>🪙 {purchaseModal.cost} Coins</strong>
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button 
                                onClick={processCoinPurchase}
                                disabled={loading || wallet.coins < purchaseModal.cost}
                                style={{ width: '100%', padding: '15px', fontSize: '15px', borderRadius: '12px', border: 'none', background: wallet.coins >= purchaseModal.cost ? '#3498db' : '#ccc', color: '#fff', cursor: wallet.coins >= purchaseModal.cost ? 'pointer' : 'not-allowed', fontWeight: 'bold', transition: '0.3s' }}
                            >
                                {loading ? 'Processing...' : `Pay ${purchaseModal.cost} Coins to Unlock`}
                            </button>

                            <button 
                                onClick={() => { setPurchaseModal({ show: false, files: [], cost: 0, type: '', isBatch: false }); setShowWalletModal(true); }}
                                disabled={adLoading || loading}
                                style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '12px', border: '2px solid #2ecc71', background: 'transparent', color: '#2ecc71', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                🎬 Watch Ad to Earn Coins
                            </button>
                        </div>

                        <p onClick={() => setPurchaseModal({ show: false, file: null, files: [], cost: 0, type: '', isBatch: false })} style={{ marginTop: '25px', color: '#999', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline' }}>
                            Cancel & Go Back
                        </p>
                    </div>
                </div>
            )}
            
            {/* ✅ ADVANCED MEDIA INTERFACE (Download, Share, Collab) */}
            {selectedMedia && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
                    
                    {/* Header */}
                    <div style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
                        <span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedMedia.type} Preview</span>
                        <button onClick={() => setSelectedMedia(null)} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '35px', height: '35px', fontSize: '16px', cursor: 'pointer' }}>✖</button>
                    </div>

                    {/* Media Display */}
                    <div style={{ flex: 1, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px', position: 'relative' }}>
                        {selectedMedia.type === 'Video' ? (
                            <video src={getCleanUrl(selectedMedia.url)} controls autoPlay style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
                        ) : (
                            <img src={getCleanUrl(selectedMedia.url)} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', objectFit: 'contain', filter: selectedMedia.isUnlocked ? 'none' : 'blur(5px)' }} />
                        )}
                        
                        {!selectedMedia.isUnlocked && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '15px', textAlign: 'center', color: '#fff', width: '220px' }}>
                                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔒</div>
                                <h3 style={{ margin: '0 0 5px 0' }}>Premium Media</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#ccc' }}>Unlock to view, download, and share.</p>
                            </div>
                        )}
                    </div>

                    {/* Action Bar (Download, Share, Collab) */}
                    <div style={{ width: '100%', background: '#1a1a2e', padding: '20px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px' }}>
                        
                        {downloadingFile === selectedMedia.url ? (
                            <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '12px', textAlign: 'center' }}>
                                <div style={{color: '#3498db', fontWeight: 'bold', fontSize: '12px', marginBottom: '5px'}}>{downloadProgress}% - {downloadSpeed}</div>
                                <div style={{ width: '100%', background: 'rgba(255,255,255,0.2)', height: '5px', borderRadius: '5px', overflow: 'hidden' }}>
                                    <div style={{ width: `${downloadProgress}%`, background: '#3498db', height: '100%', transition: '0.2s' }}></div>
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={() => {
                                    if (selectedMedia.isUnlocked) handleDownload(selectedMedia.url);
                                    else {
                                        setPurchaseModal({ show: true, file: selectedMedia.url, files: [selectedMedia.url], cost: selectedMedia.cost, type: selectedMedia.type, isBatch: false });
                                    }
                                }} 
                                disabled={loading}
                                style={{ background: selectedMedia.isUnlocked ? '#2ecc71' : '#3498db', color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', width: '100%', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}
                            >
                                {loading ? 'Processing...' : (selectedMedia.isUnlocked ? '⬇️ Download Original Quality' : `🔓 Unlock for ${selectedMedia.cost} Coins`)}
                            </button>
                        )}

                        {/* Social Buttons - ONLY VISIBLE IF UNLOCKED */}
                        {selectedMedia.isUnlocked && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={handleNativeShare} style={{ flex: 1, background: '#f39c12', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    📤 Share Post
                                </button>
                                <button onClick={() => setShowCollabModal(true)} style={{ flex: 1, background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    🤝 Instagram Collab
                                </button>
                            </div>
                        )}
                        <p style={{ textAlign: 'center', color: '#777', fontSize: '11px', margin: 0 }}>
                            {selectedMedia.isUnlocked ? "You have full access to this media." : `Once unlocked, access validity: ${activeFolder?.unlockValidity || '24 Hours'}`}
                        </p>
                    </div>
                </div>
            )}

            {/* ✅ COLLAB INSTRUCTION MODAL */}
            {showCollabModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        <h2 style={{ color: '#e1306c', margin: '0 0 10px 0' }}>Instagram Collaboration</h2>
                        <p style={{ color: '#555', fontSize: '14px', marginBottom: '20px' }}>Follow these simple steps to collab with our official page and reach more audience!</p>
                        
                        <div style={{ textAlign: 'left', background: '#f5f6fa', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
                            <ol style={{ paddingLeft: '20px', margin: 0, color: '#333', fontSize: '13px', lineHeight: '1.6' }}>
                                <li><strong>Download</strong> the photo/video first.</li>
                                <li>Open <strong>Instagram App</strong> and create a New Post.</li>
                                <li>Tap on <strong>Tag People</strong> ➔ <strong>Invite Collaborator</strong>.</li>
                                <li>Search and select <strong>@sandncinema</strong>.</li>
                                <li>Paste the caption below and Post!</li>
                            </ol>
                        </div>

                        <div style={{ background: '#e8f8f5', border: '1px dashed #2ecc71', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                            <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontStyle: 'italic', color: '#27ae60' }}>
                                "Beautiful moments captured flawlessly! ✨ Thanks to @sandncinema for the amazing work. 📸❤️ #SandNCinema #Photography #Cinematography"
                            </p>
                            <button onClick={() => {
                                navigator.clipboard.writeText("Beautiful moments captured flawlessly! ✨ Thanks to @sandncinema for the amazing work. 📸❤️ #SandNCinema #Photography #Cinematography");
                                alert("Caption Copied to Clipboard!");
                            }} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '6px 15px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Copy Caption</button>
                        </div>

                        <button onClick={() => setShowCollabModal(false)} style={{ background: '#ccc', color: '#333', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>Close</button>
                    </div>
                </div>
            )}

            {/* 🎁 DAILY REWARD POPUP */}
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
                <div className="ud-coin-badge-vip" title="Click to add coins" onClick={() => setShowWalletModal(true)} style={{ cursor: 'pointer' }}>
                    <span className="coin-val-vip">{wallet.coins}</span><span className="coin-label-vip">COINS ➕</span>
                </div>
            </header>

            <main className="user-main-content">
                {renderContent()}
            </main>

            <nav className="bottom-nav-bar" style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 5px' }}>
                <button className={`nav-item ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => { setCurrentTab('HOME'); setActiveFolder(null); setActiveSubFolder(null); setMediaFilter('ALL'); setIsSelectionMode(false); setSelectedMediaFiles([]); }}>
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