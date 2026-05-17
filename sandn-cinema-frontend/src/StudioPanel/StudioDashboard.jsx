import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import './StudioDashboard.css'; 
import useBackButton from '../hooks/useBackButton';
import SyncPlayer from '../components/SyncPlayer';
import io from 'socket.io-client'; // 👈 NAYA: Socket.io Client Import

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';
const SERVER_URL = 'https://sandn-cinema.onrender.com/';

// ✅ SUPER TOKEN GRABBER: Ye 'token' aur 'authToken' dono ko check karega, kabhi Khali (null) nahi bhejega!
const getValidToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
};

const StudioDashboard = ({ user, onLogout }) => {
    // --- UI TABS STATES ---
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const [showExitPopup, setShowExitPopup] = useState(false);

    // ✅ NEW: DROPDOWN MENU STATE FOR SIDEBAR
    const [openDropdown, setOpenDropdown] = useState(null);

    // ✅ NEW: LONG MEDIA (CINEMATIC) UPLOAD STATES
    const [longMediaForm, setLongMediaForm] = useState({ title: '', description: '', category: 'Wedding Highlight', customPrice: '', ytLink: '', freeHours: '0', monthlyPrice: '', yearlyPrice: '' });
    const [longMediaFile, setLongMediaFile] = useState(null);
    const [longMediaPreview, setLongMediaPreview] = useState('');
    const [isLongUploading, setIsLongUploading] = useState(false);
    
    // 🔥 NEW: AUDIO vs VIDEO TOGGLE & 500MB CHECKER
    const [uploadMode, setUploadMode] = useState('AUDIO'); // Default 'AUDIO' rakhna safe hai
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

    // ✅ PREMIUM UPLOADER STATES (For Feed Drag & Drop)
    const [isDragging, setIsDragging] = useState(false);
    const [feedPreviews, setFeedPreviews] = useState([]);

    // ✅ NEW: FEED FORM STATES WITH CUSTOM EXPIRY
    const [feedDescription, setFeedDescription] = useState('');
    const [feedCategory, setFeedCategory] = useState('trending');
    const [feedPrice, setFeedPrice] = useState('');
    const [feedExpiryType, setFeedExpiryType] = useState('permanent'); // Predefined & Custom Logic
    const [customExpiryHours, setCustomExpiryHours] = useState('');

    // ✅ NEW: SMART ALBUM SELECTION STATES
    const [uploadType, setUploadType] = useState('NORMAL'); // 'NORMAL' or 'SELECTION'
    const [selectionForm, setSelectionForm] = useState({ sheetLimit: '30', imagesPerSheet: '4', costPerExtraSheet: '150', totalPhases: '3' });
    const [mySelections, setMySelections] = useState([]); // Projects list
    const [fetchingSelections, setFetchingSelections] = useState(false);

    // ✅ NEW: SEARCH CLIENT STATE
    const [clientSearchQuery, setClientSearchQuery] = useState('');

    // --- FOLDER & FILE COUNTER STATES ---
    const [folderName, setFolderName] = useState('');
    const [useDateFolder, setUseDateFolder] = useState(false); 
    
    // --- LIMIT & EXPIRY STATES ---
    const [expiryDays, setExpiryDays] = useState('');
    const [downloadLimit, setDownloadLimit] = useState('');

    // 🏷️ NEW: DYNAMIC SUBSCRIPTION PLANS
    const [subPlans, setSubPlans] = useState([]);

    const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);
    const [showMobileSuggestions, setShowMobileSuggestions] = useState(false);
    const [fileStats, setFileStats] = useState({ photos: 0, videos: 0, feedPhotos: 0, feedVideos: 0 }); 

    // ✅ NEW: SMART DOWNLOADER STATES
    const [downloadManager, setDownloadManager] = useState({ 
        active: false, paused: false, projectId: null, clientName: '', 
        totalFiles: 0, downloadedFiles: 0, progressPercent: 0, speed: '', eta: '', failedFiles: [] 
    });
    const abortControllerRef = useRef(null);
    const [showNotifications, setShowNotifications] = useState(false); // ✅ Added Notification State
    
    // ✅ NEW: VIEW CLIENT UI STATE (For Modal)
    const [previewProject, setPreviewProject] = useState(null);

    // --- UPLOAD PROGRESS TRACKER STATES ---
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [uploadETA, setUploadETA] = useState('');
    const [uploadStats, setUploadStats] = useState(''); // 🔥 NAYA: Kitna MB upload hua
    const [uploadController, setUploadController] = useState(null); // 🔥 NAYA: Upload rokne ke liye (Abort)
    const [uploadLogSearch, setUploadLogSearch] = useState('');
    const [uploadLogLimit, setUploadLogLimit] = useState(5);

    // ==========================================
    // 📱 PWA INSTALL (ADD TO HOME SCREEN) LOGIC
    // ==========================================
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault(); // Browser ka default popup roko
            setDeferredPrompt(e); // Event ko save kar lo
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        }
    };

    // ==========================================
    // 💡 SCREEN WAKE LOCK (PREVENT SLEEP) LOGIC
    // ==========================================
    const wakeLockRef = useRef(null);
    
    // Check: Agar normal upload ya long video upload chal raha hai toh true hoga
    const isActivelyUploading = loading || isLongUploading || (uploadProgress > 0 && uploadProgress < 100);

    useEffect(() => {
        const requestWakeLock = async () => {
            if ('wakeLock' in navigator && isActivelyUploading) {
                try {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                    console.log('💡 Screen Wake Lock Active: Screen will NOT sleep during upload!');
                } catch (err) {
                    console.error('Wake Lock failed:', err);
                }
            }
        };

        const releaseWakeLock = async () => {
            if (wakeLockRef.current !== null && !isActivelyUploading) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                console.log('💤 Wake Lock Released: Screen can sleep now.');
            }
        };

        if (isActivelyUploading) requestWakeLock();
        else releaseWakeLock();

        return () => {
            if (wakeLockRef.current) {
                wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
        };
    }, [isActivelyUploading]);

    // 🚀 NEW: LIVE TRACKER STATES
    const [liveActionText, setLiveActionText] = useState(''); 
    const [fileProgressMap, setFileProgressMap] = useState({}); 
    const fileProgressRef = useRef({});

    // ✅ STUDIO REMOVE TAB STATES
    const [studioRemoveMobile, setStudioRemoveMobile] = useState('');
    const [studioRemoveSearchSuggestions, setStudioRemoveSearchSuggestions] = useState(false);
    const [studioRemoveUserObj, setStudioRemoveUserObj] = useState(null);

    // ✅ NEW: MY FEED POSTS STATES
    const [myFeedPosts, setMyFeedPosts] = useState([]);
    const [fetchingFeed, setFetchingFeed] = useState(false);

    // ✅ NEW: STUDIO WITHDRAWAL & PAYOUT STATES
    const [withdrawForm, setWithdrawForm] = useState({ amount: '', upiId: '' });
    const [myPayouts, setMyPayouts] = useState([]);
    const [fetchingPayouts, setFetchingPayouts] = useState(false);

    const fetchMyPayouts = async () => {
        setFetchingPayouts(true);
        try {
            const res = await axios.get(`${API_BASE}/my-payouts`, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if (res.data.success) setMyPayouts(res.data.data);
        } catch(e) { console.error("Failed to fetch payouts"); }
        setFetchingPayouts(false);
    };

    // ✅ NEW: BOOKING LEADS & PROPOSAL STATES
    const [studioBookings, setStudioBookings] = useState([]);
    const [fetchingBookings, setFetchingBookings] = useState(false);
    const [activeProposalBooking, setActiveProposalBooking] = useState(null);
    const [proposalForm, setProposalForm] = useState({
        totalPrice: '',
        advanceAmount: '',
        deliverables: 'Complete edited photos & cinematic highlight video',
        terms: '30% Advance is non-refundable. Final payment is required before full data delivery.',
        expiryHours: '48'
    });

    // ✅ LOAD PENDING DRAFT ON START
    useEffect(() => {
        const savedDraft = localStorage.getItem('feedUploadDraft');
        if (savedDraft) {
            const parsed = JSON.parse(savedDraft);
            setFeedDescription(parsed.desc || '');
            setFeedCategory(parsed.cat || 'trending');
            setFeedPrice(parsed.price || '');
            setFeedExpiryType(parsed.expType || 'permanent');
            setCustomExpiryHours(parsed.customExp || '');
        }
    }, []);

    // ✅ SAVE DRAFT AUTOMATICALLY ON CHANGE
    useEffect(() => {
        localStorage.setItem('feedUploadDraft', JSON.stringify({
            desc: feedDescription,
            cat: feedCategory,
            price: feedPrice,
            expType: feedExpiryType,
            customExp: customExpiryHours
        }));
    }, [feedDescription, feedCategory, feedPrice, feedExpiryType, customExpiryHours]);

    // ✅ HELPER: 72-HOUR CHECKER FOR SPLIT MODE
    const isSplitWindowActive = (project) => {
        if (!project || !project.finalSubmissionDate) return false;
        if (project.splitCompleted) return false;
        const now = new Date();
        const submittedAt = new Date(project.finalSubmissionDate);
        const hoursDiff = (now - submittedAt) / (1000 * 60 * 60);
        return hoursDiff <= 72;
    };

    // --- PROFILE EDIT STATES (WITH PORTFOLIO) ---
    const [profileEdit, setProfileEdit] = useState({
        studioName: user.studioName || '',
        ownerName: user.ownerName || '',
        email: user.email || '',
        password: '',
        location: user.location || '',
        portfolioUrl: user.portfolioUrl || '' 
    });

    // --- 1. FETCH LOGIC & 🔥 REAL-TIME WEBSOCKETS ---
    useEffect(() => {
        if (user && user.mobile) {
            // Initial Fetch
            fetchMyProfile();
            fetchClients();
            fetchStudioBookings();
            fetchSubPlans(); // Fetch dynamic plans
            if (studioProfile.isFeedApproved) fetchMyFeedPosts();

            // 🚀 SOCKET.IO REAL-TIME CONNECTION
            const socket = io(SERVER_URL); 

            // Connect hone par apna mobile number bhej kar private "Room" me jud jao
            socket.on('connect', () => {
                socket.emit('join_user_room', user.mobile);
            });

            // 🔥 JAB BHI BACKEND SE SIGNAL AAYE, CHUPCHAAP DATA REFRESH MARO!
            socket.on('data_updated', (data) => {
                console.log("⚡ Studio Real-time update received! Fetching fresh data...");
                fetchMyProfile();
                fetchClients();
                fetchStudioBookings();
                if (studioProfile.isFeedApproved) fetchMyFeedPosts();
            });

            // Cleanup Socket on unmount
            return () => {
                if (socket) socket.disconnect();
            };
        }
    }, [user, studioProfile.isFeedApproved]);

    // Update specific tabs instantly when clicked (Bonus responsiveness)
    useEffect(() => {
        if (activeTab === 'LEADS') fetchStudioBookings();
        if (activeTab === 'FEED' && studioProfile.isFeedApproved) fetchMyFeedPosts();
        if (activeTab === 'DASHBOARD') fetchClients();
        if (activeTab === 'PAYOUTS') fetchMyPayouts(); // 💳 Naya Payouts Fetch
    }, [activeTab]);

    // ✅ 1. SMART NETWORK MONITOR & 5-MIN GRACE PERIOD
    const [isNetworkDown, setIsNetworkDown] = useState(!navigator.onLine);
    const [pendingResumeState, setPendingResumeState] = useState(null);

    useEffect(() => {
        let logoutTimer;
        const handleOffline = () => {
            setIsNetworkDown(true);
            // 5 Minutes (300,000 ms) wait before forcing logout
            logoutTimer = setTimeout(() => {
                alert("⚠️ Connection timeout! You have been logged out for security. Your upload progress has been saved.");
                sessionStorage.removeItem('user'); 
                localStorage.removeItem('user');
                if (onLogout) onLogout();
                else window.location.href = "/SandN-Cinema/"; 
            }, 300000); 
        };

        const handleOnline = () => {
            setIsNetworkDown(false);
            if (logoutTimer) clearTimeout(logoutTimer);
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        
        // Check for failed drafts on load
        const savedDraft = localStorage.getItem('snevio_failed_upload');
        if (savedDraft) setPendingResumeState(JSON.parse(savedDraft));

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            if (logoutTimer) clearTimeout(logoutTimer);
        };
    }, [onLogout]);

    // ✅ 2. RESUME UPLOAD CLICK HANDLER
    const handleResumeClick = () => {
        if(pendingResumeState) {
            setClientMobile(pendingResumeState.clientMobile);
            setFolderName(pendingResumeState.folderName);
            setActiveTab('UPLOAD');
            alert(`🔄 Ready to resume! Please select the SAME folder/files. We will automatically skip the ${pendingResumeState.uploadedFiles.length} files that are already safe on the server.`);
        }
    };

    useBackButton(() => {
        if (showExitPopup) {
            setShowExitPopup(false);
        } else if (activeProposalBooking) {
            setActiveProposalBooking(null); 
        } else if (studioRemoveUserObj) {
            setStudioRemoveUserObj(null); 
        } else if (activeTab !== 'DASHBOARD') { 
            setActiveTab('DASHBOARD'); 
        } else {
            setShowExitPopup(true);
        }
    });

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
                    location: res.data.data.location || '',
                    portfolioUrl: res.data.data.portfolioUrl || ''
                });
                sessionStorage.setItem('user', JSON.stringify(res.data.data)); 
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

    const fetchStudioBookings = async () => {
        setFetchingBookings(true);
        try {
            const res = await axios.get(`${API_BASE}/get-bookings?t=${Date.now()}`); 
            if (res.data.success) {
                const myLeads = res.data.data.filter(b => b.providerTarget === (studioProfile.studioName || user.ownerName));
                setStudioBookings(myLeads);
            }
        } catch (e) {
            console.error("Failed to fetch leads", e);
        } finally {
            setFetchingBookings(false);
        }
    };

    const fetchMyFeedPosts = async () => {
        setFetchingFeed(true);
        try {
            const res = await axios.get(`${API_BASE}/get-public-feed?t=${Date.now()}`); 
            if (res.data.success) {
                const myPosts = res.data.data.filter(post => post.studioMobile === user.mobile);
                setMyFeedPosts(myPosts);
            }
        } catch (e) {
            console.error("Failed to fetch feed posts", e);
        } finally {
            setFetchingFeed(false);
        }
    };

    const fetchSubPlans = async () => {
        try {
            const res = await axios.get(`${API_BASE}/get-subscription-plans`);
            if(res.data.success) setSubPlans(res.data.data);
        } catch(e) { console.error("Failed to fetch plans"); }
    };

    const fetchStudioSelections = async () => {
        setFetchingSelections(true);
        try {
            const res = await axios.post(`${API_BASE}/get-studio-selections`, {}, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if(res.data.success) setMySelections(res.data.data);
        } catch(e) { console.error("Failed to fetch selections"); }
        setFetchingSelections(false);
    };

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

    // ✅ UPGRADED: Can read files OR entire folders natively!
    const handleFileChange = (e, isFolderUpload = false) => {
        const selectedFiles = Array.from(e.target.files);
        
        // Filter out junk files (like .DS_Store on Mac or .ini on Windows)
        const validMediaFiles = selectedFiles.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
        
        // Extract sub-folder names automatically from the file path
        const structuredFiles = validMediaFiles.map(file => {
            let extractedSubFolder = 'Main Event';
            if (isFolderUpload && file.webkitRelativePath) {
                // Path looks like: "Wedding_Data/Haldi/IMG_001.jpg"
                const pathParts = file.webkitRelativePath.split('/');
                if (pathParts.length >= 3) {
                    extractedSubFolder = pathParts[pathParts.length - 2]; // Get the immediate parent folder name (e.g., 'Haldi')
                }
            }
            // Safely attach the subfolder name to the file object
            Object.defineProperty(file, 'customSubFolder', { value: extractedSubFolder, writable: true });
            return file;
        });

        setFiles(prev => [...prev, ...structuredFiles]);
        
        const photos = structuredFiles.filter(file => file.type.startsWith('image/')).length;
        const videos = structuredFiles.filter(file => file.type.startsWith('video/')).length;
        
        // 🚀 NEW: Count unique folders
        const uniqueFolders = new Set(structuredFiles.map(f => f.customSubFolder || 'Main Event'));
        setFileStats(prev => ({ 
            ...prev, 
            photos: prev.photos + photos, 
            videos: prev.videos + videos,
            subFolders: uniqueFolders.size 
        }));
    };

    const processFeedFiles = (selectedFiles) => {
        const validFiles = selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
        if (validFiles.length === 0) return alert("Only image and video files are allowed!");

        const newPreviews = validFiles.map(file => ({
            file,
            url: URL.createObjectURL(file),
            type: file.type,
            name: file.name
        }));

        setFeedFiles(prev => [...prev, ...validFiles]);
        setFeedPreviews(prev => [...prev, ...newPreviews]);

        const allFiles = [...feedFiles, ...validFiles];
        const feedPhotos = allFiles.filter(f => f.type.startsWith('image/')).length;
        const feedVideos = allFiles.filter(f => f.type.startsWith('video/')).length;
        setFileStats(prev => ({ ...prev, feedPhotos, feedVideos }));
    };

    const handleFeedDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleFeedDragLeave = () => { setIsDragging(false); };
    const handleFeedDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        processFeedFiles(droppedFiles);
    };

    const removeFeedFile = (indexToRemove) => {
        const updatedFiles = feedFiles.filter((_, i) => i !== indexToRemove);
        const updatedPreviews = feedPreviews.filter((_, i) => i !== indexToRemove);
        setFeedFiles(updatedFiles);
        setFeedPreviews(updatedPreviews);
        const feedPhotos = updatedFiles.filter(f => f.type.startsWith('image/')).length;
        const feedVideos = updatedFiles.filter(f => f.type.startsWith('video/')).length;
        setFileStats(prev => ({ ...prev, feedPhotos, feedVideos }));
    };

    // 🛡️ Data Masking Helpers for Security
    const maskName = (name) => {
        if (!name) return '';
        if (name.length <= 2) return name;
        return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
    };

    const maskEmail = (email) => {
        if (!email || !email.includes('@')) return '';
        const [local, domain] = email.split('@');
        if (local.length <= 2) return email;
        return local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1) + '@' + domain;
    };

    const handleMobileChange = async (e) => {
        const val = e.target.value;
        setClientMobile(val);
        setShowMobileSuggestions(val.length > 0);

        // 1. Existing Client Check (Full Details)
        const exactMatch = clients.find(c => c.mobile === val);
        if (exactMatch) {
            setClientName(exactMatch.name || exactMatch.studioName || '');
            setClientEmail(exactMatch.email && !exactMatch.email.includes('dummy_') ? exactMatch.email : ''); 
        } 
        // 2. Global Search for New Clients (Masked Details)
        else if (val.length === 10) {
            try {
                const res = await axios.post(`${API_BASE}/search-account`, { mobile: val });
                if (res.data.success && res.data.data) {
                    const globalUser = res.data.data;
                    setClientName(maskName(globalUser.name || globalUser.studioName || 'Client'));
                    if (globalUser.email && !globalUser.email.includes('dummy_')) {
                        setClientEmail(maskEmail(globalUser.email));
                    } else {
                        setClientEmail('');
                    }
                    alert("User found in Snevio Network! Details are masked for privacy.");
                } else {
                    setClientName('');
                    setClientEmail('');
                }
            } catch (err) {
                console.log("Global search failed");
            }
        } 
        else {
            setClientName('');
            setClientEmail('');
        }
    };


// 🛑 STOP UPLOAD LOGIC
    const handleStopUpload = () => {
        if (uploadController) {
            uploadController.abort(); // API Request ko turant rok dega
            setUploadController(null);
            setLoading(false);
            setUploadProgress(0);
            setUploadStats('');
            setUploadSpeed('');
            setUploadETA('');
            alert("⚠️ Upload stopped by user.");
        }
    };

// 🚀 DIRECT CLOUDINARY UPLOAD FUNCTION (5x HIGH-SPEED PARALLEL UPLOAD)
    const handleUpload = async (isFeed = false) => {
        if (!isFeed && (!clientMobile || clientMobile.length !== 10)) return alert("Please enter a valid 10-digit mobile number.");
        const currentFiles = isFeed ? feedFiles : files;
        if (currentFiles.length === 0) return alert("Please select files to upload.");

        let baseFolder = folderName.trim() || 'Snevio Photography';
        let targetSubFolder = '';
        if (useDateFolder && !isFeed) {
            targetSubFolder = new Date().toLocaleDateString('en-GB').replace(/\//g, '-'); 
        }
        
        const isResuming = pendingResumeState && pendingResumeState.clientMobile === clientMobile && pendingResumeState.folderName === baseFolder;
        let alreadyUploadedNames = isResuming ? pendingResumeState.uploadedFiles : [];
        
        const filesToUpload = isFeed ? currentFiles : currentFiles.filter(file => !alreadyUploadedNames.includes(file.name));
        
        if (!isFeed && filesToUpload.length === 0 && currentFiles.length > 0) {
            alert("✅ All selected files are already uploaded!");
            localStorage.removeItem('snevio_failed_upload');
            setPendingResumeState(null);
            return;
        }

        setLoading(true);
        setUploadProgress(0);
        setUploadSpeed(isResuming ? 'Resuming Upload...' : 'Preparing Upload...');
        setUploadETA('Calculating...');

        const totalBytes = filesToUpload.reduce((acc, file) => acc + file.size, 0);
        const loadedBytesArray = new Array(filesToUpload.length).fill(0);
        const uploadedUrls = isResuming ? pendingResumeState.uploadedUrlsList || [] : [];

        let startTime = Date.now();
        let lastTime = startTime;
        let lastTotalLoaded = 0;

        const controller = new AbortController();
        setUploadController(controller);

        if (!fileProgressRef.current) fileProgressRef.current = {};

        try {
            let fallbackSpeed = '0.00';

            const speedTracker = setInterval(() => {
                const totalLoaded = loadedBytesArray.reduce((acc, val) => acc + val, 0);
                let bytesLoadedSinceLast = totalLoaded - lastTotalLoaded;
                if (bytesLoadedSinceLast < 0) bytesLoadedSinceLast = 0; 

                const instantSpeedBps = bytesLoadedSinceLast / 0.5;
                const speedMbps = (instantSpeedBps / (1024 * 1024)).toFixed(2);
                if (instantSpeedBps > 0) fallbackSpeed = speedMbps;
                setUploadSpeed(`${fallbackSpeed} MB/s (Stable Sync 🚀)`);

                const elapsedTimeSec = (Date.now() - startTime) / 1000;
                const averageSpeedBps = totalLoaded / elapsedTimeSec; 
                const bytesRemaining = Math.max(0, totalBytes - totalLoaded);
                
                const etaSeconds = averageSpeedBps > 0 ? bytesRemaining / averageSpeedBps : 0;

                const percentCompleted = Math.round((totalLoaded * 100) / totalBytes) || 0;
                setUploadProgress(Math.min(percentCompleted, 99));

                if (percentCompleted >= 98) {
                    setUploadETA(`Almost done... Saving data`);
                } else if (etaSeconds > 60) {
                    setUploadETA(`Total: ${Math.floor(etaSeconds / 60)}m ${Math.floor(etaSeconds % 60)}s left`);
                } else if (etaSeconds > 0 && etaSeconds !== Infinity) {
                    setUploadETA(`Total: ${Math.floor(etaSeconds)}s left`);
                } else {
                    setUploadETA(`Calculating total time...`);
                }

                const loadedMB = (totalLoaded / (1024 * 1024)).toFixed(2);
                const totalMBStr = (totalBytes / (1024 * 1024)).toFixed(2);
                setUploadStats(`Uploaded: ${loadedMB} MB / ${totalMBStr} MB`);

                setFileProgressMap({ ...fileProgressRef.current });
                lastTotalLoaded = totalLoaded; 
            }, 500);

            let currentIndex = 0;
            const activePromises = new Set(); 

            while (currentIndex < filesToUpload.length) {
                const file = filesToUpload[currentIndex];
                const globalIndex = currentIndex;
                currentIndex++;

                const isVid = file.type.startsWith('video/');
                const concurrencyLimit = isVid ? 1 : 5; 

                while (activePromises.size >= concurrencyLimit) {
                    await Promise.race(activePromises);
                }

                await new Promise(resolve => setTimeout(resolve, 100));

                setLiveActionText(`Uploading ${file.name.substring(0, 15)}...`);

                const uploadTask = (async () => {
                    let attempt = 0;
                    const maxAttempts = 3;
                    let successData = null;

                    while (attempt < maxAttempts) {
                        try {
                            attempt++;
                            loadedBytesArray[globalIndex] = 0; 

                            const sigRes = await axios.post(`${API_BASE}/generate-upload-signature`, {
                                fileName: file.name, 
                                fileType: file.type, 
                                fileSizeGB: file.size / (1024 * 1024 * 1024),
                                targetFolder: file.customSubFolder ? `${baseFolder}/${file.customSubFolder}` : baseFolder
                            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` }, signal: controller.signal });

                            if (sigRes.data.directUpload) {
                                let finalUrl = '';
                                
                                if (sigRes.data.provider === 'CLOUDINARY') {
                                    const cFormData = new FormData();
                                    cFormData.append('file', file);
                                    cFormData.append('api_key', sigRes.data.apiKey);
                                    cFormData.append('timestamp', sigRes.data.timestamp);
                                    cFormData.append('signature', sigRes.data.signature);
                                    cFormData.append('folder', sigRes.data.folder);

                                    // 🔥 THE CORS FIX: Native Fetch API to Bypass Global Axios CORS Headers
                                    const fetchResponse = await fetch(`https://api.cloudinary.com/v1_1/${sigRes.data.cloudName}/auto/upload`, {
                                        method: 'POST',
                                        body: cFormData,
                                        signal: controller.signal
                                    });

                                    if (!fetchResponse.ok) throw new Error(`Cloudinary Error: ${fetchResponse.statusText}`);
                                    const cData = await fetchResponse.json();
                                    finalUrl = cData.secure_url;
                                } 
                                else {
                                    const fetchResponse = await fetch(sigRes.data.signedUrl, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': file.type },
                                        body: file,
                                        signal: controller.signal
                                    });

                                    if (!fetchResponse.ok) throw new Error("AWS Error");
                                    finalUrl = sigRes.data.publicUrl;
                                }

                                loadedBytesArray[globalIndex] = file.size;
                                fileProgressRef.current[file.name] = 100;
                                successData = isFeed ? finalUrl : { url: finalUrl, subFolder: file.customSubFolder || targetSubFolder || 'Main Event' };
                                break; 
                            }
                            else {
                                if (file.size > 100 * 1024 * 1024) {
                                    alert(`🚨 File too large for proxy!`);
                                    throw new Error("File too large");
                                }

                                const fd = new FormData();
                                fd.append('file', file);
                                fd.append('skipPreview', 'true'); 

                                const proxyRes = await axios.post(`${API_BASE}/proxy-upload`, fd, {
                                    headers: { 'Authorization': `Bearer ${getValidToken()}` },
                                    signal: controller.signal, 
                                    onUploadProgress: (e) => {
                                        if (e.lengthComputable) {
                                            loadedBytesArray[globalIndex] = e.loaded;
                                            fileProgressRef.current[file.name] = Math.round((e.loaded * 100) / e.total);
                                        }
                                    }
                                });

                                loadedBytesArray[globalIndex] = file.size;
                                fileProgressRef.current[file.name] = 100;
                                successData = isFeed ? proxyRes.data.url : { url: proxyRes.data.url, subFolder: file.customSubFolder || targetSubFolder || 'Main Event' };
                                break; 
                            }
                        } catch (err) {
                            if (err.name === "AbortError" || axios.isCancel(err)) throw err; 
                            if (!navigator.onLine) {
                                setUploadSpeed('Paused (No Internet) ⚠️');
                                attempt--; 
                                await new Promise(res => {
                                    const goOnline = () => { window.removeEventListener('online', goOnline); res(); };
                                    window.addEventListener('online', goOnline);
                                });
                            } else {
                                console.error(`🚨 Error on [${file.name}]:`, err.message);
                                if (attempt >= maxAttempts) { 
                                    loadedBytesArray[globalIndex] = 0; 
                                    fileProgressRef.current[file.name] = -1; // ❌ MARK AS FAILED
                                    return null; 
                                }
                                await new Promise(resolve => setTimeout(resolve, 3000));
                            }
                        }
                    }
                    return successData;
                })();

                const wrappedTask = (async () => {
                    try {
                        const data = await uploadTask;
                        if (data) {
                            uploadedUrls.push(data);
                            if (!isFeed) {
                                alreadyUploadedNames.push(file.name);
                                const updatedDraft = { clientMobile, folderName: baseFolder, uploadedFiles: alreadyUploadedNames, uploadedUrlsList: uploadedUrls };
                                localStorage.setItem('snevio_failed_upload', JSON.stringify(updatedDraft));
                                setPendingResumeState(updatedDraft);
                            }
                        }
                        return data;
                    } finally {
                        activePromises.delete(wrappedTask); 
                    }
                })();

                activePromises.add(wrappedTask);
            }

            await Promise.all(activePromises);
            clearInterval(speedTracker); 
            
            const failedFilesList = filesToUpload.filter(f => fileProgressRef.current[f.name] === -1).map(f => f.name);
            const failedFilesCount = failedFilesList.length;
            
            if (failedFilesCount > 0) {
                setUploadSpeed(`⚠️ ${failedFilesCount} files failed`);
                setUploadETA('Waiting for your permission...');
                setFileProgressMap({ ...fileProgressRef.current });

                const userWantsRetry = window.confirm(`⚠️ ${failedFilesCount} files failed due to network drop.\n\nDo you want the system to Auto-Retry them right now?\n\n✅ Click 'OK' to Retry failed files.\n❌ Click 'Cancel' to skip them and save the successfully uploaded files to the database.`);
                
                if (userWantsRetry) {
                    return handleUpload(isFeed);
                }
            }

            if (uploadedUrls.length === 0 && !isResuming) {
                setLoading(false);
                return alert("❌ All uploads failed. Database save aborted.");
            }

            setUploadProgress(100);
            setUploadSpeed('Finalizing...');
            setUploadETA('Saving Data to Server...');

            if (isFeed) {
                let finalExpiryHours = '';
                if (feedExpiryType === 'custom') finalExpiryHours = customExpiryHours;
                else if (feedExpiryType !== 'permanent') finalExpiryHours = feedExpiryType;

                const feedPayload = {
                    mobile: studioProfile.mobile,
                    studioName: studioProfile.studioName || user.ownerName,
                    description: feedDescription,
                    feedCategory: feedCategory,
                    price: feedPrice,
                    expiryHours: finalExpiryHours, 
                    fileUrls: uploadedUrls 
                };
                
                const feedRes = await axios.post(`${API_BASE}/upload-feed-post`, feedPayload, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                
                if (feedRes.data.success) {
                    setUploadETA('Complete!');
                    localStorage.removeItem('feedUploadDraft');
                    setTimeout(() => {
                        alert(`✅ Success: ${feedRes.data.message}`);
                        setUploadProgress(0); setUploadSpeed(''); setUploadETA('');
                        setFeedFiles([]); setFeedPreviews([]);
                        setFeedDescription(''); setFeedPrice(''); setFeedCategory('trending');
                        setFeedExpiryType('permanent'); setCustomExpiryHours('');
                        setFileStats(prev => ({ ...prev, feedPhotos: 0, feedVideos: 0 }));
                        setLoading(false);
                        fetchMyFeedPosts(); 
                    }, 500);
                } else {
                    alert(`❌ Error: ${feedRes.data.message}`); 
                    setLoading(false);
                }
                return; 
            }

            const uploadReportData = { total: currentFiles.length, success: uploadedUrls.length, failed: failedFilesCount, failedNames: failedFilesList };

            let dbResNormal;
            const uploaderNameText = studioProfile?.studioName || user?.name || 'Studio Partner';

            if (uploadType === 'SELECTION') {
                const selPayload = {
                    clientMobile, 
                    clientEmail, 
                    folderName: baseFolder, 
                    uploadReport: uploadReportData,
                    sheetLimit: selectionForm.sheetLimit,
                    imagesPerSheet: selectionForm.imagesPerSheet,
                    costPerExtraSheet: selectionForm.costPerExtraSheet,
                    totalPhases: selectionForm.totalPhases,
                    cloudProvider: 'CLOUDINARY',
                    addedBy: studioProfile?.mobile || user?.mobile || 'STUDIO',
                    uploaderName: uploaderNameText,
                    uploaderRole: 'Studio Partner',
                    fileUrls: uploadedUrls // 🔥 THE PAYLOAD FIX: Mongoose needs 'fileUrls', not 'images'!
                };
                
                dbResNormal = await axios.post(`${API_BASE}/create-album-selection`, selPayload, {
                    headers: { 'Authorization': `Bearer ${getValidToken()}` },
                    signal: controller.signal
                });
            } else {
                const payload = {
                    mobile: clientMobile, name: clientName || 'Client', type: 'USER', uploadReport: uploadReportData,
                    folderName: baseFolder, subFolderName: targetSubFolder, 
                    email: clientEmail, expiryDays: expiryDays || '30', downloadLimit: downloadLimit || '0',
                    addedBy: user?.mobile || 'ADMIN',
                    uploaderName: uploaderNameText, 
                    uploaderRole: 'Studio Partner', 
                    fileUrls: uploadedUrls, 
                    imageCost: '5', videoCost: '10', unlockValidity: '24 Hours'
                };

                dbResNormal = await axios.post(`${API_BASE}/admin-add-user-cloud`, payload, {
                    headers: { 'Authorization': `Bearer ${getValidToken()}` },
                    signal: controller.signal 
                });
            }

            if (dbResNormal.data.success) {
                setUploadETA('Complete!');
                localStorage.removeItem('snevio_failed_upload'); 
                setPendingResumeState(null);
                setTimeout(() => {
                    alert(`✅ Success: ${dbResNormal.data.message}\n📩 Notification sent!`);
                    setUploadProgress(0); setUploadSpeed(''); setUploadETA('');
                    setClientMobile(''); setClientName(''); setClientEmail(''); setFolderName(''); 
                    setExpiryDays(''); setDownloadLimit(''); setUseDateFolder(false);
                    setFiles([]); document.getElementById('file-input-field').value = '';
                    setFileStats(prev => ({ ...prev, photos: 0, videos: 0 }));
                    fetchClients(); fetchMyProfile(); 
                    if(studioRemoveUserObj && studioRemoveUserObj.mobile === clientMobile) searchUserForRemoval(clientMobile);
                    setLoading(false);
                }, 500);
            } else { 
                alert(`❌ Error from Database: ${dbResNormal.data.message}`); 
                fetchMyProfile(); 
                setLoading(false);
            }
        } catch (error) { 
            if (error.name === "AbortError" || axios.isCancel(error)) return console.log('Upload aborted.');
            alert("Upload Failed. Check internet connection."); 
            console.error(error);
            fetchMyProfile(); 
            setLoading(false);
        } 
    };

    const handleProfileUpdate = async (e) => {
        if(e) e.preventDefault();
        try {
            const payload = { mobile: user.mobile, ...profileEdit };
            const res = await axios.post(`${API_BASE}/update-studio-profile`, payload);
            if (res.data.success) {
                alert("✅ Profile Updated Successfully!");
                fetchMyProfile();
            } else alert("Update failed.");
        } catch (error) { alert("Server error."); }
    };

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

    // 🧾 AUTOMATED PDF INVOICE GENERATOR (CRASH-PROOF)
    const downloadInvoice = (item) => {
        try {
            const doc = new jsPDF();
            
            // SNEVIO Header Branding
            doc.setFontSize(22);
            doc.setTextColor(41, 128, 185); // Professional Blue
            doc.text("SNEVIO STUDIO NETWORK", 14, 20);
            
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text("Official Payment Receipt / Invoice", 14, 26);
            doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 150, 20);
            doc.text(`Receipt ID: TXN-${Math.floor(Math.random() * 900000) + 100000}`, 150, 26);
            
            doc.setLineWidth(0.5);
            doc.line(14, 30, 196, 30);
            
            // Studio / Billed To Details
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text("Billed To:", 14, 40);
            doc.setFontSize(10);
            doc.setTextColor(80);
            doc.text(`Studio Name: ${studioProfile.studioName || user.ownerName || 'Studio'}`, 14, 46);
            doc.text(`Mobile Number: ${studioProfile.mobile}`, 14, 52);
            if(studioProfile.email) doc.text(`Email ID: ${studioProfile.email}`, 14, 58);
            
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
            doc.text("Thank you for choosing Snevio Platform for your digital business!", 14, finalY);
            doc.setFontSize(8);
            doc.text("Note: This is a computer-generated document. No physical signature is required.", 14, finalY + 6);
            
            // Save the PDF
            doc.save(`Snevio_Receipt_${new Date().getTime()}.pdf`);
            
        } catch (error) {
            console.error("PDF Generation Error: ", error);
            alert("⚠️ Error generating PDF. Please check the browser console (F12).");
        }
    };

    // ✅ AUTO-UPGRADE STORAGE PLAN VIA INSTAMOJO
    const handlePlanUpgrade = async (plan) => {
        const finalPrice = plan.discountPercentage > 0 
            ? (plan.monthlyPrice - (plan.monthlyPrice * plan.discountPercentage / 100)).toFixed(0) 
            : plan.monthlyPrice;

        if (!window.confirm(`Proceed to upgrade to ${plan.planName} for ₹${finalPrice}? You will be redirected to the payment gateway.`)) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/create-payment`, {
                amount: finalPrice,
                purpose: `Storage Upgrade - ${plan.planName}`,
                buyer_name: studioProfile.studioName || user.name || 'Studio Owner',
                email: studioProfile.email || 'dummy@snevio.com',
                phone: user.mobile,
                itemType: 'PLAN_UPGRADE', // Backend ko batayega ki ye plan upgrade hai
                itemValue: `${plan.planName}|${plan.storageLimitGB}` // Plan ki details
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });

            if (res.data.success && res.data.paymentUrl) {
                window.location.href = res.data.paymentUrl;
            } else {
                alert("Failed to initialize payment gateway.");
                setLoading(false);
            }
        } catch (error) {
            console.error(error);
            alert("Connection error. Could not start payment.");
            setLoading(false);
        }
    };

    // ✅ HANDLE STUDIO WITHDRAWAL
    const handleWithdraw = async (e) => {
        e.preventDefault();
        if (withdrawForm.amount < 500) return alert("Minimum withdrawal is ₹500.");
        
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/request-withdrawal`, withdrawForm, { 
                headers: { 'Authorization': `Bearer ${getValidToken()}` } 
            });
            if (res.data.success) {
                // UI को तुरंत अपडेट करने के लिए प्रोफाइल रिफ्रेश कर लो
                fetchMyProfile();
                alert("✅ Withdrawal Request Sent! Admin will process it within 24-48 hours.");
                setWithdrawForm({ amount: '', upiId: '' });
            } else {
                alert(res.data.message);
            }
        } catch (err) {
            alert("Error submitting request.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendProposal = async (e) => {
        e.preventDefault();
        if (!proposalForm.totalPrice || !proposalForm.advanceAmount) return alert("Please fill the pricing details.");

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/send-proposal`, {
                bookingId: activeProposalBooking._id,
                ...proposalForm
            });

            if (res.data.success) {
                alert("✅ Custom Proposal Sent to User Successfully!");
                setActiveProposalBooking(null);
                fetchStudioBookings(); 
            } else {
                alert(res.data.message || "Failed to send proposal.");
            }
        } catch (err) {
            alert("Server error sending proposal.");
        } finally {
            setLoading(false);
        }
    };

    // ✅ 1. VIEW CLIENT UI (Opens In-App Modal)
    const handleMagicLogin = (project) => {
        if (!project || !project.images || project.images.length === 0) {
            return alert("No images found in this project.");
        }
        setPreviewProject(project); // Set the project to show in modal
    };

    // ✅ NEW: DELETE SMART SELECTION PROJECT (Single Correct Version)
    const handleDeleteSelectionProject = async (projectId) => {
        if (!window.confirm("⚠️ WARNING: Are you absolutely sure you want to delete this Selection Project? All data and client progress will be permanently lost!")) return;
        
        try {
            const token = getValidToken();
            if(!token) return alert("Security Token missing. Please relogin.");

            const res = await axios.post(`${API_BASE}/delete-selection-project`, { projectId }, { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (res.data.success) {
                alert("✅ Project deleted successfully!");
                setMySelections(prev => prev.filter(sel => sel._id !== projectId)); 
            } else {
                alert("❌ Failed to delete: " + res.data.message);
            }
        } catch (e) {
            console.error("Delete Error:", e);
            alert(`Error deleting project: ${e.response?.data?.message || e.message}`);
        }
    };

    // ✅ 2. SMART ZIP DOWNLOADER ENGINE (Auto-Resume & Progress Tracking)
    const startSmartDownload = async (selectionProject) => {
        if (!selectionProject || !selectionProject.images) return;
        
        const selectedImages = selectionProject.images.filter(img => img.status === 'selected');
        if (selectedImages.length === 0) return alert("No images selected by client yet!");

        if (!window.confirm(`Start downloading ${selectedImages.length} original photos for ${selectionProject.folderName}?`)) return;

        setDownloadManager({
            active: true, paused: false, projectId: selectionProject._id, 
            clientName: selectionProject.clientMobile, totalFiles: selectedImages.length, 
            downloadedFiles: 0, progressPercent: 0, speed: 'Starting...', eta: 'Calculating...', failedFiles: []
        });

        const zip = new JSZip();
        const mainFolder = zip.folder(`${selectionProject.folderName}_Final_Selection`);
        abortControllerRef.current = new AbortController();

        let successfulDownloads = 0;
        let failedDownloads = [];
        let startTime = Date.now();
        let totalDownloadedBytes = 0;

        for (let i = 0; i < selectedImages.length; i++) {
            if (abortControllerRef.current.signal.aborted) {
                setDownloadManager(prev => ({ ...prev, paused: true, speed: 'Paused' }));
                return; // Stop if paused
            }

            const imgUrl = getCleanUrl(selectedImages[i].url);
            // 🛡️ SMART NUMBERING: File name ke aage '001_', '002_' lagayenge taaki sequence na bigde aur file overwrite na ho!
            const originalName = imgUrl.split('/').pop().split('?')[0] || `image_${i + 1}.jpg`;
            const fileExt = originalName.includes('.') ? originalName.split('.').pop() : 'jpg';
            const safeName = originalName.split('.')[0].slice(-10); // Lamba naam chhota karne ke liye
            const uniqueFileName = `${String(i + 1).padStart(3, '0')}_${safeName}.${fileExt}`;

            try {
                // 🚀 SUPER FIX: Call our own Backend Proxy to bypass all CORS/CSP issues!
                const response = await axios.post(`${API_BASE}/proxy-download`, 
                    { fileUrl: imgUrl }, 
                    { 
                        responseType: 'blob', // We still want a blob back to put in the ZIP
                        signal: abortControllerRef.current.signal 
                    }
                );
                
                const blob = response.data;
                
                totalDownloadedBytes += blob.size;
                
                // ✅ DYNAMIC SPLIT ALBUM & SUB-FOLDER CREATION IN ZIP
                const isSplit = selectionProject.splitCompleted && selectionProject.splitDetails?.hasSplit;
                const albumFolderName = isSplit ? `${selectedImages[i].albumTag || 'Album 1'}/` : '';
                
                // 📂 Hamesha folder banayega, chahe 'Haldi' ho ya 'Main Event'
                const zipSubFolder = selectedImages[i].subFolder ? `${selectedImages[i].subFolder}/` : 'Other_Photos/';
                
                // Folder structure: Final_Selection -> Album 1 -> Haldi -> 001_image.jpg
                mainFolder.file(`${albumFolderName}${zipSubFolder}${uniqueFileName}`, blob);
                successfulDownloads++;

                // Let's scope the math variables tightly to avoid any redeclaration issues
                {
                    const elapsedSecs = (Date.now() - startTime) / 1000; 
                    const currentSpeedBps = totalDownloadedBytes / elapsedSecs;
                    const currentSpeedMbps = (currentSpeedBps / (1024 * 1024)).toFixed(2);
                    
                    const averageSize = totalDownloadedBytes / successfulDownloads;
                    const bytesLeft = averageSize * (selectedImages.length - successfulDownloads);
                    const secondsLeft = bytesLeft / currentSpeedBps;

                    setDownloadManager(prev => ({
                        ...prev,
                        downloadedFiles: successfulDownloads,
                        progressPercent: Math.round((successfulDownloads / selectedImages.length) * 100),
                        speed: `${currentSpeedMbps} MB/s`,
                        eta: secondsLeft > 60 ? `${Math.floor(secondsLeft/60)}m left` : `${Math.floor(secondsLeft)}s left`
                    }));
                }

            } catch (err) {
                if (axios.isCancel(err)) {
                    console.log('Download paused by user');
                } else {
                    console.error("Failed to fetch:", imgUrl, err);
                    failedDownloads.push(fileName);
                    // We don't stop the whole process, just record failure and continue
                }
            }
        }

        if (!abortControllerRef.current.signal.aborted) {
            setDownloadManager(prev => ({ ...prev, speed: 'Zipping files...', eta: 'Almost ready...' }));
            
            // Generate ZIP
            zip.generateAsync({ type: "blob" }).then((content) => {
                saveAs(content, `${selectionProject.folderName}_${selectionProject.clientMobile}_Final.zip`);
                
                setDownloadManager(prev => ({ ...prev, active: false }));
                alert(`✅ Download Complete!\n${successfulDownloads} downloaded.\n${failedDownloads.length > 0 ? `⚠️ ${failedDownloads.length} files failed.` : ''}`);
                
                // Fire Email/SMS via backend to notify studio (as requested)
                axios.post(`${API_BASE}/deduct-coins`, { mobile: studioProfile.mobile, amount: 0, reason: `Downloaded ${selectionProject.folderName}` });
            });
        }
    };

    const pauseDownload = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort(); // Triggers the cancel catch block
            
            // Send warning if paused for long (Simulation logic)
            setTimeout(() => {
                if (downloadManager.paused) {
                    alert("⚠️ Your download has been paused for a while. Please resume to finish.");
                }
            }, 600000); // 10 minutes warning
        }
    };

    const isVideo = (filePath) => {
        if (!filePath || typeof filePath !== 'string') return false;
        // 👇 YE NAYI LINE ADD KARNI HAI 👇
        if (filePath.startsWith('CINEMATIC::')) return true; 
        
        if (filePath.includes('/video/upload/')) return true; 
        return filePath.match(/\.(mp4|webm|ogg|mov)$/i);
    };

    // ✅ 100% SAFE & FAST IMAGE URL GENERATOR
    const getCleanUrl = (filePath, isThumbnail = false) => {
        try {
            if (!filePath || typeof filePath !== 'string') return '';
            
            // 1. Cinematic Video (Skip)
            if (filePath.startsWith('CINEMATIC::')) return filePath; 

            // 2. Cloudinary Auto-Compression (Magic Trick 🎩) - Safer Logic
            if (filePath.includes('cloudinary.com') && !filePath.includes('/video/upload')) {
                const uploadIndex = filePath.indexOf('/upload/');
                // Agar URL mein '/upload/' hai aur thumb mangaya hai, tabhi transform karo
                if (uploadIndex !== -1 && isThumbnail) {
                    const baseUrl = filePath.slice(0, uploadIndex + 8); // Up to '.../upload/'
                    const imagePath = filePath.slice(uploadIndex + 8); // Rest of the path
                    return `${baseUrl}c_scale,w_400,q_auto,f_auto/${imagePath}`;
                }
                return filePath; // Full quality agar thumbnail nahi chahiye
            }
            
            // 3. Absolute URL (already includes http)
            if (filePath.startsWith('http')) return filePath; 

            // 4. Relative URL (Local server storage)
            return `${SERVER_URL}${filePath.replace(/\\/g, '/')}`; 

        } catch (error) {
            // Agar code fate, toh original URL return karo takki screen black na ho
            console.error("getCleanUrl error:", error, filePath);
            return typeof filePath === 'string' && filePath.startsWith('http') ? filePath : '';
        }
    };

    const filteredMobileSuggestions = clients.filter(c => c.mobile && c.mobile.includes(clientMobile));
    const selectedClient = clients.find(c => c.mobile === clientMobile);
    const filteredClientsList = clients.filter(c => c.mobile && c.mobile.includes(clientSearchQuery));

    let existingFolders = [];
    if (selectedClient && selectedClient.uploadedData) {
        if(Array.isArray(selectedClient.uploadedData)){
             existingFolders = selectedClient.uploadedData.map(f => f.folderName).filter(Boolean);
        }
    }
    const filteredFolderSuggestions = existingFolders.filter(fName => fName.toLowerCase().includes(folderName.toLowerCase()));

    // Safe wallet values
    const studioWallet = studioProfile?.wallet || {};
    const studioRevenue = studioWallet.revenue || 0;
    const studioCoins = studioWallet.coins || 0;
    const studioHistory = studioWallet.history || [];

    // 📄 PDF GENERATOR FOR FAILED UPLOADS
    const generateFailedReportPDF = (log) => {
        if (!log.report) return alert("No report data available for this upload.");
        try {
            const doc = new jsPDF();
            doc.setFontSize(18);
            doc.setTextColor(231, 76, 60); // Red
            doc.text("Snevio - Upload Failure Report", 14, 20);
            
            doc.setFontSize(12);
            doc.setTextColor(50);
            doc.text(`Date: ${log.date}`, 14, 30);
            doc.text(`Action: ${log.action}`, 14, 38);
            doc.text(`Folder: ${log.amount || 'N/A'}`, 14, 46);
            
            doc.setFontSize(14);
            doc.setTextColor(41, 128, 185); // Blue
            doc.text("Upload Statistics:", 14, 60);
            
            doc.setFontSize(12);
            doc.setTextColor(0);
            doc.text(`Total Files Attempted: ${log.report.total}`, 14, 70);
            doc.text(`Successfully Uploaded: ${log.report.success}`, 14, 78);
            doc.setTextColor(231, 76, 60); 
            doc.text(`Failed Files: ${log.report.failed}`, 14, 86);
            
            if (log.report.failedNames && log.report.failedNames.length > 0) {
                const tableData = log.report.failedNames.map((name, index) => [index + 1, name, "Network / Cloud Timeout"]);
                autoTable(doc, {
                    startY: 95,
                    head: [['#', 'Failed File Name', 'Reason']],
                    body: tableData,
                    headStyles: { fillColor: [231, 76, 60] },
                });
            }
            
            doc.save(`Failed_Upload_Report_${Date.now()}.pdf`);
        } catch (err) {
            console.error(err);
            alert("Error generating PDF.");
        }
    };

    return (
        <div className="owner-dashboard-container">

            {/* 🔴 AUTO-RESUME NETWORK ALERT */}
            {isNetworkDown && (
                <div style={{ position: 'fixed', top: '0', left: '0', width: '100%', background: '#e74c3c', color: '#fff', textAlign: 'center', padding: '10px', zIndex: 9999999, fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                    ⚠️ Internet Connection Lost! Uploads and tasks are paused. Waiting to reconnect...
                </div>
            )}
            
            {/* 🟠 FAILED DRAFT RESUME BANNER */}
            {pendingResumeState && !loading && activeTab !== 'UPLOAD' && (
                <div style={{ background: '#f39c12', color: '#fff', margin: '10px 20px', padding: '15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    <div>
                        <h4 style={{ margin: 0 }}>⚠️ Incomplete Upload Detected!</h4>
                        <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>Client: {pendingResumeState.clientMobile} | Folder: {pendingResumeState.folderName}</p>
                    </div>
                    <button onClick={handleResumeClick} style={{ background: '#fff', color: '#d35400', border: 'none', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                        🔄 Click to Resume
                    </button>
                </div>
            )}

            {/* ✅ FLOATING SMART DOWNLOAD MANAGER */}
            {downloadManager.active && (
                <div style={{ position: 'fixed', bottom: '20px', right: '20px', width: '350px', background: '#fff', borderRadius: '15px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', zIndex: 999999, border: '1px solid #3498db', overflow: 'hidden' }}>
                    <div style={{ background: '#3498db', padding: '15px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '14px' }}>📥 Downloading Album Data</h4>
                        {downloadManager.paused ? (
                            <button onClick={() => startSmartDownload(mySelections.find(s => s._id === downloadManager.projectId))} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>▶️ Resume</button>
                        ) : (
                            <button onClick={pauseDownload} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>⏸️ Pause</button>
                        )}
                    </div>
                    <div style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#2c3e50' }}>
                            <span>{downloadManager.downloadedFiles} / {downloadManager.totalFiles} Files</span>
                            <span>{downloadManager.progressPercent}%</span>
                        </div>
                        <div style={{ width: '100%', background: '#eee', borderRadius: '10px', height: '8px', overflow: 'hidden', marginBottom: '15px' }}>
                            <div style={{ width: `${downloadManager.progressPercent}%`, background: downloadManager.paused ? '#f1c40f' : '#2ecc71', height: '100%', transition: 'width 0.3s ease' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#7f8c8d' }}>
                            <span>⚡ Speed: <strong style={{color: '#3498db'}}>{downloadManager.speed}</strong></span>
                            <span>⏳ Time Left: <strong style={{color: '#e67e22'}}>{downloadManager.eta}</strong></span>
                        </div>
                        {downloadManager.failedFiles.length > 0 && (
                            <p style={{ margin: '10px 0 0 0', fontSize: '10px', color: '#e74c3c', textAlign: 'center' }}>⚠️ {downloadManager.failedFiles.length} files failed. System will retry them.</p>
                        )}
                    </div>
                </div>
            )}

            {/* ✅ CLIENT DATA PREVIEW MODAL */}
            {previewProject && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1a1a2e', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>📂 Preview: {previewProject.folderName}</h2>
                                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#aaa' }}>Client: {previewProject.clientMobile} | Total Images: {previewProject.images?.length || 0}</p>
                            </div>
                            <button onClick={() => setPreviewProject(null)} style={{ background: 'transparent', border: 'none', fontSize: '24px', color: '#fff', cursor: 'pointer' }}>✖</button>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                            {previewProject.images && previewProject.images.length > 0 ? (
                                (() => {
                                    // 1. Sirf selected images filter karo
                                    const selectedImgs = previewProject.images.filter(img => img.status === 'selected');
                                    if (selectedImgs.length === 0) return <p style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>No finalized images available yet.</p>;

                                    // 2. Images ko 'albumTag' aur phir 'subFolder' ke hisaab se group karo
                                    const groupedData = {};
                                    selectedImgs.forEach(img => {
                                        const aTag = img.albumTag || 'Album 1';
                                        const sTag = img.subFolder || 'Main Event';
                                        if (!groupedData[aTag]) groupedData[aTag] = {};
                                        if (!groupedData[aTag][sTag]) groupedData[aTag][sTag] = [];
                                        groupedData[aTag][sTag].push(img);
                                    });

                                    // 3. Alag-alag section aur folder mein render karo
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
                                                                <div key={idx} style={{ position: 'relative', height: '100px', background: '#000', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${albumName === 'Album 2' ? '#f39c12' : '#3498db'}`, boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>
                                                                    <img src={getCleanUrl(img.url, true)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`img-${idx}`} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    });
                                })()
                            ) : (
                                <p style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>No images found.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ STUDIO EXIT APP POPUP */}
            {showExitPopup && (
                <div className="popup-overlay-fixed" style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter: 'blur(5px)'}}>
                    <div style={{background:'#1a1a2e', padding:'30px', borderRadius:'15px', textAlign:'center', color:'#fff', boxShadow:'0 10px 30px rgba(0,0,0,0.7)', border: '1px solid #333', maxWidth: '300px', width: '90%'}}>
                        <div style={{fontSize: '40px', marginBottom: '10px'}}>📸</div>
                        <h3 style={{marginBottom:'10px', marginTop: 0}}>Close Studio?</h3>
                        <p style={{fontSize: '13px', color: '#aaa', marginBottom: '20px'}}>Are you sure you want to exit your Studio Panel?</p>
                        
                        <div style={{display:'flex', gap:'15px', justifyContent:'center'}}>
                            <button onClick={() => window.location.replace('/')} style={{background:'#e74c3c', color:'#fff', padding:'10px 20px', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', flex: 1}}>Yes, Exit</button>
                            <button onClick={() => setShowExitPopup(false)} style={{background:'#34495e', color:'#fff', padding:'10px 20px', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', flex: 1}}>No, Stay</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ PROPOSAL MODAL */}
            {activeProposalBooking && (
                <div className="popup-overlay-fixed" style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.85)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter: 'blur(5px)'}}>
                    <div style={{background:'#fff', padding:'30px', borderRadius:'20px', width:'90%', maxWidth:'450px', boxShadow:'0 20px 50px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto'}}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ margin: 0, color: '#2c3e50' }}>📝 Send Proposal</h2>
                            <button onClick={() => setActiveProposalBooking(null)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>✖</button>
                        </div>
                        
                        <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #3498db' }}>
                            <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#7f8c8d' }}>Responding to:</p>
                            <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>{activeProposalBooking.name} - {activeProposalBooking.type}</p>
                        </div>

                        <form onSubmit={handleSendProposal} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#444' }}>Total Estimate (₹)</label>
                                    <input type="number" required placeholder="e.g. 50000" value={proposalForm.totalPrice} onChange={(e) => handlePriceChange(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '5px' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#e74c3c' }}>Advance 30% (₹)</label>
                                    <input type="number" required value={proposalForm.advanceAmount} onChange={(e) => setProposalForm({...proposalForm, advanceAmount: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e74c3c', marginTop: '5px', background: '#fdedec', color: '#c0392b', fontWeight: 'bold' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#444' }}>Deliverables</label>
                                <textarea rows="2" required value={proposalForm.deliverables} onChange={(e) => setProposalForm({...proposalForm, deliverables: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '5px', resize: 'vertical' }}></textarea>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#444' }}>Terms & Conditions</label>
                                <textarea rows="2" required value={proposalForm.terms} onChange={(e) => setProposalForm({...proposalForm, terms: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginTop: '5px', resize: 'vertical' }}></textarea>
                            </div>

                            <button type="submit" disabled={loading} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
                                {loading ? 'Sending...' : '🚀 Send Proposal to User'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            
            <aside className="admin-sidebar">
                {/* 🚀 SNEVIO LOGO + STUDIO PANEL INDICATOR */}
                <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '25px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '400', letterSpacing: '3px', color: '#fff' }}>
                            SNE<span style={{ fontWeight: '800', color: '#f1c40f' }}>VIO</span>
                        </h2>
                    </div>
                    {/* 👇 Ye clear karega ki ye Studio Panel hai 👇 */}
                    <span style={{ marginTop: '8px', background: 'transparent', color: '#888', border: '1px solid #f1c40f', fontSize: '10px', padding: '3px 12px', borderRadius: '15px', letterSpacing: '2px', fontWeight: 'bold' }}>
                        STUDIO PANEL
                    </span>
                </div>
                
                <div style={{ background: '#0f3460', padding: '15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
                    <h4 style={{ margin: 0, color: '#4dabf7' }}>{studioProfile.studioName || user.ownerName}</h4>
                    <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#aeb6bf' }}>{studioProfile.mobile}</p>
                    
                    {studioProfile.isFeedApproved && (
                        <span style={{ display:'inline-block', marginTop:'10px', background:'#2ecc71', color:'#fff', fontSize:'11px', padding:'3px 8px', borderRadius:'10px', fontWeight: 'bold' }}>✓ Verified Creator</span>
                    )}

                    {/* 🔥 NAYA: SHARE PORTFOLIO BUTTON 🔥 */}
                    <button onClick={() => {
                        // Safe URL generation replacing spaces with hyphens
                        const safeName = encodeURIComponent((studioProfile.studioName || user.ownerName || 'studio').replace(/\s+/g, '-'));
                        // Chuki HashRouter use ho raha hai, link me # ayega
                        const shareLink = `https://snevio.com/#/studio/${safeName}`; 
                        const shareText = `Hello! Check out our latest photography & cinematic portfolio on Snevio. Book your shoot with us today! ✨📷 \n\nView here: ${shareLink}`;
                        
                        if (navigator.share) {
                            navigator.share({ title: 'Our Studio Portfolio', text: shareText });
                        } else {
                            navigator.clipboard.writeText(shareText);
                            alert("Portfolio Link Copied! Paste & Share on WhatsApp or Instagram.");
                        }
                    }} style={{ width: '100%', background: '#f1c40f', color: '#000', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        🔗 Share Public Profile
                    </button>
                </div>

                <ul className="sidebar-menu">
                    <div className="menu-group">
                        <div className={`menu-group-header ${openDropdown === 'MENU' ? 'open' : ''}`} onClick={() => setOpenDropdown(openDropdown === 'MENU' ? null : 'MENU')} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#1a1a2e', cursor: 'pointer', fontWeight: 'bold', color: '#fff', borderRadius: '5px', marginBottom: '5px' }}>
                            <span>📁 Studio Options</span>
                            <span>{openDropdown === 'MENU' ? '▲' : '▼'}</span>
                        </div>
                        {openDropdown === 'MENU' && (
                            <div className="menu-dropdown-content" style={{ paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                                <li className={activeTab === 'DASHBOARD' ? 'active' : ''} onClick={() => { setActiveTab('DASHBOARD'); setOpenDropdown(null); }}>👥 My Clients</li>
                                <li className={activeTab === 'LEADS' ? 'active' : ''} onClick={() => { setActiveTab('LEADS'); setOpenDropdown(null); }}>📅 Booking Leads</li>
                                <li className={activeTab === 'UPLOAD' ? 'active' : ''} onClick={() => { setActiveTab('UPLOAD'); setOpenDropdown(null); }}>📤 Upload Client Data</li>
                                <li className={activeTab === 'SELECTION_PROJECTS' ? 'active' : ''} onClick={() => { setActiveTab('SELECTION_PROJECTS'); fetchStudioSelections(); setOpenDropdown(null); }} style={{color: '#f1c40f', fontWeight: 'bold'}}>✨ Smart Album Selections</li>
                                
                                {studioProfile.isFeedApproved && (
                                    <li className={activeTab === 'FEED' ? 'active' : ''} onClick={() => { setActiveTab('FEED'); setOpenDropdown(null); }}>🌟 Feed Management</li>
                                )}
                                <li className={activeTab === 'LONG_UPLOAD' ? 'active' : ''} onClick={() => { setActiveTab('LONG_UPLOAD'); setOpenDropdown(null); }} style={{color: '#3498db', fontWeight: 'bold'}}>🎬 Cinematic Upload (Pro)</li>
                                <li className={activeTab === 'REVENUE' ? 'active' : ''} onClick={() => { setActiveTab('REVENUE'); setOpenDropdown(null); }}>💰 Revenue</li>
                                <li className={activeTab === 'PAYOUTS' ? 'active' : ''} onClick={() => { setActiveTab('PAYOUTS'); setOpenDropdown(null); }} style={{color: '#f39c12', fontWeight: 'bold'}}>💳 Payouts</li>
                                <li className={activeTab === 'MY_STORAGE' ? 'active' : ''} onClick={() => { setActiveTab('MY_STORAGE'); setOpenDropdown(null); }} style={{color: '#2ecc71', fontWeight: 'bold'}}>🗄️ My Storage Vault</li>
                                <li className={activeTab === 'PROFILE' ? 'active' : ''} onClick={() => { setActiveTab('PROFILE'); setOpenDropdown(null); }}>⚙️ Studio Profile</li>
                            </div>
                        )}
                    </div>
                </ul>

                {/* 📱 SMART INSTALL APP BUTTON */}
                {deferredPrompt && (
                    <button 
                        onClick={handleInstallClick} 
                        style={{ background: 'linear-gradient(135deg, #e67e22, #f39c12)', color: '#fff', border: 'none', padding: '12px', width: '90%', margin: '10px auto 0', display: 'block', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 10px rgba(230, 126, 34, 0.4)' }}
                    >
                        📲 Install Studio App
                    </button>
                )}

                <button onClick={onLogout} className="admin-logout-btn" style={{marginTop: '15px'}}>Log Out</button>
            </aside>

            <main className="admin-main-content">

                {/* 🔴 TAB 1: CLIENTS DASHBOARD */}
                {activeTab === 'DASHBOARD' && (
                    <div className="view-section">
                        <div className="section-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
                            <h2 style={{margin: 0, color: '#2c3e50', fontWeight: 'bold'}}>👥 My Recent Clients</h2>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input 
                                    type="number" 
                                    placeholder="🔍 Search Mobile No..." 
                                    value={clientSearchQuery}
                                    onChange={(e) => setClientSearchQuery(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, fetchClients)}
                                    style={{ padding: '8px 15px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none', width: '180px', color: '#000', fontWeight: '500' }}
                                />
                                <button className="refresh-btn" style={{padding: '8px 15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap'}} onClick={fetchClients} disabled={fetching}>
                                    {fetching ? '...' : '🔄 Refresh List'}
                                </button>
                            </div>
                        </div>
                        
                        <div className="data-table-container" style={{ marginTop: '20px' }}>
                            <table className="admin-table" style={{color: '#333'}}>
                                <thead>
                                    <tr>
                                        <th style={{color: '#2c3e50'}}>Client Name</th>
                                        <th style={{color: '#2c3e50'}}>Mobile Number</th>
                                        <th style={{color: '#2c3e50'}}>Uploaded Folders</th>
                                        <th style={{color: '#2c3e50'}}>Joined Date</th>
                                        <th style={{color: '#2c3e50'}}>Actions</th> 
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
                                                    <td style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        <button className="pdf-btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#34495e', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }} onClick={() => { setStudioRemoveMobile(client.mobile); searchUserForRemoval(client.mobile); }}>
                                                            📂 Manage Data
                                                        </button>
                                                        <button onClick={() => handleMagicLogin(client.mobile)} style={{ padding: '6px 12px', fontSize: '12px', background: '#f1c40f', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                            👁️ View UI
                                                        </button>
                                                        <button className="pdf-btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#e74c3c', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }} onClick={() => handleDeleteClient(client.mobile)}>
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

                        {/* DATA MANAGER SECTION */}
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
                                                                        {fileUrl.startsWith('CINEMATIC::') ? (
    <div style={{width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#2c3e50', color:'#f1c40f', fontSize:'10px', textAlign:'center', padding:'5px'}}>
        <span style={{fontSize: '20px'}}>🎬</span><span style={{fontWeight: 'bold', marginTop: '5px'}}>Cinematic<br/>(YT Sync)</span>
    </div>
) : isVideo(fileUrl) ? (
    <><video src={getCleanUrl(fileUrl)} playsInline muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white'}}>▶️</div></>
) : (
    <img src={getCleanUrl(fileUrl)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
)}
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
                                                                                    {isVideo(subFileUrl) ? (<><video src={getCleanUrl(subFileUrl)} playsInline muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white'}}>▶️</div></>) : <img src={getCleanUrl(subFileUrl)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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

                {/* 🔴 TAB: BOOKING LEADS (THE ESCROW SYSTEM) */}
                {activeTab === 'LEADS' && (
                    <div className="view-section">
                        <div className="section-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <h2 style={{margin: 0, color: '#2c3e50', fontWeight: 'bold'}}>📅 Incoming Booking Leads</h2>
                            <button className="refresh-btn" style={{padding: '8px 15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer'}} onClick={fetchStudioBookings} disabled={fetchingBookings}>
                                {fetchingBookings ? '...' : '🔄 Refresh'}
                            </button>
                        </div>

                        {fetchingBookings ? (
                            <p style={{ textAlign: 'center', color: '#888', marginTop: '30px' }}>Loading incoming leads...</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
                                {studioBookings.length > 0 ? studioBookings.map((booking, idx) => {
                                    
                                    // Status Badge Logic
                                    let statusColor = '#f1c40f'; // Pending
                                    let statusText = 'Pending Your Proposal';
                                    if(booking.status === 'Pending Payment') { statusColor = '#e67e22'; statusText = 'Awaiting 30% User Payment'; }
                                    if(booking.status === 'Confirmed' || booking.status === 'Accepted') { statusColor = '#2ecc71'; statusText = 'DEAL CLOSED - Contact Revealed'; }
                                    if(booking.status === 'Declined') { statusColor = '#e74c3c'; statusText = 'Cancelled / Expired'; }

                                    // Masking Logic
                                    const isRevealed = booking.status === 'Confirmed' || booking.status === 'Accepted';
                                    const maskedMobile = booking.mobile ? `+91 ********${booking.mobile.slice(-2)}` : 'N/A';
                                    const displayMobile = isRevealed ? booking.mobile : maskedMobile;
                                    const displayEmail = isRevealed ? (booking.email || 'N/A') : '*****@***.com';

                                    return (
                                        <div key={idx} style={{ background: '#fff', borderRadius: '15px', padding: '20px', borderLeft: `5px solid ${statusColor}`, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <div>
                                                    <h3 style={{ color: '#2c3e50', margin: 0, fontSize: '18px' }}>{booking.type}</h3>
                                                    <p style={{ color: '#7f8c8d', margin: '5px 0 0 0', fontSize: '13px' }}>Received on: {new Date(booking.createdAt).toLocaleDateString()}</p>
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: statusColor, background: `${statusColor}22`, padding: '5px 10px', borderRadius: '8px', textAlign: 'right' }}>
                                                    {statusText}
                                                </span>
                                            </div>
                                            
                                            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                                <div>
                                                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#95a5a6' }}>Client Name</p>
                                                    <p style={{ margin: 0, fontWeight: 'bold', color: '#34495e' }}>{booking.name}</p>
                                                </div>
                                                <div>
                                                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#95a5a6' }}>Contact Number</p>
                                                    <p style={{ margin: 0, fontWeight: 'bold', color: isRevealed ? '#27ae60' : '#e74c3c' }}>
                                                        {displayMobile} {isRevealed && '📞'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#95a5a6' }}>Email ID</p>
                                                    <p style={{ margin: 0, fontWeight: 'bold', color: '#34495e' }}>{displayEmail}</p>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            {booking.status === 'Pending' && (
                                                <button onClick={() => setActiveProposalBooking(booking)} style={{ background: '#3498db', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                    📝 Send Custom Proposal
                                                </button>
                                            )}

                                            {booking.status === 'Confirmed' && (
                                                <div style={{ background: '#e8f8f5', border: '1px solid #2ecc71', color: '#27ae60', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                                                    ✅ You have received ₹{booking.proposal?.advanceAmount} in your Wallet. You can now contact the client to proceed with the work!
                                                </div>
                                            )}
                                        </div>
                                    );
                                }) : (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
                                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                                        <h3>No Booking Leads Yet</h3>
                                        <p style={{ fontSize: '13px' }}>Keep uploading quality content to your feed to attract clients!</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 🔴 TAB 2: UPLOAD CLIENT DATA */}
                {activeTab === 'UPLOAD' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>📤 Upload Client Data</h2></div>
                        
                        {/* 🔥 NAYA: Top Level Main Switch (Normal vs Smart) */}
                        <div style={{ display: 'flex', gap: '10px', maxWidth: '600px', margin: '0 auto 25px', background: '#f8f9fa', padding: '5px', borderRadius: '12px', border: '1px solid #ddd' }}>
                            <button type="button" onClick={() => setUploadType('NORMAL')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', background: uploadType === 'NORMAL' ? '#3498db' : 'transparent', color: uploadType === 'NORMAL' ? '#fff' : '#555', boxShadow: uploadType === 'NORMAL' ? '0 4px 10px rgba(52, 152, 219, 0.3)' : 'none' }}>
                                📁 Normal Gallery
                            </button>
                            <button type="button" onClick={() => setUploadType('SELECTION')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', background: uploadType === 'SELECTION' ? '#8e44ad' : 'transparent', color: uploadType === 'SELECTION' ? '#fff' : '#555', boxShadow: uploadType === 'SELECTION' ? '0 4px 10px rgba(142, 68, 173, 0.3)' : 'none' }}>
                                ✨ Smart Album
                            </button>
                        </div>

                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto', borderTop: uploadType === 'SELECTION' ? '4px solid #8e44ad' : 'none' }}>
                            
                            {/* Show Active Mode Indicator */}
                            {uploadType === 'SELECTION' && (
                                <div style={{ background: '#f5eef8', padding: '10px', borderRadius: '8px', border: '1px dashed #8e44ad', fontSize: '12px', color: '#8e44ad', fontWeight: 'bold', marginBottom: '20px' }}>
                                    ✨ Smart Album Mode Active. User can select photos.
                                </div>
                            )}
                            {uploadType === 'SELECTION' && (
                                <div style={{ background: '#f5eef8', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#8e44ad' }}>📸 Smart Album Configuration</h4>
                                    <p style={{ fontSize: '11px', color: '#555', margin: '0 0 15px 0' }}>The client will receive an email link. They will go through a multi-phase selection process. You can set limits to charge for extra photo selections automatically.</p>
                                    
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <div style={{ flex: '1 1 120px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Number of Sheets Allowed</label>
                                            <input type="number" value={selectionForm.sheetLimit} onChange={e => setSelectionForm({...selectionForm, sheetLimit: e.target.value})} className="custom-admin-input" style={{ marginTop: '5px', padding: '8px' }} />
                                        </div>
                                        <div style={{ flex: '1 1 120px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Images per Sheet</label>
                                            <input type="number" value={selectionForm.imagesPerSheet} onChange={e => setSelectionForm({...selectionForm, imagesPerSheet: e.target.value})} className="custom-admin-input" style={{ marginTop: '5px', padding: '8px' }} />
                                        </div>
                                        <div style={{ flex: '1 1 120px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#e67e22' }}>Cost per Extra Sheet (₹)</label>
                                            <input type="number" value={selectionForm.costPerExtraSheet} onChange={e => setSelectionForm({...selectionForm, costPerExtraSheet: e.target.value})} className="custom-admin-input" style={{ marginTop: '5px', padding: '8px', border: '1px solid #f39c12' }} />
                                        </div>
                                        <div style={{ flex: '1 1 120px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Selection Phases</label>
                                            <select value={selectionForm.totalPhases} onChange={e => setSelectionForm({...selectionForm, totalPhases: e.target.value})} className="custom-admin-input" style={{ marginTop: '5px', padding: '8px' }}>
                                                <option value="1">1 Phase (Direct Final)</option>
                                                <option value="2">2 Phases (Shortlist &gt; Final)</option>
                                                <option value="3">3 Phases (Recommended)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '10px', padding: '8px', background: '#fff', borderRadius: '5px', border: '1px dashed #ccc', fontSize: '11px', color: '#333' }}>
                                        <strong>Math Check:</strong> Client can select max <strong>{Number(selectionForm.sheetLimit) * Number(selectionForm.imagesPerSheet)}</strong> images for free.
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                
                                <div style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Client Mobile</label>
                                    <input 
                                        type="number" 
                                        placeholder="10-Digit Number" 
                                        value={clientMobile} 
                                        onChange={handleMobileChange}
                                        onFocus={() => setShowMobileSuggestions(true)} 
                                        onBlur={() => setTimeout(() => setShowMobileSuggestions(false), 200)}
                                        className="custom-admin-input" style={{color: '#000', fontWeight: 'bold'}}
                                    />
                                    {showMobileSuggestions && clientMobile && filteredMobileSuggestions.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', borderRadius: '5px', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}>
                                            {filteredMobileSuggestions.map((c, idx) => (
                                                <li key={idx} onMouseDown={() => {
                                                    setClientMobile(c.mobile);
                                                    setClientName(c.name || 'Client');
                                                    setClientEmail(c.email || '');
                                                    setShowMobileSuggestions(false);
                                                }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#000', fontWeight: '500' }}>
                                                    📞 <strong>{c.mobile}</strong> - <span style={{color: '#2980b9'}}>{c.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Client Name {selectedClient && <span style={{color: '#2ecc71', fontSize: '11px'}}>(Auto-filled)</span>}</label>
                                    <input type="text" placeholder="Full Name" value={clientName} onChange={(e) => setClientName(e.target.value)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))} />
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Client Email (For Notification) {clientEmail && selectedClient && <span style={{color: '#2ecc71', fontSize: '11px'}}>(Auto-filled)</span>}</label>
                                    <input type="email" placeholder="example@email.com (Optional)" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))} />
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
                                        className="custom-admin-input" style={{color: '#000', fontWeight: '500'}}
                                        onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))}
                                    />
                                    {(!folderName || folderName.trim() === '') && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#e67e22', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span>⚠️</span> Default folder "Stranger Photography" will be used.
                                        </div>
                                    )}

                                    {showFolderSuggestions && existingFolders.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', borderRadius: '5px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                                            {filteredFolderSuggestions.map((folder, idx) => (
                                                <li key={idx} onMouseDown={() => { setFolderName(folder); setShowFolderSuggestions(false); }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#000', fontWeight: 'bold' }}>
                                                    📁 <strong>{folder}</strong>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    
                                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input type="checkbox" id="useDateFolder" checked={useDateFolder} onChange={(e) => setUseDateFolder(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                        <label htmlFor="useDateFolder" style={{ fontSize: '12px', color: '#333', cursor: 'pointer', fontWeight: 'bold' }}>🗓️ Save inside Today's Date Sub-Folder</label>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '15px', background: '#fffdf5', padding: '15px', borderRadius: '8px', border: '1px solid #f1c40f' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4ac0d' }}>⏳ Expiry (Days)</label>
                                        <input type="number" placeholder="e.g. 30 (0 = Never)" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} className="custom-admin-input" style={{marginTop:'5px', color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d4ac0d' }}>📥 Max Downloads</label>
                                        <input type="number" placeholder="e.g. 3 (0 = Unlimited)" value={downloadLimit} onChange={(e) => setDownloadLimit(e.target.value)} className="custom-admin-input" style={{marginTop:'5px', color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, () => handleUpload(false))} />
                                    </div>
                                </div>

                                <div style={{ border: '2px dashed #ccc', padding: '20px', borderRadius: '10px', textAlign: 'center', background: '#f9f9f9' }}>
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '15px', color: '#444' }}>📁 Upload Media (Smart Structuring)</label>
                                    
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                                        <button type="button" onClick={() => document.getElementById('file-input-field').click()} style={{ background: '#3498db', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            📄 Select Specific Files
                                        </button>
                                        <button type="button" onClick={() => document.getElementById('folder-input-field').click()} style={{ background: '#8e44ad', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            🗂️ Select Entire Folder
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#777', margin: '0 0 15px 0' }}>Tip: Select a root folder (e.g. 'Wedding') and we'll automatically detect its sub-folders (Haldi, Mehndi)!</p>

                                    <input id="file-input-field" type="file" multiple accept="image/*,video/*" onChange={(e) => handleFileChange(e, false)} style={{ display: 'none' }} />
                                    {/* ✅ THE MAGIC DIRECTORY ATTRIBUTE */}
                                    <input id="folder-input-field" type="file" webkitdirectory="true" directory="true" multiple onChange={(e) => handleFileChange(e, true)} style={{ display: 'none' }} />
                                    
                                    {files.length > 0 && (
                                        <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                                            <div style={{ background: '#e8f8f5', border: '1px solid #2ecc71', color: '#27ae60', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                                📸 Photos: {fileStats.photos}
                                            </div>
                                            <div style={{ background: '#fdedec', border: '1px solid #e74c3c', color: '#c0392b', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                                🎥 Videos: {fileStats.videos}
                                            </div>
                                            {fileStats.subFolders > 0 && (
                                                <div style={{ background: '#f5eef8', border: '1px solid #9b59b6', color: '#8e44ad', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                                    📂 Folders: {fileStats.subFolders}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* ✅ SMART PER-FILE PROGRESS & RETRY BLOCK (CLIENT UPLOAD) */}
                                {(loading || (pendingResumeState && !loading && uploadSpeed.includes('failures'))) && (() => {
                                    let successCount = 0;
                                    let failCount = 0;
                                    let pendingCount = 0;
                                    const failedFilesList = [];
                                    
                                    files.forEach(f => {
                                        const prog = fileProgressMap[f.name];
                                        const isAlreadyDone = pendingResumeState?.uploadedFiles?.includes(f.name);
                                        
                                        if (prog === 100 || isAlreadyDone) successCount++;
                                        else if (prog === -1) { failCount++; failedFilesList.push(f.name); }
                                        else pendingCount++;
                                    });

                                    return (
                                        <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>
                                                <span>{uploadProgress === 100 ? 'Saving to Database...' : `Cloud Upload... ${uploadProgress}%`}</span>
                                                <span style={{ color: '#3498db' }}>{uploadSpeed}</span>
                                            </div>
                                            <div style={{ width: '100%', background: '#eee', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
                                                <div style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #3498db, #2ecc71)', height: '100%', transition: 'width 0.3s ease' }}></div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', fontWeight: 'bold' }}>
                                                <span style={{ color: '#f1c40f' }}>{uploadStats}</span>
                                                <span style={{ color: '#e67e22' }}>⏳ {uploadETA}</span>
                                            </div>
                                            
                                            {/* 🔄 LIVE ACTION TEXT */}
                                            {liveActionText && loading && (
                                                <div style={{ marginTop: '10px', padding: '8px', background: '#f5f6fa', borderRadius: '5px', fontSize: '11px', color: '#2c3e50', borderLeft: '3px solid #3498db', fontWeight: 'bold' }}>
                                                    🔄 {liveActionText}
                                                </div>
                                            )}

                                            {/* 📊 SUCCESS / FAIL STATS */}
                                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                                <div style={{ flex: 1, background: '#e8f8f5', border: '1px solid #2ecc71', color: '#27ae60', padding: '8px', borderRadius: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>✅ {successCount} Uploaded</div>
                                                <div style={{ flex: 1, background: '#fdedec', border: '1px solid #e74c3c', color: '#c0392b', padding: '8px', borderRadius: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>❌ {failCount} Failed</div>
                                                <div style={{ flex: 1, background: '#ebf5fb', border: '1px solid #3498db', color: '#2980b9', padding: '8px', borderRadius: '6px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>⏳ {pendingCount} Queued</div>
                                            </div>

                                            {/* 🛑 FAILURES RETRY ACTION */}
                                            {failCount > 0 && !loading && (
                                                <div style={{ background: '#fdf2e9', padding: '15px', borderRadius: '8px', marginTop: '15px', border: '1px dashed #e67e22', textAlign: 'center' }}>
                                                    <p style={{ margin: '0 0 10px 0', color: '#d35400', fontWeight: 'bold', fontSize: '13px' }}>⚠️ Some files failed to upload</p>
                                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                                        <button onClick={() => handleUpload(false)} style={{ background: '#e67e22', color: '#fff', padding: '8px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🔄 Retry Failed Files</button>
                                                        <button onClick={() => alert(`FAILED FILES:\n\n${failedFilesList.join('\n')}`)} style={{ background: 'transparent', color: '#e74c3c', textDecoration: 'underline', border: 'none', padding: '8px 15px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>👁️ View List</button>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* 🛑 Stop Upload Button */}
                                            {loading && (
                                                <div style={{ textAlign: 'center', marginTop: '15px' }}>
                                                    <button onClick={handleStopUpload} style={{ background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', border: '1px solid #e74c3c', padding: '6px 15px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>
                                                        🛑 Stop Upload
                                                    </button>
                                                </div>
                                            )}
                                            
                                            <div style={{marginTop: '15px', maxHeight: '200px', overflowY: 'auto', borderTop: '1px solid #eee', paddingTop: '10px'}}>
                                                <p style={{fontSize: '11px', color: '#888', fontWeight: 'bold', margin: '0 0 10px 0'}}>PER FILE UPLOAD STATUS:</p>
                                                {files.map((f, i) => {
                                                    const fileProg = fileProgressMap[f.name] || (pendingResumeState?.uploadedFiles?.includes(f.name) ? 100 : 0);
                                                    let statusColor = '#f39c12'; 
                                                    let statusText = '⏳ Queued';
                                                    
                                                    if (fileProg > 0 && fileProg < 100) {
                                                        statusColor = '#3498db'; 
                                                        statusText = `🚀 ${fileProg}%`;
                                                    } else if (fileProg === 100) {
                                                        statusColor = '#2ecc71'; 
                                                        statusText = '✅ Done';
                                                    } else if (fileProg === -1) {
                                                        statusColor = '#e74c3c'; 
                                                        statusText = '❌ Failed';
                                                    }

                                                    return (
                                                        <div key={i} style={{ padding: '8px', background: '#fff', marginBottom: '5px', borderRadius: '6px', border: '1px solid #eee', fontSize: '11px', color: '#444', position: 'relative', overflow: 'hidden' }}>
                                                            {/* Background Live Loading Bar */}
                                                            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${fileProg === -1 ? 100 : fileProg}%`, background: fileProg === 100 ? 'rgba(46, 204, 113, 0.15)' : (fileProg === -1 ? 'rgba(231, 76, 60, 0.15)' : 'rgba(52, 152, 219, 0.15)'), transition: 'width 0.3s ease', zIndex: 0 }}></div>
                                                            
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                                                                <div style={{width: '70%', display: 'flex', flexDirection: 'column'}}>
                                                                    <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: fileProg > 0 ? 'bold' : 'normal', color: fileProg === -1 ? '#e74c3c' : '#444'}}>
                                                                        📄 {f.name}
                                                                    </span>
                                                                    {f.customSubFolder && (
                                                                        <span style={{fontSize: '9px', color: '#888', marginTop: '2px'}}>📂 {f.customSubFolder}</span>
                                                                    )}
                                                                </div>
                                                                <span style={{ color: statusColor, fontWeight: 'bold', background: '#fff', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${statusColor}` }}>
                                                                    {statusText}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                                
                                <button onClick={() => handleUpload(false)} disabled={loading} className="global-update-btn" style={{ width: '100%', padding: '15px', fontSize: '16px', background: loading ? '#95a5a6' : (uploadType === 'SELECTION' ? '#8e44ad' : '#2ecc71'), cursor: loading ? 'not-allowed' : 'pointer' }}>
                                    {loading ? 'Uploading to Cloud...' : (uploadType === 'SELECTION' ? '✨ Upload Selection Project & Email Client' : '🚀 Upload Folder & Notify Client')}
                                </button>
                            </div>
                        </div>

                        {/* ✅ UPLOAD HISTORY SECTION (SEARCH & SHOW MORE) */}
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '30px auto 0', background: '#fff', border: '1px solid #ddd', borderRadius: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #f5f6fa', paddingBottom: '10px' }}>
                                <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '16px' }}>📜 Recent Uploads</h3>
                                <input
                                    type="text"
                                    placeholder="🔍 Search history..."
                                    value={uploadLogSearch}
                                    onChange={(e) => setUploadLogSearch(e.target.value)}
                                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '12px', width: '150px', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {(() => {
                                    // 🔥 ULTIMATE FIX: Fetching Real History directly from Backend Wallet Logs (Includes Normal + Smart Albums)
                                    const uploadHistory = (studioProfile?.wallet?.history || []).filter(item => item.type === 'upload');
                                    
                                    const filteredLogs = uploadHistory.filter(log => log.action.toLowerCase().includes(uploadLogSearch.toLowerCase()) || (log.amount && log.amount.toLowerCase().includes(uploadLogSearch.toLowerCase())));

                                    if (filteredLogs.length === 0) return <p style={{ textAlign: 'center', color: '#999', fontSize: '12px', padding: '10px 0' }}>No upload history found.</p>;

                                    return (
                                        <>
                                            {filteredLogs.slice(0, uploadLogLimit).map((log, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #8e44ad', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                                                    <div>
                                                        <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>{log.action}</p>
                                                        <p style={{ margin: 0, fontSize: '11px', color: '#7f8c8d' }}>🕒 {log.date}</p>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                                                        {log.amount && (
                                                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', background: 'rgba(142, 68, 173, 0.1)', border: '1px solid rgba(142, 68, 173, 0.2)', padding: '5px 10px', borderRadius: '6px' }}>
                                                                {log.amount}
                                                            </div>
                                                        )}
                                                        {log.report && log.report.failed > 0 && (
                                                            <button onClick={() => generateFailedReportPDF(log)} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(231,76,60,0.3)' }}>
                                                                📄 Download Error Report
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            {filteredLogs.length > uploadLogLimit && (
                                                <button onClick={() => setUploadLogLimit(prev => prev + 5)} style={{ width: '100%', marginTop: '10px', background: '#ecf0f1', color: '#34495e', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>
                                                    Show More 👇
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                    </div>
                )}

                {/* 🔴 TAB: SELECTION PROJECTS */}
                {activeTab === 'SELECTION_PROJECTS' && (
                    <div className="view-section">
                        <div className="section-header" style={{display: 'flex', justifyContent: 'space-between'}}>
                            <h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>✨ Smart Album Selections</h2>
                            <button className="refresh-btn" onClick={fetchStudioSelections} disabled={fetchingSelections} style={{background:'#8e44ad', color:'white', border:'none', padding:'8px 15px', borderRadius:'5px', cursor:'pointer'}}>
                                {fetchingSelections ? 'Refreshing...' : '🔄 Refresh Status'}
                            </button>
                        </div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Track which clients have selected photos for their albums. Download final lists or share access.</p>

                        <div className="data-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Project Details</th><th>Client</th><th>Selection Progress</th><th>Extra Amount</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {mySelections.map((sel, i) => {
                                        const totalImgs = sel.allImages ? sel.allImages.length : 0;
                                        const selectedImgs = sel.images ? sel.images.filter(img => img.status === 'selected').length : 0;
                                        return (
                                            <tr key={i}>
                                                <td>
                                                    <strong>{sel.folderName}</strong>
                                                    <div style={{fontSize:'10px', color:'#777', marginTop:'3px'}}>Created: {new Date(sel.createdAt).toLocaleDateString()}</div>
                                                    
                                                    {/* ✅ NEW: SHOW DELIVERY DATE & EDIT BUTTON IF COMPLETED */}
                                                    {sel.status === 'Completed' && sel.expectedDeliveryDate && (
                                                        <div style={{fontSize:'11px', color:'#27ae60', marginTop:'8px', fontWeight:'bold', background: '#e8f8f5', padding: '5px', borderRadius: '4px', display: 'inline-block'}}>
                                                            🚚 Delivery: {new Date(sel.expectedDeliveryDate).toLocaleDateString()}
                                                            <span onClick={() => {
                                                                const days = window.prompt("Update Expected Delivery (in DAYS from today):", "25");
                                                                if (days && !isNaN(days)) {
                                                                    axios.post(`${API_BASE}/update-album-delivery-date`, { projectId: sel._id, newDaysToAdd: days }, { headers: { 'Authorization': `Bearer ${getValidToken()}` }}).then(() => { alert("✅ Date Updated & Reminders Reset!"); fetchStudioSelections(); });
                                                                }
                                                            }} style={{cursor:'pointer', marginLeft:'10px', color:'#3498db', textDecoration: 'underline'}}>✏️ Edit</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{fontWeight: 'bold'}}>{sel.clientMobile}</span>
                                                    
                                                    {/* ✅ NEW: FAMILY COLLAB BADGE (Shows Nicknames) */}
                                                    {sel.familyMembers && sel.familyMembers.length > 0 && (
                                                        <div style={{marginTop: '8px', background: '#fcf3cf', border: '1px dashed #f39c12', padding: '6px', borderRadius: '6px', fontSize: '10px', color: '#d35400'}}>
                                                            <strong style={{fontSize: '11px'}}>👨‍👩‍👧‍👦 Family Collab Active</strong><br/>
                                                            {sel.familyMembers.length} Members Invited:
                                                            <div style={{marginTop: '3px', color: '#555', fontWeight: 'bold'}}>
                                                                {sel.familyMembers.map(f => f.nickname || f.mobile).join(', ')}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span style={{background: sel.status === 'Completed' ? '#2ecc71' : (sel.status === 'Pending' ? '#f1c40f' : '#3498db'), color: '#fff', padding: '3px 8px', borderRadius: '15px', fontSize: '11px', fontWeight: 'bold'}}>
                                                        {sel.status}
                                                    </span>
                                                    <div style={{fontSize:'11px', marginTop:'5px'}}>Phase: {sel.currentPhase} / {sel.totalPhases}</div>
                                                    <div style={{fontSize:'11px', color:'#8e44ad'}}><strong>{selectedImgs}</strong> of {totalImgs} picked</div>
                                                </td>
                                                <td>
                                                <strong style={{color: sel.extraAmountToPay > 0 ? '#e74c3c' : '#2ecc71'}}>₹{sel.extraAmountToPay || 0}</strong>
                                                {sel.extraAmountToPay > 0 && <div style={{fontSize:'10px', color: sel.isPaid ? '#2ecc71' : '#e74c3c'}}>{sel.isPaid ? 'Paid' : 'Unpaid'}</div>}
                                                
                                                {/* ✅ SPLIT ALBUM DETAILS INDICATOR */}
                                                {sel.splitCompleted && sel.splitDetails?.hasSplit && (
                                                    <div style={{ marginTop: '5px', background: '#fdf2e9', border: '1px dashed #e67e22', padding: '5px', borderRadius: '5px', fontSize: '9px', color: '#d35400', fontWeight: 'bold' }}>
                                                        📘 Main: {sel.splitDetails.album1Count} Pics<br/>
                                                        📙 Mini: {sel.splitDetails.album2Count} Pics
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                <button onClick={() => handleMagicLogin(sel)} style={{background:'#34495e', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', fontSize:'11px', cursor:'pointer', fontWeight: 'bold'}}>👁️ Preview Data</button>
                                                
                                                <button onClick={() => handleDeleteSelectionProject(sel._id)} style={{background:'#e74c3c', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', fontSize:'11px', cursor:'pointer', fontWeight: 'bold'}}>🗑️ Delete</button>
                                                
                                                {/* ✅ SMART DOWNLOAD LOGIC BASED ON STATUS */}
                                                {sel.status === 'Confirmed' || (sel.status === 'Completed' && !isSplitWindowActive(sel)) ? (
                                                    <button onClick={() => startSmartDownload(sel)} disabled={downloadManager.active && downloadManager.projectId === sel._id} style={{background: (downloadManager.active && downloadManager.projectId === sel._id) ? '#bdc3c7' : '#2ecc71', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', fontSize:'11px', cursor:'pointer', fontWeight: 'bold'}}>
                                                        {downloadManager.active && downloadManager.projectId === sel._id ? 'Downloading...' : '📥 Download ZIP'}
                                                    </button>
                                                ) : (sel.status === 'Submitted' || sel.status === 'Split Mode') ? (
                                                    <button disabled style={{background:'#95a5a6', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', fontSize:'10px', cursor:'not-allowed', fontWeight: 'bold'}}>
                                                        ⏳ Locked (Client Splitting...)
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                    {mySelections.length === 0 && !fetchingSelections && (
                                        <tr><td colSpan="5" style={{textAlign:'center', color:'#888', padding:'20px'}}>No Smart Selections created yet. Start uploading in Selection Mode!</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 3: FEED MANAGEMENT */}
                {activeTab === 'FEED' && studioProfile.isFeedApproved && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>🌟 Feed Management</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto', textAlign:'center' }}>
                            <div style={{background: '#fffdf5', border: '1px solid #f1c40f', padding: '20px', borderRadius: '10px', marginBottom: '25px'}}>
                                <h3 style={{color: '#d4ac0d', marginTop: 0}}>Grow Your Audience</h3>
                                <p style={{color:'#555', fontSize: '14px', lineHeight: '1.5'}}>
                                    Upload your best shots (images or short 1-min clips) here. These will be randomly featured on Snevio's main public trending page!
                                </p>
                            </div>
                            
                            {/* ✅ PREMIUM DRAG & DROP ZONE FOR FEED */}
                            <div 
                                onDragOver={handleFeedDragOver}
                                onDragLeave={handleFeedDragLeave}
                                onDrop={handleFeedDrop}
                                style={{ 
                                    border: isDragging ? '2px dashed #2ecc71' : '2px dashed #d4af37', 
                                    padding: '40px 20px', 
                                    borderRadius: '15px', 
                                    background: isDragging ? 'rgba(46, 204, 113, 0.1)' : '#fafafa', 
                                    transition: 'all 0.3s ease',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                                onClick={() => document.getElementById('feed-hidden-input').click()}
                            >
                                <div style={{ fontSize: '50px', marginBottom: '10px', animation: isDragging ? 'bounce 1s infinite' : 'none' }}>📥</div>
                                <h3 style={{ color: isDragging ? '#27ae60' : '#8e6b1e', margin: '0 0 10px 0' }}>
                                    {isDragging ? 'Drop Files Here!' : 'Drag & Drop Media Here'}
                                </h3>
                                <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>or click to browse files from your device</p>
                                
                                <input 
                                    id="feed-hidden-input" 
                                    type="file" 
                                    multiple 
                                    accept="image/*,video/mp4,video/mov" 
                                    onChange={(e) => processFeedFiles(Array.from(e.target.files))} 
                                    style={{ display: 'none' }}
                                />
                            </div>

                            {/* ✅ NEW: FEED DETAILS FORM WITH CUSTOM EXPIRY LOGIC */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px', textAlign: 'left', background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #eee' }}>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>📝 Post Description / Caption</label>
                                    <textarea rows="2" value={feedDescription} onChange={(e) => setFeedDescription(e.target.value)} className="custom-admin-input" placeholder="Write a catchy caption detailing the shot..." style={{marginTop: '5px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', color: '#000', fontWeight: '500'}}></textarea>
                                </div>
                                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>🗂️ Select Feed Category</label>
                                        <select value={feedCategory} onChange={(e) => setFeedCategory(e.target.value)} className="custom-admin-input" style={{marginTop: '5px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', color: '#000', fontWeight: 'bold'}}>
                                            <option value="trending">🔥 Trending Now</option>
                                            <option value="viral">🚀 Viral Content</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>💰 Booking Price (₹)</label>
                                        <input type="number" value={feedPrice} onChange={(e) => setFeedPrice(e.target.value)} className="custom-admin-input" placeholder="e.g. 15000" style={{marginTop: '5px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', color: '#000', fontWeight: '500'}} />
                                    </div>

                                    {/* ✅ FOMO Expiry Logic Input */}
                                    <div style={{ flex: '1 1 100%' }}>
                                        <label style={{fontWeight:'bold', fontSize:'13px', color: '#d4ac0d'}}>⏳ Limited Time Offer Expiry</label>
                                        
                                        <select 
                                            value={feedExpiryType} 
                                            onChange={(e) => setFeedExpiryType(e.target.value)} 
                                            className="custom-admin-input" 
                                            style={{marginTop: '5px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px dashed #f1c40f', background: '#fffdf5', cursor: 'pointer', color: '#000', fontWeight: 'bold'}}
                                        >
                                            <option value="permanent">♾️ Permanent (No Expiry)</option>
                                            <option value="12">⏳ 12 Hours</option>
                                            <option value="24">⏳ 24 Hours (1 Day)</option>
                                            <option value="72">⏳ 72 Hours (3 Days)</option>
                                            <option value="168">⏳ 1 Week</option>
                                            <option value="custom">✍️ Custom Hours</option>
                                        </select>

                                        {feedExpiryType === 'custom' && (
                                            <input 
                                                type="number" 
                                                value={customExpiryHours} 
                                                onChange={(e) => setCustomExpiryHours(e.target.value)} 
                                                className="custom-admin-input" 
                                                placeholder="Enter exact hours (e.g., 48)" 
                                                style={{marginTop: '10px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', color: '#000', fontWeight: '500'}} 
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ✅ LIVE MEDIA PREVIEW GRID FOR FEED */}
                            {feedPreviews.length > 0 && (
                                <div style={{ marginTop: '20px', background: '#fff', padding: '15px', borderRadius: '15px', border: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <span style={{ fontWeight: 'bold', color: '#333' }}>Selected Media ({feedPreviews.length})</span>
                                        <div style={{ display: 'flex', gap: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                                            <span style={{ background: '#e8f8f5', color: '#27ae60', padding: '4px 10px', borderRadius: '10px' }}>📸 {fileStats.feedPhotos} Photos</span>
                                            <span style={{ background: '#fdedec', color: '#c0392b', padding: '4px 10px', borderRadius: '10px' }}>🎥 {fileStats.feedVideos} Videos</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
                                        {feedPreviews.map((preview, idx) => (
                                            <div key={idx} style={{ position: 'relative', minWidth: '100px', height: '100px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #ddd', background: '#000', flexShrink: 0 }}>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); removeFeedFile(idx); }} 
                                                    style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(231, 76, 60, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '10px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    ✖
                                                </button>
                                                {preview.type.startsWith('video/') ? (
                                                    <>
                                                        <video src={preview.url} playsInline muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize: '20px' }}>▶️</div>
                                                    </>
                                                ) : (
                                                    <img src={preview.url} alt={preview.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ✅ PER-FILE PROGRESS BLOCK (FEED UPLOAD) */}
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

                                    <div style={{marginTop: '15px', maxHeight: '150px', overflowY: 'auto', borderTop: '1px solid #eee', paddingTop: '10px'}}>
                                        <p style={{fontSize: '11px', color: '#888', fontWeight: 'bold', margin: '0 0 10px 0'}}>PER FILE UPLOAD STATUS:</p>
                                        {feedFiles.map((f, i) => (
                                            <div key={i} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px', background: '#fdfbf7', marginBottom: '5px', borderRadius: '4px', fontSize: '10px', color: '#444'}}>
                                                <span style={{width: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>📄 {f.name}</span>
                                                <span style={{color: uploadProgress >= ((i+1)/feedFiles.length)*100 ? '#2ecc71' : '#f39c12', fontWeight: 'bold'}}>
                                                    {uploadProgress >= ((i+1)/feedFiles.length)*100 ? '✅ Uploaded' : '⏳ Queued...'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <button onClick={() => handleUpload(true)} disabled={loading} className="global-update-btn" style={{ width: '100%', padding: '15px', marginTop:'20px', background: loading ? '#bdc3c7' : 'linear-gradient(135deg, #d4af37, #f1c40f)', color:'#000', fontSize: '16px', fontWeight: 'bold', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                {loading ? 'Uploading to Cloud Server...' : '🔥 Upload to Global Feed'}
                            </button>
                        </div>

                        {/* ✅ FEED ANALYTICS DISPLAY */}
                        <div className="update-creation-container" style={{ maxWidth: '900px', margin: '30px auto', background: '#f8f9fa' }}>
                            <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #eee', paddingBottom: '10px', textAlign: 'left' }}>📊 My Feed Analytics</h3>
                            {fetchingFeed ? (
                                <p style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>Loading your feed posts...</p>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px', marginTop: '20px' }}>
                                    {myFeedPosts.length > 0 ? myFeedPosts.map((post, idx) => (
                                        <div key={idx} style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', position: 'relative' }}>
                                            {/* Views Counter Overlay */}
                                            <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', zIndex: 10 }}>
                                                👁️ {post.views || 0} Views
                                            </div>
                                            <div style={{ height: '180px', background: '#000', position: 'relative' }}>
                                                {post.fileType === 'video' ? (
                                                    <>
                                                        <video src={getCleanUrl(post.file)} playsInline muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>🎥</div>
                                                    </>
                                                ) : (
                                                    <img src={getCleanUrl(post.file)} alt="Feed" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                )}
                                            </div>
                                            <div style={{ padding: '12px', textAlign: 'left' }}>
                                                <p style={{ margin: '0 0 5px 0', fontSize: '12px', fontWeight: 'bold', color: post.feedCategory === 'trending' ? '#e74c3c' : '#3498db' }}>{post.feedCategory === 'trending' ? '🔥 Trending' : '🚀 Viral'}</p>
                                                <p style={{ margin: 0, fontSize: '11px', color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.description}</p>
                                                <p style={{ margin: '8px 0', fontSize: '14px', color: '#27ae60', fontWeight: 'bold' }}>₹{post.price}</p>
                                                {/* Timer/Expiry Tag */}
                                                <div style={{ background: post.expiryDate ? '#fdf2e9' : '#ebf5fb', color: post.expiryDate ? '#e67e22' : '#2980b9', padding: '5px', borderRadius: '5px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>
                                                    {post.expiryDate ? `⏳ Expires: ${new Date(post.expiryDate).toLocaleString()}` : '♾️ Permanent Post'}
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <p style={{ color: '#888', fontSize: '13px', gridColumn: '1 / -1', textAlign: 'center', padding: '20px 0' }}>You haven't uploaded any public feed posts yet.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 6: LONG MEDIA / CINEMATIC UPLOAD */}
                {activeTab === 'LONG_UPLOAD' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>🎬 Cinematic & Long Video Upload</h2></div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Upload large videos directly to client's account. System will extract audio, link YouTube, and send SMS/Email notifications automatically.</p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
                            
                            {/* 👤 TOP ROW: CLIENT ASSIGNMENT */}
                            <div className="update-creation-container" style={{ flex: '1 1 100%', margin: 0, borderTop: '4px solid #f39c12', display: 'flex', flexWrap: 'wrap', gap: '15px', background: '#fffdf5' }}>
                                <div style={{ flex: '1 1 200px', position: 'relative' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d35400' }}>👤 Assign to Client Mobile</label>
                                    <input 
                                        type="number" placeholder="10-Digit Number" value={clientMobile} onChange={handleMobileChange}
                                        onFocus={() => setShowMobileSuggestions(true)} onBlur={() => setTimeout(() => setShowMobileSuggestions(false), 200)}
                                        className="custom-admin-input" style={{marginTop: '5px', border: '1px solid #f39c12'}}
                                    />
                                    {showMobileSuggestions && clientMobile && filteredMobileSuggestions.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', borderRadius: '5px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                                            {filteredMobileSuggestions.map((c, idx) => (
                                                <li key={idx} onMouseDown={() => { setClientMobile(c.mobile); setClientName(c.name || 'Client'); setClientEmail(c.email || ''); setShowMobileSuggestions(false); }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#333' }}>
                                                    📞 <strong>{c.mobile}</strong> - {c.name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div style={{ flex: '1 1 200px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#444' }}>Client Name {selectedClient && <span style={{color: '#2ecc71'}}>(Auto)</span>}</label>
                                    <input type="text" placeholder="Full Name" value={clientName} onChange={(e) => setClientName(e.target.value)} className="custom-admin-input" style={{marginTop: '5px'}}/>
                                </div>
                                <div style={{ flex: '1 1 200px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#444' }}>Client Email {selectedClient && <span style={{color: '#2ecc71'}}>(Auto)</span>}</label>
                                    <input type="email" placeholder="For Instant Link Delivery" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="custom-admin-input" style={{marginTop: '5px'}}/>
                                </div>
                                <div style={{ flex: '1 1 200px', position: 'relative' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#444' }}>📂 Target Folder Name</label>
                                    <input type="text" placeholder="e.g. Wedding Cinematic" value={folderName} onChange={(e) => { setFolderName(e.target.value); setShowFolderSuggestions(true); }} onFocus={() => setShowFolderSuggestions(true)} onBlur={() => setTimeout(() => setShowFolderSuggestions(false), 200)} className="custom-admin-input" style={{marginTop: '5px'}}/>
                                    {showFolderSuggestions && existingFolders.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', borderRadius: '5px' }}>
                                            {filteredFolderSuggestions.map((folder, idx) => (
                                                <li key={idx} onMouseDown={() => { setFolderName(folder); setShowFolderSuggestions(false); }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#333' }}>📁 <strong>{folder}</strong></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* LEFT COLUMN: FORM DETAILS */}
                            <div className="update-creation-container" style={{ flex: '1 1 350px', margin: 0, borderTop: '4px solid #3498db' }}>
                                <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>📝 Video & Subscription Details</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d' }}>Video Title</label>
                                        <input type="text" placeholder="e.g. Royal Rajput Wedding Highlight" value={longMediaForm.title} onChange={(e) => setLongMediaForm({...longMediaForm, title: e.target.value})} className="custom-admin-input" style={{marginTop: '5px'}}/>
                                    </div>

                                    {/* YOUTUBE LINK INPUT */}
                                    <div style={{ background: '#fdf2e9', padding: '10px', borderRadius: '8px', borderLeft: '4px solid #e67e22' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d35400' }}>🔗 Real YouTube Link (Unlisted)</label>
                                        <input type="url" placeholder="Paste your Unlisted YouTube link here" value={longMediaForm.ytLink} onChange={(e) => setLongMediaForm({...longMediaForm, ytLink: e.target.value})} className="custom-admin-input" style={{marginTop: '5px'}}/>
                                    </div>

                                    {/* ✅ NEW: SUBSCRIPTION & FREE TIME LOGIC */}
                                    <div style={{ background: '#e8f8f5', padding: '10px', borderRadius: '8px', borderLeft: '4px solid #1abc9c' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#16a085' }}>⏳ Free Access Time (Hours)</label>
                                        <input type="number" placeholder="e.g. 24 (Leave 0 for always free)" value={longMediaForm.freeHours} onChange={(e) => setLongMediaForm({...longMediaForm, freeHours: e.target.value})} className="custom-admin-input" style={{marginTop: '5px', marginBottom: '10px'}}/>
                                        
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#16a085' }}>Monthly Charge (₹)</label>
                                                <input type="number" placeholder="e.g. 199" value={longMediaForm.monthlyPrice} onChange={(e) => setLongMediaForm({...longMediaForm, monthlyPrice: e.target.value})} className="custom-admin-input" style={{marginTop: '5px'}}/>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#16a085' }}>Yearly Charge (₹)</label>
                                                <input type="number" placeholder="e.g. 999" value={longMediaForm.yearlyPrice} onChange={(e) => setLongMediaForm({...longMediaForm, yearlyPrice: e.target.value})} className="custom-admin-input" style={{marginTop: '5px'}}/>
                                            </div>
                                        </div>
                                        <p style={{fontSize: '10px', color: '#7f8c8d', margin: '5px 0 0 0'}}>Users can watch free for the specified time, then must buy a plan.</p>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d' }}>Category</label>
                                        <select value={longMediaForm.category} onChange={(e) => setLongMediaForm({...longMediaForm, category: e.target.value})} className="custom-admin-input" style={{marginTop: '5px'}}>
                                            <option value="Wedding Highlight">Wedding Highlight</option>
                                            <option value="Pre-Wedding">Pre-Wedding Song</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: PREVIEW & UPLOAD ACTION */}
                            <div className="update-creation-container" style={{ flex: '1 1 350px', margin: 0, background: '#f8f9fa', border: '1px dashed #bdc3c7' }}>
                                <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>📺 Media Upload Mode</h3>
                                
                                {/* 🔥 NEW: The Smart Toggle Switch */}
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', background: '#fff', padding: '5px', borderRadius: '8px', border: '1px solid #ccc' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => { setUploadMode('AUDIO'); setLongMediaFile(null); setLongMediaPreview(''); document.getElementById('long-video-upload').value = ''; }} 
                                        style={{ flex: 1, padding: '10px', borderRadius: '5px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: uploadMode === 'AUDIO' ? '#2ecc71' : 'transparent', color: uploadMode === 'AUDIO' ? '#fff' : '#777', transition: '0.3s' }}
                                    >
                                        🎵 Upload Audio Only (.mp3)
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => { setUploadMode('VIDEO'); setLongMediaFile(null); setLongMediaPreview(''); document.getElementById('long-video-upload').value = ''; }} 
                                        style={{ flex: 1, padding: '10px', borderRadius: '5px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: uploadMode === 'VIDEO' ? '#e74c3c' : 'transparent', color: uploadMode === 'VIDEO' ? '#fff' : '#777', transition: '0.3s' }}
                                    >
                                        🎥 Upload Video (Max 500MB)
                                    </button>
                                </div>

                                {!longMediaPreview ? (
                                    <div style={{ height: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ecf0f1', borderRadius: '10px', cursor: 'pointer', border: '2px dashed #95a5a6' }} onClick={() => document.getElementById('long-video-upload').click()}>
                                        <span style={{ fontSize: '40px' }}>{uploadMode === 'AUDIO' ? '🎵' : '📁'}</span>
                                        <p style={{ margin: '10px 0 0 0', fontWeight: 'bold', color: '#34495e', textAlign: 'center' }}>
                                            {uploadMode === 'AUDIO' ? 'Select Extracted Audio (.mp3, .wav)' : 'Select Original Video with Audio'}
                                        </p>
                                        
                                        {/* 🛑 500MB CRASH PROTECTOR LOGIC HERE */}
                                        <input 
                                            id="long-video-upload" 
                                            type="file" 
                                            accept={uploadMode === 'AUDIO' ? "audio/*" : "video/mp4,video/mov"} 
                                            style={{ display: 'none' }} 
                                            onChange={(e) => { 
                                                const file = e.target.files[0]; 
                                                if(file) { 
                                                    // 500MB Check (500 * 1024 * 1024 bytes = 524288000 bytes)
                                                    if (uploadMode === 'VIDEO' && file.size > 524288000) {
                                                        alert("🚨 WARNING: Video is larger than 500MB! Your server will crash.\n\nPlease switch to 'Upload Audio Only' mode and provide the MP3 file instead.");
                                                        e.target.value = ''; 
                                                        return;
                                                    }
                                                    setLongMediaFile(file); 
                                                    setLongMediaPreview(URL.createObjectURL(file)); 
                                                } 
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ position: 'relative', width: '100%', borderRadius: '10px', overflow: 'hidden', background: '#000', boxShadow: '0 5px 15px rgba(0,0,0,0.2)' }}>
                                        {uploadMode === 'VIDEO' ? (
                                            <video src={longMediaPreview} controls style={{ width: '100%', height: 'auto', maxHeight: '250px', display: 'block' }} />
                                        ) : (
                                            <div style={{ height: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#2ecc71', background: '#1a1a2e' }}>
                                                <span style={{ fontSize: '30px' }}>🎧</span>
                                                <p style={{ marginTop: '10px', fontWeight: 'bold', fontSize: '14px' }}>Audio Selected ({ (longMediaFile.size / (1024 * 1024)).toFixed(2) } MB)</p>
                                                <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#aaa' }}>Ready for lightning fast upload! ⚡</p>
                                            </div>
                                        )}
                                        <button onClick={() => { setLongMediaFile(null); setLongMediaPreview(''); document.getElementById('long-video-upload').value = ''; }} style={{ position: 'absolute', top: '10px', right: '10px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', zIndex: 10 }} disabled={isLongUploading}>✖ Remove</button>
                                    </div>
                                )}

                                {/* PROGRESS & ACTION BUTTON */}
                                {isLongUploading && (
                                    <div style={{ marginTop: '20px', padding: '15px', background: '#ebf5fb', borderRadius: '8px', border: '1px solid #3498db' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px', fontWeight: 'bold' }}>
                                            <span style={{color: '#2980b9'}}>🚀 {uploadSpeed || 'Calculating...'}</span>
                                            <span style={{color: '#e67e22'}}>⏳ {uploadETA || 'Calculating...'}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '10px', background: '#ccc', borderRadius: '10px', overflow: 'hidden' }}>
                                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#3498db', transition: 'width 0.3s' }}></div>
                                        </div>
                                        <p style={{ textAlign: 'center', fontSize: '11px', marginTop: '8px', color: '#555', fontWeight: 'bold' }}>Uploading: {uploadProgress}%</p>
                                    </div>
                                )}

                                <button 
                                    disabled={isLongUploading || !longMediaFile || !longMediaForm.title || !longMediaForm.ytLink}
                                    onClick={async () => {
                                        if(!clientMobile || clientMobile.length !== 10) return alert("Please assign to a valid 10-digit client mobile number!");
                                        if(!folderName) return alert("Please provide a Target Folder Name!");

                                        setIsLongUploading(true);
                                        setUploadProgress(0); setUploadSpeed('Starting...'); setUploadETA('Calculating...');
                                        
                                        // 1. Extract YouTube ID
                                        let extractedYtId = "";
                                        try {
                                            const urlObj = new URL(longMediaForm.ytLink);
                                            extractedYtId = urlObj.searchParams.get("v") || urlObj.pathname.split('/').pop();
                                        } catch(e) {
                                            alert("Invalid YouTube Link!"); setIsLongUploading(false); return;
                                        }

                                        let startTime = Date.now(); let lastTime = startTime; let lastLoaded = 0;

                                        try {
                                            const fd = new FormData();
                                            fd.append('videoFile', longMediaFile);
                                            // 2. Upload to Server (Audio Extraction)
                                            const extractRes = await axios.post(`${API_BASE}/upload-split-video`, fd, {
                                                headers: { 'Authorization': `Bearer ${getValidToken()}` },
                                                onUploadProgress: (progressEvent) => {
                                                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                                                    setUploadProgress(percentCompleted);
                                                    const currentTime = Date.now();
                                                    if ((currentTime - lastTime) / 1000 > 0.5) { 
                                                        const speedBps = (progressEvent.loaded - lastLoaded) / ((currentTime - lastTime) / 1000);
                                                        setUploadSpeed(`${(speedBps / (1024 * 1024)).toFixed(2)} MB/s`);
                                                        const secs = (progressEvent.total - progressEvent.loaded) / speedBps;
                                                        setUploadETA(secs > 60 ? `${Math.floor(secs / 60)}m left` : `${Math.floor(secs)}s left`);
                                                        lastLoaded = progressEvent.loaded; lastTime = currentTime;
                                                    }
                                                }
                                            });

                                            if(extractRes.data.success) {
                                                setUploadSpeed('Linking to Client DB...'); setUploadETA('Sending Notification...');
                                                
                                                // 3. Format String and Save to DB (Triggers Email/SMS Automatically!)
                                                const cinematicMediaString = `CINEMATIC::${extractedYtId}::${extractRes.data.data.audioCloudUrl}::${longMediaForm.freeHours || 0}::${longMediaForm.monthlyPrice || 0}::${longMediaForm.yearlyPrice || 0}`;
                                                
                                                const payload = {
                                                    mobile: clientMobile,
                                                    name: clientName || 'Client',
                                                    type: 'USER',
                                                    folderName: folderName.trim(),
                                                    subFolderName: '', 
                                                    email: clientEmail,
                                                    addedBy: user.mobile,
                                                    fileUrls: [cinematicMediaString] 
                                                };

                                                const dbRes = await axios.post(`${API_BASE}/admin-add-user-cloud`, payload, {
                                                    headers: { 'Authorization': `Bearer ${getValidToken()}` }
                                                });

                                                if(dbRes.data.success) {
                                                    alert(`✅ Success!\nCinematic Video saved to DB.\nSubscription Plans Applied.`);
                                                    setLongMediaFile(null); setLongMediaPreview('');
                                                    setLongMediaForm({ title: '', description: '', category: 'Wedding Highlight', customPrice: '', ytLink: '' });
                                                    setClientMobile(''); setClientName(''); setClientEmail(''); setFolderName('');
                                                    fetchClients(); // Refresh Dashboard List
                                                } else {
                                                    alert("❌ Database Error: " + dbRes.data.message);
                                                }
                                            } else {
                                                alert("❌ Extraction Failed: " + extractRes.data.message);
                                            }
                                        } catch (error) {
                                            alert(`❌ Upload Error: ${error.response?.data?.message || error.message}`);
                                        } finally {
                                            setIsLongUploading(false); setUploadProgress(0); setUploadSpeed(''); setUploadETA('');
                                        }
                                    }}
                                    className="global-update-btn" 
                                    style={{ width: '100%', marginTop: '20px', padding: '15px', fontSize: '16px', background: (isLongUploading || !longMediaFile || !longMediaForm.title || !longMediaForm.ytLink) ? '#bdc3c7' : '#2ecc71', cursor: (isLongUploading || !longMediaFile || !longMediaForm.title || !longMediaForm.ytLink) ? 'not-allowed' : 'pointer' }}
                                >
                                    {isLongUploading ? '🚀 Uploading & Linking...' : '📤 Link to Client & Notify'}
                                </button>
                            </div>

                        </div>
                    </div>
                )}
                

                {/* 🔴 TAB 4: REVENUE (LIVE MONETIZATION UPDATE) */}
                {activeTab === 'REVENUE' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>💰 Business Revenue & Wallet</h2></div>
                        <div className="dashboard-stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="stat-card green" style={{ padding: '30px', textAlign:'center' }}>
                                <p style={{ color: '#555', fontWeight: 'bold', marginBottom: '10px' }}>Total Cash Revenue</p>
                                <h3 style={{ fontSize: '40px', color: '#27ae60', margin: 0 }}>₹ {studioRevenue}</h3>
                                <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>From advance bookings</p>
                            </div>
                            <div className="stat-card blue" style={{ padding: '30px', textAlign:'center', background: '#fffdf5', border: '1px solid #f1c40f' }}>
                                <p style={{ color: '#d4ac0d', fontWeight: 'bold', marginBottom: '10px' }}>Digital Coins Earned</p>
                                <h3 style={{ fontSize: '40px', color: '#f39c12', margin: 0 }}>🪙 {studioCoins}</h3>
                                <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>From premium media unlocks</p>
                            </div>
                        </div>

                        {/* ✅ TRANSACTION HISTORY */}
                        <div style={{ marginTop: '30px', background: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #eee' }}>
                            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '18px' }}>📜 Recent Transactions</h3>
                            {studioHistory.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                                    {studioHistory.map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', borderLeft: item.type === 'credit' ? '4px solid #2ecc71' : '4px solid #e74c3c' }}>
                                            <div>
                                                <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{item.action}</p>
                                                <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>{item.date}</p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div style={{ fontWeight: 'bold', fontSize: '15px', color: item.type === 'credit' ? '#27ae60' : '#c0392b' }}>
                                                    {item.amount}
                                                </div>
                                                <button onClick={() => downloadInvoice(item)} style={{ background: 'transparent', border: '1px solid #3498db', color: '#3498db', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                                    🧾 Receipt
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ textAlign: 'center', color: '#999', fontSize: '13px', padding: '20px 0' }}>No transactions recorded yet.</p>
                            )}
                        </div>

                        <div style={{textAlign:'center', marginTop:'30px'}}>
                            <button onClick={() => setActiveTab('PAYOUTS')} className="global-update-btn" style={{ background: '#e67e22', padding: '15px 40px', fontSize: '16px' }}>➡️ Go to Payouts</button>
                        </div>
                    </div>
                )}

                {/* 🔴 NEW TAB: STUDIO PAYOUTS & WITHDRAWALS */}
                {activeTab === 'PAYOUTS' && (
                    <div className="view-section">
                        <div className="section-header">
                            <h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>💳 Withdrawals & Payouts</h2>
                            <button className="refresh-btn" onClick={fetchMyPayouts} disabled={fetchingPayouts} style={{padding: '8px 15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
                                {fetchingPayouts ? '...' : '🔄 Refresh Status'}
                            </button>
                        </div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Request money to your bank account and track the approval status here.</p>

                        {/* ✅ WITHDRAWAL FORM */}
                        <div style={{ background: '#0f172a', padding: '25px', borderRadius: '15px', border: '1px solid #333', marginBottom: '30px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '18px' }}>🏦 Request Payout</h3>
                                <span style={{ color: '#2ecc71', fontWeight: 'bold', background: 'rgba(46, 204, 113, 0.2)', padding: '5px 10px', borderRadius: '5px', fontSize: '14px' }}>Balance: ₹{studioRevenue}</span>
                            </div>
                            <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Withdraw Amount (₹)</label>
                                        <input 
                                            type="number" required placeholder="Min ₹500" 
                                            value={withdrawForm.amount} onChange={e => setWithdrawForm({...withdrawForm, amount: e.target.value})} 
                                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#1a1a2e', color: '#fff', marginTop: '5px' }} 
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ color: '#aaa', fontSize: '12px', fontWeight: 'bold' }}>Your UPI ID</label>
                                        <input 
                                            type="text" required placeholder="e.g. 9876543210@ybl" 
                                            value={withdrawForm.upiId} onChange={e => setWithdrawForm({...withdrawForm, upiId: e.target.value})} 
                                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #444', background: '#1a1a2e', color: '#fff', marginTop: '5px' }} 
                                        />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} style={{ width: '100%', background: '#e67e22', color: '#fff', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px' }}>
                                    {loading ? 'Processing...' : 'Submit Withdrawal Request'}
                                </button>
                            </form>
                        </div>

                        {/* ✅ PAYOUT HISTORY TABLE */}
                        <h3 style={{ padding: '15px 0', color: '#2c3e50', fontWeight: 'bold', borderBottom: '2px solid #eee', margin: 0 }}>📜 Payout History</h3>
                        <div className="data-table-container" style={{ marginTop: '10px' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Date</th><th>UPI ID</th><th>Amount</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {myPayouts.length > 0 ? myPayouts.map((req, idx) => (
                                        <tr key={idx} style={{ background: req.status === 'Pending' ? '#fffdf5' : 'transparent' }}>
                                            <td>
                                                <strong style={{color: '#2c3e50'}}>{new Date(req.requestedAt).toLocaleDateString()}</strong><br/>
                                                <span style={{fontSize: '10px', color: '#aaa'}}>{new Date(req.requestedAt).toLocaleTimeString()}</span>
                                            </td>
                                            <td><strong style={{ color: '#8e44ad', fontSize: '13px' }}>{req.upiId}</strong></td>
                                            <td><strong style={{ color: '#e67e22', fontSize: '16px' }}>₹{req.amount}</strong></td>
                                            <td>
                                                <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '15px', color: '#fff', background: req.status === 'Approved' ? '#2ecc71' : (req.status === 'Rejected' ? '#e74c3c' : '#f1c40f') }}>
                                                    {req.status}
                                                </span>
                                                {req.processedAt && <div style={{ fontSize: '9px', color: '#777', marginTop: '4px' }}>Processed on {new Date(req.processedAt).toLocaleDateString()}</div>}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="4" style={{textAlign: 'center', padding: '30px', color: '#888'}}>No payouts requested yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                {/* 🔴 TAB 5: PROFILE SETTINGS */}
                {activeTab === 'PROFILE' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>⚙️ Studio Profile Details</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Studio Name</label>
                                    <input type="text" value={profileEdit.studioName} onChange={e => setProfileEdit({...profileEdit, studioName: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Owner Name</label>
                                    <input type="text" value={profileEdit.ownerName} onChange={e => setProfileEdit({...profileEdit, ownerName: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Email Address</label>
                                    <input type="email" value={profileEdit.email} onChange={e => setProfileEdit({...profileEdit, email: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Location</label>
                                    <input type="text" value={profileEdit.location} onChange={e => setProfileEdit({...profileEdit, location: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>
                                
                                {/* ✅ PORTFOLIO LINK INPUT */}
                                <div style={{ background: '#f4f6f7', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #3498db' }}>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#2980b9'}}>🌐 Portfolio / Website Link</label>
                                    <p style={{ margin: '3px 0 8px 0', fontSize: '11px', color: '#7f8c8d' }}>This link will be shown to users when they view your studio details.</p>
                                    <input type="url" placeholder="https://instagram.com/your_page" value={profileEdit.portfolioUrl} onChange={e => setProfileEdit({...profileEdit, portfolioUrl: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>

                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>New Password</label>
                                    <input type="password" placeholder="Leave blank to keep current password" value={profileEdit.password} onChange={e => setProfileEdit({...profileEdit, password: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} onKeyDown={(e) => handleKeyDown(e, handleProfileUpdate)} />
                                </div>
                                
                                <button type="submit" className="global-update-btn" style={{ width: '100%', padding: '15px', background: '#2ecc71', fontSize: '16px', marginTop: '10px' }}>
                                    💾 Save Profile Details
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB 6: MY STORAGE VAULT (STUDIO LIMITS) */}
                {activeTab === 'MY_STORAGE' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>🗄️ My Storage Vault</h2></div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Track your cloud storage usage and upgrade your plan to upload more cinematic videos and heavy photo albums.</p>

                        <div className="update-creation-container" style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', borderTop: '5px solid #3498db' }}>
                            {/* Current Storage Progress */}
                            <div style={{ marginBottom: '30px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 5px 0', color: '#2c3e50' }}>Current Usage</h3>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#7f8c8d' }}>
                                            <strong style={{color: '#2980b9'}}>{(studioProfile.usedStorageGB || 0).toFixed(2)} GB</strong> used out of <strong>{studioProfile.allocatedStorageGB || 5} GB</strong>
                                        </p>
                                    </div>
                                    <div style={{ background: studioProfile.storagePlan === 'PREMIUM' ? '#8e44ad' : (studioProfile.storagePlan === 'VIP' ? '#e67e22' : '#2980b9'), color: '#fff', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                                        Current Plan: {studioProfile.storagePlan || 'FREE'}
                                    </div>
                                </div>
                                
                                {(() => {
                                    const used = studioProfile.usedStorageGB || 0;
                                    const allocated = studioProfile.allocatedStorageGB || 5;
                                    const percent = Math.min((used / allocated) * 100, 100).toFixed(1);
                                    const isCritical = percent > 90;
                                    
                                    return (
                                        <>
                                            <div style={{ width: '100%', height: '15px', background: '#ecf0f1', borderRadius: '10px', overflow: 'hidden', border: '1px solid #ddd' }}>
                                                <div style={{ width: `${percent}%`, height: '100%', background: isCritical ? '#e74c3c' : 'linear-gradient(90deg, #3498db, #2ecc71)', transition: 'width 0.5s ease' }}></div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '11px', fontWeight: 'bold' }}>
                                                <span style={{ color: isCritical ? '#e74c3c' : '#7f8c8d' }}>{percent}% Full</span>
                                                {isCritical && <span style={{ color: '#e74c3c' }}>⚠️ Almost full! Upgrade required.</span>}
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* Upgrade Plans Grid (DYNAMIC) */}
                            <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>🚀 Upgrade Your Storage</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                                
                                {subPlans.length > 0 ? subPlans.map((plan, index) => {
                                    const isCurrentPlan = studioProfile.storagePlan === plan.planName;
                                    const colors = ['#e67e22', '#8e44ad', '#2980b9', '#27ae60'];
                                    const themeColor = colors[index % colors.length];
                                    
                                    return (
                                        <div key={plan._id} style={{ border: `2px solid ${themeColor}`, borderRadius: '12px', padding: '20px', textAlign: 'center', background: '#fdfdfd', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            
                                            {isCurrentPlan && <div style={{position:'absolute', top:'-10px', left:'50%', transform:'translateX(-50%)', background:themeColor, color:'#fff', padding:'3px 10px', borderRadius:'10px', fontSize:'10px', fontWeight:'bold'}}>CURRENT PLAN</div>}
                                            {plan.offerText && !isCurrentPlan && <div style={{position:'absolute', top:'-10px', right:'-10px', background:'#e74c3c', color:'#fff', padding:'5px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'bold', transform: 'rotate(5deg)'}}>{plan.offerText}</div>}
                                            
                                            <div>
                                                <h2 style={{ color: themeColor, margin: '0 0 5px 0' }}>{plan.planName}</h2>
                                                <h1 style={{ margin: '10px 0', color: '#333' }}>{plan.storageLimitGB} GB</h1>
                                                
                                                {plan.features && plan.features.length > 0 && (
                                                    <div style={{ margin: '15px 0', background: '#f4f6f7', padding: '10px', borderRadius: '8px', textAlign: 'left', fontSize: '12px', color: '#555' }}>
                                                        <strong style={{color: '#333', display: 'block', marginBottom: '5px'}}>Features Included:</strong>
                                                        <ul style={{ margin: 0, paddingLeft: '15px' }}>
                                                            {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{marginTop: '15px'}}>
                                                {plan.discountPercentage > 0 ? (
                                                    <div style={{ marginBottom: '15px' }}>
                                                        <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '14px', marginRight: '8px' }}>₹{plan.monthlyPrice}</span>
                                                        <span style={{ fontWeight: 'bold', color: themeColor, fontSize: '20px' }}>₹{(plan.monthlyPrice - (plan.monthlyPrice * plan.discountPercentage / 100)).toFixed(0)} <span style={{fontSize: '12px'}}>/ month</span></span>
                                                    </div>
                                                ) : (
                                                    <p style={{ fontWeight: 'bold', color: themeColor, fontSize: '18px', marginBottom: '15px' }}>₹{plan.monthlyPrice} <span style={{fontSize: '12px'}}>/ month</span></p>
                                                )}

                                                <button 
                                                    disabled={isCurrentPlan || loading}
                                                    onClick={() => handlePlanUpgrade(plan)}
                                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: isCurrentPlan ? '#bdc3c7' : themeColor, color: '#fff', fontWeight: 'bold', cursor: (isCurrentPlan || loading) ? 'not-allowed' : 'pointer' }}
                                                >
                                                    {loading ? 'Processing...' : (isCurrentPlan ? 'Active Plan' : 'Pay & Upgrade Now')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <p style={{color: '#888', fontSize: '13px', gridColumn: '1 / -1', textAlign: 'center'}}>No public plans available right now. Please contact admin.</p>
                                )}
                            </div>
                            
                            <div style={{ marginTop: '25px', background: '#fdfefe', padding: '15px', borderRadius: '10px', border: '1px dashed #ccc', textAlign: 'center' }}>
                                <p style={{ fontSize: '12px', color: '#7f8c8d', margin: 0 }}>
                                    Need even more space? <a href="#" onClick={(e) => { e.preventDefault(); window.open(`https://wa.me/91${process.env.ADMIN_MOBILE || '9999999999'}?text=Hi,%20I%20need%20a%20CUSTOM%20storage%20plan%20for%20my%20studio.`, '_blank'); }} style={{ color: '#3498db', fontWeight: 'bold', textDecoration: 'none' }}>Contact Support</a> for Custom Plans (500GB+).
                                </p>
                            </div>

                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default StudioDashboard;