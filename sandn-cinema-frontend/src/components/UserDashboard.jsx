import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import './UserDashboard.css';
import { calculateDailyReward } from '../utils/coinLogic';
import useBackButton from '../hooks/useBackButton';
import SyncPlayer from '../components/SyncPlayer';
import io from 'socket.io-client'; // 👈 NAYA: Socket.io Client Import

const API_BASE = import.meta.env.VITE_API_BASE;
const SERVER_URL = import.meta.env.VITE_SERVER_URL;

// ✅ SUPER TOKEN GRABBER: Ye token ko securely fetch karega
const getValidToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
};

// 🌟 PREMIUM REUSABLE BACK BUTTON COMPONENT
const BackButton = ({ onClick, label = "Back", color = "#fff", border = "rgba(255,255,255,0.3)" }) => (
    <button 
        onClick={onClick} 
        style={{ 
            background: 'rgba(0, 0, 0, 0.25)', color: color, 
            border: `1px solid ${border}`, padding: '6px 14px', 
            borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', 
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', 
            backdropFilter: 'blur(10px)', transition: 'all 0.3s ease',
            whiteSpace: 'nowrap'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'; e.currentTarget.style.borderColor = color; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.25)'; e.currentTarget.style.borderColor = border; }}
    >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        {label}
    </button>
);

const UserDashboard = ({ user, userData, onLogout }) => {

    // 🧾 AUTOMATED PDF INVOICE GENERATOR (CRASH-PROOF)
    const downloadInvoice = (item) => {
        try {
            const doc = new jsPDF();
            
            // SNEVIO Header Branding
            doc.setFontSize(22);
            doc.setTextColor(41, 128, 185); // Professional Blue
            doc.text("SNEVIO DIGITAL", 14, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text("Official Payment Receipt", 14, 26);
            doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 150, 20);
            doc.text(`Receipt ID: TXN-${Math.floor(Math.random() * 900000) + 100000}`, 150, 26);
            
            doc.setLineWidth(0.5);
            doc.line(14, 30, 196, 30);
            
            // Billed To Details (User Data)
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text("Billed To:", 14, 40);
            doc.setFontSize(10);
            doc.setTextColor(80);
            doc.text(`Name: ${user?.name || 'User'}`, 14, 46);
            doc.text(`Mobile Number: ${user?.mobile || 'N/A'}`, 14, 52);
            if(user?.email) doc.text(`Email ID: ${user.email}`, 14, 58);
            
            // Transaction Table
            autoTable(doc, {
                startY: 65,
                head: [['Description of Action', 'Date', 'Transaction Type', 'Amount']],
                body: [
                    [item.action || 'N/A', item.date || 'N/A', (item.type || 'N/A').toUpperCase(), item.amount || '0']
                ],
                headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                margin: { top: 10 }
            });
            
            // Footer Notes
            const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 100;
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text("Thank you for using Snevio Platform!", 14, finalY);
            doc.setFontSize(8);
            doc.text("Note: This is a computer-generated document. No physical signature is required.", 14, finalY + 6);
            
            // Save the PDF
            doc.save(`Snevio_Receipt_${new Date().getTime()}.pdf`);
            
        } catch (error) {
            console.error("PDF Generation Error: ", error);
            alert("⚠️ Error generating PDF. Please check the browser console.");
        }
    };

    // --- UI STATES ---
    // 🔄 FIXED: Refresh hone par same page par rahega
    const [currentTab, setCurrentTab] = useState(() => localStorage.getItem('currentDashboardTab') || 'HOME');
    const [loading, setLoading] = useState(true); 

    // ✅ FIXED: Missing handleTabChange Function Add Kiya
    const handleTabChange = (tabName) => {
        localStorage.setItem('currentDashboardTab', tabName);
        setCurrentTab(tabName);
    }; 
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [showExitPopup, setShowExitPopup] = useState(false);
    const [timeTicker, setTimeTicker] = useState(Date.now()); // 🔥 For live countdown ticking

    // 👑 VIP/PREMIUM SUBSCRIPTION STATES
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [userSubPlans, setUserSubPlans] = useState([]); // Will fetch from global settings
    const [activeSubscription, setActiveSubscription] = useState(user?.activePlan || null);

    // Live Timer Refresh Effect (Ticks every second)
    useEffect(() => {
        const timer = setInterval(() => setTimeTicker(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    
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

    // ✅ NEW: TEMPORARY SECURE ACCESS STATES
    const [showAccessModal, setShowAccessModal] = useState(false);
    const [accessForm, setAccessForm] = useState({ receiverMobile: '', hours: '24' });
    const [sharedWithMe, setSharedWithMe] = useState([]);
    const [sharedByMe, setSharedByMe] = useState([]); // 👈 NEW
    const [sharedTabFilter, setSharedTabFilter] = useState('RECEIVED'); // 👈 NEW
    const [viewBookingDetails, setViewBookingDetails] = useState(null); // 👈 NEW (For Booking Details)
    const [fetchingShared, setFetchingShared] = useState(false);

    // ✅ MONETIZATION STATES (Pay per View/Download)
    const [purchaseModal, setPurchaseModal] = useState({ show: false, file: null, files: [], cost: 0, type: '', isBatch: false });
    const [adLoading, setAdLoading] = useState(false);

    // ✅ NEW: SMART ALBUM SELECTION STATES
    const [mySelections, setMySelections] = useState([]);
    const [activeSelectionProject, setActiveSelectionProject] = useState(null);
    const [activeSelectionCategory, setActiveSelectionCategory] = useState('ALL'); 
    const [wizardCategories, setWizardCategories] = useState([]); // 👈 Tracks available folders
    const [selectionDraft, setSelectionDraft] = useState([]); // Selected URLs
    const [showSelectionReview, setShowSelectionReview] = useState(false);
    const [showMissedImages, setShowMissedImages] = useState(false); // 👈 Missed Images State
    const [imageToRemove, setImageToRemove] = useState(null); // 👈 NEW: Phase 2/3 Removal Confirmation State
    const [showFamilyShareModal, setShowFamilyShareModal] = useState(false);
    const [missedSelection, setMissedSelection] = useState([]); // 👈 For multi-selecting missed images
    const [showMissedRestoreConfirm, setShowMissedRestoreConfirm] = useState(false); // 👈 Confirmation for restoring missed images
    const touchRef = useRef({ isLong: false, timer: null }); // 👈 For long-press detection
    const [familyShareForm, setFamilyShareForm] = useState({ mobile: '', hours: '24' });

    // ✅ NEW: STATES FOR COLLAB OVERVIEW & MERGE FOLDER
    const [selectionSubView, setSelectionSubView] = useState('OVERVIEW'); // OVERVIEW, MY_SELECTION, MEMBER_VIEW, MERGED_VIEW
    const [viewingMember, setViewingMember] = useState(null);
    const [viewingSplitAlbum, setViewingSplitAlbum] = useState(null); // 👈 For viewing split albums after completion
    const [showSelectedPreview, setShowSelectedPreview] = useState(false); // 🔥 NAYA: Clean Folder View ke liye
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [membersToMerge, setMembersToMerge] = useState([]);

    // ✅ NEW: STATES FOR 72-HOUR SPLIT WORKFLOW
    const [showFinalOptModal, setShowFinalOptModal] = useState(false);
    const [splitActionModal, setSplitActionModal] = useState({ show: false, image: null });
    const [isProcessingSplit, setIsProcessingSplit] = useState(false);

    // ⏱️ Helper: Check if 72 hours are active
    const isSplitWindowActive = () => {
        if (!activeSelectionProject || !activeSelectionProject.finalSubmissionDate) return false;
        if (activeSelectionProject.splitCompleted) return false;
        
        const now = new Date();
        const submittedAt = new Date(activeSelectionProject.finalSubmissionDate);
        const hoursDiff = (now - submittedAt) / (1000 * 60 * 60);
        return hoursDiff <= 72;
    };

    // ✅ WALLET MODAL & GLOBAL CHARGES STATES
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [walletTab, setWalletTab] = useState('BUY'); // 'BUY' or 'FREE'
    const [coinPackages, setCoinPackages] = useState([]);
    const [miniEvents, setMiniEvents] = useState([]);
    const [tutorials, setTutorials] = useState([]); // 👈 NAYA: Dynamic Video Guides ke liye

    // ✅ LIVE DOWNLOAD STATES
    const [downloadingFile, setDownloadingFile] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [downloadETA, setDownloadETA] = useState('');

    // --- PROFILE STATES ---
    const [profileImage, setProfileImage] = useState(user?.profileImage || null);
    const [dpFile, setDpFile] = useState(null); // 👈 NAYA: To store the actual image file
    const [editProfileMode, setEditProfileMode] = useState(false);
    const [profileData, setProfileData] = useState({
        email: user?.email || '',
        location: user?.location || ''
    });

    const [rewardPopup, setRewardPopup] = useState({ show: false, type: '', coins: 0, streak: 0 });

    // 🔔 NOTIFICATION & 🎁 GIFT CARD STATES
    const [notifications, setNotifications] = useState([]);
    const [showNotifModal, setShowNotifModal] = useState(false);
    const [showGiftCardModal, setShowGiftCardModal] = useState(false);
    const [giftCode, setGiftCode] = useState('');
    const [giftLoading, setGiftLoading] = useState(false);

    // ✅ NATIVE SERVICES & BOOKINGS STATES
    const [availableServices, setAvailableServices] = useState([]);
    const [userBookings, setUserBookings] = useState([]);
    const [bookingFilter, setBookingFilter] = useState('ALL'); // 'ALL', 'Pending', 'Accepted', 'Declined'
    const [selectedServiceModal, setSelectedServiceModal] = useState(null);
    const [servicesLoading, setServicesLoading] = useState(false);

    // ✅ NEW: CART, EMERGENCY & PROPOSAL STATES
    const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('userCart')) || []);
    const [showCartModal, setShowCartModal] = useState(false);
    const [showEmergencyModal, setShowEmergencyModal] = useState(false);
    const [emergencyData, setEmergencyData] = useState({ reason: '', location: '' });
    const [showSupportModal, setShowSupportModal] = useState(false); 
    const [showTutorialsModal, setShowTutorialsModal] = useState(false); // 👈 VIDEO GUIDES STATE
    
    // ✅ NEW: ACCEPT PROPOSAL MODAL
    const [viewProposalBooking, setViewProposalBooking] = useState(null);

    // ✅ TOAST NOTIFICATION STATE
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // ✅ TOAST TRIGGER FUNCTION
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    // 🔄 FIXED: Refresh hone par same page par rahega
    useEffect(() => {
        if (currentTab) {
            localStorage.setItem('currentDashboardTab', currentTab);
        }
    }, [currentTab]);

    const DEFAULT_FOLDER = { folderName: 'Snevio Photography', files: [], subFolders: [], isDefault: true, uploadedBy: 'Snevio Official', uploaderRole: 'VIP Studio', imageCost: 5, videoCost: 10, unlockValidity: '24 Hours' };

    // 🌐 NETWORK MONITOR (Auto-Logout Removed)
    useEffect(() => {
        const handleOffline = () => {
            console.log("⚠️ Internet connection lost! Waiting for reconnect...");
            // 🔥 अब यहाँ से ऑटो-लॉगआउट और डेटा डिलीट करने वाला लॉजिक पूरी तरह हटा दिया गया है!
        };
        window.addEventListener('offline', handleOffline);
        return () => window.removeEventListener('offline', handleOffline);
    }, []);

    // ✅ Sync Cart to LocalStorage
    useEffect(() => {
        localStorage.setItem('userCart', JSON.stringify(cart));
    }, [cart]);

    // ✅ NATIVE BROWSER HISTORY & HARDWARE BACK BUTTON LOGIC (PWA/PRO APP STYLE)
    // 1. Ek ref banayenge jo humari current state ko yaad rakhega bina re-render ke error diye
    const uiStateRef = useRef({});
    
    useEffect(() => {
        uiStateRef.current = {
            showFamilyShareModal, showMissedImages, showSelectionReview, showMergeModal,
            activeSelectionProject, viewingSplitAlbum, showSelectedPreview, selectionSubView,
            viewProposalBooking, showEmergencyModal, showCartModal, selectedServiceModal,
            selectedMedia, purchaseModal, showWalletModal, showCollabModal, activeSubFolder,
            activeFolder, currentTab, syncUser
        };
    });

    useEffect(() => {
        // App khulte hi ek dummy history state push karo (Taki hardware back button trap ho jaye)
        window.history.pushState({ page: 'snevio_dashboard' }, '', window.location.pathname);

        const handlePopState = (event) => {
            const s = uiStateRef.current; // Current UI states ko fetch karo
            let actionTaken = true;

            // Systematically ek-ek karke UI elements band karo (LIFO order)
            if (s.showFamilyShareModal) {
                setShowFamilyShareModal(false);
            } else if (s.showMissedImages) {
                setShowMissedImages(false);
            } else if (s.showSelectionReview) {
                setShowSelectionReview(false);
            } else if (s.showMergeModal) {
                setShowMergeModal(false);
            } else if (s.activeSelectionProject) {
                const isFamilyMember = s.activeSelectionProject.clientMobile !== s.syncUser?.mobile;
                if (s.viewingSplitAlbum) {
                    setViewingSplitAlbum(null);
                } else if (s.showSelectedPreview) {
                    setShowSelectedPreview(false);
                } else if (!isFamilyMember && s.selectionSubView !== 'OVERVIEW' && !['Completed', 'Confirmed', 'Submitted'].includes(s.activeSelectionProject.status)) {
                    setSelectionSubView('OVERVIEW');
                    setViewingMember(null);
                } else {
                    setActiveSelectionProject(null);
                    setSelectionDraft([]);
                    handleTabChange('HOME');
                    setSelectionSubView('OVERVIEW');
                }
            } else if (s.viewProposalBooking) {
                setViewProposalBooking(null);
            } else if (s.showEmergencyModal) {
                setShowEmergencyModal(false);
            } else if (s.showCartModal) {
                setShowCartModal(false);
            } else if (s.selectedServiceModal) {
                setSelectedServiceModal(null);
            } else if (s.selectedMedia) {
                setSelectedMedia(null);
            } else if (s.purchaseModal?.show) {
                setPurchaseModal({ show: false, file: null, files: [], cost: 0, type: '', isBatch: false });
            } else if (s.showWalletModal) {
                setShowWalletModal(false);
            } else if (s.showCollabModal) {
                setShowCollabModal(false);
            } else if (s.activeSubFolder) {
                setActiveSubFolder(null);
                setIsSelectionMode(false);
                setSelectedMediaFiles([]);
            } else if (s.activeFolder) {
                setActiveFolder(null);
                setMediaFilter('ALL');
                setIsSelectionMode(false);
                setSelectedMediaFiles([]);
            } else if (s.currentTab !== 'HOME') {
                handleTabChange('HOME');
            } else {
                actionTaken = false;
                setShowExitPopup(true); // Agar sab kuch band hai, tab ja kar Exit Popup dikhao
            }

            // 🔥 USER TRAP: Vapas state push karo taki user galti se app ke bahar na nikal jaye
            window.history.pushState({ page: 'snevio_dashboard' }, '', window.location.pathname);
        };

        // Event Listener lagao
        window.addEventListener('popstate', handlePopState);
        
        // Clean up on unmount
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // 🟢 FETCH LOGIC & 🔥 GLOBAL AUTO-REFRESH
    useEffect(() => {
        const fetchRealTimeData = async (isInitialLoad = true) => {
            let activeUser = user || JSON.parse(sessionStorage.getItem('user'));
            if (!activeUser || !activeUser.mobile) {
                if (isInitialLoad) {
                    setFolders([DEFAULT_FOLDER]);
                    setLoading(false);
                }
                return; 
            }

            if (isInitialLoad) setLoading(true);
            try {
                // Fetch user data (Silent update if not initial load)
                const res = await axios.post(`${API_BASE}/search-account`, { mobile: activeUser.mobile });
                
                if (res.data.success) {
                    const dbData = res.data.data;
                    setSyncUser(dbData);
                    // Update name only if it's the initial load to prevent overwriting user typing
                    if(isInitialLoad) setEditName(dbData.name || '');
                    if(isInitialLoad) setProfileData({ email: dbData.email || '', location: dbData.location || '' });
                    if(isInitialLoad) setProfileImage(dbData.profileImage || null); // 👈 DP ko DB se load karna zaroori hai!
                    
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
                            subFolders: Array.isArray(folder.subFolders) ? folder.subFolders : [],
                            unlockValidity: folder.unlockValidity || '24 Hours' 
                        };
                    }).filter(Boolean);

                    // 1. वो फोल्डर्स निकालो जो न तो 'Stranger' हैं और न ही 'Snevio' (यानी क्लाइंट के अपने फोल्डर्स)
                    const customFolders = fetchedFolders.filter(f => {
                        const name = f?.folderName?.trim().toLowerCase();
                        return name !== 'snevio photography' && name !== 'stranger photography';
                    });

                    // 2. डेटाबेस में अगर 'Snevio' या 'Stranger' नाम का कोई भी फोल्डर है, तो उसका डेटा निकालो
                    const existingDefaultData = fetchedFolders.find(f => {
                        const name = f?.folderName?.trim().toLowerCase();
                        return name === 'snevio photography' || name === 'stranger photography';
                    });
                    
                    // 3. हमेशा 'Snevio Photography' ही दिखाओ, भले ही डेटाबेस में नाम 'Stranger' हो
                    const finalDefaultFolder = existingDefaultData 
                        ? { ...DEFAULT_FOLDER, ...existingDefaultData, folderName: 'Snevio Photography' } 
                        : DEFAULT_FOLDER;
                    
                    setFolders([finalDefaultFolder, ...customFolders]);
                    sessionStorage.setItem('user', JSON.stringify({ ...activeUser, name: dbData.name })); 
                } else if(isInitialLoad) {
                    setFolders([DEFAULT_FOLDER]); 
                }

                // Only fetch heavy global settings on initial load
                if (isInitialLoad) {
                    const platformRes = await axios.get(`${API_BASE}/get-platform-settings`);
                    if (platformRes.data.success && platformRes.data.data) {
                        setCoinPackages(platformRes.data.data.coinPackages || []);
                        setMiniEvents(platformRes.data.data.miniEvents || []);
                        setTutorials(platformRes.data.data.tutorials || []);
                        setUserSubPlans(platformRes.data.data.userSubPlans || []); // 👑 NAYA: Subscription Plans Fetch karega
                    }
                }

                // 🔥 Auto-refresh Bookings and Shared Media silently
                fetchServicesAndBookings(activeUser.mobile, !isInitialLoad); // 👈 Passes true if it's a background refresh
                fetchSharedMedia(activeUser.mobile, !isInitialLoad);         // 👈 Passes true if it's a background refresh
                fetchUserSelections(activeUser.mobile);
                fetchNotifications(activeUser.mobile);

            } catch (error) {
                console.error("Fetch error:", error);
                if(isInitialLoad) setFolders([DEFAULT_FOLDER]); 
            } finally {
                if (isInitialLoad) setLoading(false);
            }
        };

        // 1. Run immediately on mount
        fetchRealTimeData(true);
        
        // 2. 🕒 SETUP BACKGROUND POLLING (Every 10 Seconds)
        const refreshInterval = setInterval(() => {
            fetchRealTimeData(false); // false = Silent load (no loader screen)
        }, 10000); 
        
        // 🚀 3. SOCKET.IO (REAL-TIME MAGIC - 0 DELAY)
        const socket = io(SERVER_URL);
        const currentUserMobile = user?.mobile || JSON.parse(sessionStorage.getItem('user'))?.mobile;
        
        if (currentUserMobile) {
            // Join personal room so we only get notifications meant for this user
            socket.emit('join_user_room', currentUserMobile);
        }
        
        socket.on('data_updated', (data) => {
            console.log("⚡ Instant Socket Update:", data?.message);
            fetchRealTimeData(false); // Instantly fetch without loader
        });

        // 🔄 4. WINDOW FOCUS SYNC (Instant refresh when user switches back to the app)
        const handleFocus = () => fetchRealTimeData(false);
        window.addEventListener('focus', handleFocus);
        
        // 5. 🛡️ SECURE DAILY REWARD LOGIC (Backend Verifies Everything)
        const checkDailyReward = async () => {
            if (!currentUserMobile) return;
            try {
                const res = await axios.post(`${API_BASE}/claim-daily-login`, { mobile: currentUserMobile });
                if (res.data.success) {
                    setWallet(res.data.wallet); 
                    setRewardPopup({ show: true, type: 'EARNED', coins: 1, streak: res.data.streak });
                    
                    setTimeout(() => {
                        const coinBadge = document.querySelector('.ud-coin-badge-vip');
                        if (coinBadge) {
                            coinBadge.classList.add('coin-bump-animation');
                            setTimeout(() => coinBadge.classList.remove('coin-bump-animation'), 2000);
                        }
                    }, 500); 
                    
                    setTimeout(() => setRewardPopup({ show: false }), 4000);
                }
            } catch(e) { console.log("Daily reward check silently failed."); }
        };

        checkDailyReward();

        // 🧹 6. CLEANUP (Prevent memory leaks when component unmounts)
        return () => {
            clearInterval(refreshInterval);
            socket.disconnect();
            window.removeEventListener('focus', handleFocus);
        };
    }, [user?.mobile]);

    // ⏳ 15 SECOND TIMER FOR INSTALL POPUP
    useEffect(() => {
        const timer = setTimeout(() => {
            // Check karo agar browser ne install allow kiya hai aur app pehle se installed nahi hai
            if (window.deferredPrompt) {
                setShowInstallBanner(true);
            }
        }, 15000); // 15000ms = 15 Seconds

        return () => clearTimeout(timer);
    }, []);

    const fetchNotifications = async (userMobile) => {
        try {
            const res = await axios.post(`${API_BASE}/get-notifications`, { mobile: userMobile });
            if (res.data.success) setNotifications(res.data.data);
        } catch (e) { console.error("Notif Error"); }
    };

    const handleMarkNotificationsRead = async () => {
        try {
            await axios.post(`${API_BASE}/mark-notifications-read`, { mobile: syncUser.mobile });
            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
        } catch (e) {}
    };

    const handleRedeemGiftCard = async (e) => {
        e.preventDefault();
        if (!giftCode.trim()) return alert("Please enter a valid Gift Code.");
        setGiftLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/redeem-gift-card`, { mobile: syncUser.mobile, code: giftCode });
            if (res.data.success) {
                alert(res.data.message);
                setWallet(res.data.wallet); // Update Wallet
                setShowGiftCardModal(false);
                setGiftCode('');
            } else {
                alert(res.data.message);
            }
        } catch (err) { alert("Server error. Try again."); }
        setGiftLoading(false);
    };

    const fetchSharedMedia = async (userMobile, isSilent = false) => {
        if (!isSilent) setFetchingShared(true); // 👈 Agar silent mode hai, toh loader nahi chalega
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
            const res = await axios.post(`${API_BASE}/get-shared-media`, { mobile: userMobile }, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.data.success) {
                setSharedWithMe(res.data.data.sharedWithMe || []);
                setSharedByMe(res.data.data.sharedByMe || []);
            }
        } catch (e) { console.log(e); }
        finally { if (!isSilent) setFetchingShared(false); }
    };

    // ✅ FETCH SMART ALBUM SELECTIONS
    const fetchUserSelections = async (userMobile) => {
        try {
            const token = getValidToken();
            const res = await axios.post(`${API_BASE}/get-user-selections`, { mobile: userMobile }, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.data.success) setMySelections(res.data.data);
        } catch (e) { console.error("Failed to load selections", e); }
    };

    // --- FETCH SERVICES AND BOOKINGS ---
    const fetchServicesAndBookings = async (userMobile, isSilent = false) => {
        if (!isSilent) setServicesLoading(true); // 👈 Silent mode logic applied here
        try {
            const servRes = await axios.get(`${API_BASE}/get-available-services`);
            if (servRes.data.success) setAvailableServices(servRes.data.data || []);

            const bookRes = await axios.post(`${API_BASE}/get-user-services`, { mobile: userMobile });
            if (bookRes.data.success) setUserBookings(bookRes.data.data || []);
            
        } catch (e) {
            console.error("Failed to load services/bookings", e);
        } finally {
            if (!isSilent) setServicesLoading(false);
        }
    };

    // --- HELPERS ---
    const isCinematic = (url) => typeof url === 'string' && url.startsWith('CINEMATIC::');

    

    // ✅ 100% SAFE & SUPER-FAST IMAGE URL GENERATOR (Auto Object/String Handler)
    const getCleanUrl = (fileData, isThumbnail = false) => {
        try {
            if (!fileData) return '';
            
            // 1. SMART FIX: Agar Data Object hai (Selection Data), toh usme se URL nikal lo
            let filePath = typeof fileData === 'object' ? (fileData.previewUrl || fileData.url || fileData.fileUrl) : fileData;
            
            // Agar fir bhi string nahi hai, toh blank return karo (Crash se bachane ke liye)
            if (typeof filePath !== 'string' || filePath.trim() === '') return '';
            
            // 2. Cinematic Video (Skip)
            if (filePath.startsWith('CINEMATIC::')) return filePath; 

            // 3. 🚀 HIGH-SPEED CLOUDINARY COMPRESSION (50x Faster Loading)
            if (filePath.includes('cloudinary.com') && !filePath.includes('/video/upload')) {
                const uploadIndex = filePath.indexOf('/upload/');
                // Agar list view/grid view me hai (thumbnail), tabhi compressed version mangao
                if (uploadIndex !== -1 && isThumbnail) {
                    const baseUrl = filePath.slice(0, uploadIndex + 8); // Up to '.../upload/'
                    const imagePath = filePath.slice(uploadIndex + 8); // Rest of the path
                    
                    // w_500 = Width 500px karega
                    // q_auto = Quality auto-adjust karega (data bachega)
                    // f_auto = Browser ke hisab se WebP/AVIF fast format me bhejega
                    return `${baseUrl}c_scale,w_500,q_auto,f_auto/${imagePath}`;
                }
                return filePath; // Original quality agar thumbnail nahi chahiye (Jaise full screen preview me)
            }
            
            // 4. Absolute URL (ImgBB, AWS, Mega - already includes http)
            if (filePath.startsWith('http')) return filePath; 

            // 5. Relative URL (Local server storage)
            return `${SERVER_URL}${filePath.replace(/\\/g, '/')}`; 

        } catch (error) {
            console.error("getCleanUrl error:", error, fileData);
            // Fallback: Agar code fate toh jo mila wahi chipka do
            return typeof fileData === 'string' && fileData.startsWith('http') ? fileData : '';
        }
    };
    const handleRevokeAccess = async (id) => {
        if (!window.confirm("Are you sure you want to revoke access? The user will no longer see this media.")) return;
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
            const res = await axios.post(`${API_BASE}/revoke-media-access`, { id, mobile: syncUser.mobile }, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.data.success) {
                alert("Access Revoked Successfully!");
                fetchSharedMedia(syncUser.mobile); // Refresh the lists
            }
        } catch (e) { alert("Error revoking access."); }
    };

    // ✅ CHECK IF FILE IS UNLOCKED (SMART OBJECT-SAFE CHECK)
    const isFileUnlocked = (fileInput) => {
        if (!wallet.unlockedFiles) return false;
        // Extracted exact string URL seamlessly
        const filePath = typeof fileInput === 'object' ? (fileInput.url || fileInput.fileUrl) : fileInput;
        
        return wallet.unlockedFiles.some(f => {
            if (f.fileUrl !== filePath) return false;
            if (f.expiry === 'Permanent') return true;
            return new Date(f.expiry) > new Date(); // True if not expired
        });
    };

    // 🔥 TIME CALCULATOR FOR FOMO UI (OBJECT-SAFE FIXED)
    const getUnlockTimerText = (fileInput) => {
        if (!wallet.unlockedFiles) return null;
        const filePath = typeof fileInput === 'object' ? (fileInput.url || fileInput.fileUrl) : fileInput;
        
        const validEntries = wallet.unlockedFiles.filter(f => f.fileUrl === filePath && (f.expiry === 'Permanent' || new Date(f.expiry) > new Date()));
        
        if (validEntries.length === 0) return null; 
        if (validEntries.some(f => f.expiry === 'Permanent')) return null;

        const latestExpiryEntry = validEntries.reduce((latest, current) => {
            return new Date(current.expiry) > new Date(latest.expiry) ? current : latest;
        });

        const timeDiff = new Date(latestExpiryEntry.expiry) - new Date();
        if (timeDiff <= 0) return null;

        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        const hDisp = hours < 10 ? `0${hours}` : hours;
        const mDisp = minutes < 10 ? `0${minutes}` : minutes;
        
        return `⏳ Locks in ${hDisp}h ${mDisp}m`;
    };

    // 🎥 VIDEO DETECTOR (OBJECT-SAFE FIXED)
    const isVideo = (fileInput) => {
        const filePath = typeof fileInput === 'object' ? (fileInput.url || fileInput.fileUrl) : fileInput;
        if (!filePath || typeof filePath !== 'string') return false;
        if (isCinematic(filePath)) return true;
        if (filePath.includes('/video/upload/')) return true; 
        return filePath.match(/\.(mp4|webm|ogg|mov)$/i);
    };

    // --- PROFILE HANDLERS ---
    const handleDPChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfileImage(URL.createObjectURL(file)); 
            setDpFile(file); // 👈 Save file for backend upload
        }
    };

    const handleRemoveDP = () => {
        setProfileImage(null);
        setDpFile(null); // 👈 Clear file state too
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            let finalDpUrl = profileImage; // Default to existing DP if no new file is uploaded
            
            // 1️⃣ JAB NAYA PHOTO UPLOAD KIYA HO
            if (dpFile) {
                const fd = new FormData();
                fd.append('file', dpFile);
                // Upload image to cloud via proxy
                const cloudRes = await axios.post(`${API_BASE}/proxy-upload`, fd, {
                    headers: { 'Authorization': `Bearer ${getValidToken()}` }
                });
                if(cloudRes.data.url) finalDpUrl = cloudRes.data.url;
            }

            // 2️⃣ SAVE ALL DATA TO DATABASE
            const payload = {
                mobile: syncUser.mobile,
                name: editName,
                email: profileData.email,
                location: typeof profileData.location === 'object' ? '' : profileData.location, // 👈 THE 500 ERROR FIX
                profileImage: finalDpUrl
            };

            const res = await axios.post(`${API_BASE}/update-profile`, payload, {
                headers: { 'Authorization': `Bearer ${getValidToken()}` }
            });

            if (res.data.success) {
                alert("✅ Profile Updated Successfully!");
                setEditProfileMode(false);
                const updatedLocalUser = { ...syncUser, ...payload };
                setSyncUser(updatedLocalUser);
                sessionStorage.setItem('user', JSON.stringify(updatedLocalUser));
                localStorage.setItem('user', JSON.stringify(updatedLocalUser));
            } else {
                alert("❌ Failed to update profile.");
            }
        } catch (err) {
            console.error("Profile Save Error:", err);
            alert("Server error while saving profile. Please check connection.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ NEW: BATCH SELECTION HELPERS
    const toggleSelection = (filePath) => {
        setSelectedMediaFiles(prev => prev.includes(filePath) ? prev.filter(f => f !== filePath) : [...prev, filePath]);
    };

    // 🧠 SMART PRICING LOGIC (VIP & PREMIUM)
    const calculateItemCost = (filePath) => {
        if (!activeFolder) return 0;
        let baseCost = isVideo(filePath) ? (activeFolder.videoCost || 10) : (activeFolder.imageCost || 5);
        
        if (activeSubscription?.type === 'VIP') return 0; // VIP is 100% Free
        if (activeSubscription?.type === 'PREMIUM') return Math.ceil(baseCost / 2); // Premium is 50% OFF
        
        return baseCost; // Free user pays full
    };

    const getBatchCost = () => {
        let total = 0;
        selectedMediaFiles.forEach(file => {
            if (!isFileUnlocked(file)) {
                total += calculateItemCost(file);
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
        setPurchaseModal({ show: true, file: filePath, files: [filePath], cost: calculateItemCost(filePath), type: fileType, isBatch: false });
    };

    // ✅ OPEN NEW MEDIA INTERFACE (Share, Collab, Unlock)
    const openMediaInterface = (filePath) => {
        if (!activeFolder) return;
        const fileType = isVideo(filePath) ? 'Video' : 'Photo';
        
        setSelectedMedia({
            url: filePath,
            type: fileType,
            cost: calculateItemCost(filePath),
            isUnlocked: isFileUnlocked(filePath) || activeSubscription?.type === 'VIP' // 👑 VIP is auto-unlocked visually
        });
    };

    const getCostLabel = (filePath) => {
        if(!activeFolder) return '';
        if (activeSubscription?.type === 'VIP') return `FREE (VIP)`;
        return `${calculateItemCost(filePath)} Coins`;
    };

    // ✅ Process Purchase with Coins and Update Unlock Status (Supports BATCH & SINGLE)
    const processCoinPurchase = async () => {
        const targetCost = purchaseModal.cost || selectedMedia?.cost;
        const targetFiles = purchaseModal.isBatch ? purchaseModal.files : (purchaseModal.file ? [purchaseModal.file] : [selectedMedia?.url]);
        const targetType = purchaseModal.type || selectedMedia?.type;

        // Bypassing coin check for VIP since cost is 0
        if (targetCost > 0 && wallet.coins < targetCost) {
            alert("Not enough coins! Watch Ads to earn or buy more.");
            setShowWalletModal(true); 
            return;
        }

        setLoading(true);
        try {
            // 🧠 SMART EXPIRY LOGIC (VIP & PREMIUM)
            let expiryDate = 'Permanent';
            if (activeSubscription?.type === 'VIP') {
                expiryDate = 'Permanent'; // VIP gets lifetime
            } else if (activeSubscription?.type === 'PREMIUM') {
                expiryDate = new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(); // Premium gets 1 Year
            } else {
                // Free user gets normal expiry
                if (activeFolder?.unlockValidity === '24 Hours' || activeFolder?.folderName === 'Snevio Photography') {
                    expiryDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString();
                } else if (activeFolder?.unlockValidity === '7 Days') {
                    expiryDate = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
                }
            }

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
            title: 'Snevio - Digital Memories',
            text: 'Check out this amazing moment captured beautifully by @snevio! ✨📸 #Snevio #Photography #Cinematography',
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

    // ✅ REAL MONEY PACKAGE PURCHASE (VIA INSTAMOJO)
    const handleBuyPackage = async (pkg) => {
        if (!window.confirm(`Proceed to pay ₹${pkg.price} for ${pkg.coins} Coins?`)) return;
        
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/create-payment`, {
                amount: pkg.price,
                purpose: `${pkg.coins} Coins Package`,
                buyer_name: syncUser.name || 'Snevio User',
                email: profileData.email || 'dummy@snevio.com',
                phone: syncUser.mobile,
                itemType: 'COINS',
                itemValue: pkg.coins
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });

            if (res.data.success && res.data.paymentUrl) {
                // 🚀 Redirect user securely to Instamojo Payment Gateway
                window.location.href = res.data.paymentUrl;
            } else {
                alert("Failed to initialize payment gateway. Please try again.");
                setLoading(false);
            }
        } catch (e) { 
            alert("Connection error. Could not start payment.");
            setLoading(false);
        }
    };

    // 👑 REAL MONEY SUBSCRIPTION PURCHASE (VIA INSTAMOJO)
    const handleBuySubscription = async (plan) => {
        if (!window.confirm(`Proceed to upgrade to ${plan.planName} for ₹${plan.monthlyPrice}/month?`)) return;
        
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/create-payment`, {
                amount: plan.monthlyPrice,
                purpose: `Subscription: ${plan.planName}`,
                buyer_name: syncUser.name || 'Snevio User',
                email: profileData.email || 'dummy@snevio.com',
                phone: syncUser.mobile,
                itemType: 'SUBSCRIPTION', // 👈 Backend isko read karke plan update karega
                itemValue: plan.id,
                planType: plan.type // VIP or PREMIUM
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });

            if (res.data.success && res.data.paymentUrl) {
                window.location.href = res.data.paymentUrl;
            } else {
                alert("Failed to initialize payment gateway. Please try again.");
                setLoading(false);
            }
        } catch (e) { 
            alert("Connection error. Could not start payment.");
            setLoading(false);
        }
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

    // 🚀 LIVE DOWNLOAD (FIXED FOR CORS & CINEMATIC MEDIA)
    const handleDownload = async (filePath) => {
        // 1. Prevent downloading Cinematic YT videos (They are stream-only)
        if (isCinematic(filePath)) {
            alert("⚠️ Premium Cinematic videos can only be watched inside the app. Direct download is not available.");
            return;
        }

        setDownloadingFile(filePath);
        setDownloadProgress(0);
        setDownloadSpeed('Connecting to server...');
        setDownloadETA('...');

        const url = getCleanUrl(filePath);
        let startTime = Date.now();
        let lastLoadedBytes = 0;
        let lastTime = startTime;

        try {
            // 🔥 SUPER FIX: Use our Backend Proxy to bypass all CORS issues
            const response = await axios.post(`${API_BASE}/proxy-download`, 
                { fileUrl: url },
                {
                    responseType: 'blob', 
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
                }
            );

            // Process and save the blob
            const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = urlBlob;
            
            // Extract a proper filename, removing any query parameters
            const fileName = filePath.substring(filePath.lastIndexOf('/') + 1).split('?')[0] || 'Snevio_Premium_Media';
            link.setAttribute('download', fileName);
            
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(urlBlob);

            setDownloadingFile(null);
            
            // Sync Download Count
            if (activeFolder && activeFolder.downloadLimit > 0) {
                const newCount = (activeFolder.downloadCount || 0) + 1;
                setActiveFolder({ ...activeFolder, downloadCount: newCount });
                setFolders(folders.map(f => f.folderName === activeFolder.folderName ? { ...f, downloadCount: newCount } : f));
                axios.post(`${API_BASE}/update-download-count`, { mobile: syncUser.mobile, folderName: activeFolder.folderName }).catch(err => console.log("Failed to sync count", err));
            }

        } catch (error) {
            console.error("Download failed", error);
            alert("Download Failed. Server might be busy. Try again.");
            setDownloadingFile(null);
        }
    };

    // ✅ NEW CART & BOOKING LOGIC (FIXED: Takes Discounted Price)
    const handleAddToCart = (service) => {
        if(cart.find(item => item._id === service._id)) return alert("This service is already in your cart!");
        
        // 🛠️ BUG FIX: Pick finalPrice if available, else startingPrice
        const priceToCharge = service.finalPrice || service.startingPrice;
        
        const itemToAdd = {
            ...service,
            startingPrice: priceToCharge, // We overwrite startingPrice with the actual price to charge
            addedBy: service.addedBy || 'Snevio', // ✅ Fallback added here
            addedAt: Date.now()
        };

        setCart([itemToAdd, ...cart]);
        alert("Service added to Cart!");
        setSelectedServiceModal(null);
    };

    const handleRemoveFromCart = (id) => {
        setCart(cart.filter(item => item._id !== id));
    };

    const handleDirectBook = async (service) => {
        if (!window.confirm(`Confirm Direct Booking for ${service.title}?`)) return;

        setLoading(true);
        try {
            // 🛠️ BUG FIX: Pick finalPrice if available, else startingPrice
            const priceToCharge = service.finalPrice || service.startingPrice;
            
            const itemToBook = {
                ...service,
                startingPrice: priceToCharge // Send the discounted price to backend
            };

            const res = await axios.post(`${API_BASE}/checkout-cart`, {
                mobile: syncUser.mobile,
                items: [itemToBook]
            });
            
            if (res.data.success) {
                alert(`Booking Request Sent to Provider: ${service.addedBy || 'Snevio'}\nAmount: ₹${priceToCharge}`);
                setSelectedServiceModal(null);
                setCurrentTab('BOOKINGS');
                fetchServicesAndBookings(syncUser.mobile);
            }
        } catch (e) {
            alert("Booking failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleCartCheckout = async () => {
        const hasChangedItems = cart.some(cartItem => {
            const liveItem = availableServices.find(s => s._id === cartItem._id);
            return liveItem && (liveItem.startingPrice !== cartItem.startingPrice || liveItem.title !== cartItem.title);
        });

        if (hasChangedItems) {
            alert("⚠️ Some items in your cart have been updated by the provider. Please recheck the details and continue.");
            const updatedCart = cart.map(cartItem => {
                const liveItem = availableServices.find(s => s._id === cartItem._id);
                return liveItem ? { ...liveItem, addedAt: cartItem.addedAt, isChanged: true } : cartItem;
            });
            setCart(updatedCart);
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/checkout-cart`, {
                mobile: syncUser.mobile,
                items: cart
            });

            if (res.data.success) {
                alert(`Successfully checked out ${cart.length} items! Request routing to providers...`);
                setCart([]); 
                setShowCartModal(false);
                setCurrentTab('BOOKINGS');
                fetchServicesAndBookings(syncUser.mobile);
            }
        } catch (e) {
            alert("Checkout failed.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ EMERGENCY BOOKING LOGIC WITH GPS LIVE LOCATION
    const processEmergencyBooking = async (e) => {
        e.preventDefault();
        
        // 👑 VIP Check
        const isVipUser = activeSubscription?.type === 'VIP';
        const emergencyCost = isVipUser ? 0 : 50;

        if (wallet.coins < emergencyCost) {
            alert(`You need at least ${emergencyCost} coins for Emergency Booking. Please recharge your wallet.`);
            setShowEmergencyModal(false);
            setShowWalletModal(true);
            return;
        }

        setLoading(true);

        // Fetch GPS Location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    sendEmergencyToBackend(position.coords.latitude, position.coords.longitude);
                },
                async (error) => {
                    alert("Location access denied. Using only typed location.");
                    sendEmergencyToBackend(null, null); // Send without GPS
                }
            );
        } else {
            sendEmergencyToBackend(null, null); // Geolocation not supported
        }
    };

    const sendEmergencyToBackend = async (lat, long) => {
        try {
            const res = await axios.post(`${API_BASE}/emergency-booking`, {
                mobile: syncUser.mobile,
                reason: emergencyData.reason,
                location: emergencyData.location,
                lat: lat,
                long: long
            });

            if (res.data.success) {
                setWallet(res.data.wallet); 
                alert("Payment Successful! Connecting to Customer Care...");
                setShowEmergencyModal(false);
                setEmergencyData({ reason: '', location: '' });
                fetchServicesAndBookings(syncUser.mobile);
                
                // Connect Call
                window.location.href = "tel:+917828011282"; 
            }
        } catch (err) {
            alert("Failed to process payment.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ USER ACCEPTS PROPOSAL & PAYS ADVANCE VIA INSTAMOJO
    const handleAcceptProposal = async () => {
        if (!viewProposalBooking) return;
        if (!window.confirm(`You will be redirected to the payment gateway to pay ₹${viewProposalBooking.proposal?.advanceAmount}. Proceed?`)) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/create-payment`, {
                amount: viewProposalBooking.proposal.advanceAmount,
                purpose: `Booking Advance - ${viewProposalBooking.type}`,
                buyer_name: syncUser.name || 'Snevio User',
                email: profileData.email || 'dummy@snevio.com',
                phone: syncUser.mobile,
                itemType: 'BOOKING',           // Backed ko batayega ki ye booking hai
                itemValue: viewProposalBooking._id // Backend ko booking ki ID dega
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });

            if (res.data.success && res.data.paymentUrl) {
                // 🚀 Redirect to Instamojo
                window.location.href = res.data.paymentUrl;
            } else {
                alert("Failed to initialize payment gateway. Please try again.");
                setLoading(false);
            }
        } catch (e) {
            console.error("Booking Payment Error:", e);
            alert("Error connecting to payment gateway.");
            setLoading(false);
        }
    };

    // --- RENDER TABS ---
    const renderContent = () => {
        if (currentTab === 'SERVICES') return renderServicesTab();
        if (currentTab === 'BOOKINGS') return renderBookingsTab();
        if (currentTab === 'HISTORY') return renderHistoryTab();
        if (currentTab === 'PROFILE') return renderProfileTab();
        if (currentTab === 'SHARED') return renderSharedTab();
        if (currentTab === 'SELECTIONS') return renderSelectionsTab(); // 👈 SMART SELECTION
        return renderHomeTab();
    };

    // ==============================================================
    // ✨ SMART ALBUM SELECTION ENGINE (UI)
    // ==============================================================
    const handleSelectionToggle = (url) => {
        setSelectionDraft(prev => prev.includes(url) ? prev.filter(item => item !== url) : [...prev, url]);
    };

    // 🔥 NAYA: LAZY LOADING FETCH FUNCTION (Saves RAM and Loads Fast)
    const openSmartAlbum = async (sel) => {
        setLoading(true); // 1200+ इमेजेज लोड होने तक स्क्रीन पर लोडर दिखाएगा
        try {
            const token = getValidToken();
            // बैकएंड से पूरा भारी फोल्डर मंगाओ
            const res = await axios.post(`${API_BASE}/get-selection-folder-data`, { projectId: sel._id }, { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (res.data.success && res.data.data) {
                const fullProject = res.data.data;
                
                // अब पूरे डेटा के साथ फोल्डर खोलो
                setActiveSelectionProject(fullProject); 
                setCurrentTab('SELECTIONS'); 
                
                const isFam = fullProject.clientMobile !== syncUser?.mobile;
                const initialDraft = fullProject.images.filter(img => isFam ? (img.selectedBy && img.selectedBy.includes(syncUser?.mobile)) : img.status === 'selected').map(i => i.url);
                setSelectionDraft(initialDraft); 
            } else {
                alert("Failed to load full album data. Please try again.");
            }
        } catch (error) {
            console.error("Fetch full album error:", error);
            alert("Network error while loading album.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ NEW: Auto-Save Draft (Without changing phase)
    const saveDraftOnly = async () => {
        if (!activeSelectionProject) return false;
        try {
            await axios.post(`${API_BASE}/update-album-selection`, {
                projectId: activeSelectionProject._id,
                selectedImages: selectionDraft,
                isFinal: false,
                isFamilyMember: activeSelectionProject.clientMobile !== syncUser?.mobile,
                userMobile: syncUser.mobile,
                isDraftOnly: true // Custom flag for backend to just update images array, not phase
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            return true;
        } catch (e) {
            console.error("Draft save error", e);
            return false;
        }
    };

    // 🔄 NAYA: SILENT AUTO-SAVE LOGIC
    // Jab bhi user photo select/deselect karega, 3 second baad background me chup-chaap save ho jayega.
    useEffect(() => {
        if (!activeSelectionProject) return;
        
        const autoSaveTimer = setTimeout(() => {
            saveDraftOnly();
        }, 3000); // 3 Seconds wait

        return () => clearTimeout(autoSaveTimer);
    }, [selectionDraft, activeSelectionProject]);

    const submitPhaseSelection = async (finalPhase = false) => {
        if (!activeSelectionProject) return;

        // ✅ Check if the current user is a Family Member (not the main client)
        const isFamilyMember = activeSelectionProject.clientMobile !== syncUser?.mobile;
        
        let msg = `Move to Phase ${activeSelectionProject.currentPhase + 1}? Only selected images will be carried forward.`;
        
        if (isFamilyMember && finalPhase) {
            msg = `Send your selected images to the main client? You won't be able to change them later.`;
        } else if (!isFamilyMember && finalPhase) {
            msg = `⚠️ WARNING: This is the Final Preview!\n\nUnselected images will be permanently removed from your album (kept in 7-day backup).\nAre you ready to submit your final selection to the studio?`;
        }
        
        if (!window.confirm(msg)) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/update-album-selection`, {
                projectId: activeSelectionProject._id,
                selectedImages: selectionDraft,
                isFinal: finalPhase,
                isFamilyMember: isFamilyMember, // ✅ Sent to backend
                userMobile: syncUser.mobile
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });

            if (res.data.success) {
                alert(`✅ ${res.data.message}`);
                setShowSelectionReview(false);
                setActiveSelectionProject(null);
                setCurrentTab('HOME'); // 👈 NEW: Redirect to Home to avoid blank screen
                fetchUserSelections(syncUser.mobile);
            } else {
                alert(`❌ ${res.data.message}`);
            }
        } catch(e) {
            console.error("Submission Error:", e);
            alert("Server Error: Failed to save your selection. Please try again."); 
        } finally {
            setLoading(false);
        }
    };

    // 🔄 HANDLE SHIFT IMAGE BETWEEN ALBUMS (SPLIT MODE LOGIC)
    const handleShiftImageClick = (e, imgData) => {
        e.stopPropagation();
        
        // 🛑 If currently in Split Mode, open Copy/Move Popup instead of directly shifting
        if (activeSelectionProject?.status === 'Split Mode') {
            setSplitActionModal({ show: true, image: imgData });
            return;
        }
        
        // Regular Shift (if not in Split Mode yet, but just organizing)
        executeShift(activeSelectionProject._id, imgData.url, imgData.albumTag === 'Album 2' ? 'Album 1' : 'Album 2', false);
    };

    const executeShift = async (projectId, imageUrl, targetAlbum, isCopy) => {
        setIsProcessingSplit(true);
        try {
            // Note: Update backend if you want true 'Copy' logic to duplicate array entry. 
            // Currently, it acts as a move for simplicity as requested earlier.
            const res = await axios.post(`${API_BASE}/move-image-album`, {
                projectId, imageUrl, targetAlbum
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            
            if(res.data.success) {
                setActiveSelectionProject(prev => ({
                    ...prev,
                    images: prev.images.map(img => img.url === imageUrl ? { ...img, albumTag: targetAlbum } : img)
                }));
                setSplitActionModal({ show: false, image: null });
            }
        } catch (err) {
            alert("Action failed. Please check connection.");
        } finally {
            setIsProcessingSplit(false);
        }
    };

    const submitInitialFinalData = async () => {
        if(!window.confirm("Are you sure you want to finalize these photos and send them to the Studio?")) return;
        setLoading(true);
        try {
            // 1. Pehle images ko as 'FINAL' save karo
            await axios.post(`${API_BASE}/update-album-selection`, {
                projectId: activeSelectionProject._id,
                selectedImages: selectionDraft,
                isFinal: true,
                isFamilyMember: false,
                userMobile: syncUser.mobile
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });

            // 2. Fir 72-hour wala timer start karo
            const res = await axios.post(`${API_BASE}/projects/${activeSelectionProject._id}/final-submit`, {}, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            
            if (res.data.success) {
                // 🔥 NAYA FIX: Popup hata diya, ab direct 72h window dikhega aur data update ho jayega
                setActiveSelectionProject(res.data.project); 
                setShowSelectionReview(false);
            }
        } catch (err) { alert("Failed to submit data."); }
        finally { setLoading(false); }
    };

    const renderSelectionsTab = () => {
        if (!activeSelectionProject) return null;

        const isFamilyMember = activeSelectionProject.clientMobile !== syncUser?.mobile;
        let currentFamilyMember = null;
        if (isFamilyMember && activeSelectionProject.familyMembers) {
            currentFamilyMember = activeSelectionProject.familyMembers.find(f => f.mobile === syncUser?.mobile);
        }
        const hasFamilySubmitted = currentFamilyMember?.hasSubmitted || false;
        // ✅ Add 'Confirmed' and 'Submitted' to completed states so user sees the Read-Only folders
        const isMainProjectCompleted = ['Completed', 'Confirmed', 'Submitted'].includes(activeSelectionProject.status);
        const isInviteExpired = currentFamilyMember?.expiryDate && new Date(currentFamilyMember.expiryDate) < new Date();

        // Helper for Long Press Preview (Read-Only)
        const startPressRO = (e, url) => { touchRef.current.isLong = false; touchRef.current.startY = e.clientY || (e.touches && e.touches[0].clientY) || 0; touchRef.current.timer = setTimeout(() => { touchRef.current.isLong = true; setPreviewMedia(url); }, 500); };
        const movePressRO = (e) => { const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0; if (Math.abs(currentY - touchRef.current.startY) > 15) { clearTimeout(touchRef.current.timer); } };
        const endPressRO = () => { clearTimeout(touchRef.current.timer); };

        // 🛑 1. SESSION MISSED (Family Member)
        if (isFamilyMember && !hasFamilySubmitted && (isInviteExpired || isMainProjectCompleted)) {
            return (
                <div className="folders-view" style={{ paddingBottom: '100px' }}>
                    <div style={{ position: 'sticky', top: 0, zIndex: 90, background: '#f5f6fa', paddingBottom: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                        <div className="folder-header-nav" style={{background: 'linear-gradient(90deg, #e74c3c, #c0392b)', margin: 0, padding: '15px 20px', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(231, 76, 60, 0.4)'}}>
                            <BackButton onClick={() => { setActiveSelectionProject(null); setCurrentTab('HOME'); }} />
                            <h3 style={{color: '#fff', margin: 0, fontSize: '16px'}}>Session Closed</h3>
                        </div>
                        <div style={{ padding: '20px', background: '#fdedec', border: '1px solid #e74c3c', margin: '20px', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '40px', marginBottom: '10px' }}>⏳</div>
                            <h3 style={{ margin: '0 0 10px 0', color: '#c0392b' }}>Oops! Session Missed.</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
                                {isMainProjectCompleted ? "The main client has already finalized the album and sent it to the studio." : "Your invitation link has expired."}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        // 🛑 2. THANK YOU READ-ONLY (Family Member)
        if (isFamilyMember && hasFamilySubmitted) {
            const myVotedImages = activeSelectionProject.images.filter(img => img.selectedBy && img.selectedBy.includes(syncUser?.mobile));
            return (
                <div className="folders-view" style={{ paddingBottom: '100px' }}>
                    <div style={{ position: 'sticky', top: 0, zIndex: 90, background: '#f5f6fa', paddingBottom: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                        <div className="folder-header-nav" style={{background: 'linear-gradient(90deg, #27ae60, #2ecc71)', margin: 0, padding: '15px 20px', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(46, 204, 113, 0.4)'}}>
                            <BackButton onClick={() => { setActiveSelectionProject(null); setCurrentTab('HOME'); }} />
                            <h3 style={{color: '#fff', margin: 0, fontSize: '16px'}}>Selection Submitted</h3>
                        </div>
                        <div style={{ padding: '15px', background: '#e8f8f5', border: '1px solid #2ecc71', margin: '15px', borderRadius: '10px', textAlign: 'center' }}>
                            <h3 style={{ margin: '0 0 5px 0', color: '#27ae60' }}>🎉 Thank You, {currentFamilyMember?.nickname}!</h3>
                            <p style={{ margin: 0, fontSize: '13px', color: '#2c3e50', fontWeight: 'bold' }}>Your votes have been sent to the main client.</p>
                        </div>
                    </div>
                    <div className="ud-grid-vip" style={{ padding: '15px' }}>
                        {myVotedImages.map((img, idx) => (
                            <div key={idx} onPointerDown={(e) => startPressRO(e, img.url)} onPointerMove={movePressRO} onPointerUp={endPressRO} onPointerLeave={() => clearTimeout(touchRef.current.timer)} className="gallery-item-vip" style={{ position: 'relative', height: '150px', background: '#000', borderRadius: '12px', overflow: 'hidden', border: '3px solid #2ecc71', cursor: 'zoom-in' }}>
                                <img src={getCleanUrl(img.url, true)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', top: '10px', right: '10px', width: '25px', height: '25px', borderRadius: '50%', background: '#2ecc71', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                    <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>❤️</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // 🛑 3. MAIN CLIENT COMPLETED READ-ONLY (CLEAN UI WITH 72H LOGIC)
        if (!isFamilyMember && isMainProjectCompleted) {
            // 🔥 FIX: Ab ye un photos ko bhi dikhayega jo draft me hain
            const finalSelectedImages = activeSelectionProject.images.filter(img => selectionDraft.includes(img.url) || img.status === 'selected');
                        
            // Split Logic Check
            const album1Images = finalSelectedImages.filter(img => !img.albumTag || img.albumTag === 'Album 1');
            const album2Images = finalSelectedImages.filter(img => img.albumTag === 'Album 2');
            const hasSplitAlbums = album2Images.length > 0;

            // ⏱️ 72-Hour Logic Calculation
            const submittedAt = activeSelectionProject.finalSubmissionDate ? new Date(activeSelectionProject.finalSubmissionDate) : new Date(activeSelectionProject.updatedAt || Date.now());
            const hoursPassed = (Date.now() - submittedAt) / (1000 * 60 * 60);
            const isFrozen = activeSelectionProject.isFrozen || activeSelectionProject.status === 'Production';
            const is72hActive = hoursPassed < 72 && !isFrozen;
            
            const timeLeftMs = Math.max(0, (72 * 60 * 60 * 1000) - (Date.now() - submittedAt));
            const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
            const minsLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
            
            // 🔥 NAYA: Lock edits if 1 hour or less is left (3600000 ms = 1 Hour)
            const isLastHour = timeLeftMs > 0 && timeLeftMs <= 3600000; 

            let imagesToShow = [];
            if (viewingSplitAlbum === 'Album 2') {
                imagesToShow = album2Images;
            } else if (viewingSplitAlbum === 'Album 1') {
                imagesToShow = album1Images;
            } else if (showSelectedPreview || activeSelectionProject.status === 'Split Mode') {
                imagesToShow = finalSelectedImages;
            }

            return (
                <div className="folders-view" style={{ paddingBottom: '100px' }}>
                    <div style={{ position: 'sticky', top: 0, zIndex: 90, background: '#f5f6fa', paddingBottom: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                        {/* 🔥 NATIVE PREMIUM HEADER & BACK BUTTON */}
                        <div className="folder-header-nav" style={{ background: 'linear-gradient(90deg, #27ae60, #2ecc71)', margin: 0, padding: '15px 20px', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(39, 174, 96, 0.4)', borderBottom: '1px solid rgba(255,255,255,0.2)', position: 'relative', zIndex: 10 }}>
                            <BackButton onClick={() => { 
                                if (showSelectedPreview) setShowSelectedPreview(false);
                                else if (viewingSplitAlbum) setViewingSplitAlbum(null); 
                                else { setActiveSelectionProject(null); setCurrentTab('HOME'); }
                            }} />
                            <h3 style={{color: '#fff', margin: 0, fontSize: '16px', letterSpacing: '0.5px', textShadow: '0 2px 4px rgba(0,0,0,0.2)'}}>
                                {showSelectedPreview ? 'Selected Photos 👁️' : (viewingSplitAlbum ? viewingSplitAlbum : 'Album in Production 🚚')}
                            </h3>
                        </div>
                    </div>

                    {/* 🌟 OVERVIEW CARD (Clean UI - DYNAMIC SPLIT STATE) */}
                    {!viewingSplitAlbum && !showSelectedPreview && (
                        <div style={{ padding: '15px' }}>
                            <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', padding: '20px', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '80px', opacity: 0.1 }}>📸</div>
                                <h3 style={{ margin: '0 0 10px 0', color: '#2ecc71', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    🎉 Success! Selection Sent
                                </h3>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                    <span style={{ color: '#aaa', fontSize: '13px' }}>Total Photos Approved:</span>
                                    <strong style={{ fontSize: '16px', color: '#2ecc71' }}>{finalSelectedImages.length}</strong>
                                </div>
                                
                                {/* 🔥 DYNAMIC SPLIT ALBUM OVERVIEW STATS */}
                                {(hasSplitAlbums || activeSelectionProject.status === 'Split Mode') && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                                        <span style={{ color: '#aaa', fontSize: '13px' }}>✂️ Split Active:</span>
                                        <strong style={{ fontSize: '13px', color: '#3498db' }}>Main ({album1Images.length}) | Mini ({album2Images.length})</strong>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                    <span style={{ color: '#aaa', fontSize: '13px' }}>Expected Delivery:</span>
                                    <strong style={{ fontSize: '13px', color: '#e67e22' }}>{activeSelectionProject.expectedDeliveryDate ? new Date(activeSelectionProject.expectedDeliveryDate).toLocaleDateString() : 'Updating soon...'}</strong>
                                </div>

                                {/* 📂 DYNAMIC CLICKABLE FOLDERS */}
                                {(hasSplitAlbums || activeSelectionProject.status === 'Split Mode') ? (
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <div onClick={() => setViewingSplitAlbum('Album 1')} style={{ flex: 1, background: 'rgba(52, 152, 219, 0.15)', border: '1px dashed #3498db', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: '0.3s' }}>
                                            <span style={{ fontSize: '24px', marginBottom: '5px' }}>📘</span>
                                            <h4 style={{ margin: 0, color: '#3498db', fontSize: '12px' }}>Main Album</h4>
                                            <span style={{ fontSize: '10px', color: '#aaa', marginTop: '3px' }}>{album1Images.length} Photos</span>
                                        </div>
                                        <div onClick={() => setViewingSplitAlbum('Album 2')} style={{ flex: 1, background: 'rgba(243, 156, 18, 0.15)', border: '1px dashed #f39c12', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: '0.3s' }}>
                                            <span style={{ fontSize: '24px', marginBottom: '5px' }}>📙</span>
                                            <h4 style={{ margin: '0', color: '#f39c12', fontSize: '12px' }}>Mini Album</h4>
                                            <span style={{ fontSize: '10px', color: '#aaa', marginTop: '3px' }}>{album2Images.length} Photos</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div onClick={() => setShowSelectedPreview(true)} style={{ background: 'rgba(52, 152, 219, 0.15)', border: '1px dashed #3498db', padding: '15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: '0.3s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '24px' }}>📂</span>
                                            <div>
                                                <h4 style={{ margin: 0, color: '#3498db', fontSize: '14px' }}>View Final Selection</h4>
                                                <span style={{ fontSize: '11px', color: '#aaa' }}>Tap to see your chosen photos</span>
                                            </div>
                                        </div>
                                        <span style={{ color: '#3498db', fontWeight: 'bold', background: '#fff', padding: '3px 8px', borderRadius: '5px', fontSize: '11px' }}>👁️ View</span>
                                    </div>
                                )}
                            </div>

                            {/* ⏱️ 72 HOUR LOGIC & BUTTONS */}
                            <div style={{ marginTop: '20px' }}>
                                {is72hActive ? (
                                    <div style={{ background: '#fdf2e9', border: '1px solid #f39c12', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                                        <h4 style={{ margin: '0 0 10px 0', color: '#d35400', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            ⏱️ Modification Window Open
                                        </h4>
                                        <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#555', lineHeight: '1.4' }}>
                                            You have <strong>{hoursLeft}h {minsLeft}m</strong> left to make any changes to your selection before the studio starts designing.
                                        </p>

                                        {/* 🔥 DYNAMIC SPLIT MODE BUTTON/INDICATOR */}
                                        {(hasSplitAlbums || activeSelectionProject.status === 'Split Mode') ? (
                                            <div style={{ marginBottom: '15px', background: 'rgba(46, 204, 113, 0.1)', border: '1px dashed #2ecc71', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#27ae60', fontWeight: 'bold', textAlign: 'center' }}>
                                                ✨ Split Mode Enabled. Shift your photos into Album 2 using the 🔄 icon on the images below.
                                            </div>
                                        ) : (!activeSelectionProject.isSplitRequested && !activeSelectionProject.splitCompleted && (
                                            <button onClick={() => setShowFinalOptModal(true)} disabled={isLastHour} style={{ width: '100%', marginBottom: '15px', background: isLastHour ? '#bdc3c7' : 'linear-gradient(90deg, #8e44ad, #3498db)', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: isLastHour ? 'not-allowed' : 'pointer', fontSize: '13px', boxShadow: '0 4px 10px rgba(142, 68, 173, 0.3)' }}>
                                                {isLastHour ? '🔒 Split Option Locked (Less than 1h left)' : '✂️ Split into 2 Albums (Main & Mini)'}
                                            </button>
                                        ))}

                                        {isLastHour && (
                                            <div style={{ color: '#e74c3c', fontSize: '11px', textAlign: 'center', marginBottom: '10px', fontWeight: 'bold' }}>
                                                ⚠️ Time is almost up! Edits and album splitting are now locked to prevent delays.
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button disabled={isLastHour || activeSelectionProject.status === 'Split Mode'} onClick={async () => {
                                                if(window.confirm("Go back to edit mode? Your submission will be paused.")) {
                                                    setLoading(true);
                                                    try {
                                                        await axios.post(`${API_BASE}/update-album-selection`, { 
                                                            projectId: activeSelectionProject._id, 
                                                            selectedImages: selectionDraft, 
                                                            isFinal: false,
                                                            userMobile: syncUser.mobile
                                                        }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                                                        
                                                        setActiveSelectionProject({...activeSelectionProject, status: 'In Progress'});
                                                        setSelectionSubView('MY_SELECTION'); 
                                                    } catch(e) { alert("Error going back."); }
                                                    setLoading(false);
                                                }
                                            }} style={{ flex: 1, background: (isLastHour || activeSelectionProject.status === 'Split Mode') ? '#ecf0f1' : '#fff', color: (isLastHour || activeSelectionProject.status === 'Split Mode') ? '#bdc3c7' : '#f39c12', border: `1px solid ${(isLastHour || activeSelectionProject.status === 'Split Mode') ? '#bdc3c7' : '#f39c12'}`, padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: (isLastHour || activeSelectionProject.status === 'Split Mode') ? 'not-allowed' : 'pointer', fontSize: '12px' }}>
                                                {(isLastHour || activeSelectionProject.status === 'Split Mode') ? '🔒 Edit Locked' : '✏️ Edit Selection'}
                                            </button>
                                            
                                            {/* Freeze button only visible if NOT in split mode */}
                                            {activeSelectionProject.status !== 'Split Mode' && (
                                                <button onClick={async () => {
                                                    if(window.confirm("Are you 100% sure? This will lock the album immediately and notify the studio to start production.")) {
                                                        setLoading(true);
                                                        try {
                                                            const res = await axios.post(`${API_BASE}/freeze-selection`, { projectId: activeSelectionProject._id }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                                                            if (res.data.success) {
                                                                setActiveSelectionProject({...activeSelectionProject, isFrozen: true, status: 'Confirmed'});
                                                                alert("✅ Album Locked! Studio has been notified to start production.");
                                                            } else {
                                                                alert("❌ Failed to lock album.");
                                                            }
                                                        } catch(e) { 
                                                            alert("Server Error.");
                                                        }
                                                        setLoading(false);
                                                    }
                                                }} style={{ flex: 1, background: '#2ecc71', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', boxShadow: '0 4px 10px rgba(46, 204, 113, 0.3)' }}>
                                                    ✅ Freeze & Send
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ background: '#f9f9f9', border: '1px dashed #ccc', padding: '15px', borderRadius: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '24px', marginBottom: '5px' }}>🔒</div>
                                        <h4 style={{ margin: '0 0 5px 0', color: '#333', fontSize: '14px' }}>Selection Locked</h4>
                                        <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#777' }}>The 72-hour window has closed. Production is underway.</p>
                                        <button onClick={() => alert("To reopen the selection, please ask the Studio or use 50 Coins. (Feature coming soon!)")} style={{ background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                                            ⚠️ Request Re-open
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 👁️ PREVIEW SELECTED IMAGES (CATEGORIZED FOLDER VIEW) */}
                    {(showSelectedPreview || viewingSplitAlbum || activeSelectionProject.status === 'Split Mode') ? (
                        <div style={{ padding: '15px' }}>
                            <div style={{ background: '#e8f8f5', padding: '10px', borderRadius: '8px', color: '#27ae60', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', marginBottom: '20px', border: '1px solid #2ecc71' }}>
                                👁️ Read-Only Mode: You are viewing your final selected photos.
                            </div>
                            
                            {(() => {
                                if (imagesToShow.length === 0) {
                                    return <p style={{ color: '#888', textAlign: 'center' }}>No images found in this album.</p>;
                                }

                                // 1. Group by Album Tag, then by Sub-Folder (Wedding, Haldi, etc.)
                                const groupedData = {};
                                imagesToShow.forEach(img => {
                                    const aTag = img.albumTag || 'Album 1';
                                    const sTag = img.subFolder || 'Main Event';
                                    if (!groupedData[aTag]) groupedData[aTag] = {};
                                    if (!groupedData[aTag][sTag]) groupedData[aTag][sTag] = [];
                                    groupedData[aTag][sTag].push(img);
                                });

                                // 2. Render the Categorized UI
                                return Object.keys(groupedData).sort().map((albumName) => {
                                    const subFolders = groupedData[albumName];
                                    const totalInAlbum = Object.values(subFolders).flat().length;
                                    
                                    return (
                                        <div key={albumName} style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #1a1a2e, #0f172a)', padding: '20px', borderRadius: '15px', border: `1px solid ${albumName === 'Album 2' ? '#f39c12' : '#3498db'}`, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
                                            {/* 🔥 Premium Glow Effect */}
                                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', height: '150px', background: albumName === 'Album 2' ? 'rgba(243, 156, 18, 0.15)' : 'rgba(52, 152, 219, 0.15)', borderRadius: '50%', filter: 'blur(40px)', zIndex: 0 }}></div>
                                            
                                            <h3 style={{ 
                                                color: albumName === 'Album 2' ? '#f1c40f' : '#3498db', 
                                                borderBottom: '1px solid rgba(255,255,255,0.05)', 
                                                paddingBottom: '10px', 
                                                marginBottom: '20px',
                                                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', position: 'relative', zIndex: 2
                                            }}>
                                                {albumName === 'Album 2' ? '📙' : '📘'} {albumName} 
                                                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '3px 10px', borderRadius: '12px', marginLeft: 'auto' }}>
                                                    {totalInAlbum} Photos
                                                </span>
                                            </h3>
                                            
                                            {Object.keys(subFolders).sort().map(folderName => (
                                                <div key={folderName} style={{ marginBottom: '25px', position: 'relative', zIndex: 2 }}>
                                                    <h4 style={{ margin: '0 0 12px 0', color: '#e0e0e0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.5px' }}>
                                                        📁 {folderName} <span style={{fontSize: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#bdc3c7', padding: '3px 8px', borderRadius: '8px', fontWeight: 'bold'}}>{subFolders[folderName].length} Items</span>
                                                    </h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
                                                        {subFolders[folderName].map((img, idx) => (
                                                            <div key={idx} onPointerDown={(e) => startPressRO(e, img.url)} onPointerMove={movePressRO} onPointerUp={endPressRO} onPointerLeave={() => clearTimeout(touchRef.current.timer)} className="gallery-item-vip" style={{ position: 'relative', height: '120px', background: '#000', borderRadius: '8px', overflow: 'hidden', border: `2px solid ${albumName === 'Album 2' ? '#f39c12' : '#3498db'}`, cursor: 'zoom-in' }}>
                                                                <img src={getCleanUrl(img.url, true)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                <div style={{ position: 'absolute', top: '5px', right: '5px', width: '20px', height: '20px', borderRadius: '50%', background: albumName === 'Album 2' ? '#f39c12' : '#3498db', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                                                    <span style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>✓</span>
                                                                </div>
                                                                
                                                                {/* Shift Button if in Split Mode */}
                                                                {activeSelectionProject.status === 'Split Mode' && (
                                                                    <button 
                                                                        onPointerDown={(e) => e.stopPropagation()} 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSplitActionModal({ show: true, image: img });
                                                                        }}
                                                                        style={{ position: 'absolute', bottom: '5px', right: '5px', background: '#fff', border: 'none', width: '25px', height: '25px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', zIndex: 15 }}
                                                                        title="Copy/Move Image"
                                                                    >
                                                                        🔄
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : null}
                </div>
            );
        }
        if (!isFamilyMember && selectionSubView === 'OVERVIEW') {
            const familyMembers = activeSelectionProject.familyMembers || [];
            const completedMembers = familyMembers.filter(fm => fm.hasSubmitted);

            return (
                <div className="folders-view" style={{ paddingBottom: '100px' }}>
                    <div style={{ position: 'sticky', top: 0, zIndex: 90, background: '#f5f6fa', paddingBottom: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                        <div className="folder-header-nav" style={{background: 'linear-gradient(90deg, #8e44ad, #9b59b6)', margin: 0, padding: '15px 20px', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(142, 68, 173, 0.4)'}}>
                            <BackButton onClick={() => { setActiveSelectionProject(null); setSelectionDraft([]); setCurrentTab('HOME'); }} />
                            <h3 style={{color: '#fff', margin: 0, fontSize: '16px'}}>{activeSelectionProject.folderName}</h3>
                        </div>
                    </div>

                    <div style={{ padding: '20px' }}>
                        <h3 style={{color: '#333', marginBottom: '15px'}}>Main Folders</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
                            {/* YOUR SELECTION */}
                            <div onClick={() => setSelectionSubView('MY_SELECTION')} style={{ background: '#2c3e50', padding: '20px', borderRadius: '15px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', border: '2px solid #3498db' }}>
                                <div style={{fontSize: '40px', marginBottom: '10px'}}>👑</div>
                                <h4 style={{color: '#fff', margin: 0}}>Your Selection</h4>
                                <p style={{color: '#3498db', fontSize: '11px', margin: '5px 0 0 0'}}>Phase {activeSelectionProject.currentPhase}</p>
                            </div>
                            
                            {/* MERGED FOLDER */}
                            <div onClick={() => setSelectionSubView('MERGED_VIEW')} style={{ background: '#1a1a2e', padding: '20px', borderRadius: '15px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', border: '2px solid #f1c40f' }}>
                                <div style={{fontSize: '40px', marginBottom: '10px'}}>🗂️</div>
                                <h4 style={{color: '#fff', margin: 0}}>Merged Folder</h4>
                                <p style={{color: '#f1c40f', fontSize: '11px', margin: '5px 0 0 0'}}>{(activeSelectionProject.mergedImages || []).length} Items</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{color: '#333', margin: 0, fontSize: '16px'}}>Family Members</h3>
                            {completedMembers.length > 0 && (
                                <button onClick={() => { setMembersToMerge(completedMembers.map(m => m.mobile)); setShowMergeModal(true); }} style={{ background: '#e67e22', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px', boxShadow: '0 4px 10px rgba(230, 126, 34, 0.3)' }}>
                                    🔄 Merge Folders
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {familyMembers.map((fm, idx) => (
                                <div key={idx} onClick={() => {
                                    if (fm.hasSubmitted) { setViewingMember(fm); setSelectionSubView('MEMBER_VIEW'); }
                                }} style={{ background: '#fff', padding: '15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: fm.hasSubmitted ? '4px solid #2ecc71' : '4px solid #f1c40f', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', cursor: fm.hasSubmitted ? 'pointer' : 'default', opacity: fm.hasSubmitted ? 1 : 0.7 }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 5px 0', color: '#2c3e50', fontSize: '15px' }}>📁 {fm.nickname}</h4>
                                        <span style={{ fontSize: '11px', color: '#7f8c8d' }}>{fm.mobile}</span>
                                    </div>
                                    <span style={{ background: fm.hasSubmitted ? 'rgba(46, 204, 113, 0.1)' : 'rgba(241, 196, 15, 0.1)', color: fm.hasSubmitted ? '#27ae60' : '#f39c12', padding: '4px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 'bold' }}>
                                        {fm.hasSubmitted ? '✅ Completed' : '⏳ Pending'}
                                    </span>
                                </div>
                            ))}
                            {familyMembers.length === 0 && <p style={{color: '#888', fontSize: '13px', textAlign: 'center', marginTop: '20px'}}>No family members invited yet.</p>}
                        </div>
                    </div>

                    {/* MERGE MODAL */}
                    {showMergeModal && (
                        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                            <div style={{ background: '#fff', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '350px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Merge Folders</h3>
                                <p style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>Select members to merge. Duplicates will be removed automatically.</p>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', maxHeight: '150px', overflowY: 'auto' }}>
                                    {completedMembers.map((fm, idx) => (
                                        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#333', padding: '10px', background: '#f9f9f9', borderRadius: '8px' }}>
                                            <input type="checkbox" checked={membersToMerge.includes(fm.mobile)} onChange={(e) => {
                                                if (e.target.checked) setMembersToMerge([...membersToMerge, fm.mobile]);
                                                else setMembersToMerge(membersToMerge.filter(m => m !== fm.mobile));
                                            }} style={{ width: '18px', height: '18px', accentColor: '#e67e22' }} />
                                            📁 {fm.nickname}
                                        </label>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => setShowMergeModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#eee', color: '#333', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                                    <button onClick={async () => {
                                        if(membersToMerge.length === 0) return alert("Select at least one member!");
                                        setLoading(true);
                                        try {
                                            // Deduplication Logic
                                            let mergedSet = new Set(activeSelectionProject.mergedImages || []);
                                            activeSelectionProject.images.forEach(img => {
                                                if (img.selectedBy && img.selectedBy.some(m => membersToMerge.includes(m))) mergedSet.add(img.url);
                                            });
                                            const finalMergedArray = Array.from(mergedSet);
                                            
                                            // Save to DB
                                            await axios.post(`${API_BASE}/save-merged-selection`, { projectId: activeSelectionProject._id, mergedImages: finalMergedArray }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                                            
                                            setActiveSelectionProject({...activeSelectionProject, mergedImages: finalMergedArray});
                                            setShowMergeModal(false);
                                            alert("✅ Folders merged successfully into 'Merged Folder'!");
                                        } catch(e) { alert("Merge failed. Try again."); } 
                                        finally { setLoading(false); }
                                    }} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#e67e22', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>{loading ? '...' : 'Merge Selected'}</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // 👁️ 5. MAIN CLIENT - VIEWING A SPECIFIC MEMBER'S FOLDER
        if (!isFamilyMember && selectionSubView === 'MEMBER_VIEW' && viewingMember) {
            const memberImages = activeSelectionProject.images.filter(img => img.selectedBy && img.selectedBy.includes(viewingMember.mobile));
            return (
                <div className="folders-view" style={{ paddingBottom: '100px' }}>
                    <div style={{ position: 'sticky', top: 0, zIndex: 90, background: '#f5f6fa', paddingBottom: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                        <div className="folder-header-nav" style={{background: 'linear-gradient(90deg, #3498db, #2980b9)', margin: 0, padding: '15px 20px', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(52, 152, 219, 0.4)'}}>
                            <BackButton onClick={() => setSelectionSubView('OVERVIEW')} />
                            <h3 style={{color: '#fff', margin: 0, fontSize: '16px'}}>📁 {viewingMember.nickname}</h3>
                        </div>
                        <p style={{textAlign: 'center', fontSize: '13px', color: '#555', margin: '15px 0 0 0', fontWeight: 'bold'}}>Total Selected: {memberImages.length}</p>
                    </div>
                    <div className="ud-grid-vip" style={{ padding: '15px' }}>
                        {memberImages.map((img, idx) => (
                            <div key={idx} onPointerDown={(e) => startPressRO(e, img.url)} onPointerMove={movePressRO} onPointerUp={endPressRO} onPointerLeave={() => clearTimeout(touchRef.current.timer)} className="gallery-item-vip" style={{ position: 'relative', height: '150px', background: '#000', borderRadius: '12px', overflow: 'hidden', border: '2px solid #3498db', cursor: 'zoom-in' }}>
                                <img src={getCleanUrl(img.url, true)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <div style={{ position: 'absolute', top: '10px', right: '10px', width: '25px', height: '25px', borderRadius: '50%', background: '#3498db', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ color: '#fff', fontSize: '12px' }}>❤️</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // 🗂️ 6. MAIN CLIENT - VIEWING THE MERGED FOLDER
        if (!isFamilyMember && selectionSubView === 'MERGED_VIEW') {
            const mergedImages = activeSelectionProject.mergedImages || [];
            return (
                <div className="folders-view" style={{ paddingBottom: '100px' }}>
                    <div style={{ position: 'sticky', top: 0, zIndex: 90, background: '#f5f6fa', paddingBottom: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                        <div className="folder-header-nav" style={{background: 'linear-gradient(90deg, #f1c40f, #f39c12)', margin: 0, padding: '15px 20px', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(241, 196, 15, 0.4)'}}>
                            <BackButton color="#000" border="rgba(0,0,0,0.3)" onClick={() => setSelectionSubView('OVERVIEW')} />
                            <h3 style={{color: '#000', margin: 0, fontSize: '16px'}}>🗂️ Merged Folder</h3>
                        </div>
                        <div style={{ padding: '15px' }}>
                            <p style={{textAlign: 'center', fontSize: '13px', color: '#555', margin: '0 0 15px 0'}}>This folder contains {mergedImages.length} deduplicated images from your family.</p>
                            {mergedImages.length > 0 && (
                                <button onClick={() => {
                                    const newDraft = new Set([...selectionDraft, ...mergedImages]);
                                    setSelectionDraft(Array.from(newDraft));
                                    alert("✅ All merged images have been imported to 'Your Selection'!");
                                    setSelectionSubView('MY_SELECTION');
                                }} style={{ width: '100%', background: '#2ecc71', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(46, 204, 113, 0.3)' }}>
                                    📥 Import All to 'Your Selection'
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="ud-grid-vip" style={{ padding: '15px' }}>
                        {mergedImages.map((url, idx) => (
                            <div key={idx} onPointerDown={(e) => startPressRO(e, url)} onPointerMove={movePressRO} onPointerUp={endPressRO} onPointerLeave={() => clearTimeout(touchRef.current.timer)} className="gallery-item-vip" style={{ position: 'relative', height: '150px', background: '#000', borderRadius: '12px', overflow: 'hidden', border: '2px solid #f1c40f', cursor: 'zoom-in' }}>
                                <img src={getCleanUrl(url)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                        ))}
                        {mergedImages.length === 0 && <p style={{textAlign: 'center', width: '100%', color: '#888', gridColumn: '1 / -1'}}>No images merged yet.</p>}
                    </div>
                </div>
            );
        }

        // 👑 7. ACTIVE GRID (Main Client's "MY_SELECTION" OR Family Member's Active Phase)
        const currentPhase = activeSelectionProject.currentPhase || 1;
        const effectiveTotalPhases = isFamilyMember ? Math.min(2, activeSelectionProject.totalPhases) : activeSelectionProject.totalPhases;
        const isFinalPhase = currentPhase >= effectiveTotalPhases;
        
        const totalAllowed = (activeSelectionProject.sheetLimit || 0) * (activeSelectionProject.imagesPerSheet || 0);
        
        let allImagesInCurrentPhase = [];
        let missedImages = [];

        if (currentPhase === 1) {
            allImagesInCurrentPhase = activeSelectionProject.images;
        } else {
            allImagesInCurrentPhase = activeSelectionProject.images.filter(img => selectionDraft.includes(img.url));
            missedImages = activeSelectionProject.images.filter(img => !selectionDraft.includes(img.url));
        }

        // ✅ UNIQUE FOLDERS EXTRACTION FOR TABS & WIZARD
        const categoriesSet = new Set();
        allImagesInCurrentPhase.forEach(img => {
            if (img.subFolder && img.subFolder !== 'Main Event') categoriesSet.add(img.subFolder);
        });
        
        const realFolders = Array.from(categoriesSet);
        
        // ✅ WIZARD LOGIC FOR PHASE 1 & 2
        // If it's Phase 3 (Final Phase), we DON'T want folders or wizard steps. Just "ALL".
        const categories = (isFinalPhase && !isFamilyMember) ? ['ALL'] : (realFolders.length > 0 ? [...realFolders, 'ALL'] : ['ALL']);
        
        // Keep component state in sync with categories
        if (wizardCategories.length !== categories.length) {
            setWizardCategories(categories);
            if (activeSelectionCategory === 'ALL' && realFolders.length > 0 && !isFinalPhase) {
                setActiveSelectionCategory(realFolders[0]); // Start at first folder automatically
            }
        }

        // ✅ FILTER IMAGES BASED ON SELECTED FOLDER TAB
        const displayedImages = activeSelectionCategory === 'ALL' 
            ? allImagesInCurrentPhase 
            : allImagesInCurrentPhase.filter(img => img.subFolder === activeSelectionCategory);

        // Wizard Navigation Logic
        const currentIndex = categories.indexOf(activeSelectionCategory);
        const isLastFolder = currentIndex === categories.length - 1; // Usually 'ALL'
        const nextFolder = !isLastFolder ? categories[currentIndex + 1] : null;

        const handleNextFolder = async () => {
            if (nextFolder) {
                setLoading(true);
                await saveDraftOnly(); // Silently save progress
                setActiveSelectionCategory(nextFolder);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setLoading(false);
            }
        };

        // Active Long Press Helpers
        const startPress = (e, url) => { touchRef.current.isLong = false; touchRef.current.startY = e.clientY || (e.touches && e.touches[0].clientY) || 0; touchRef.current.timer = setTimeout(() => { touchRef.current.isLong = true; setPreviewMedia(url); }, 500); };
        const movePress = (e) => { const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0; if (Math.abs(currentY - touchRef.current.startY) > 15) { clearTimeout(touchRef.current.timer); } };
        const endPress = (actionFn) => { clearTimeout(touchRef.current.timer); if (!touchRef.current.isLong) actionFn(); };
        
        return (
            <div className="folders-view" style={{ paddingBottom: '120px' }}>
                <div style={{ position: 'sticky', top: 0, zIndex: 90, background: '#f5f6fa', paddingBottom: '5px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                    <div className="folder-header-nav" style={{background: isFinalPhase ? 'linear-gradient(90deg, #e74c3c, #c0392b)' : 'linear-gradient(90deg, #8e44ad, #9b59b6)', margin: 0, padding: '15px 20px', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'}}>
                        <BackButton onClick={async () => { 
                            await saveDraftOnly(); // 👈 Back dabane par turant save hoga
                            if(isFamilyMember) { setActiveSelectionProject(null); setSelectionDraft([]); setCurrentTab('HOME'); setActiveSelectionCategory('ALL'); }
                            else { setSelectionSubView('OVERVIEW'); setActiveSelectionCategory('ALL'); }
                        }} />
                        <h3 style={{color: '#fff', margin: 0, fontSize: '15px'}}>{isFamilyMember ? 'Family Selection' : (isFinalPhase ? 'Final Album Review' : `Phase ${currentPhase} Selection`)}</h3>
                    </div>

                    <div style={{ padding: '15px', background: '#fff', margin: '10px 15px', borderRadius: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{fontSize: '14px', color: '#2c3e50'}}>🎯 Selection Target ({activeSelectionProject.folderName})</strong>
                            <div style={{ color: '#8e44ad', fontSize: '12px', fontWeight: 'bold' }}>
                                {selectionDraft.length} / {totalAllowed > 0 ? totalAllowed : '∞'} Photos
                            </div>
                        </div>
                        {/* 🟢 Progress Bar */}
                        <div style={{ width: '100%', background: '#ecf0f1', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                            <div style={{ 
                                width: `${totalAllowed > 0 ? Math.min((selectionDraft.length / totalAllowed) * 100, 100) : 100}%`, 
                                background: selectionDraft.length > totalAllowed ? '#e74c3c' : 'linear-gradient(90deg, #8e44ad, #3498db)', 
                                height: '100%', transition: 'width 0.3s ease' 
                            }}></div>
                        </div>
                        {selectionDraft.length > totalAllowed && (
                            <p style={{ margin: '5px 0 0 0', fontSize: '10px', color: '#e74c3c', fontWeight: 'bold', textAlign: 'right' }}>
                                ⚠️ Extra Charges Applying
                            </p>
                        )}
                    </div>

                    {/* Split Tip has been moved to the final 72H screen! */}
                    
                    {/* ✅ STEPPER WIZARD UI (Replaces confusing Folder Tabs) */}
                    {categories.length > 1 && !isFinalPhase && (
                        <div style={{ margin: '0 15px 15px 15px', background: '#fff', padding: '12px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Step {currentIndex + 1} of {categories.length}
                                </span>
                                <strong style={{ fontSize: '16px', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    {activeSelectionCategory === 'ALL' ? '🌟 Final Review' : `📁 ${activeSelectionCategory}`}
                                </strong>
                            </div>
                            <div style={{ background: 'rgba(52, 152, 219, 0.1)', color: '#3498db', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                                {activeSelectionCategory === 'ALL' ? allImagesInCurrentPhase.length : allImagesInCurrentPhase.filter(i => i.subFolder === activeSelectionCategory).length} Photos
                            </div>
                        </div>
                    )}

                    {/* ✅ ADD MISSED IMAGES BUTTON (Only Phase 2 & Phase 3 Edit Mode) */}
                    {currentPhase > 1 && activeSelectionCategory === 'ALL' && (
                        <div style={{ padding: '0 15px', display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowMissedImages(true)} style={{ flex: 1, background: '#fdf2e9', color: '#e67e22', border: '1px dashed #e67e22', padding: '8px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                                ♻️ Missed Images ({missedImages.length})
                            </button>
                            
                            {/* 🔙 EDIT BUTTON FOR PHASE 3 */}
                            {isFinalPhase && !isFamilyMember && (
                                <button onClick={async () => {
                                    if(window.confirm("Go back to Phase 2 to edit your selection?")) {
                                        setLoading(true);
                                        try {
                                            await axios.post(`${API_BASE}/update-album-selection`, { projectId: activeSelectionProject._id, currentPhase: currentPhase - 1 }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                                            setActiveSelectionProject({...activeSelectionProject, currentPhase: currentPhase - 1});
                                            setActiveSelectionCategory(realFolders.length > 0 ? realFolders[0] : 'ALL');
                                        } catch(e) { alert("Error going back."); }
                                        setLoading(false);
                                    }
                                }} style={{ background: '#34495e', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                                    ⬅️ Edit Selection
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ✅ SUMMARY BILLING (Only for Final Phase) */}
                {isFinalPhase && !isFamilyMember && (
                    <div style={{ padding: '0 15px 15px 15px' }}>
                        <div style={{ background: '#fff', padding: '15px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '14px' }}>Billing Summary</h3>
                            {(() => {
                                const extraImages = Math.max(0, selectionDraft.length - totalAllowed);
                                const extraSheets = activeSelectionProject.imagesPerSheet > 0 ? Math.ceil(extraImages / activeSelectionProject.imagesPerSheet) : 0;
                                const extraCost = extraSheets * (activeSelectionProject.costPerExtraSheet || 0);
                                return (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px' }}><span style={{color: '#7f8c8d', fontSize: '12px'}}>Free Allowance</span><strong style={{color: '#2ecc71', fontSize: '12px'}}>{totalAllowed} Photos</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px' }}><span style={{color: '#7f8c8d', fontSize: '12px'}}>Extra Sheets Required</span><strong style={{color: extraSheets > 0 ? '#e74c3c' : '#2ecc71', fontSize: '12px'}}>{extraSheets} Sheets</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fdf2e9', padding: '10px', borderRadius: '8px' }}><span style={{color: '#d35400', fontWeight: 'bold', fontSize: '13px'}}>Estimated Extra Charge</span><strong style={{color: '#d35400', fontSize: '14px'}}>₹{extraCost}</strong></div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}

                <div className="ud-grid-vip" style={{ padding: '0 15px 15px 15px' }}>
                    {displayedImages.map((img, idx) => {
                        const isSelected = selectionDraft.includes(img.url);
                        
                        let voterNames = [];
                        if (!isFamilyMember && img.selectedBy && img.selectedBy.length > 0 && activeSelectionProject.familyMembers) {
                            img.selectedBy.forEach(voterMobile => {
                                if (voterMobile !== activeSelectionProject.clientMobile) {
                                    const fm = activeSelectionProject.familyMembers.find(f => f.mobile === voterMobile);
                                    if (fm && fm.nickname) voterNames.push(fm.nickname);
                                }
                            });
                        }

                        const currentAlbum = img.albumTag || 'Album 1';
                        const borderColor = isSelected ? (currentAlbum === 'Album 2' ? '#f39c12' : '#3498db') : '#ddd';
                        const bgColor = isSelected ? (currentAlbum === 'Album 2' ? '#f39c12' : '#3498db') : 'rgba(255,255,255,0.5)';

                        return (
                                            <div key={idx} 
                                                    onPointerDown={(e) => startPress(e, img.url)} // Fullscreen original quality preview
                                                    onPointerMove={movePress}
                                                    onPointerUp={() => endPress(() => {
                                                        if (isFinalPhase && !isFamilyMember) return; 
                                                        if (currentPhase > 1 && isSelected) setImageToRemove(img.url);
                                                        else handleSelectionToggle(img.url); // Selection hamesha asli URL ke basis par hoga
                                                    })}
                                                    onPointerLeave={() => clearTimeout(touchRef.current.timer)}
                                                    className="gallery-item-vip" 
                                                    style={{ position: 'relative', height: '150px', background: '#000', borderRadius: '12px', overflow: 'hidden', border: `3px solid ${borderColor}`, cursor: (isFinalPhase && !isFamilyMember) ? 'zoom-in' : 'pointer', transition: 'border 0.2s' }}
                                                >
                                                    {/* 🚀 On-The-Fly Compressed Thumbnail for ultra-fast loading */}
                                                    <img src={getCleanUrl(img.url, true)} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isSelected ? 1 : 0.7 }} />
                                                    
                                {/* Checkmark Top Right */}
                                <div style={{ position: 'absolute', top: '10px', right: '10px', width: '25px', height: '25px', borderRadius: '50%', background: bgColor, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'background 0.2s' }}>
                                    {isSelected && <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                                </div>

                                {/* 🏷️ ALBUM TAG LABEL Top Left */}
                                {isSelected && (
                                    <div style={{ position: 'absolute', top: '10px', left: '10px', background: bgColor, color: '#fff', padding: '2px 8px', fontSize: '10px', borderRadius: '4px', fontWeight: 'bold', zIndex: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>
                                        {currentAlbum}
                                    </div>
                                )}

                                {/* 🔄 SHIFT BUTTON Bottom Right */}
                                {isSelected && (
                                    <button 
                                        onPointerDown={(e) => e.stopPropagation()} 
                                        onClick={(e) => handleShiftImageClick(e, img)}
                                        style={{ position: 'absolute', bottom: voterNames.length > 0 ? '35px' : '10px', right: '10px', background: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', zIndex: 15 }}
                                        title={activeSelectionProject?.status === 'Split Mode' ? "Copy/Move Image" : "Shift to other Album"}
                                    >
                                        🔄
                                    </button>
                                )}

                                {voterNames.length > 0 && (
                                    <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.7)', color: '#f1c40f', padding: '4px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold', zIndex: 5, backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '85%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        ❤️ {voterNames.join(', ')}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {displayedImages.length === 0 && <p style={{textAlign: 'center', width: '100%', gridColumn: '1/-1', color: '#888'}}>No images found in this folder.</p>}
                </div>

                {/* ✅ DYNAMIC BOTTOM ACTION BAR (WIZARD & FINAL LOGIC) */}
                <div style={{ position: 'fixed', bottom: '65px', left: 0, width: '100%', background: '#fff', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -5px 15px rgba(0,0,0,0.1)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', zIndex: 100 }}>
                    <div>
                        <span style={{ fontSize: '12px', color: '#7f8c8d', display: 'block' }}>Selected: <strong style={{color: '#2c3e50'}}>{selectionDraft.length}</strong></span>
                        {totalAllowed > 0 && <span style={{ fontSize: '10px', color: selectionDraft.length > totalAllowed ? '#e74c3c' : '#2ecc71', fontWeight: 'bold' }}>Free Limit: {totalAllowed}</span>}
                    </div>
                    
                    {isFinalPhase ? (
                        // ✅ PHASE 3 (FINAL PHASE): Changed to trigger Split Popup logic
                        <button onClick={() => isFamilyMember ? submitPhaseSelection(true) : submitInitialFinalData()} disabled={loading || selectionDraft.length === 0} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(231, 76, 60, 0.4)' }}>
                            {loading ? 'Processing...' : (isFamilyMember ? '🚀 Send to Client' : '🚀 Finalize & Send')}
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                            {/* 🔥 NAYA: Back Button for Wizard */}
                            {currentIndex > 0 && (
                                <button onClick={() => { saveDraftOnly(); setActiveSelectionCategory(categories[currentIndex - 1]); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ background: '#ecf0f1', color: '#333', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                    ⬅️ Back
                                </button>
                            )}
                            
                            {isLastFolder ? (
                                // ✅ PHASE 1 & 2 (ALL TAB): Show "Preview" Button first
                                <button onClick={() => setShowSelectionReview(true)} style={{ flex: 1, background: '#8e44ad', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(142, 68, 173, 0.4)', cursor: 'pointer' }}>
                                    {`Preview Phase ${currentPhase} ➡️`}
                                </button>
                            ) : (
                                // ✅ SPECIFIC FOLDER: Save & Next
                                <button onClick={handleNextFolder} disabled={loading} style={{ flex: 1, background: '#3498db', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(52, 152, 219, 0.4)', cursor: 'pointer' }}>
                                    {loading ? 'Saving...' : `Next: ${nextFolder === 'ALL' ? 'Review' : nextFolder} ➡️`}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* MODALS: REMOVE CONFIRM, MISSED IMAGES, RECOVER CONFIRM, REVIEW/PROMPT */}
                {/* Image Removal Confirm */}
                {imageToRemove && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                        <div style={{ background: '#fff', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '350px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                            <div style={{fontSize: '40px', marginBottom: '10px'}}>🗑️</div>
                            <h3 style={{ color: '#e74c3c', margin: '0 0 10px 0' }}>Remove Image?</h3>
                            <p style={{ color: '#555', fontSize: '13px', marginBottom: '20px' }}>Are you sure you want to discard this image? You can still recover it from 'Missed Images'.</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => setImageToRemove(null)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#eee', color: '#333', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={() => { handleSelectionToggle(imageToRemove); setImageToRemove(null); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#e74c3c', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Yes, Remove</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Missed Images Grid */}
                {showMissedImages && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#f5f6fa', zIndex: 999999, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ background: '#e67e22', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                            <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>♻️ Recover Images</h2>
                            <button onClick={() => { setShowMissedImages(false); setMissedSelection([]); }} style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: '24px', cursor: 'pointer' }}>✖</button>
                        </div>
                        <div className="ud-grid-vip" style={{ padding: '15px', overflowY: 'auto', flex: 1, paddingBottom: '100px' }}>
                            {missedImages.map((img, idx) => {
                                const isMissedSelected = missedSelection.includes(img.url);
                                return (
                                    <div key={idx} onPointerDown={(e) => startPress(e, img.url)} onPointerMove={movePress} onPointerUp={() => endPress(() => {
                                            setMissedSelection(prev => prev.includes(img.url) ? prev.filter(i => i !== img.url) : [...prev, img.url]);
                                        })} onPointerLeave={() => clearTimeout(touchRef.current.timer)} className="gallery-item-vip" style={{ position: 'relative', height: '150px', background: '#000', borderRadius: '12px', overflow: 'hidden', border: isMissedSelected ? '3px solid #e67e22' : '1px solid #ddd', cursor: 'pointer' }}>
                                        <img src={getCleanUrl(img.url, true)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isMissedSelected ? 1 : 0.5 }} />
                                        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '25px', height: '25px', borderRadius: '50%', background: isMissedSelected ? '#e67e22' : 'rgba(255,255,255,0.5)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {isMissedSelected && <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                                        </div>
                                    </div>
                                );
                            })}
                            {missedImages.length === 0 && <p style={{textAlign: 'center', width: '100%', color: '#888', gridColumn: '1 / -1'}}>No missed images available!</p>}
                        </div>
                        {missedSelection.length > 0 && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: '#fff', padding: '15px', boxShadow: '0 -5px 15px rgba(0,0,0,0.1)', zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{fontWeight: 'bold', color: '#e67e22'}}>{missedSelection.length} Selected</span>
                                <button onClick={() => setShowMissedRestoreConfirm(true)} style={{ background: '#e67e22', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Restore Images</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Restore Confirmation Modal */}
                {showMissedRestoreConfirm && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                        <div style={{ background: '#fff', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '350px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                            <div style={{fontSize: '40px', marginBottom: '10px'}}>♻️</div>
                            <h3 style={{ color: '#e67e22', margin: '0 0 10px 0' }}>Restore {missedSelection.length} Images?</h3>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button onClick={() => setShowMissedRestoreConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#eee', color: '#333', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={() => { setSelectionDraft(prev => [...prev, ...missedSelection]); setMissedSelection([]); setShowMissedRestoreConfirm(false); setShowMissedImages(false); alert("✅ Images restored!"); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#e67e22', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Yes, Restore</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ DEEP SUMMARY & REVIEW MODAL (Phase Transition) */}
                {showSelectionReview && !isFinalPhase && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
                        <div style={{ background: '#1a1a2e', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid #3498db', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                            
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                                <h2 style={{ margin: 0, color: '#fff', fontSize: '22px' }}>📊 Phase {currentPhase} Summary</h2>
                                <button onClick={() => setShowSelectionReview(false)} style={{ background: 'transparent', border: 'none', fontSize: '24px', color: '#fff', cursor: 'pointer' }}>✖</button>
                            </div>

                            <div style={{ overflowY: 'auto', paddingRight: '10px', flex: 1 }}>
                                <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
                                    Before proceeding to Phase {currentPhase + 1}, here is a detailed breakdown of your current selection for <strong>{activeSelectionProject.folderName}</strong>.
                                </p>

                                {/* Stats Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                                    <div style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #2ecc71' }}>
                                        <div style={{ fontSize: '30px', fontWeight: 'bold', color: '#2ecc71' }}>{selectionDraft.length}</div>
                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Selected</div>
                                    </div>
                                    <div style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', textAlign: 'center', border: '1px solid #f1c40f' }}>
                                        <div style={{ fontSize: '30px', fontWeight: 'bold', color: '#f1c40f' }}>{missedImages.length}</div>
                                        <div style={{ fontSize: '11px', color: '#888', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Left Behind</div>
                                    </div>
                                </div>

                                {/* Folder-wise Breakdown */}
                                {realFolders.length > 0 && (
                                    <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', marginBottom: '25px' }}>
                                        <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '14px' }}>📁 Category Breakdown</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {realFolders.map((folderName, idx) => {
                                                const selectedInFolder = activeSelectionProject.images.filter(img => img.subFolder === folderName && selectionDraft.includes(img.url)).length;
                                                const totalInFolder = activeSelectionProject.images.filter(img => img.subFolder === folderName).length;
                                                return (
                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#333', borderBottom: idx !== realFolders.length - 1 ? '1px solid #ddd' : 'none', paddingBottom: '5px' }}>
                                                        <span>{folderName}</span>
                                                        <strong style={{ color: '#2980b9' }}>{selectedInFolder} / {totalInFolder}</strong>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Warning / Next Steps */}
                                <div style={{ background: 'rgba(231,76,60,0.1)', padding: '15px', borderRadius: '10px', borderLeft: '4px solid #e74c3c', marginBottom: '10px' }}>
                                    <h4 style={{ margin: '0 0 5px 0', color: '#e74c3c', fontSize: '13px' }}>⚠️ What happens next?</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#ccc', lineHeight: '1.4' }}>
                                        When you start Phase {currentPhase + 1}, the <strong>{missedImages.length} unselected images</strong> will be hidden to help you focus. You can still recover them from the 'Missed Images' bin if needed.
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                                <button onClick={async () => {
                                    setLoading(true);
                                    try {
                                        await axios.post(`${API_BASE}/update-album-selection`, { projectId: activeSelectionProject._id, currentPhase: currentPhase + 1 }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                                        setActiveSelectionProject({...activeSelectionProject, currentPhase: currentPhase + 1});
                                        setActiveSelectionCategory(realFolders.length > 0 ? realFolders[0] : 'ALL');
                                        setShowSelectionReview(false);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    } catch(e) { alert("Error progressing."); }
                                    setLoading(false);
                                }} disabled={loading} style={{ background: '#3498db', color: '#fff', border: 'none', padding: '15px', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(52, 152, 219, 0.3)' }}>
                                    {loading ? 'Starting...' : `🚀 Start Phase ${currentPhase + 1} Now`}
                                </button>
                                
                                <button onClick={async () => {
                                    setLoading(true);
                                    await saveDraftOnly(); // 👈 Yahan properly database me data jayega
                                    alert("Progress saved! You can resume from Home anytime.");
                                    setShowSelectionReview(false);
                                    setActiveSelectionProject(null);
                                    setCurrentTab('HOME');
                                    setLoading(false);
                                }} disabled={loading} style={{ background: 'transparent', color: '#aaa', border: '1px solid #555', padding: '12px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>
                                    {loading ? 'Saving...' : '⏸️ Save & Do it Later'}
                                </button>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        );
    };

   // 👇 NAYA FUNCTION (SHARED TAB KE LIYE - CLEAN UI & WHATSAPP REMINDER) 👇
    const renderSharedTab = () => {
        // ✅ BUG FIX: Define FRONTEND_URL to avoid undefined error
        const FRONTEND_URL = "https://snevio.com/"; // Make sure this points to your frontend app

        const displayedList = sharedTabFilter === 'RECEIVED' ? sharedWithMe : sharedByMe;
        
        // ✅ Extract Album Selection Invites automatically
        const receivedInvites = mySelections.filter(sel => sel.clientMobile !== syncUser?.mobile && (sel.familyMembers || []).some(f => f.mobile === syncUser?.mobile));
        const sentInvitesList = mySelections.filter(sel => sel.clientMobile === syncUser?.mobile && (sel.familyMembers || []).length > 0);
        
        const displayedInvites = sharedTabFilter === 'RECEIVED' ? receivedInvites : sentInvitesList;

        return (
            <div className="folders-view" style={{ paddingBottom: '20px' }}>
                <div className="welcome-banner" style={{ background: 'linear-gradient(135deg, #8e44ad, #3498db)' }}>
                    <h1>🔐 Media Sharing</h1>
                    <p>Manage access to premium content & album collabs.</p>
                </div>
                
                {/* 🎛️ TOGGLE BUTTONS */}
                <div style={{ display: 'flex', gap: '10px', padding: '20px 20px 0 20px' }}>
                    <button onClick={() => setSharedTabFilter('RECEIVED')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: sharedTabFilter === 'RECEIVED' ? '#8e44ad' : '#1a1a2e', color: sharedTabFilter === 'RECEIVED' ? '#fff' : '#888' }}>
                        📥 Received ({sharedWithMe.length + receivedInvites.length})
                    </button>
                    <button onClick={() => setSharedTabFilter('SENT')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: sharedTabFilter === 'SENT' ? '#3498db' : '#1a1a2e', color: sharedTabFilter === 'SENT' ? '#fff' : '#888' }}>
                        📤 Shared By Me ({sharedByMe.length + sentInvitesList.length})
                    </button>
                </div>

                {fetchingShared ? <div className="loading-state-vip">Checking for shared data...</div> : (
                    <div className="ud-grid-vip mt-20" style={{ padding: '20px' }}>
                        
                        {/* 🌟 1. RENDER ALBUM COLLAB INVITES FIRST (Top Priority) */}
                        {displayedInvites.map((sel, idx) => (
                            <div key={`invite-${idx}`} className="gallery-item-vip" style={{ display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #2c3e50, #8e44ad)', borderRadius: '12px', overflow: 'hidden', border: '2px solid #f1c40f', boxShadow: '0 5px 15px rgba(241, 196, 15, 0.2)' }}>
                                <div style={{ padding: '20px', textAlign: 'center', flex: 1 }}>
                                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>🤝</div>
                                    <h3 style={{ color: '#fff', margin: '0 0 5px 0', fontSize: '16px' }}>Album Collaboration</h3>
                                    <p style={{ color: '#f1c40f', margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold' }}>{sel.folderName}</p>
                                    
                                    {/* ✅ Cleaned UI for Invited Members List */}
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '11px', color: '#ccc', marginBottom: '20px', lineHeight: '1.4' }}>
                                        {sharedTabFilter === 'RECEIVED' 
                                            ? `Invited by: ${sel.clientMobile}` 
                                            : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <span style={{ color: '#fff', borderBottom: '1px solid #555', paddingBottom: '5px' }}>Invited Members:</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                                                    {sel.familyMembers.map((f, i) => (
                                                        <span key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', color: '#fff' }}>
                                                            <strong style={{color: '#f1c40f'}}>{f.nickname || 'Family'}</strong> ({f.mobile})
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>}
                                    </div>
                                    
                                    {/* ✅ Stacked Buttons Layout */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button onClick={() => openSmartAlbum(sel)} style={{ background: '#f1c40f', color: '#000', border: 'none', padding: '12px', width: '100%', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            {sharedTabFilter === 'RECEIVED' ? 'View & Vote ❤️' : 'Open Selection Folder'}
                                        </button>

                                        {/* ✅ Single WhatsApp Reminder Button (Only for Sender) */}
                                        {sharedTabFilter === 'SENT' && (
                                            <button onClick={() => {
                                                const text = `Hi Family! I have securely shared the "${sel.folderName}" album with you. \n\n🔒 *Security Note:* To view the photos, you must log in using the exact mobile number I invited you with.\n\nClick here to login and vote:`;
                                                if (navigator.share) {
                                                    navigator.share({ title: 'Secure Album Invite', text: text, url: FRONTEND_URL });
                                                } else {
                                                    navigator.clipboard.writeText(`${text} ${FRONTEND_URL}`);
                                                    alert("Secure invite message copied! Paste it in your Family WhatsApp group.");
                                                }
                                            }} style={{ background: '#25D366', color: '#fff', border: 'none', padding: '12px', width: '100%', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                💬 Share Secure Link in WhatsApp
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* 🌟 2. RENDER NORMAL SHARED MEDIA */}
                        {displayedList.length > 0 ? displayedList.map((item, idx) => (
                            <div key={idx} className="gallery-item-vip" style={{ display: 'flex', flexDirection: 'column', background: '#1a1a2e', borderRadius: '12px', overflow: 'hidden', border: sharedTabFilter === 'RECEIVED' ? '1px solid #8e44ad' : '1px solid #3498db' }}>
                                
                                <div style={{ position: 'relative', height: '180px', cursor: 'pointer', overflow: 'hidden', background: '#000' }} onClick={() => {
                                    if(sharedTabFilter === 'RECEIVED') {
                                        setSelectedMedia({ url: item.mediaUrl, type: item.mediaType, isUnlocked: true, isShared: true, senderName: item.senderName, expiryDate: item.expiryDate });
                                    }
                                }}>
                                    {isCinematic(item.mediaUrl) ? (
                                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2c3e50, #1a1a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f1c40f' }}>
                                            <span style={{ fontSize: '40px', marginBottom: '5px' }}>🎬</span>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>CINEMATIC</span>
                                        </div>
                                    ) : isVideo(item.mediaUrl) ? (
                                        <>
                                            <video src={getCleanUrl(item.mediaUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '16px'}}>▶️</div>
                                        </>
                                    ) : (
                                        <img src={getCleanUrl(item.mediaUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}
                                    
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: sharedTabFilter === 'RECEIVED' ? 'rgba(231,76,60,0.9)' : 'rgba(52,152,219,0.9)', color: '#fff', padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>
                                        {sharedTabFilter === 'RECEIVED' ? 'View Only' : 'Shared Out'}
                                    </div>
                                </div>
                                
                                <div style={{ padding: '10px 12px', background: '#0f172a' }}>
                                    <p style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>
                                        {sharedTabFilter === 'RECEIVED' ? `From: ${item.senderName}` : `To: ${item.receiverMobile}`}
                                    </p>
                                    <p style={{ margin: '0 0 10px 0', color: '#e74c3c', fontSize: '11px', fontWeight: 'bold' }}>⏳ Expires: {new Date(item.expiryDate).toLocaleString()}</p>
                                    
                                    {sharedTabFilter === 'SENT' && (
                                        <button onClick={() => handleRevokeAccess(item._id)} style={{ width: '100%', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid #e74c3c', padding: '8px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                                            ❌ Revoke Access
                                        </button>
                                    )}
                                </div>
                            </div>
                        )) : null}

                        {/* NO DATA STATE */}
                        {displayedList.length === 0 && sentInvitesList.length === 0 && receivedInvites.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#888', width: '100%', gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                                <h3>No Media Here</h3>
                                <p style={{ fontSize: '13px' }}>{sharedTabFilter === 'RECEIVED' ? 'No one has shared media or albums with you yet.' : 'You haven\'t shared anything securely yet.'}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ✅ NATIVE SERVICES TAB (UPDATED WITH DISCOUNT & OFFER UI)
    const renderServicesTab = () => {
        return (
            <div className="services-tab-wrapper" style={{ padding: '20px', paddingBottom: '20px' }}>
                <div className="section-header" style={{ marginBottom: '20px' }}>
                    <h2 style={{ color: '#fff', fontSize: '22px', margin: 0 }}>Explore Services</h2>
                    <p style={{ color: '#aaa', fontSize: '13px', margin: '5px 0 0 0' }}>Discover premium packages curated just for you.</p>
                </div>

                {servicesLoading ? (
                    // Native Skeleton Loading
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ background: '#1a1a2e', borderRadius: '15px', padding: '15px', display: 'flex', gap: '15px', opacity: 0.7, animation: 'pulse 1.5s infinite' }}>
                                <div style={{ width: '80px', height: '80px', background: '#333', borderRadius: '10px' }}></div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ height: '15px', width: '80%', background: '#333', borderRadius: '5px' }}></div>
                                    <div style={{ height: '10px', width: '50%', background: '#333', borderRadius: '5px' }}></div>
                                    <div style={{ height: '30px', width: '90px', background: '#333', borderRadius: '8px', alignSelf: 'flex-end', marginTop: 'auto' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {availableServices.length > 0 ? availableServices.map((service, idx) => (
                            <div key={idx} onClick={() => setSelectedServiceModal(service)} style={{ background: '#1a1a2e', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 8px 20px rgba(0,0,0,0.3)', cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }}>
                                
                                {/* ✅ DISPLAY OFFER TAG IF AVAILABLE */}
                                {service.offerText && (
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: '#e74c3c', color: '#fff', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', animation: 'pulse 2s infinite' }}>
                                        {service.offerText}
                                    </div>
                                )}

                                {service.imageUrl && (
                                    <div style={{ height: '140px', width: '100%', overflow: 'hidden', background: '#2c3e50' }}>
                                        {/* 🚀 SMART FIX: getCleanUrl compression + lazy loading added */}
                                        <img src={getCleanUrl(service.imageUrl, true)} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={service.title} />
                                    </div>
                                )}
                                <div style={{ padding: '15px' }}>
                                    <h3 style={{ color: '#fff', margin: '0 0 5px 0', fontSize: '18px' }}>{service.title}</h3>
                                    <p style={{ color: '#aaa', margin: '0 0 15px 0', fontSize: '13px', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{service.shortDescription}</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        
                                        {/* ✅ DISPLAY DISCOUNTED PRICE VS ORIGINAL PRICE */}
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {service.discountPercentage > 0 ? (
                                                <>
                                                    <span style={{ color: '#888', textDecoration: 'line-through', fontSize: '12px' }}>₹{service.startingPrice}</span>
                                                    <span style={{ color: '#2ecc71', fontWeight: 'bold', fontSize: '18px' }}>₹{service.finalPrice}</span>
                                                </>
                                            ) : (
                                                <span style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '16px' }}>₹{service.startingPrice}</span>
                                            )}
                                        </div>

                                        <button style={{ background: '#3498db', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px' }}>View & Book</button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
                                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🚧</div>
                                <h3>No Services Available</h3>
                                <p style={{ fontSize: '13px' }}>We are updating our catalog. Please check back later!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // ✅ NATIVE BOOKINGS TAB (UPDATED TO SHOW DENIAL REASON)
    const renderBookingsTab = () => {
        const filteredBookings = bookingFilter === 'ALL' 
            ? userBookings 
            : userBookings.filter(b => {
                if (bookingFilter === 'PENDING PAYMENT') return b.status === 'Pending Payment';
                return b.status.toUpperCase() === bookingFilter.toUpperCase();
            });

        return (
            <div className="bookings-tab-wrapper" style={{ padding: '20px', paddingBottom: '20px' }}>
                <div className="section-header" style={{ marginBottom: '20px' }}>
                    <h2 style={{ color: '#fff', fontSize: '22px', margin: 0 }}>My Bookings</h2>
                    <p style={{ color: '#aaa', fontSize: '13px', margin: '5px 0 0 0' }}>Track the status of your active and past services.</p>
                </div>

                {/* Native Filter Chips */}
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '15px' }}>
                    {['ALL', 'PENDING', 'PENDING PAYMENT', 'CONFIRMED', 'DECLINED'].map(type => (
                        <button 
                            key={type} 
                            onClick={() => setBookingFilter(type)} 
                            style={{ 
                                padding: '8px 15px', 
                                borderRadius: '20px', 
                                border: 'none', 
                                fontSize: '12px', 
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                background: bookingFilter === type ? '#3498db' : '#2c3e50',
                                color: bookingFilter === type ? '#fff' : '#aaa'
                            }}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                {servicesLoading ? (
                    <p style={{ color: '#888', textAlign: 'center', marginTop: '30px' }}>Loading bookings...</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {filteredBookings.length > 0 ? filteredBookings.map((booking, idx) => {
                            let statusColor = '#f1c40f'; // Pending
                            if(booking.status === 'Confirmed' || booking.status === 'Accepted') statusColor = '#2ecc71';
                            if(booking.status === 'Pending Payment') statusColor = '#e67e22'; // Orange for Payment Pending
                            if(booking.status === 'Declined') statusColor = '#e74c3c';

                            return (
                                <div key={idx} style={{ background: '#1a1a2e', borderRadius: '15px', padding: '15px', borderLeft: `5px solid ${statusColor}`, position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                        <h3 style={{ color: '#fff', margin: 0, fontSize: '16px' }}>{booking.type}</h3>
                                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: statusColor, background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '5px', textAlign: 'right' }}>
                                            {booking.status}
                                        </span>
                                    </div>
                                    <p style={{ color: '#aaa', margin: '0 0 5px 0', fontSize: '12px' }}>📅 Date: {new Date(booking.createdAt).toLocaleDateString()}</p>
                                    <p style={{ color: '#aaa', margin: 0, fontSize: '12px' }}>💰 Estimated: ₹{booking.amount || 'TBD'}</p>
                                    
                                    {/* ✅ SHOW DECLINE REASON IF ANY */}
                                    {booking.status === 'Declined' && booking.cancelReason && (
                                        <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px dashed #e74c3c', color: '#e74c3c', padding: '10px', borderRadius: '8px', marginTop: '10px', fontSize: '12px' }}>
                                            <strong>Reason for decline:</strong> {booking.cancelReason}
                                        </div>
                                    )}

                                    {/* Action Buttons depending on status */}
                                    <div style={{ textAlign: 'right', marginTop: '10px' }}>
                                        {booking.status === 'Pending Payment' ? (
                                            <button onClick={() => setViewProposalBooking(booking)} style={{ background: '#f39c12', border: 'none', color: '#fff', padding: '8px 15px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', animation: 'pulse 2s infinite' }}>
                                                ⚠️ View Proposal & Pay
                                            </button>
                                        ) : (
                                            <button onClick={() => setViewBookingDetails(booking)} style={{ background: 'transparent', border: '1px solid #3498db', color: '#3498db', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>View Details</button>
                                        )}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
                                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📅</div>
                                <h3>No Bookings Found</h3>
                                <p style={{ fontSize: '13px' }}>You don't have any bookings matching this filter.</p>
                                <button onClick={() => setCurrentTab('SERVICES')} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', marginTop: '10px', cursor: 'pointer' }}>Explore Services</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderHistoryTab = () => {
        const historyData = wallet?.history || [ { date: new Date().toLocaleDateString(), action: "Account Registered", amount: "0", type: "neutral" } ];
        return (
            <div className="history-tab-vip" style={{padding: '20px', paddingBottom: '20px'}}>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{fontWeight: 'bold', color: item.type === 'credit' ? '#f1c40f' : item.type === 'debit' ? '#e74c3c' : '#fff', fontSize: '16px'}}>{item.amount}</div>
                                <button onClick={() => downloadInvoice(item)} style={{ background: 'transparent', border: '1px solid #3498db', color: '#3498db', padding: '4px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                    🧾 Receipt
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderProfileTab = () => {
        // 🔥 Bug Fix for Location: Ensure it's always a string, not an object.
        const safeLocation = typeof profileData.location === 'object' ? '' : profileData.location;

        // 📝 VIEW 1: EDIT PROFILE MODE (Clean Form)
        if (editProfileMode) {
            return (
                <div style={{ padding: '20px', paddingBottom: '100px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                        <BackButton onClick={() => setEditProfileMode(false)} label="Cancel" />
                        <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>Edit Profile</h2>
                    </div>
                    
                    <div style={{ background: '#1a1a2e', padding: '25px', borderRadius: '20px', border: '1px solid #333' }}>
                        <div className="dp-section" style={{ marginBottom: '20px', textAlign: 'center' }}>
                            <div className="dp-circle" style={{ width: '90px', height: '90px', margin: '0 auto', border: '3px solid #d4af37', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '35px', background: '#2c3e50', overflow: 'hidden' }}>
                                {profileImage ? <img src={profileImage} alt="DP" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <span style={{color: '#d4af37'}}>{editName ? editName.charAt(0).toUpperCase() : 'U'}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
                                <label style={{ background: '#3498db', color: '#fff', padding: '6px 15px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    Change <input type="file" accept="image/*" hidden onChange={handleDPChange}/>
                                </label>
                                <button onClick={handleRemoveDP} style={{ background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', border: '1px solid #e74c3c', padding: '6px 15px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Remove</button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ color: '#888', fontSize: '12px', marginBottom: '5px', display: 'block' }}>Full Name</label>
                                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#0f172a', border: '1px solid #444', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ color: '#888', fontSize: '12px', marginBottom: '5px', display: 'block' }}>Email Address</label>
                                <input type="email" value={profileData.email} onChange={(e) => setProfileData({...profileData, email: e.target.value})} placeholder="Add your email" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#0f172a', border: '1px solid #444', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ color: '#888', fontSize: '12px', marginBottom: '5px', display: 'block' }}>Location / City</label>
                                <input type="text" value={safeLocation} onChange={(e) => setProfileData({...profileData, location: e.target.value})} placeholder="e.g. Indore" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: '#0f172a', border: '1px solid #444', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        <button onClick={handleSaveProfile} style={{ width: '100%', padding: '15px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', marginTop: '25px', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(46, 204, 113, 0.3)' }}>
                            Save Changes
                        </button>
                    </div>
                </div>
            );
        }

        // 📱 VIEW 2: MAIN MENU VIEW (Modern App Style)
        return (
            <div style={{ padding: '20px', paddingBottom: '100px' }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ width: '100px', height: '100px', margin: '0 auto 15px auto', border: '3px solid #d4af37', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', overflow: 'hidden', boxShadow: '0 10px 25px rgba(212, 175, 55, 0.2)' }}>
                        {profileImage ? <img src={profileImage} alt="DP" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <span style={{color: '#d4af37'}}>{(editName || 'U').charAt(0).toUpperCase()}</span>}
                    </div>
                    <h2 style={{ color: '#fff', margin: '0 0 5px 0', fontSize: '22px' }}>{editName || 'Snevio User'}</h2>
                    <span style={{ background: 'rgba(52, 152, 219, 0.1)', color: '#3498db', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', border: '1px solid rgba(52, 152, 219, 0.3)' }}>
                        📱 +91 {syncUser?.mobile || 'N/A'}
                    </span>
                </div>

                <h3 style={{ color: '#888', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', paddingLeft: '5px' }}>Account Settings</h3>
                
                <div style={{ background: '#1a1a2e', borderRadius: '15px', overflow: 'hidden', border: '1px solid #333', marginBottom: '20px' }}>
                    <div onClick={() => setEditProfileMode(true)} style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ background: '#3498db', width: '35px', height: '35px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👤</div>
                            <div>
                                <h4 style={{ color: '#fff', margin: '0 0 3px 0', fontSize: '15px' }}>Personal Details</h4>
                                <p style={{ color: '#aaa', margin: 0, fontSize: '11px' }}>Name, Email, Location</p>
                            </div>
                        </div>
                        <span style={{ color: '#666', fontSize: '18px' }}>›</span>
                    </div>

                    <div onClick={() => setCurrentTab('HISTORY')} style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ background: '#f1c40f', width: '35px', height: '35px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📜</div>
                            <div>
                                <h4 style={{ color: '#fff', margin: '0 0 3px 0', fontSize: '15px' }}>Transaction History</h4>
                                <p style={{ color: '#aaa', margin: 0, fontSize: '11px' }}>Invoices and Coin logs</p>
                            </div>
                        </div>
                        <span style={{ color: '#666', fontSize: '18px' }}>›</span>
                    </div>

                    <div onClick={() => setShowWalletModal(true)} style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ background: '#e67e22', width: '35px', height: '35px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🪙</div>
                            <div>
                                <h4 style={{ color: '#fff', margin: '0 0 3px 0', fontSize: '15px' }}>Snevio Wallet</h4>
                                <p style={{ color: '#aaa', margin: 0, fontSize: '11px' }}>Balance: {wallet.coins} Coins</p>
                            </div>
                        </div>
                        <span style={{ color: '#666', fontSize: '18px' }}>›</span>
                    </div>

                    {/* 🎁 NAYA: Snevio Gift Card */}
                    <div onClick={() => setShowGiftCardModal(true)} style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ background: 'linear-gradient(45deg, #8e44ad, #9b59b6)', width: '35px', height: '35px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🎁</div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 3px 0' }}>
                                    <h4 style={{ color: '#fff', margin: 0, fontSize: '15px' }}>Snevio Gift Card</h4>
                                    <span style={{ background: '#e74c3c', color: '#fff', fontSize: '9px', padding: '3px 6px', borderRadius: '10px', fontWeight: 'bold', letterSpacing: '0.5px', boxShadow: '0 2px 5px rgba(231,76,60,0.4)' }}>COMING SOON</span>
                                </div>
                                <p style={{ color: '#aaa', margin: 0, fontSize: '11px' }}>Send or redeem premium gift cards</p>
                            </div>
                        </div>
                        <span style={{ color: '#666', fontSize: '18px' }}>›</span>
                    </div>
                </div>
                
                <h3 style={{ color: '#888', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', paddingLeft: '5px' }}>Premium Access</h3>
                
                <div style={{ background: '#1a1a2e', borderRadius: '15px', overflow: 'hidden', border: '1px solid #333', marginBottom: '20px' }}>
                    {/* 👑 NAYA: MY SUBSCRIPTIONS (VIP/PREMIUM) */}
                    <div onClick={() => setShowSubscriptionModal(true)} style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ background: 'linear-gradient(45deg, #f39c12, #d35400)', width: '35px', height: '35px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', boxShadow: '0 4px 10px rgba(243, 156, 18, 0.4)' }}>👑</div>
                            <div>
                                <h4 style={{ color: '#fff', margin: '0 0 3px 0', fontSize: '15px' }}>My Subscriptions</h4>
                                <p style={{ color: '#f39c12', margin: 0, fontSize: '11px', fontWeight: 'bold' }}>{activeSubscription ? `Active: ${activeSubscription.planName}` : 'Upgrade to VIP / Premium'}</p>
                            </div>
                        </div>
                        <span style={{ color: '#666', fontSize: '18px' }}>›</span>
                    </div>
                </div>

                <h3 style={{ color: '#888', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', paddingLeft: '5px' }}>Support & Security</h3>

                <div style={{ background: '#1a1a2e', borderRadius: '15px', overflow: 'hidden', border: '1px solid #333' }}>
                    {/* 👇 NAYA ACTION LAGA DIYA HAI 👇 */}
                    <div onClick={() => setShowSupportModal(true)} style={{ padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #222', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ background: 'linear-gradient(45deg, #3498db, #2980b9)', width: '35px', height: '35px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🎧</div>
                            <h4 style={{ color: '#fff', margin: '0', fontSize: '15px' }}>Help & Support</h4>
                        </div>
                        <span style={{ color: '#666', fontSize: '18px' }}>›</span>
                    </div>

                    <div onClick={onLogout} style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', background: 'rgba(231, 76, 60, 0.05)' }}>
                        <div style={{ background: 'rgba(231, 76, 60, 0.2)', width: '35px', height: '35px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: '#e74c3c' }}>🚪</div>
                        <h4 style={{ color: '#e74c3c', margin: '0', fontSize: '15px', fontWeight: 'bold' }}>Logout Securely</h4>
                    </div>
                </div>
            </div>
        );
    };

    const renderHomeTab = () => {
    // ✅ 1. वेरिएबल को फंक्शन के शुरुआत में ही define करें
    let filesToDisplay = [];
    let currentFolderName = '';
    let rawFiles = [];

    // ✅ SCENARIO 1: Viewing Media inside a Folder (or Sub-folder)
    if (activeFolder && (!activeFolder.subFolders || activeFolder.subFolders.length === 0 || activeSubFolder)) {
        
        if (activeSubFolder) {
            rawFiles = activeSubFolder.files || [];
            currentFolderName = `${activeFolder.folderName} ➔ ${activeSubFolder.name}`;
        } else {
            rawFiles = activeFolder.files || [];
            currentFolderName = activeFolder.folderName;
        }

        // ✅ 2. एक्सपायर्ड फाइल्स को फिल्टर करें
        filesToDisplay = rawFiles.filter(item => {
            // Check करें कि item एक object है या नहीं
            if (item && typeof item === 'object' && (item.expiryDate || item.fileExpiryDate)) {
                const expiry = item.expiryDate || item.fileExpiryDate;
                return new Date(expiry) > new Date(); 
            }
            return true; // अगर एक्सपायरी नहीं है, तो फाइल दिखाएं
        });

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
                    <div className="folder-header-nav" style={{ padding: '0 5px' }}>
                        <BackButton color="#fff" onClick={() => { 
                            if(activeSubFolder) { setActiveSubFolder(null); setIsSelectionMode(false); setSelectedMediaFiles([]); }
                            else { setActiveFolder(null); setMediaFilter('ALL'); setIsSelectionMode(false); setSelectedMediaFiles([]); } 
                        }} />
                        <h3 style={{fontSize: '16px', margin: 0}}>{currentFolderName}</h3>
                    </div>

                    {/* 🔥 SNEVIO EXCLUSIVE MARKETING BANNER (Only shows for the default/Snevio folder) */}
                    {(activeFolder.isDefault || activeFolder.folderName === 'Snevio Photography') && !activeSubFolder && (
                        <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f172a)', padding: '20px', borderRadius: '15px', margin: '15px 0', border: '1px solid #d4af37', boxShadow: '0 10px 25px rgba(212, 175, 55, 0.15)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(212, 175, 55, 0.2)', borderRadius: '50%', filter: 'blur(30px)' }}></div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '24px' }}>✨</span>
                                <h3 style={{ margin: 0, color: '#d4af37', fontSize: '16px', letterSpacing: '0.5px' }}>You've Been Spotted!</h3>
                                <span style={{ background: '#2ecc71', color: '#fff', fontSize: '9px', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', marginLeft: 'auto' }}>100% FREE SHOOT</span>
                            </div>
                            
                            <p style={{ margin: '0 0 12px 0', color: '#e0e0e0', fontSize: '13px', lineHeight: '1.5' }}>
                                We loved capturing your candid moments! As a special gesture, <strong>the entire photoshoot was completely on us.</strong> 🎁
                            </p>
                            
                            <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderLeft: '3px solid #3498db', padding: '10px', borderRadius: '0 8px 8px 0' }}>
                                <p style={{ margin: 0, color: '#bdc3c7', fontSize: '11px', lineHeight: '1.5' }}>
                                    <strong style={{color: '#3498db'}}>Why the nominal charge?</strong> The small fee required to unlock these images strictly covers our <strong>Professional Color-Grading and Cinematic Retouching</strong> to make your digital memories look magazine-ready. 🎨
                                </p>
                            </div>
                        </div>
                    )}

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
                        {displayedMedia.length > 0 ? displayedMedia.map((mediaItem, idx) => {
                            // Smart Extraction: Extracts string URL immediately at block start
                            const mediaUrl = typeof mediaItem === 'object' ? (mediaItem.url || mediaItem.fileUrl) : mediaItem;
                            
                            const isUnlocked = isFileUnlocked(mediaUrl) || activeSubscription?.type === 'VIP';
                            const isSelected = selectedMediaFiles.includes(mediaUrl);
                            
                            return (
                                <div key={idx} className="gallery-item-vip" style={{ display: 'flex', flexDirection: 'column', background: '#1a1a2e', borderRadius: '12px', overflow: 'hidden', border: isSelected ? '3px solid #3498db' : (isUnlocked ? '1px solid #2ecc71' : '1px solid #333') }}>
                                    
                                    {/* 1. MEDIA CLICK AREA */}
                                    <div style={{ position: 'relative', height: '180px', cursor: 'pointer', overflow: 'hidden', background: '#000' }} onClick={() => isSelectionMode ? toggleSelection(mediaUrl) : openMediaInterface(mediaUrl)}>
                                        
                                        {/* CHECKBOX FOR SELECTION */}
                                        {isSelectionMode && (
                                            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 20, background: '#fff', borderRadius: '50%', padding: '2px', display: 'flex', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
                                                <input type="checkbox" checked={isSelected} readOnly style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#3498db' }} />
                                            </div>
                                        )}

                                        {/* 🔥 BUG FIX: filePath ki jagah mediaUrl kar diya */}
                                        {isCinematic(mediaUrl) ? (
                                            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2c3e50, #1a1a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f1c40f', filter: isUnlocked ? 'none' : 'blur(2px)' }}>
                                                <span style={{ fontSize: '40px', marginBottom: '5px' }}>🎬</span>
                                                <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>CINEMATIC</span>
                                            </div>
                                        ) : isVideo(mediaUrl) ? (
                                            <>
                                                <video src={getCleanUrl(mediaUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '16px'}}>▶️</div>
                                            </>
                                        ) : (
                                            /* 🚀 SMART THUMBNAIL LOGIC */
                                            <img src={getCleanUrl(mediaUrl, true)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isUnlocked ? 'none' : 'blur(2px)' }} />
                                        )}

                                        {!isUnlocked && !isSelectionMode && (
                                            <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', color: '#f1c40f', padding: '5px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>
                                                🔒 Locked
                                            </div>
                                        )}

                                        {/* Download Progress Overlay */}
                                        {downloadingFile === mediaUrl && (
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
                                        {(() => {
                                            const displayName = activeFolder.uploaderName || activeFolder.uploadedBy || 'Snevio Partner';
                                            const displayRole = activeFolder.uploaderRole || 'Premium Studio';
                                            
                                            return (
                                                <div 
                                                    onClick={() => setUploaderProfile({
                                                        name: displayName,
                                                        role: displayRole,
                                                        email: activeFolder.uploaderEmail || 'contact@snevio.com'
                                                    })}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                                >
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(45deg, #f1c40f, #e67e22)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                                        {displayName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontSize: '9px', color: '#888', lineHeight: '1.2' }}>Uploaded by</span>
                                                        <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', lineHeight: '1.2', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {displayName}
                                                            {displayRole === 'Super Admin' && <span style={{fontSize: '10px'}} title="Verified Admin">👑</span>}
                                                            {displayRole === 'Studio Partner' && <span style={{fontSize: '10px'}} title="Verified Studio">✨</span>}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Badge Area */}
                                        <div style={{ textAlign: 'right' }}>
                                            {isUnlocked ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                    <span style={{ fontSize: '11px', color: '#2ecc71', fontWeight: 'bold', background: 'rgba(46,204,113,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        ✅ Unlocked
                                                    </span>
                                                    {/* 🔥 BUG FIX: filePath ki jagah mediaUrl kar diya */}
                                                    {getUnlockTimerText(mediaUrl) && (
                                                        <span style={{ fontSize: '10px', color: '#e74c3c', fontWeight: 'bold', background: 'rgba(231,76,60,0.1)', padding: '2px 6px', borderRadius: '4px', animation: 'pulse 2s infinite' }}>
                                                            {getUnlockTimerText(mediaUrl)}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    <span style={{ display: 'block', fontSize: '9px', color: '#aaa' }}>To Unlock</span>
                                                    <span style={{ fontSize: '11px', color: '#f1c40f', fontWeight: 'bold', background: 'rgba(241,196,15,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                        🪙 {getCostLabel(mediaUrl)}
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
                    <div className="folder-header-nav" style={{ padding: '0 5px' }}>
                        <BackButton label="Back to Main Folders" color="#fff" onClick={() => { setActiveFolder(null); setMediaFilter('ALL'); }} />
                        <h3 style={{margin: 0}}>{activeFolder.folderName}</h3>
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
            <div className="folders-view" style={{ padding: '20px', paddingBottom: '20px', boxSizing: 'border-box', width: '100%' }}>
                <div className="welcome-banner" style={{ textAlign: 'center', marginBottom: '25px', marginTop: '10px' }}>
                    <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 8px 0', letterSpacing: '1px' }}>Your Digital Memories</h1>
                    <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>Select a folder to view your curated albums.</p>
                </div>
                
                {loading ? <div className="loading-state-vip">Fetching latest albums...</div> : (
                        <div className="folders-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px', padding: '0 20px', marginTop: '20px' }}>

                            {/* 🥇 1st PRIORITY: SNEVIO & ADMIN FOLDERS (ALWAYS FIRST) */}
                            {folders.filter(f => f.isDefault || f.uploaderRole === 'Super Admin').map((folder, index) => {
                                const isExpired = false; // 🔥 FOLDER EXPIRY HATA DI TAAKI LOCK NA HO
                                const isLimitReached = folder.downloadLimit > 0 && folder.downloadCount >= folder.downloadLimit;
                                const isLocked = false; // 🔥 AB FOLDER LOCK NAHI HOGA

                                let totalFiles = folder.files ? folder.files.length : 0;
                                if (folder.subFolders) {
                                    folder.subFolders.forEach(sf => totalFiles += (sf.files ? sf.files.length : 0));
                                }
                                
                                const themeColor = '#d4af37'; // Gold
                                const shadowColor = 'rgba(212, 175, 55, 0.2)';
                                const bgGradient = 'linear-gradient(145deg, #1a1813, #0a0a0a)';

                                return (
                                    <div key={`admin-${index}`} className="folder-card" onClick={() => setActiveFolder(folder)} 
                                        style={{ 
                                            opacity: isLocked ? 0.6 : 1, margin: 0, cursor: 'pointer', background: bgGradient,
                                            border: `1px solid ${themeColor}55`, boxShadow: `0 10px 20px ${shadowColor}`,
                                            borderRadius: '16px', padding: '30px 15px 20px 15px', display: 'flex', flexDirection: 'column',
                                            justifyContent: 'space-between', height: '100%', minHeight: '220px', boxSizing: 'border-box', /* 🔥 FIX: Uniform Height */
                                            alignItems: 'center', position: 'relative', transition: 'all 0.3s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = `0 15px 30px ${shadowColor}`; e.currentTarget.style.border = `1px solid ${themeColor}`; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 10px 20px ${shadowColor}`; e.currentTarget.style.border = `1px solid ${themeColor}55`; }}
                                    >
                                        <div style={{ position: 'absolute', top: '-10px', background: 'linear-gradient(90deg, #f1c40f, #d4af37)', color: '#000', fontSize: '9px', padding: '5px 15px', borderRadius: '20px', fontWeight: '900', letterSpacing: '1px', boxShadow: '0 4px 12px rgba(241, 196, 15, 0.6)', zIndex: 10, textTransform: 'uppercase' }}>
                                            {folder.isDefault ? "📸 Spotted by Snevio" : "✨ Snevio Exclusive"}
                                        </div>
                                        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', height: '150px', background: 'rgba(243, 156, 18, 0.1)', borderRadius: '50%', filter: 'blur(40px)', zIndex: 0 }}></div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', zIndex: 2 }}>
                                            <div style={{ fontSize: '40px', filter: `drop-shadow(0px 5px 15px ${themeColor}88)`, marginBottom: '10px', marginTop: '10px' }}>
                                                {isLocked ? '🔒' : '🗂️'}
                                            </div>
                                            <h4 style={{ color: '#fff', fontSize: '15px', margin: '0 0 5px 0', textAlign: 'center', fontWeight: 'bold', letterSpacing: '0.5px' }}>{folder.folderName}</h4>
                                            <p style={{ color: '#aaa', fontSize: '11px', margin: '0' }}>{totalFiles} Total Media</p>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: 'auto', paddingTop: '15px', zIndex: 2 }}>
                                            {folder.subFolders && folder.subFolders.length > 0 && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: '#bdc3c7', padding: '4px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>🗓️ Organized Events</span>}
                                            {isExpired && <span style={{fontSize:'10px', color:'#fff', marginTop: folder.subFolders?.length ? '5px' : '0', background: '#c0392b', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold'}}>Expired</span>}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* 🥈 2nd PRIORITY: VIP HIGHLIGHTED FOLDER FOR ALBUM SELECTIONS */}
                            {mySelections && mySelections.length > 0 && mySelections.filter(sel => sel.clientMobile === syncUser?.mobile).map((sel, idx) => {
                                // 🔥 NAYA: Check if uploaded by Admin or Studio
                                const isAdminUpload = sel.uploaderRole === 'Super Admin' || sel.uploaderRole === 'ADMIN';
                                const bgGradient = isAdminUpload ? 'linear-gradient(145deg, #1a1813, #0a0a0a)' : 'linear-gradient(135deg, #2c3e50, #8e44ad)';
                                const borderColor = isAdminUpload ? '#d4af37' : '#f1c40f';
                                const shadowColor = isAdminUpload ? 'rgba(212, 175, 55, 0.4)' : 'rgba(142, 68, 173, 0.4)';
                                const badgeText = isAdminUpload ? '✨ Snevio Exclusive Selection' : '📸 Studio Selection Task';

                                return (
                                <React.Fragment key={`sel-${idx}`}>
                                    <div 
                                                className="folder-card" 
                                                onClick={() => openSmartAlbum(sel)}
                                                style={{ background: bgGradient, border: `1px solid ${borderColor}`, boxShadow: `0 10px 20px ${shadowColor}`, animation: 'pulse 2s infinite', margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', minHeight: '220px', boxSizing: 'border-box', alignItems: 'center', cursor: 'pointer', borderRadius: '16px', padding: '30px 15px 20px 15px', position: 'relative' }}
                                            >
                                                {/* Premium Badge */}
                                                <div style={{ position: 'absolute', top: '-10px', background: isAdminUpload ? 'linear-gradient(90deg, #f1c40f, #d4af37)' : '#e74c3c', color: isAdminUpload ? '#000' : '#fff', fontSize: '9px', padding: '5px 15px', borderRadius: '20px', fontWeight: '900', letterSpacing: '1px', zIndex: 10, textTransform: 'uppercase', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                                                    {badgeText}
                                                </div>

                                                {/* Top Content (Icon, Title, Count) */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                    <div className="folder-icon" style={{background: 'rgba(255,255,255,0.1)', fontSize: '35px', marginBottom: '10px', marginTop: '10px'}}>{isAdminUpload ? '👑' : '📸'}</div>
                                                    <h4 style={{color: '#fff', fontSize: '15px', textAlign: 'center', marginBottom: '5px', fontWeight: 'bold'}}>{sel.folderName}</h4>
                                                    <p style={{color: '#aaa', margin: '0', fontSize: '11px'}}>{sel.images?.length || 0} Media Items</p>
                                                </div>

                                                {/* Bottom Content (Button & Status Tag) - Pushed to bottom via mt-auto */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: 'auto', paddingTop: '15px' }}>
                                                    {!['Completed', 'Confirmed', 'Submitted'].includes(sel.status) && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setActiveSelectionProject(sel); setShowFamilyShareModal(true); }}
                                                            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: `1px solid ${borderColor}`, padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', width: '100%', cursor: 'pointer', transition: '0.2s', marginBottom: '10px' }}
                                                        >
                                                            🤝 Invite Family
                                                        </button>
                                                    )}

                                                    <span style={{ display:'inline-block', fontSize:'10px', color:'#fff', background: ['Completed', 'Confirmed'].includes(sel.status) ? '#2ecc71' : '#e74c3c', padding:'4px 10px', borderRadius:'12px', fontWeight: 'bold', width: 'max-content' }}>
                                                        {['Completed', 'Confirmed'].includes(sel.status) ? '✅ Done' : (sel.status === 'Split Mode' ? '🔄 Splitting...' : (sel.status === 'Submitted' ? '⏳ Finalizing' : `Phase ${sel.currentPhase} Pending`))}
                                                    </span>
                                                </div>
                                            </div>

                                    {/* FAMILY COLLABORATION MODAL */}
                                    {showFamilyShareModal && activeSelectionProject?._id === sel._id && (
                                        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                                            <div style={{ background: '#fff', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                                    <h2 style={{ color: '#f39c12', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>🤝 Invite Family</h2>
                                                    <button onClick={() => setShowFamilyShareModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#333', cursor: 'pointer' }}>✖</button>
                                                </div>
                                                <p style={{ color: '#555', fontSize: '13px', marginBottom: '20px' }}>
                                                    Share this album selection folder with a family member so they can also select their favorite photos. 
                                                    <strong>Cost: {activeSubscription?.type === 'VIP' ? 'FREE (VIP)' : '10 Coins per invite'}.</strong>
                                                </p>
                                                
                                                <form onSubmit={async (e) => {
                                                    e.preventDefault();
                                                    const isVipUser = activeSubscription?.type === 'VIP';
                                                    const inviteCost = isVipUser ? 0 : 10;

                                                    if(wallet.coins < inviteCost) {
                                                        alert(`Not enough coins! You need ${inviteCost} coins to invite family.`);
                                                        setShowFamilyShareModal(false);
                                                        setShowWalletModal(true);
                                                        return;
                                                    }
                                                    if(familyShareForm.mobile.length !== 10) return alert("Enter valid 10-digit mobile number!");
                                                    if(!familyShareForm.nickname.trim()) return alert("Please provide a Nickname!");
                                                    
                                                    setLoading(true);
                                                    try {
                                                        const token = getValidToken();
                                                        const res = await axios.post(`${API_BASE}/invite-family-selection`, {
                                                            projectId: activeSelectionProject._id,
                                                            senderMobile: syncUser.mobile,
                                                            familyMobile: familyShareForm.mobile,
                                                            nickname: familyShareForm.nickname,
                                                            cost: inviteCost
                                                        }, { headers: { 'Authorization': `Bearer ${token}` } });

                                                        if (res.data.success) {
                                                            setWallet(res.data.wallet);
                                                            alert(`✅ Access granted! ${familyShareForm.nickname} can now view and select photos.`);
                                                            setShowFamilyShareModal(false);
                                                            setFamilyShareForm({mobile: '', nickname: '', hours: '24'});
                                                        } else {
                                                            alert(res.data.message || "Failed to invite family member. Try again.");
                                                        }
                                                    } catch(err) {
                                                        alert("Server error during invitation. Please try again.");
                                                    } finally {
                                                        setLoading(false);
                                                    }
                                                }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                                    
                                                    <input 
                                                        type="number" required placeholder="Family Member's 10-Digit Mobile" 
                                                        value={familyShareForm.mobile} onChange={e => setFamilyShareForm({...familyShareForm, mobile: e.target.value})} 
                                                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', width: '100%', color: '#333', backgroundColor: '#f8f9fa' }} 
                                                    />
                                                    <input 
                                                        type="text" required placeholder="Nickname (e.g. Uncle Rahul)" 
                                                        value={familyShareForm.nickname} onChange={e => setFamilyShareForm({...familyShareForm, nickname: e.target.value})} 
                                                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', width: '100%', color: '#333', backgroundColor: '#f8f9fa' }} 
                                                    />
                                                    <div style={{ background: '#fcf3cf', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#d4ac0d', fontWeight: 'bold' }}>
                                                        Wallet Balance: 🪙 {wallet.coins} Coins
                                                    </div>
                                                    <button type="submit" disabled={loading} style={{ background: (activeSubscription?.type === 'VIP' || wallet.coins >= 10) ? '#f39c12' : '#ccc', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: (activeSubscription?.type === 'VIP' || wallet.coins >= 10) && !loading ? 'pointer' : 'not-allowed' }}>
                                                        {loading ? 'Processing...' : (activeSubscription?.type === 'VIP' ? 'Invite For Free (VIP) 🤝' : 'Pay 10 Coins & Invite')}
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    )}
                                </React.Fragment>
                                );
                            })}

                            {/* 🥉 3rd PRIORITY: NORMAL STUDIO FOLDERS */}
                            {folders.filter(f => !f.isDefault && f.uploaderRole !== 'Super Admin').map((folder, index) => {
                                const isExpired = false; // 🔥 FOLDER EXPIRY HATA DI TAAKI LOCK NA HO
                                const isLimitReached = folder.downloadLimit > 0 && folder.downloadCount >= folder.downloadLimit;
                                const isLocked = false; // 🔥 AB FOLDER LOCK NAHI HOGA

                                let totalFiles = folder.files ? folder.files.length : 0;
                                if (folder.subFolders) {
                                    folder.subFolders.forEach(sf => totalFiles += (sf.files ? sf.files.length : 0));
                                }
                                
                                const themeColor = '#3498db'; // Neon Blue
                                const shadowColor = 'rgba(52, 152, 219, 0.2)';
                                const bgGradient = 'linear-gradient(145deg, #101620, #0a0a0a)';

                                return (
                                    <div key={`studio-${index}`} className="folder-card" onClick={() => setActiveFolder(folder)} 
                                        style={{ 
                                            opacity: isLocked ? 0.6 : 1, margin: 0, cursor: 'pointer', background: bgGradient,
                                            border: `1px solid ${themeColor}55`, boxShadow: `0 10px 20px ${shadowColor}`,
                                            borderRadius: '16px', padding: '30px 15px 20px 15px', display: 'flex', flexDirection: 'column',
                                            justifyContent: 'space-between', height: '100%', minHeight: '220px', boxSizing: 'border-box', /* 🔥 FIX: Uniform Height */
                                            alignItems: 'center', position: 'relative', transition: 'all 0.3s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = `0 15px 30px ${shadowColor}`; e.currentTarget.style.border = `1px solid ${themeColor}`; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 10px 20px ${shadowColor}`; e.currentTarget.style.border = `1px solid ${themeColor}55`; }}
                                    >
                                        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '150px', height: '150px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '50%', filter: 'blur(40px)', zIndex: 0 }}></div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', zIndex: 2 }}>
                                            <div style={{ fontSize: '40px', filter: `drop-shadow(0px 5px 15px ${themeColor}88)`, marginBottom: '10px', marginTop: '10px' }}>
                                                {isLocked ? '🔒' : '📁'}
                                            </div>
                                            <h4 style={{ color: '#fff', fontSize: '15px', margin: '0 0 5px 0', textAlign: 'center', fontWeight: 'bold', letterSpacing: '0.5px' }}>{folder.folderName}</h4>
                                            <p style={{ color: '#aaa', fontSize: '11px', margin: '0' }}>{totalFiles} Total Media</p>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: 'auto', paddingTop: '15px', zIndex: 2 }}>
                                            {folder.subFolders && folder.subFolders.length > 0 && <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: '#bdc3c7', padding: '4px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>🗓️ Organized Events</span>}
                                            {isExpired && <span style={{fontSize:'10px', color:'#fff', marginTop: folder.subFolders?.length ? '5px' : '0', background: '#c0392b', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold'}}>Expired</span>}
                                        </div>
                                    </div>
                                )
                            })}

                        </div>
                    )}
                </div>
            );
        };

    return (
        <div className="ud-container-vip" onContextMenu={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100vw', overflow: 'hidden', background: '#0a0a0a' }}>
            {/* 🔥 NATIVE APP LAYOUT: Flexbox Container locks screen size and prevents Nav hiding */}

            {/* 🔔 NOTIFICATION MODAL */}
            {showNotifModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 999999, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1a1a2e', width: '100%', maxHeight: '85vh', borderTopLeftRadius: '25px', borderTopRightRadius: '25px', padding: '20px', overflowY: 'auto', animation: 'slideUp 0.3s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '15px' }}>
                            <h2 style={{ color: '#fff', margin: 0 }}>🔔 Notifications</h2>
                            <button onClick={() => setShowNotifModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>✖</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {notifications.length > 0 ? notifications.map((n, idx) => (
                                <div key={idx} style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', borderLeft: `4px solid ${n.type === 'SUCCESS' ? '#2ecc71' : n.type === 'WARNING' ? '#e74c3c' : '#3498db'}` }}>
                                    <h4 style={{ color: '#fff', margin: '0 0 5px 0', fontSize: '14px' }}>{n.title}</h4>
                                    <p style={{ color: '#aaa', margin: 0, fontSize: '12px' }}>{n.message}</p>
                                    <p style={{ color: '#777', margin: '5px 0 0 0', fontSize: '10px' }}>{new Date(n.createdAt).toLocaleString()}</p>
                                </div>
                            )) : <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No new notifications.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* 🎁 GIFT CARD MODAL */}
            {showGiftCardModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1a1a2e', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 50px rgba(142,68,173,0.3)', border: '1px solid #8e44ad' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ color: '#8e44ad', margin: 0 }}>🎁 Redeem Gift Card</h2>
                            <button onClick={() => setShowGiftCardModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#888', cursor: 'pointer' }}>✖</button>
                        </div>
                        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '25px' }}>Got a secret code from an event or offer? Enter it below to claim free coins!</p>
                        
                        <form onSubmit={handleRedeemGiftCard}>
                            <input 
                                type="text" 
                                placeholder="Enter Gift Code (e.g. DIWALI500)" 
                                value={giftCode} 
                                onChange={e => setGiftCode(e.target.value.toUpperCase())}
                                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '2px solid #3498db', background: '#0f172a', color: '#fff', fontSize: '16px', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', outline: 'none', marginBottom: '15px' }} 
                                required 
                            />
                            <button type="submit" disabled={giftLoading} style={{ width: '100%', background: 'linear-gradient(45deg, #8e44ad, #3498db)', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: giftLoading ? 'not-allowed' : 'pointer', boxShadow: '0 5px 15px rgba(142,68,173,0.4)' }}>
                                {giftLoading ? 'Checking...' : '🎉 Claim Reward Now'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ✅ USER EXIT APP POPUP A*/}
            {showExitPopup && (
                <div className="popup-overlay-fixed" style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter: 'blur(5px)'}}>
                    <div style={{background:'#1a1a2e', padding:'30px', borderRadius:'15px', textAlign:'center', color:'#fff', boxShadow:'0 10px 30px rgba(0,0,0,0.7)', border: '1px solid #333', maxWidth: '300px', width: '90%'}}>
                        <div style={{fontSize: '40px', marginBottom: '10px'}}>🚪</div>
                        <h3 style={{marginBottom:'10px', marginTop: 0}}>Exit App?</h3>
                        <p style={{fontSize: '13px', color: '#aaa', marginBottom: '20px'}}>Are you sure you want to close the app?</p>
                        
                        <div style={{display:'flex', gap:'15px', justifyContent:'center'}}>
                            <button onClick={() => window.location.href = '/'} style={{background:'#e74c3c', color:'#fff', padding:'10px 20px', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', flex: 1}}>Yes, Exit</button>
                            <button onClick={() => setShowExitPopup(false)} style={{background:'#34495e', color:'#fff', padding:'10px 20px', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', flex: 1}}>No, Stay</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ GLOBAL LONG PRESS IMAGE PREVIEW MODAL */}
            {previewMedia && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 99999999, display: 'flex', justifyContent: 'center', alignItems: 'center', WebkitTouchCallout: 'none', userSelect: 'none' }} onClick={() => setPreviewMedia(null)} onContextMenu={(e) => e.preventDefault()}>
                    <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px', cursor: 'pointer', zIndex: 10 }}>✖</button>
                    <img src={getCleanUrl(previewMedia)} style={{ maxWidth: '95%', maxHeight: '90%', borderRadius: '10px', objectFit: 'contain', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', pointerEvents: 'none' }} alt="Preview" />
                    <p style={{ position: 'absolute', bottom: '20px', color: '#aaa', fontSize: '12px' }}>Tap anywhere to close preview</p>
                </div>
            )}

            {/* Inline CSS for Pulse Animation (Emergency Button) */}
            <style>{`
                /* 🔥 THE FIX: Remove unused bottom gaps from all tabs */
                .folders-view, .folder-gallery-view, .services-tab-wrapper, .bookings-tab-wrapper, .history-tab-vip, .profile-tab-vip {
                    padding-bottom: 15px !important;
                }
                /* 🔥 FIX: Prevent double scrollbars on Services and Bookings */
                .services-tab-wrapper, .bookings-tab-wrapper {
                    height: auto !important;
                    overflow-y: visible !important;
                }

                /* 🔥 SECURITY: Disable Long-Press Image Download Popup in Mobile */
                .gallery-item-vip img {
                    -webkit-touch-callout: none !important;
                    -webkit-user-select: none !important;
                    user-select: none !important;
                    pointer-events: none !important;
                }
                /* 🌟 NEW: Daily Reward Coin Bounce Animation */
                @keyframes coinBump {
                    0% { transform: scale(1); box-shadow: 0 0 0px transparent; }
                    50% { transform: scale(1.3) translateY(-5px); box-shadow: 0 0 20px #f1c40f; background: #f39c12; color: #fff; }
                    100% { transform: scale(1); box-shadow: 0 0 0px transparent; }
                }
                .coin-bump-animation {
                    animation: coinBump 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                    transition: all 0.3s;
                }

                @keyframes pulseEmergency {
                    0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
                }
                .emergency-pulse-btn {
                    animation: pulseEmergency 1.5s infinite;
                    background: linear-gradient(45deg, #e74c3c, #c0392b);
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-weight: bold;
                    font-size: 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .cart-icon-wrapper {
                    position: relative;
                    font-size: 24px;
                    cursor: pointer;
                }
                .cart-badge {
                    position: absolute;
                    top: -5px;
                    right: -10px;
                    background: #e74c3c;
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 10px;
                    border: 2px solid #0f172a;
                }
            `}</style>

            {/* ✅ VIEW & ACCEPT PROPOSAL MODAL */}
            {viewProposalBooking && viewProposalBooking.proposal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '25px', width: '90%', maxWidth: '450px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ color: '#2c3e50', margin: 0 }}>📋 Custom Proposal</h2>
                            <button onClick={() => setViewProposalBooking(null)} style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#555', cursor: 'pointer' }}>✖</button>
                        </div>
                        
                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '20px', borderLeft: '5px solid #3498db' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#7f8c8d' }}>Deliverables</p>
                            <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#2c3e50' }}>{viewProposalBooking.proposal.deliverables}</p>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                            <div style={{ flex: 1, background: '#fdfefe', border: '1px solid #ddd', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#7f8c8d' }}>Total Estimate</p>
                                <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#27ae60' }}>₹{viewProposalBooking.proposal.totalPrice}</p>
                            </div>
                            <div style={{ flex: 1, background: '#fdfefe', border: '1px dashed #e74c3c', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                                <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#e74c3c', fontWeight: 'bold' }}>Advance to Pay</p>
                                <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#e74c3c' }}>₹{viewProposalBooking.proposal.advanceAmount}</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '25px' }}>
                            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Terms & Conditions</h4>
                            <div style={{ background: '#eee', padding: '15px', borderRadius: '8px', fontSize: '12px', color: '#555', maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                                {viewProposalBooking.proposal.terms}
                            </div>
                        </div>

                        <button 
                            onClick={handleAcceptProposal} 
                            disabled={loading}
                            style={{ width: '100%', padding: '15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
                        >
                            {loading ? 'Processing...' : `Accept & Pay ₹${viewProposalBooking.proposal.advanceAmount}`}
                        </button>
                        <p style={{ textAlign: 'center', fontSize: '11px', color: '#aaa', marginTop: '10px' }}>
                            Proposal Expires: {new Date(viewProposalBooking.proposal.expiryTime).toLocaleString()}
                        </p>
                    </div>
                </div>
            )}

            {/* ✅ NEW SUPPORT & HELP MODAL */}
            {showSupportModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1a1a2e', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>🎧 Help & Support</h2>
                            <button onClick={() => setShowSupportModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#888', cursor: 'pointer' }}>✖</button>
                        </div>
                        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '20px' }}>How can we assist you today? Choose an option below.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* WhatsApp Support */}
                            <button onClick={() => window.open('https://wa.me/917828011282', '_blank')} style={{ background: 'rgba(37, 211, 102, 0.1)', border: '1px solid #25D366', color: '#2ecc71', padding: '15px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                💬 Chat on WhatsApp
                            </button>

                            {/* Email Support */}
                            <button onClick={() => window.location.href = 'mailto:support@snevio.com'} style={{ background: 'rgba(52, 152, 219, 0.1)', border: '1px solid #3498db', color: '#3498db', padding: '15px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                📧 Send an Email
                            </button>

                            {/* Call Request */}
                            <button onClick={() => { alert('Call request sent! Our team will contact you shortly.'); setShowSupportModal(false); }} style={{ background: 'rgba(241, 196, 15, 0.1)', border: '1px solid #f1c40f', color: '#f1c40f', padding: '15px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                📞 Request a Call Back
                            </button>

                            {/* 📺 NEW: Video Guides Button */}
                            <button onClick={() => { setShowSupportModal(false); setShowTutorialsModal(true); }} style={{ background: 'rgba(155, 89, 182, 0.1)', border: '1px solid #9b59b6', color: '#9b59b6', padding: '15px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                📺 Watch Video Guides
                            </button>

                            {/* Existing Emergency Booking */}
                            <button onClick={() => { setShowSupportModal(false); setShowEmergencyModal(true); }} style={{ background: 'linear-gradient(45deg, #e74c3c, #c0392b)', border: 'none', color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                🚨 Urgent Emergency Booking
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ NEW: VIDEO TUTORIALS MODAL */}
            {showTutorialsModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1a1a2e', padding: '25px', borderRadius: '20px', width: '90%', maxWidth: '450px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>📺 App Guides</h2>
                            <button onClick={() => setShowTutorialsModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#888', cursor: 'pointer' }}>✖</button>
                        </div>
                        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '20px' }}>Learn how to use the Snevio App with these quick video tutorials.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '5px' }}>
                            
                            {tutorials && tutorials.length > 0 ? tutorials.map((tut, idx) => (
                                <div key={idx} style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ color: '#fff', margin: '0 0 5px 0', fontSize: '14px' }}>{tut.title}</h4>
                                        {tut.description && <p style={{ color: '#aaa', margin: '0 0 5px 0', fontSize: '11px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tut.description}</p>}
                                        {tut.duration && <span style={{ color: '#3498db', fontSize: '10px', fontWeight: 'bold', background: 'rgba(52,152,219,0.1)', padding: '2px 6px', borderRadius: '4px' }}>⏱️ {tut.duration}</span>}
                                    </div>
                                    <button onClick={() => window.open(tut.link, '_blank')} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                        ▶ Play
                                    </button>
                                </div>
                            )) : (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
                                    <span style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}>🎥</span>
                                    <p style={{ margin: 0, fontSize: '13px' }}>Video guides are currently being updated. Check back soon!</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* 👑 VIP/PREMIUM SUBSCRIPTION MODAL (PRO SAAS STYLE) */}
            {showSubscriptionModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(10, 10, 10, 0.9)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
                    <div style={{ background: '#111827', padding: '30px', borderRadius: '25px', width: '95%', maxWidth: '1050px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', border: '1px solid #1f2937' }}>
                        
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h2 style={{ color: '#fff', margin: 0, fontSize: '28px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '900', letterSpacing: '0.5px' }}>
                                <span style={{fontSize: '32px'}}>👑</span> Choose Your Premium Plan
                            </h2>
                            <button onClick={() => setShowSubscriptionModal(false)} style={{ background: '#374151', border: 'none', fontSize: '18px', color: '#fff', cursor: 'pointer', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>✖</button>
                        </div>
                        <p style={{ color: '#9ca3af', fontSize: '15px', marginBottom: '35px', fontWeight: '500' }}>Upgrade your Snevio experience. Enjoy zero ads, limitless downloads, and exclusive perks.</p>

                        {/* Cards Container (Grid / Flex Wrap) */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
                            
                            {/* 1️⃣ FREE BASIC PLAN */}
                            <div style={{ flex: '1 1 280px', maxWidth: '320px', background: 'linear-gradient(180deg, #1f2937, #111827)', border: '1px solid #374151', borderRadius: '20px', padding: '25px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ position: 'absolute', top: 0, right: 0, background: '#4b5563', color: '#fff', fontSize: '10px', fontWeight: '900', padding: '6px 12px', borderBottomLeftRadius: '15px', letterSpacing: '1px' }}>CURRENT PLAN</div>
                                <h3 style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: '20px', fontWeight: '800' }}>Basic Access</h3>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '25px' }}>
                                    <span style={{ color: '#f3f4f6', fontSize: '40px', fontWeight: '900' }}>Free</span>
                                </div>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 25px 0', color: '#9ca3af', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                                    <li style={{display: 'flex', gap:'8px'}}>❌ <span>Watch Ads to Earn Coins</span></li>
                                    <li style={{display: 'flex', gap:'8px'}}>❌ <span>Media locks after 24 Hours</span></li>
                                    <li style={{display: 'flex', gap:'8px'}}>❌ <span>Costs {activeFolder?.imageCost || 5} Coins per Photo</span></li>
                                    <li style={{display: 'flex', gap:'8px'}}>❌ <span>Needs 50 Coins for Emergency</span></li>
                                    <li style={{display: 'flex', gap:'8px'}}>❌ <span>10 Coins / Family Invite</span></li>
                                </ul>
                                {!activeSubscription ? (
                                    <button disabled style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #374151', background: 'transparent', color: '#9ca3af', fontWeight: 'bold', fontSize: '15px', cursor: 'not-allowed', textTransform: 'uppercase', letterSpacing: '1px' }}>Currently Active</button>
                                ) : (
                                    <button disabled style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px dashed #374151', background: 'transparent', color: '#6b7280', fontSize: '15px', cursor: 'not-allowed' }}>Downgraded Plan</button>
                                )}
                            </div>

                            {/* 2️⃣ DYNAMIC PREMIUM & VIP PLANS */}
                            {userSubPlans.length > 0 ? userSubPlans.map((plan, idx) => {
                                const isVIP = plan.type === 'VIP';
                                const bgStyle = isVIP ? 'linear-gradient(180deg, #37210b, #111827)' : 'linear-gradient(180deg, #0b2237, #111827)';
                                const borderColor = isVIP ? '#f59e0b' : '#3b82f6';
                                const titleColor = isVIP ? '#fbbf24' : '#60a5fa';
                                const btnBg = isVIP ? 'linear-gradient(90deg, #f59e0b, #ea580c)' : 'linear-gradient(90deg, #3b82f6, #2563eb)';
                                const btnHoverShadow = isVIP ? '0 10px 25px rgba(245, 158, 11, 0.4)' : '0 10px 25px rgba(59, 130, 246, 0.4)';
                                const featureIcon = isVIP ? '✨' : '✅';
                                const isCurrent = activeSubscription?.id === plan.id;
                                
                                return (
                                    <div key={idx} style={{ flex: '1 1 280px', maxWidth: '320px', background: bgStyle, border: `2px solid ${borderColor}`, borderRadius: '20px', padding: '25px', position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: isVIP ? '0 10px 40px rgba(245, 158, 11, 0.15)' : '0 10px 40px rgba(59, 130, 246, 0.1)', transform: isVIP ? 'scale(1.02)' : 'none', zIndex: isVIP ? 10 : 1 }}>
                                        {isVIP && <div style={{ position: 'absolute', top: '-15px', right: '-15px', fontSize: '100px', opacity: 0.05, transform: 'rotate(15deg)' }}>👑</div>}
                                        
                                        {plan.offerText && (
                                            <div style={{ position: 'absolute', top: 0, right: 0, background: isVIP ? '#f59e0b' : '#ef4444', color: isVIP ? '#000' : '#fff', fontSize: '10px', fontWeight: '900', padding: '6px 12px', borderBottomLeftRadius: '15px', letterSpacing: '1px', textTransform: 'uppercase', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                                                {plan.offerText}
                                            </div>
                                        )}
                                        
                                        <h3 style={{ margin: '0 0 10px 0', color: titleColor, fontSize: '22px', fontWeight: '800' }}>{plan.planName}</h3>
                                        
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '25px' }}>
                                            <span style={{ color: '#fff', fontSize: '40px', fontWeight: '900' }}>₹{plan.monthlyPrice}</span>
                                            <span style={{ color: '#9ca3af', fontSize: '14px' }}>/month</span>
                                        </div>
                                        
                                        {/* Features List */}
                                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 25px 0', color: '#d1d5db', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                                            {plan.features && plan.features.map((feature, fIdx) => (
                                                <li key={fIdx} style={{display: 'flex', gap:'8px', alignItems:'flex-start'}}>
                                                    <span style={{fontSize:'14px', marginTop:'1px'}}>{featureIcon}</span> 
                                                    <span style={{lineHeight: '1.4'}} dangerouslySetInnerHTML={{ __html: feature.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${titleColor}">$1</strong>`) }} />
                                                </li>
                                            ))}
                                        </ul>
                                        
                                        <button 
                                            onClick={() => handleBuySubscription(plan)} 
                                            disabled={isCurrent || loading}
                                            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: isCurrent ? '#374151' : btnBg, color: isCurrent ? '#9ca3af' : '#fff', fontWeight: '800', fontSize: '15px', cursor: isCurrent ? 'not-allowed' : 'pointer', boxShadow: (!isCurrent) ? btnHoverShadow : 'none', transition: '0.3s', textTransform: 'uppercase', letterSpacing: '1px' }}
                                        >
                                            {isCurrent ? 'Current Plan ✓' : (loading ? 'Processing...' : `Upgrade to ${plan.type}`)}
                                        </button>
                                    </div>
                                );
                            }) : (
                                <div style={{flex: '1 1 100%', textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed #374151', maxWidth: '320px'}}>
                                    <span style={{fontSize: '40px', opacity: 0.5}}>🚀</span>
                                    <p style={{color: '#9ca3af', marginTop: '10px', fontSize:'14px'}}>Premium plans are currently being configured by the admin.</p>
                                </div>
                            )}

                        </div>
                        <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', marginTop: '35px', fontWeight: '500' }}>🔒 Secure payments via Instamojo. Subscriptions can be canceled anytime from settings.</p>
                    </div>
                </div>
            )}

            {/* ✅ EMERGENCY MODAL WITH GPS */}
            {showEmergencyModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 50px rgba(231,76,60,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ color: '#e74c3c', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>🚨 Emergency Booking</h2>
                            <button onClick={() => setShowEmergencyModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#333', cursor: 'pointer' }}>✖</button>
                        </div>
                        <p style={{ color: '#555', fontSize: '13px', marginBottom: '20px' }}>Instantly connect with our customer care for urgent booking requests. Cost: <strong>{activeSubscription?.type === 'VIP' ? 'FREE (VIP)' : '50 Coins'}</strong>.</p>
                        
                        <form onSubmit={processEmergencyBooking} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input 
                                type="text" required placeholder="Your Location / City" 
                                value={emergencyData.location} onChange={e => setEmergencyData({...emergencyData, location: e.target.value})} 
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', color: '#333', backgroundColor: '#fff' }} 
                            />
                            
                            <textarea 
                                required placeholder="Why do you need emergency service?" rows="3" 
                                value={emergencyData.reason} onChange={e => setEmergencyData({...emergencyData, reason: e.target.value})} 
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', resize: 'vertical', color: '#333', backgroundColor: '#fff' }}
                            ></textarea>
                            
                            <div style={{ background: '#fcf3cf', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#d4ac0d', fontWeight: 'bold' }}>
                                Wallet Balance: 🪙 {wallet.coins} Coins
                            </div>

                            <button type="submit" disabled={loading} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                {loading ? 'Fetching GPS & Connecting...' : (activeSubscription?.type === 'VIP' ? 'Call Now (FREE) 📞' : 'Pay 50 Coins & Call Now 📞')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ✅ CART MODAL */}
            {showCartModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 999999, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1a1a2e', width: '100%', maxHeight: '85vh', borderTopLeftRadius: '25px', borderTopRightRadius: '25px', padding: '20px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '15px' }}>
                            <h2 style={{ color: '#fff', margin: 0 }}>🛒 My Cart ({cart.length})</h2>
                            <button onClick={() => setShowCartModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>✖</button>
                        </div>

                        {cart.length === 0 ? (
                            <p style={{ color: '#888', textAlign: 'center', padding: '30px 0' }}>Your cart is empty.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {cart.map((item, idx) => {
                                    // Change detection logic
                                    const liveItem = availableServices.find(s => s._id === item._id);
                                    const isChanged = liveItem && (liveItem.startingPrice !== item.startingPrice || liveItem.title !== item.title);

                                    return (
                                        <div key={idx} style={{ background: '#0f172a', padding: '15px', borderRadius: '12px', border: isChanged ? '1px solid #e74c3c' : '1px solid #333', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <h3 style={{ color: '#fff', margin: '0 0 5px 0', fontSize: '16px' }}>{item.title}</h3>
                                                    <p style={{ color: '#f1c40f', margin: 0, fontWeight: 'bold', fontSize: '14px' }}>₹{item.startingPrice}</p>
                                                    <p style={{ color: '#888', fontSize: '11px', margin: '5px 0 0 0' }}>Provider: {item.addedBy || 'Snevio'}</p>
                                                </div>
                                                <button onClick={() => handleRemoveFromCart(item._id)} style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Remove</button>
                                            </div>
                                            {isChanged && (
                                                <div style={{ background: '#fdedec', color: '#c0392b', padding: '8px', borderRadius: '6px', fontSize: '11px', marginTop: '10px', fontWeight: 'bold' }}>
                                                    ⚠️ Note: This service details or price has been updated by the provider. Please recheck.
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}

                                <div style={{ marginTop: '20px', borderTop: '1px dashed #444', paddingTop: '20px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
                                        <span>Total Estimated:</span>
                                        <span>₹{cart.reduce((acc, item) => acc + (item.startingPrice || 0), 0)}</span>
                                    </div>
                                    <button onClick={handleCartCheckout} disabled={loading} style={{ background: '#2ecc71', color: '#fff', border: 'none', width: '100%', padding: '15px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                        {loading ? 'Processing Checkout...' : 'Checkout Now'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ✅ SERVICES MODAL (NATIVE BOTTOM SHEET) WITH ADD TO CART AND OFFERS */}
            {selectedServiceModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 999999, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1a1a2e', width: '100%', maxHeight: '85vh', borderTopLeftRadius: '25px', borderTopRightRadius: '25px', padding: '20px', overflowY: 'auto', animation: 'slideUp 0.3s ease-out' }}>
                        <div style={{ width: '40px', height: '5px', background: '#444', borderRadius: '10px', margin: '0 auto 20px auto' }}></div>
                        
                        {selectedServiceModal.imageUrl && (
                            <img src={selectedServiceModal.imageUrl} alt="Service" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '15px', marginBottom: '15px' }} />
                        )}
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <h2 style={{ color: '#fff', margin: 0 }}>{selectedServiceModal.title}</h2>
                            {selectedServiceModal.offerText && (
                                <span style={{ background: '#e74c3c', color: '#fff', padding: '4px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', animation: 'pulse 2s infinite' }}>{selectedServiceModal.offerText}</span>
                            )}
                        </div>
                        
                        <div style={{ background: 'rgba(52, 152, 219, 0.1)', border: '1px solid #3498db', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
                            <span style={{ color: '#aaa', fontSize: '13px' }}>Estimated Price</span>
                            <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {selectedServiceModal.discountPercentage > 0 ? (
                                    <>
                                        <span style={{ color: '#888', textDecoration: 'line-through', fontSize: '16px' }}>₹{selectedServiceModal.startingPrice}</span>
                                        <span style={{ color: '#2ecc71' }}>₹{selectedServiceModal.finalPrice}</span>
                                    </>
                                ) : (
                                    <span>₹{selectedServiceModal.startingPrice}</span>
                                )}
                            </div>
                        </div>

                        <h4 style={{ color: '#f1c40f', marginBottom: '10px' }}>Description</h4>
                        <p style={{ color: '#ccc', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
                            {selectedServiceModal.fullDescription || selectedServiceModal.shortDescription}
                        </p>

                        <h4 style={{ color: '#f1c40f', marginBottom: '10px' }}>Features Included</h4>
                        <ul style={{ paddingLeft: '0', listStyle: 'none', color: '#ccc', fontSize: '13px', marginBottom: '30px' }}>
                            {selectedServiceModal.features ? selectedServiceModal.features.split(',').map((f, i) => (
                                <li key={i} style={{ marginBottom: '8px' }}>✅ {f.trim()}</li>
                            )) : <li>✅ Premium Quality Service</li>}
                        </ul>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => handleAddToCart(selectedServiceModal)} style={{ flex: 1, padding: '15px', background: '#f39c12', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                    🛒 Add to Cart
                                </button>
                                <button onClick={() => handleDirectBook(selectedServiceModal)} disabled={loading} style={{ flex: 1, padding: '15px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                    {loading ? '...' : '⚡ Direct Book'}
                                </button>
                            </div>
                            <button onClick={() => setSelectedServiceModal(null)} style={{ padding: '12px', background: 'transparent', color: '#aaa', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

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

                                    {/* 🔥 NAYA: REFER & EARN CARD 🔥 */}
                                    <div style={{ background: 'linear-gradient(135deg, #8e44ad, #3498db)', padding: '20px', borderRadius: '15px', color: '#fff', textAlign: 'center', position: 'relative', overflow: 'hidden', border: '2px solid #f1c40f', boxShadow: '0 5px 15px rgba(142, 68, 173, 0.3)' }}>
                                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '60px', opacity: 0.2 }}>🎁</div>
                                        <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', color: '#f1c40f' }}>Refer & Earn 50 Coins!</h3>
                                        <p style={{ margin: '0 0 15px 0', fontSize: '12px', lineHeight: '1.4' }}>Invite your friends or clients to Snevio. They get 20 Coins instantly, and you get 50 Coins when they join!</p>
                                        
                                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                            <span style={{ fontSize: '12px', color: '#ccc' }}>Your Unique Code:</span>
                                            <strong style={{ fontSize: '20px', letterSpacing: '2px', color: '#2ecc71' }}>{syncUser?.referralCode || 'SNVO9999'}</strong>
                                        </div>

                                        <button onClick={() => {
                                            const refCode = syncUser?.referralCode || 'SNVO9999';
                                            const shareText = `Hey! Join Snevio for premium photography & cloud storage. Use my referral code *${refCode}* while signing up to get 20 FREE Coins instantly! 🎁 \n\nSign up here: https://snevio.com/login`;
                                            if (navigator.share) {
                                                navigator.share({ title: 'Join Snevio', text: shareText });
                                            } else {
                                                navigator.clipboard.writeText(shareText);
                                                alert("Referral Message Copied! Paste and send it to your friends on WhatsApp.");
                                            }
                                        }} style={{ width: '100%', background: '#f1c40f', color: '#000', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(241, 196, 15, 0.4)' }}>
                                            📲 Share on WhatsApp
                                        </button>
                                    </div>
                                    
                                    {/* Default AD Watch Card (HIDDEN FOR VIP) */}
                                    {activeSubscription?.type !== 'VIP' ? (
                                        <div style={{ background: '#0f172a', border: '1px solid #2ecc71', borderRadius: '15px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>🎬 Watch Short Ad</div>
                                                <div style={{ color: '#2ecc71', fontSize: '12px', fontWeight: 'bold' }}>Reward: +1 Coin</div>
                                            </div>
                                            <button onClick={startWatchAdFlow} disabled={adLoading || loading} style={{ background: 'transparent', border: '2px solid #2ecc71', color: '#2ecc71', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                {adLoading ? '🍿 Loading...' : 'Watch Now'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ background: '#1a1a2e', border: '1px dashed #f1c40f', borderRadius: '15px', padding: '15px', textAlign: 'center' }}>
                                            <span style={{ fontSize: '24px' }}>🛡️</span>
                                            <div style={{ color: '#f1c40f', fontSize: '14px', fontWeight: 'bold', marginTop: '5px' }}>Ad-Free Experience Active</div>
                                            <div style={{ color: '#aaa', fontSize: '11px', marginTop: '5px' }}>As a VIP, you enjoy the app without any ads!</div>
                                        </div>
                                    )}

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
                        {isCinematic(selectedMedia.url) ? (
                            // 🎬 NAYA SYNC PLAYER (For Cinematic YT Videos)
                            (() => {
                                const parts = selectedMedia.url.split('::');
                                const ytId = parts[1];
                                const audioLink = parts[2];
                                return (
                                    <div style={{ width: '100%', maxWidth: '800px', background: '#000', borderRadius: '15px', padding: '10px', boxShadow: '0 10px 40px rgba(243, 156, 18, 0.2)' }}>
                                        <div style={{ textAlign: 'center', marginBottom: '10px', color: '#f39c12', fontWeight: 'bold', fontSize: '14px', letterSpacing: '2px' }}>
                                            🎬 PREMIUM CINEMATIC EXPERIENCE
                                        </div>
                                        <SyncPlayer ytVideoId={ytId} audioUrl={audioLink} />
                                    </div>
                                )
                            })()
                        ) : selectedMedia.type === 'Video' ? (
                            // 📱 REGULAR VIDEO PLAYER
                            <video src={getCleanUrl(selectedMedia.url)} controls autoPlay style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} />
                        ) : (
                            // 📸 IMAGE VIEWER
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

                    {/* Action Bar (Download, Share, Collab, Access) */}
                    <div style={{ width: '100%', background: '#1a1a2e', padding: '20px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px' }}>
                        
                        {/* 🚫 AGAR FILE KISI NE SHARE KI HAI TOH SIRF VIEW ALLOWED HAI 🚫 */}
                        {selectedMedia.isShared ? (
                            <div style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', padding: '15px', borderRadius: '10px', textAlign: 'center', border: '1px dashed #e74c3c', fontSize: '13px', fontWeight: 'bold' }}>
                                🔒 View-Only Media. Shared with you by {selectedMedia.senderName}. Downloads and sharing are disabled for security.
                            </div>
                        ) : (
                            // NORMAL USER ACTIONS (Owner)
                            <>
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
                                            else setPurchaseModal({ show: true, file: selectedMedia.url, files: [selectedMedia.url], cost: selectedMedia.cost, type: selectedMedia.type, isBatch: false });
                                        }} 
                                        disabled={loading}
                                        style={{ background: selectedMedia.isUnlocked ? '#2ecc71' : '#3498db', color: '#fff', padding: '15px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', width: '100%', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}
                                    >
                                        {loading ? 'Processing...' : (selectedMedia.isUnlocked ? '⬇️ Download Original Quality' : `🔓 Unlock for ${selectedMedia.cost} Coins`)}
                                    </button>
                                )}

                                {selectedMedia.isUnlocked && (
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <button onClick={handleNativeShare} style={{ flex: 1, minWidth: '120px', background: '#f39c12', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>📤 Share</button>
                                        <button onClick={() => setShowCollabModal(true)} style={{ flex: 1, minWidth: '120px', background: 'linear-gradient(45deg, #f09433, #bc1888)', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>🤝 Collab</button>
                                        {/* 👇 NAYA BUTTON: GRANT ACCESS 👇 */}
                                        <button onClick={() => setShowAccessModal(true)} style={{ flex: 1, minWidth: '120px', background: '#8e44ad', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                            🔐 Grant Access
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                        <p style={{ textAlign: 'center', color: '#777', fontSize: '11px', margin: 0 }}>
                            {selectedMedia.isShared ? `Access expires on: ${new Date(selectedMedia.expiryDate).toLocaleString()}` : (selectedMedia.isUnlocked ? "You have full access to this media." : `Once unlocked, access validity: ${activeFolder?.unlockValidity || '24 Hours'}`)}
                        </p>
                    </div>
                </div>
            )}

            {/* ✅ GRANT SECURE ACCESS MODAL (Popup) */}
            {showAccessModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 50px rgba(142,68,173,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ color: '#8e44ad', margin: 0 }}>🔐 Secure Access</h2>
                            <button onClick={() => setShowAccessModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✖</button>
                        </div>
                        <p style={{ color: '#555', fontSize: '13px', marginBottom: '20px' }}>Grant temporary view-only access to another registered user. They cannot download or share it.</p>
                        
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (accessForm.receiverMobile.length !== 10) return alert("Enter valid 10-digit number!");
                            setLoading(true);
                            try {
                                const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
                                const res = await axios.post(`${API_BASE}/grant-media-access`, {
                                    senderMobile: syncUser.mobile,
                                    receiverMobile: accessForm.receiverMobile,
                                    mediaUrl: selectedMedia.url,
                                    mediaType: selectedMedia.type,
                                    hours: accessForm.hours
                                }, { headers: { 'Authorization': `Bearer ${token}` } });
                                
                                if (res.data.success) {
                                    alert(`✅ ${res.data.message}`);
                                    setShowAccessModal(false);
                                } else { alert(`❌ ${res.data.message}`); }
                            } catch (err) { alert("Server Error."); }
                            finally { setLoading(false); }
                        }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            
                            {/* Mobile Number Input */}
                            <input 
                                type="number" 
                                placeholder="Recipient's 10-Digit Mobile" 
                                required 
                                value={accessForm.receiverMobile} 
                                onChange={e => setAccessForm({...accessForm, receiverMobile: e.target.value})} 
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', width: '100%', color: '#333', backgroundColor: '#f8f9fa', outline: 'none' }} 
                            />
                            
                            {/* Time Selection Dropdown */}
                            <select 
                                value={accessForm.hours} 
                                onChange={e => setAccessForm({...accessForm, hours: e.target.value})} 
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', width: '100%', color: '#333', backgroundColor: '#f8f9fa', outline: 'none' }}
                            >
                                <option value="1">⏳ 1 Hour Access</option>
                                <option value="12">⏳ 12 Hours Access</option>
                                <option value="24">⏳ 24 Hours Access</option>
                                <option value="168">⏳ 7 Days Access</option>
                            </select>

                            <button type="submit" disabled={loading} style={{ background: '#8e44ad', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
                                {loading ? 'Granting...' : 'Send Secure Link 🚀'}
                            </button>
                        </form>
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
                                <li>Search and select <strong>@snevio</strong>.</li>
                                <li>Paste the caption below and Post!</li>
                            </ol>
                        </div>

                        <div style={{ background: '#e8f8f5', border: '1px dashed #2ecc71', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>
                            <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontStyle: 'italic', color: '#27ae60' }}>
                                "Beautiful moments captured flawlessly! ✨ Thanks to @snevio for the amazing work. 📸❤️ #Snevio #Photography #Cinematography"
                            </p>
                            <button onClick={() => {
                                navigator.clipboard.writeText("Beautiful moments captured flawlessly! ✨ Thanks to @snevio for the amazing work. 📸❤️ #Snevio #Photography #Cinematography");
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

            {/* ✅ BOOKING DETAILS MODAL */}
            {viewBookingDetails && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
                    <div style={{ background: '#1a1a2e', padding: '30px', borderRadius: '25px', width: '90%', maxWidth: '450px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid #333', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                            <h2 style={{ color: '#fff', margin: 0 }}>🧾 Booking Details</h2>
                            <button onClick={() => setViewBookingDetails(null)} style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#fff', cursor: 'pointer' }}>✖</button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ background: '#0f172a', padding: '15px', borderRadius: '10px' }}>
                                <span style={{ color: '#888', fontSize: '11px' }}>Service Name</span>
                                <h3 style={{ color: '#3498db', margin: '5px 0 0 0' }}>{viewBookingDetails.type}</h3>
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1, background: '#0f172a', padding: '15px', borderRadius: '10px' }}>
                                    <span style={{ color: '#888', fontSize: '11px' }}>Status</span>
                                    <p style={{ color: viewBookingDetails.status === 'Accepted' ? '#2ecc71' : '#f1c40f', margin: '5px 0 0 0', fontWeight: 'bold' }}>{viewBookingDetails.status}</p>
                                </div>
                                <div style={{ flex: 1, background: '#0f172a', padding: '15px', borderRadius: '10px' }}>
                                    <span style={{ color: '#888', fontSize: '11px' }}>Date</span>
                                    <p style={{ color: '#fff', margin: '5px 0 0 0', fontWeight: 'bold' }}>{new Date(viewBookingDetails.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>

                            {viewBookingDetails.proposal && (
                                <>
                                    <div style={{ background: '#0f172a', padding: '15px', borderRadius: '10px' }}>
                                        <span style={{ color: '#888', fontSize: '11px' }}>Deliverables</span>
                                        <p style={{ color: '#fff', margin: '5px 0 0 0', fontSize: '13px' }}>{viewBookingDetails.proposal.deliverables}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <div style={{ flex: 1, background: 'rgba(46, 204, 113, 0.1)', border: '1px solid #2ecc71', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                                            <span style={{ color: '#2ecc71', fontSize: '11px' }}>Total Price</span>
                                            <h3 style={{ color: '#2ecc71', margin: '5px 0 0 0' }}>₹{viewBookingDetails.proposal.totalPrice}</h3>
                                        </div>
                                        <div style={{ flex: 1, background: 'rgba(52, 152, 219, 0.1)', border: '1px solid #3498db', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                                            <span style={{ color: '#3498db', fontSize: '11px' }}>Advance Paid</span>
                                            <h3 style={{ color: '#3498db', margin: '5px 0 0 0' }}>₹{viewBookingDetails.proposal.advanceAmount}</h3>
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            <button onClick={() => setViewBookingDetails(null)} style={{ width: '100%', padding: '15px', background: '#333', color: '#fff', border: 'none', borderRadius: '10px', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Close Details</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ NATIVE HEADER: Flex Item, Shrink-Proof */}
            <header className="ud-header-vip" style={{ 
                flexShrink: 0, /* 🔥 FIX: हेडर कभी नहीं सिकुड़ेगा */
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', boxSizing: 'border-box',
                zIndex: 50, 
                background: 'rgba(15, 23, 42, 0.95)', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                padding: '15px 25px'
            }}>
                
                <div className="brand-logo-vip" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '400', letterSpacing: '3px', color: '#fff' }}>
                        SNE<span style={{ fontWeight: '800', color: '#f1c40f' }}>VIO</span>
                    </h2>
                    <span className="vip-badge-tag" style={{ background: '#f1c40f', color: '#000', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>VIP</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => setShowEmergencyModal(true)} className="emergency-pulse-btn">
                        🚨 Emergency
                    </button>

                    <div className="cart-icon-wrapper" onClick={() => { setShowNotifModal(true); handleMarkNotificationsRead(); }}>
                        🔔
                        {notifications.filter(n => !n.isRead).length > 0 && <span className="cart-badge">{notifications.filter(n => !n.isRead).length}</span>}
                    </div>

                    <div className="cart-icon-wrapper" onClick={() => setShowCartModal(true)}>
                        🛒
                        {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
                    </div>

                    <div className="ud-coin-badge-vip" title="Click to add coins" onClick={() => setShowWalletModal(true)} style={{ cursor: 'pointer', margin: 0 }}>
                        <span className="coin-val-vip">{wallet.coins}</span><span className="coin-label-vip">COINS ➕</span>
                    </div>
                </div>
            </header>

            {/* 🔥 MAIN CONTENT: Takes remaining space & scrolls internally. Zero Padding needed! */}
            <main className="user-main-content" style={{ 
                flex: 1, /* 🔥 FIX: हेडर और फुटर के बीच की जगह ले लेगा */
                overflowY: 'auto', /* 🔥 सिर्फ बीच का हिस्सा स्क्रॉल होगा */
                overflowX: 'hidden', 
                boxSizing: 'border-box', 
                background: '#0a0a0a', 
                width: '100%',
                padding: '0px', /* 🔥 THE FIX: गैप खत्म! */
                margin: '0px'
            }}>
                {renderContent()}
            </main>

            {/* =========================================
                   MODAL 1: Post-Submit Choice (Split Option)
                ========================================= */}
            {showFinalOptModal && (
                <div className="popup-overlay-fixed" style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:999999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', backdropFilter: 'blur(5px)'}}>
                    <div style={{background:'#1a1a2e', padding:'30px', borderRadius:'15px', textAlign:'center', maxWidth:'400px', boxShadow:'0 10px 25px rgba(0,0,0,0.5)', border: '1px solid #3498db'}}>
                        <div style={{fontSize:'50px', marginBottom:'20px'}}>🎉</div>
                        <h2 style={{margin:'0 0 10px 0', color:'#fff'}}>Data Sent to Studio!</h2>
                        <p style={{color:'#aaa', fontSize:'13px', marginBottom:'25px', lineHeight: '1.5'}}>
                            Your selection is safely stored. The studio can now preview it.
                            <br/><br/>
                            <strong style={{color:'#f1c40f'}}>Want to split this selection into 2 separate Albums (e.g., Main & Mini)?</strong>
                            <br/>
                            This option is available for 72 hours. Note: Studio may apply extra charges.
                        </p>
                        
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            <button 
                                onClick={async () => {
                                    try {
                                        const res = await axios.post(`${API_BASE}/projects/${activeSelectionProject._id}/request-split`, {}, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                                        setActiveSelectionProject(res.data.project); // Status: Split Mode
                                        setShowFinalOptModal(false);
                                        alert("Entered Split Mode. Extra charges added.");
                                    } catch(e) { alert("Failed to enter split mode"); }
                                }}
                                style={{background:'#f39c12', color:'#fff', border:'none', padding:'12px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', boxShadow: '0 4px 10px rgba(243, 156, 18, 0.4)'}}>
                                Yes, I want to Split Album (+₹{activeSelectionProject?.extraCharges || 2000})
                            </button>
                            <button 
                                onClick={() => {
                                    setShowFinalOptModal(false);
                                    setActiveSelectionProject(null); // Go home
                                    setCurrentTab('HOME');
                                }}
                                style={{background:'#34495e', color:'#fff', border:'none', padding:'12px', borderRadius:'8px', cursor:'pointer', fontWeight: 'bold'}}>
                                No, I am Done (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================
                   MODAL 2: Copy/Move Popup in Split Mode
                ========================================= */}
            {splitActionModal.show && (
                <div className="popup-overlay-fixed" onClick={() => setSplitActionModal({show:false, image:null})} style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:999999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter: 'blur(5px)'}}>
                    <div onClick={e => e.stopPropagation()} style={{background:'#1a1a2e', padding:'25px', borderRadius:'15px', width:'90%', maxWidth:'350px', border: '1px solid #333', textAlign: 'center'}}>
                        <h3 style={{margin:'0 0 15px 0', color:'#fff'}}>Organize Image</h3>
                        <img src={getCleanUrl(splitActionModal.image.url)} style={{width:'100%', height:'150px', objectFit:'cover', borderRadius:'8px', marginBottom:'15px', border: '2px solid #555'}}/>
                        
                        <p style={{fontSize:'12px', color:'#aaa', marginBottom:'20px'}}>
                            Currently in: <strong style={{color:'#f1c40f'}}>{splitActionModal.image.albumTag || 'Album 1'}</strong>.<br/>
                            Select action for <strong style={{color:'#3498db'}}>Album 2</strong>:
                        </p>

                        <div style={{display:'flex', gap:'10px'}}>
                            <button 
                                disabled={isProcessingSplit}
                                onClick={() => executeShift(activeSelectionProject._id, splitActionModal.image.url, 'Album 2', false)}
                                style={{flex:1, background:'#3498db', color:'#fff', border:'none', padding:'12px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>
                                {isProcessingSplit ? '...' : '🔄 Move'}
                            </button>
                            <button 
                                disabled={isProcessingSplit}
                                onClick={() => executeShift(activeSelectionProject._id, splitActionModal.image.url, 'Album 2', true)}
                                style={{flex:1, background:'#2ecc71', color:'#fff', border:'none', padding:'12px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>
                                {isProcessingSplit ? '...' : '👯 Copy'}
                            </button>
                        </div>
                        <button 
                            onClick={() => setSplitActionModal({show:false, image:null})}
                            style={{background:'#e74c3c', color:'#fff', border:'none', padding:'10px', borderRadius:'8px', cursor:'pointer', width: '100%', marginTop: '10px', fontWeight: 'bold'}}>
                            Cancel
                        </button>
                        
                        <p style={{fontSize:'10px', color:'#777', marginTop:'15px', lineHeight: '1.4'}}>
                            <span style={{color:'#3498db'}}>Move:</span> Removes from Album 1, adds to Album 2.<br/>
                            <span style={{color:'#2ecc71'}}>Copy:</span> Keeps in Album 1, also adds to Album 2.
                        </p>
                    </div>
                </div>
            )}

            {/* 🔥 NAYA: ZEN MODE EXIT INDICATOR (Shows only when Focus Mode is active) */}
            {activeSelectionProject && (
                <div onClick={() => { setActiveSelectionProject(null); setCurrentTab('HOME'); setSelectionDraft([]); }} style={{ position: 'fixed', bottom: '15px', left: '50%', transform: 'translateX(-50%)', background: '#34495e', color: '#fff', padding: '8px 20px', borderRadius: '30px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 105, cursor: 'pointer' }}>
                    🧘‍♂️ Focus Mode Active <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '15px' }}>Tap to Exit</span>
                </div>
            )}

            {/* 📱 SMART BOTTOM INSTALL BANNER (15s Timer) */}
            {showInstallBanner && (
                <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '400px', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', padding: '15px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1000, boxShadow: '0 -5px 25px rgba(0,0,0,0.5)', border: '1px solid #3498db', animation: 'slideUp 0.5s ease-out' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '45px', height: '45px', background: '#f1c40f', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📸</div>
                        <div>
                            <h4 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>Install Snevio App</h4>
                            <p style={{ margin: 0, color: '#aaa', fontSize: '11px' }}>For faster access & offline viewing</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setShowInstallBanner(false)} style={{ background: 'transparent', border: 'none', color: '#777', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Later</button>
                        <button onClick={async () => {
                            setShowInstallBanner(false);
                            const promptEvent = window.deferredPrompt;
                            if (promptEvent) {
                                promptEvent.prompt();
                                const { outcome } = await promptEvent.userChoice;
                                console.log(`User Choice: ${outcome}`);
                                window.deferredPrompt = null;
                            }
                        }} style={{ background: '#3498db', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>Install</button>
                    </div>
                </div>
            )}

            {/* 🔥 NATIVE BOTTOM NAV: Flex Item at bottom */}
            {!activeSelectionProject && (
            <nav className="bottom-nav-bar" style={{ 
                    flexShrink: 0, 
                    display: 'flex', justifyContent: 'space-around', padding: '10px 5px',
                    width: '100%', 
                    background: 'rgba(15, 23, 42, 0.98)', 
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)', zIndex: 50, boxSizing: 'border-box'
                }}>
                    <button className={`nav-item ${currentTab === 'HOME' ? 'active' : ''}`} onClick={() => handleTabChange('HOME')}>
                        🏠<span>Home</span>
                    </button>
                    <button className={`nav-item ${currentTab === 'SHARED' ? 'active' : ''}`} onClick={() => handleTabChange('SHARED')}>
                        🔐<span>Shared</span>
                    </button>
                    <button className={`nav-item ${currentTab === 'SERVICES' ? 'active' : ''}`} onClick={() => handleTabChange('SERVICES')}>
                        📸<span>Services</span>
                    </button>
                    <button className={`nav-item ${currentTab === 'BOOKINGS' ? 'active' : ''}`} onClick={() => handleTabChange('BOOKINGS')}>
                        📅<span>Bookings</span>
                    </button>
                    <button className={`nav-item ${currentTab === 'HISTORY' ? 'active' : ''}`} onClick={() => handleTabChange('HISTORY')}>
                        📜<span>History</span>
                    </button>
                    <button className={`nav-item ${currentTab === 'PROFILE' ? 'active' : ''}`} onClick={() => handleTabChange('PROFILE')}>
                        👤<span>{(editName || 'User').split(' ')[0]}</span>
                    </button>
                </nav>
            )}
            {/* 🍞 TOAST NOTIFICATION UI */}
            {toast.show && (
                <div style={{
                    position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
                    background: toast.type === 'success' ? '#2ecc71' : '#e74c3c',
                    color: '#fff', padding: '12px 25px', borderRadius: '30px',
                    zIndex: 9999999, fontWeight: 'bold', fontSize: '14px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)', animation: 'slideUp 0.3s ease-out'
                }}>
                    {toast.message}
                </div>
            )}
        </div>
    );
};

export default UserDashboard;