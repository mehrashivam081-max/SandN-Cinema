import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserDashboard.css';
import { calculateDailyReward } from '../utils/coinLogic';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';
const SERVER_URL = 'https://sandn-cinema.onrender.com/';

const UserDashboard = ({ user, userData, onLogout }) => {
    // --- UI STATES ---
    const [currentTab, setCurrentTab] = useState('HOME'); // HOME, SERVICES, BOOKINGS, HISTORY, PROFILE
    const [loading, setLoading] = useState(true);
    
    // --- USER SYNCED DATA (REAL-TIME) ---
    const [syncUser, setSyncUser] = useState(user || {});
    const [wallet, setWallet] = useState(user?.wallet || { coins: 0, currentStreak: 0, history: [] });
    const [editName, setEditName] = useState(user?.name || '');
    
    // --- FOLDER & MEDIA STATES ---
    const [folders, setFolders] = useState([]);
    const [activeFolder, setActiveFolder] = useState(null); // null means showing folder list
    const [mediaFilter, setMediaFilter] = useState('ALL'); 

    // --- PROFILE STATES ---
    const [profileImage, setProfileImage] = useState(user?.profileImage || null);
    const [editProfileMode, setEditProfileMode] = useState(false);
    const [profileData, setProfileData] = useState({
        email: user?.email || '',
        location: user?.location || ''
    });

    // --- REWARD ANIMATION STATE ---
    const [rewardPopup, setRewardPopup] = useState({ show: false, type: '', coins: 0, streak: 0 });

    // Default Folder fallback
    const DEFAULT_FOLDER = { folderName: 'Stranger Photography', files: [], isDefault: true };

    // 🟢 FETCH LOGIC (SINGLE SOURCE OF TRUTH)
    useEffect(() => {
        const fetchRealTimeData = async () => {
            // ✅ Crash Fix: Agar user mobile nahi hai toh API hit mat karo
            if (!user?.mobile) return; 

            setLoading(true);
            try {
                const res = await axios.post(`${API_BASE}/search-account`, { 
                    mobile: user.mobile,
                    roleFilter: 'USER' 
                });
                
                if (res.data.success) {
                    const dbData = res.data.data;
                    setSyncUser(dbData);
                    setEditName(dbData.name || '');
                    setProfileData({ email: dbData.email || '', location: dbData.location || '' });
                    if(dbData.wallet) setWallet(dbData.wallet);
                    
                    const fetchedFolders = dbData.uploadedData || [];
                    const filteredFolders = fetchedFolders.filter(f => f.folderName !== 'Stranger Photography');
                    
                    // Ensure Stranger Photography is always first
                    const backendDefault = fetchedFolders.find(f => f.folderName === 'Stranger Photography');
                    const mergedDefault = backendDefault ? { ...DEFAULT_FOLDER, files: backendDefault.files } : DEFAULT_FOLDER;
                    
                    setFolders([mergedDefault, ...filteredFolders]);

                    // Update LocalStorage silently
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
        
        // 🎁 DAILY REWARD LOGIC WITH PROFESSIONAL UI
        const currentUserData = userData || user || {};
        const rewardResult = calculateDailyReward({ ...currentUserData, wallet });
        
        if (rewardResult.rewardAdded) {
            setRewardPopup({ show: true, type: 'EARNED', coins: 1, streak: rewardResult.currentStreak });
            setWallet(rewardResult);
            setTimeout(() => setRewardPopup({ show: false }), 4000); // Hide after 4s
        } else if (rewardResult.streakReset && rewardResult.currentStreak === 1) {
            setRewardPopup({ show: true, type: 'MISSED', coins: 0, streak: 1 });
            setWallet(rewardResult);
            setTimeout(() => setRewardPopup({ show: false }), 4000);
        }
    }, [user?.mobile]); // ✅ Safe dependency

    // --- HELPERS ---
    const isVideo = (filePath) => {
        if (!filePath) return false;
        return filePath.match(/\.(mp4|webm|ogg|mov)$/i);
    };
    const getCleanUrl = (filePath) => `${SERVER_URL}${filePath.replace(/\\/g, '/')}`;

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

    // --- RENDER TABS ---
    const renderContent = () => {
        if (currentTab === 'SERVICES') return <div className="tab-placeholder"><h2>Our Services</h2><p>Booking modules coming soon...</p></div>;
        if (currentTab === 'BOOKINGS') return <div className="tab-placeholder"><h2>Booking History</h2><p>No past bookings found.</p></div>;
        if (currentTab === 'HISTORY') return renderHistoryTab();
        if (currentTab === 'PROFILE') return renderProfileTab();
        return renderHomeTab();
    };

    // 🔴 HISTORY TAB (NEW)
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
                        <div key={idx} style={{
                            background: '#1a1a2e', padding: '15px', borderRadius: '10px', marginBottom: '10px', 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                            borderLeft: item.type === 'credit' ? '4px solid #f1c40f' : '4px solid #3498db'
                        }}>
                            <div>
                                <h4 style={{margin: '0 0 5px 0', color: '#fff', fontSize: '15px'}}>{item.action}</h4>
                                <span style={{color: '#888', fontSize: '11px'}}>{item.date}</span>
                            </div>
                            <div style={{fontWeight: 'bold', color: item.type === 'credit' ? '#f1c40f' : '#fff', fontSize: '16px'}}>
                                {item.amount}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // 🔴 PROFILE TAB
    const renderProfileTab = () => (
        <div className="profile-tab-vip">
            <h2>Your Profile</h2>
            <div className="profile-card-vip">
                <div className="dp-section">
                    <div className="dp-circle">
                        {/* ✅ Crash Fix: Safe character extraction */}
                        {profileImage ? <img src={profileImage} alt="DP" /> : <span>{editName ? editName.charAt(0).toUpperCase() : 'U'}</span>}
                    </div>
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

    // 🔴 HOME TAB
    const renderHomeTab = () => {
        if (activeFolder) {
            const displayedMedia = (activeFolder.files || []).filter(item => {
                if (mediaFilter === 'PHOTOS') return !isVideo(item);
                if (mediaFilter === 'VIDEOS') return isVideo(item);
                return true;
            });

            return (
                <div className="folder-gallery-view">
                    <div className="folder-header-nav">
                        <button onClick={() => setActiveFolder(null)} className="back-btn">⬅ Back to Folders</button>
                        <h3>{activeFolder.folderName}</h3>
                    </div>

                    <div className="filter-group-vip">
                        <button className={`filter-btn-vip ${mediaFilter === 'ALL' ? 'active' : ''}`} onClick={() => setMediaFilter('ALL')}>All</button>
                        <button className={`filter-btn-vip ${mediaFilter === 'PHOTOS' ? 'active' : ''}`} onClick={() => setMediaFilter('PHOTOS')}>Photos</button>
                        <button className={`filter-btn-vip ${mediaFilter === 'VIDEOS' ? 'active' : ''}`} onClick={() => setMediaFilter('VIDEOS')}>Videos</button>
                    </div>

                    <div className="ud-grid-vip mt-20">
                        {displayedMedia.length > 0 ? displayedMedia.map((filePath, idx) => (
                            <div key={idx} className="gallery-item-vip">
                                {isVideo(filePath) ? <video src={getCleanUrl(filePath)} controls className="gallery-media-vip" /> : <img src={getCleanUrl(filePath)} loading="lazy" className="gallery-media-vip" />}
                                <div className="media-overlay-vip"><a href={getCleanUrl(filePath)} download target="_blank" rel="noreferrer" className="download-btn-vip">⬇ Download</a></div>
                            </div>
                        )) : <div className="no-data-vip">Folder is empty.</div>}
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
                        {folders.map((folder, index) => (
                            <div key={index} className="folder-card" onClick={() => setActiveFolder(folder)}>
                                <div className="folder-icon">📁</div>
                                <h4>{folder.folderName}</h4>
                                <p>{folder.files?.length || 0} Items</p>
                                {folder.isDefault && <span className="default-badge">Premium</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="ud-container-vip">
            
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

            {/* 🔴 BOTTOM NAVIGATION BAR UPDATED WITH HISTORY TAB */}
            <nav className="bottom-nav-bar" style={{ display: 'flex', justifyContent: 'space-around', padding: '10px 5px' }}>
                <button className={`nav-item ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => { setCurrentTab('HOME'); setActiveFolder(null); }}>
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
                    {/* ✅ Crash Fix: Ensure split doesn't fail if editName is empty */}
                    👤<span>{(editName || 'User').split(' ')[0]}</span>
                </button>
            </nav>
        </div>
    );
};

export default UserDashboard;