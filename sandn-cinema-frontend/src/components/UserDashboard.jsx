import React, { useState, useEffect } from 'react';
import './UserDashboard.css';
import { calculateDailyReward } from '../utils/coinLogic';

// Backend se data aane tak ye Mock Data use hoga (Default Folders)
const DEFAULT_FOLDERS = [
    { id: 'def_1', name: 'Stranger Photography', type: 'folder', date: '2023-01-01', unseen: false, isDefault: true },
    { id: 'u_1', name: 'My Wedding', type: 'folder', date: '2025-02-14', unseen: true, isDefault: false },
    { id: 'u_2', name: 'Pre-Wedding Shoot', type: 'folder', date: '2025-02-10', unseen: false, isDefault: false },
    { id: 'u_3', name: 'Birthday Bash', type: 'folder', date: '2024-12-25', unseen: true, isDefault: false }
];

const UserDashboard = ({ userData, onLogout, onUpdateUser }) => {
    // --- States ---
    const [folders, setFolders] = useState(userData.folders || DEFAULT_FOLDERS);
    const [wallet, setWallet] = useState(userData.wallet || { coins: 0, currentStreak: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('All'); // New, Oldest, All
    const [menuOpen, setMenuOpen] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [suggestedFolder, setSuggestedFolder] = useState(null);

    // --- 1. Coin Logic & Streak (On Mount) ---
    useEffect(() => {
        const rewardResult = calculateDailyReward({ ...userData, wallet });
        
        if (rewardResult.rewardAdded) {
            let msg = `Daily Reward: +1 Coin! Streak: ${rewardResult.currentStreak} Days.`;
            if (rewardResult.isSundayBonus) msg = `🎉 Sunday Special! +7 Coins Bonus! Streak: ${rewardResult.currentStreak} Days.`;
            alert(msg);

            // Update Local State
            setWallet(rewardResult);
            
            // Note: Real App me yahan API call karke DB update karna hoga
            // onUpdateUser({ ...userData, wallet: rewardResult });
        }
    }, []);

    // --- 2. Random Folder Suggestion ---
    useEffect(() => {
        if (folders.length > 0) {
            const random = folders[Math.floor(Math.random() * folders.length)];
            setSuggestedFolder(random);
        }
    }, [folders]);

    // --- 3. Filtering Logic ---
    const getProcessedFolders = () => {
        let result = folders.filter(f => 
            f.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filter === 'New') {
            // Newest first, prioritize Unseen
            result = result.sort((a, b) => new Date(b.date) - new Date(a.date)).filter(f => f.unseen);
        } else if (filter === 'Oldest') {
            // Oldest first
            result = result.sort((a, b) => new Date(a.date) - new Date(b.date));
        } else {
            // All (Default: Newest first)
            result = result.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        return result;
    };

    // --- Handlers ---
    const handleLongPress = (id) => {
        setSelectionMode(true);
        handleSelect(id);
    };

    const handleSelect = (id) => {
        if (selectedIds.includes(id)) {
            const newIds = selectedIds.filter(item => item !== id);
            setSelectedIds(newIds);
            if (newIds.length === 0) setSelectionMode(false);
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleFolderClick = (folder) => {
        if (selectionMode) {
            handleSelect(folder.id);
        } else {
            // Check data logic
            // Since we don't have real files, we show alert
            alert(`Opening ${folder.name}... (Data logic will fetch files here)`);
        }
    };

    const filteredFolders = getProcessedFolders();

    return (
        <div className="ud-container">
            {/* --- Header --- */}
            <div className="ud-header">
                <div className="ud-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
                    ☰
                    {menuOpen && (
                        <div className="ud-menu-dropdown">
                            <div className="ud-menu-item">Theme</div>
                            <div className="ud-menu-item">Settings</div>
                            <div className="ud-menu-item logout" onClick={onLogout}>Logout</div>
                        </div>
                    )}
                </div>

                <div className="ud-search-wrapper">
                    <input 
                        type="text" 
                        className="ud-search-input" 
                        placeholder="Search your memories..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <span className="ud-search-icon">🔍</span>
                </div>

                <div className="ud-coin-badge">
                    <span className="coin-val">{wallet.coins}</span>
                    <span>COINS</span>
                </div>
            </div>

            {/* --- Random Suggestion Banner --- */}
            {suggestedFolder && (
                <div className="ud-banner-row">
                    <div className="ud-banner-card" style={{backgroundImage: 'linear-gradient(to right, #000, #333)'}}>
                        <div className="banner-overlay"></div>
                        <div className="banner-text">
                            <h3>{suggestedFolder.name}</h3>
                            <p>Suggested for you</p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Controls & Filters --- */}
            <div className="ud-controls">
                <div className="selection-info">
                    {selectionMode ? (
                        <>
                            <input type="checkbox" checked readOnly />
                            <span>{selectedIds.length} Selected</span>
                        </>
                    ) : (
                        <span>Long press to select</span>
                    )}
                </div>

                <div className="filter-group">
                    <button className="filter-btn" onClick={() => setFilter(null)}>Filter</button>
                    <button className={`filter-btn ${filter === 'New' ? 'active' : ''}`} onClick={() => setFilter('New')}>New</button>
                    <button className={`filter-btn ${filter === 'All' ? 'active' : ''}`} onClick={() => setFilter('All')}>All</button>
                </div>
            </div>

            {/* --- Folder Grid --- */}
            <div className="ud-grid">
                {filteredFolders.length > 0 ? (
                    filteredFolders.map(folder => (
                        <div 
                            key={folder.id} 
                            className={`ud-card ${selectedIds.includes(folder.id) ? 'selected' : ''}`}
                            onClick={() => handleFolderClick(folder)}
                            onContextMenu={(e) => { e.preventDefault(); handleLongPress(folder.id); }}
                        >
                            {selectedIds.includes(folder.id) && <div className="check-mark">✔</div>}
                            
                            <div className="card-img-box">
                                {/* Thumbnail logic here */}
                            </div>
                            
                            <div className="card-info">
                                <h4>{folder.name}</h4>
                                <button className="download-btn">
                                    Download ⬇
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="no-data">No Data Found</div>
                )}
            </div>
        </div>
    );
};

export default UserDashboard;