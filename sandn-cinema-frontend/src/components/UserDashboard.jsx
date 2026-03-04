import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserDashboard.css';
import { calculateDailyReward } from '../utils/coinLogic';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';
const SERVER_URL = 'https://sandn-cinema.onrender.com/';

const UserDashboard = ({ user, userData, onLogout }) => {
    // --- UI STATES ---
    const [currentTab, setCurrentTab] = useState('HOME'); // HOME, SERVICES, BOOKINGS, PROFILE
    const [loading, setLoading] = useState(true);
    
    // --- USER SYNCED DATA (REAL-TIME) ---
    // Ab hum data ko local state se badal kar DB se sync karenge
    const [syncUser, setSyncUser] = useState(user);
    const [wallet, setWallet] = useState(user?.wallet || { coins: 0, currentStreak: 0 });
    const [editName, setEditName] = useState(user?.name || '');
    
    // --- FOLDER & MEDIA STATES ---
    const [folders, setFolders] = useState([]);
    const [activeFolder, setActiveFolder] = useState(null); // null means showing folder list
    const [mediaFilter, setMediaFilter] = useState('ALL'); 

    // --- PROFILE STATES ---
    const [profileImage, setProfileImage] = useState(user?.profileImage || null);
    const [editProfileMode, setEditProfileMode] = useState(false);

    // Default Folder (Stranger Photography) fallback
    const DEFAULT_FOLDER = { folderName: 'Stranger Photography', files: [], isDefault: true };

    // 🟢 FETCH LOGIC (SINGLE SOURCE OF TRUTH)
    useEffect(() => {
        const fetchRealTimeData = async () => {
            setLoading(true);
            try {
                // Humesha real database hit hoga latest update lene ke liye
                const res = await axios.post(`${API_BASE}/search-account`, { 
                    mobile: user.mobile,
                    roleFilter: 'USER' 
                });
                
                if (res.data.success) {
                    const dbData = res.data.data;
                    setSyncUser(dbData);
                    setEditName(dbData.name || '');
                    
                    // Folders update directly from DB
                    const fetchedFolders = dbData.uploadedData || [];
                    if(fetchedFolders.length > 0) {
                        setFolders(fetchedFolders);
                    } else {
                        setFolders([DEFAULT_FOLDER]);
                    }

                    // Update LocalStorage in background taaki reload fast ho
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
        
        // Daily Reward Logic Check
        const currentUserData = userData || user || {};
        const rewardResult = calculateDailyReward({ ...currentUserData, wallet });
        if (rewardResult.rewardAdded) {
            alert(`Daily Reward: +1 Coin! Streak: ${rewardResult.currentStreak} Days.`);
            setWallet(rewardResult);
        }
    }, [user.mobile]); // Dependency sirf mobile number hai taaki ek baar chal ke latest utha le

    // --- HELPERS ---
    const isVideo = (filePath) => filePath.match(/\.(mp4|webm|ogg|mov)$/i);
    const getCleanUrl = (filePath) => `${SERVER_URL}${filePath.replace(/\\/g, '/')}`;

    // --- PROFILE HANDLERS ---
    const handleDPChange = (e) => {
        const file = e.target.files[0];
        if (file) setProfileImage(URL.createObjectURL(file)); 
    };

    const handleRemoveDP = () => setProfileImage(null);

    const handleSaveProfile = () => {
        // Future Scope: Yahan ek API hogi `/api/auth/update-user-profile` 
        // par abhi ke liye hum UI update karke dikha rahe hain
        alert("Profile Updated Successfully!");
        setEditProfileMode(false);
        const updatedLocalUser = { ...syncUser, name: editName };
        setSyncUser(updatedLocalUser);
        localStorage.setItem('user', JSON.stringify(updatedLocalUser));
    };

    // --- RENDER TABS ---
    const renderContent = () => {
        if (currentTab === 'SERVICES') return <div className="tab-placeholder"><h2>Our Services</h2><p>Booking modules coming soon...</p></div>;
        if (currentTab === 'BOOKINGS') return <div className="tab-placeholder"><h2>Booking History</h2><p>No past bookings found.</p></div>;
        if (currentTab === 'PROFILE') return renderProfileTab();
        return renderHomeTab();
    };

    // 🔴 PROFILE (U) TAB
    const renderProfileTab = () => (
        <div className="profile-tab-vip">
            <h2>Your Profile</h2>
            <div className="profile-card-vip">
                <div className="dp-section">
                    <div className="dp-circle">
                        {profileImage ? <img src={profileImage} alt="DP" /> : <span>{editName.charAt(0)}</span>}
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
                    <input type="text" value={syncUser.mobile} disabled className="vip-input disabled" />

                    <label>Full Name</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!editProfileMode} className={`vip-input ${!editProfileMode ? 'disabled' : ''}`} />

                    {editProfileMode ? (
                        <button className="vip-btn-gold mt-20" onClick={handleSaveProfile}>Save Changes</button>
                    ) : (
                        <button className="vip-btn-outline mt-20" onClick={() => setEditProfileMode(true)}>Edit Profile</button>
                    )}
                </div>
            </div>
            <button className="logout-btn-full mt-20" onClick={onLogout}>Logout Securely</button>
        </div>
    );

    // 🔴 HOME TAB (Folders -> Gallery)
    const renderHomeTab = () => {
        // If inside a folder, show its gallery
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

        // Show Folder List
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

            {/* 🔴 BOTTOM NAVIGATION BAR */}
            <nav className="bottom-nav-bar">
                <button className={`nav-item ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => { setCurrentTab('HOME'); setActiveFolder(null); }}>
                    🏠<span>Home</span>
                </button>
                <button className={`nav-item ${currentTab === 'SERVICES' ? 'active' : ''}`} onClick={() => setCurrentTab('SERVICES')}>
                    📸<span>Services</span>
                </button>
                <button className={`nav-item ${currentTab === 'BOOKINGS' ? 'active' : ''}`} onClick={() => setCurrentTab('BOOKINGS')}>
                    📅<span>Bookings</span>
                </button>
                <button className={`nav-item ${currentTab === 'PROFILE' ? 'active' : ''}`} onClick={() => setCurrentTab('PROFILE')}>
                    👤<span>{editName.split(' ')[0] || 'U'}</span>
                </button>
            </nav>
        </div>
    );
};

export default UserDashboard;