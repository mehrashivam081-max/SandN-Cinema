import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './OwnerDashboard.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';
const SERVER_URL = 'https://sandn-cinema.onrender.com/';

const OwnerDashboard = ({ user, onLogout }) => {
    // --- UI STATES ---
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [filterRole, setFilterRole] = useState('ALL'); 
    
    // ✅ NEW: DROPDOWN MENU STATE FOR SIDEBAR
    const [openDropdown, setOpenDropdown] = useState('GLOBAL'); // 'GLOBAL', 'USER', 'STUDIO', 'ADMIN'

    // --- LOGOUT POPUP STATE ---
    const [showLogoutPopup, setShowLogoutPopup] = useState(false);

    // --- ADMIN PROFILE DP STATE ---
    const [adminDp, setAdminDp] = useState(() => localStorage.getItem('adminDp') || '');
    const dpInputRef = useRef(null);

    // ✅ NEW: ADVANCED GLOBAL CHARGES STATES
    const [globalPricing, setGlobalPricing] = useState({ imageCost: '5', videoCost: '10' });
    const [coinPackages, setCoinPackages] = useState([]);
    const [miniEvents, setMiniEvents] = useState([]);

    // --- UPLOAD DATA STATES ---
    const [formData, setFormData] = useState({ 
        type: 'USER', 
        name: '', 
        mobile: '', 
        email: '',          
        folderName: '', 
        files: [],
        expiryDays: '30',        
        downloadLimit: '0',
        imageCost: '5',
        videoCost: '10',
        unlockValidity: '24 Hours' 
    });
    
    const [previews, setPreviews] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);
    const [uploadSubTab, setUploadSubTab] = useState('BASIC'); 
    const [isEmailLocked, setIsEmailLocked] = useState(false); 
    
    const [useDateFolder, setUseDateFolder] = useState(false);

    const [globalRemoveMobile, setGlobalRemoveMobile] = useState('');
    const [globalRemoveSearchSuggestions, setGlobalRemoveSearchSuggestions] = useState(false);
    const [globalRemoveUserObj, setGlobalRemoveUserObj] = useState(null);

    // --- UPLOAD PROGRESS TRACKER STATES ---
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [uploadETA, setUploadETA] = useState('');
    const [fileStats, setFileStats] = useState({ photos: 0, videos: 0 }); 

    // --- ADMIN SETTINGS STATES ---
    const [adminProfile, setAdminProfile] = useState({ name: user?.name || 'Owner', email: user?.email || '', password: user?.password || '' });
    const [subAdmin, setSubAdmin] = useState({ name: '', mobile: '', email: '', password: '' });

    // --- SOCIAL LINKS & POLICY STATE ---
    const [socialLinks, setSocialLinks] = useState([]);
    const [newLink, setNewLink] = useState({ platform: 'Instagram', url: '' });
    const [policyData, setPolicyData] = useState({
        terms: "",
        privacy: "",
        bestForYou: ""
    });

    // --- DATABASE LIST STATES ---
    const [collabRequests, setCollabRequests] = useState([]);
    const [bookings, setBookings] = useState([]);

    // --- REVENUE DATA ---
    const calculatedTotal = accounts.length * 1500; 
    const [incomeData, setIncomeData] = useState({ total: calculatedTotal, transactions: [] });

    // ✅ NEW: MANAGE SERVICES STATES (For User Platform)
    const [newService, setNewService] = useState({ title: '', shortDescription: '', fullDescription: '', startingPrice: '', features: '' });
    const [serviceImage, setServiceImage] = useState(null);
    const [availableServices, setAvailableServices] = useState([]);
    const [editingServiceId, setEditingServiceId] = useState(null); // ✅ ADDED

    // ✅ ADDED: PROPOSAL STATES
    const [showProposalModal, setShowProposalModal] = useState(false);
    const [proposalData, setProposalData] = useState({ bookingId: '', clientName: '', deliverables: '', totalPrice: '', advanceAmount: '', terms: '', expiryHours: '24' });

    // ✅ FEATURE 1: OFFLINE SECURITY (Auto-Logout on Connection Lost)
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

    // ✅ FEATURE 2: SMART BROWSER BACK BUTTON (FIXED with useRef to prevent infinite loop)
    const stateRefs = useRef({ activeTab, globalRemoveUserObj, showLogoutPopup, uploadSubTab, showProposalModal });
    useEffect(() => {
        stateRefs.current = { activeTab, globalRemoveUserObj, showLogoutPopup, uploadSubTab, showProposalModal };
    }, [activeTab, globalRemoveUserObj, showLogoutPopup, uploadSubTab, showProposalModal]);

    useEffect(() => {
        window.history.pushState(null, null, window.location.href);

        const handlePopState = () => {
            window.history.pushState(null, null, window.location.href); // Prevent default back

            const current = stateRefs.current;

            if (current.showProposalModal) {
                setShowProposalModal(false);
            } else if (current.showLogoutPopup) {
                setShowLogoutPopup(false);
            } else if (current.globalRemoveUserObj) {
                setGlobalRemoveUserObj(null); // Step back from client data popup
            } else if (current.activeTab === 'UPLOAD' && current.uploadSubTab === 'CHARGES') {
                setUploadSubTab('LIMITS'); // Step back in upload form
            } else if (current.activeTab === 'UPLOAD' && current.uploadSubTab === 'LIMITS') {
                setUploadSubTab('BASIC'); // Step back in upload form
            } else if (current.activeTab !== 'DASHBOARD') {
                setActiveTab('DASHBOARD'); // Return to main tab
            } else {
                setShowLogoutPopup(true); // Show logout confirmation instead of throwing out
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // ✅ FEATURE 3: ENTER KEY SUPPORT HELPER
    const handleKeyDown = (e, action) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            action(e);
        }
    };

    // 🟢 INITIAL FETCH & ADMIN SYNC
    useEffect(() => {
        fetchAccounts();
        fetchPlatformSettings(); 
        fetchBookings();         
        fetchCollabs();
        fetchServices(); // Fetch active services        

        const syncAdminData = async () => {
            try {
                let activeUser = user || JSON.parse(sessionStorage.getItem('user'));
                const res = await axios.post(`${API_BASE}/search-account`, { 
                    mobile: activeUser?.mobile || "0000000000CODEIS*@OWNER*",
                    roleFilter: "ADMIN"
                });
                if (res.data.success) {
                    const latestData = res.data.data;
                    setAdminProfile({
                        name: latestData.name || 'Owner',
                        email: latestData.email || '',
                        password: ''
                    });
                    const updatedUser = { ...activeUser, name: latestData.name };
                    // ✅ FEATURE 4: SESSION STORAGE SYNC
                    sessionStorage.setItem('user', JSON.stringify(updatedUser)); 
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }
            } catch (e) { console.log("Sync failed", e); }
        };
        syncAdminData();
    }, [user]);

    useEffect(() => {
        setIncomeData(prev => ({ ...prev, total: accounts.length * 1500 }));
    }, [accounts]);


    // ==========================================
    // 🚀 API FETCH FUNCTIONS
    // ==========================================
    const fetchAccounts = async () => {
        try {
            const res = await axios.post(`${API_BASE}/list-accounts`, { requesterRole: 'ADMIN' });
            if (res.data.success) setAccounts(res.data.data);
        } catch (error) { console.error("Failed to fetch accounts", error); }
    };

    const fetchPlatformSettings = async () => {
        try {
            const res = await axios.get(`${API_BASE}/get-platform-settings`);
            if (res.data.success && res.data.data) {
                if (res.data.data.socialLinks) setSocialLinks(res.data.data.socialLinks);
                if (res.data.data.policies) setPolicyData(res.data.data.policies);
                
                // ✅ Load Advanced Monetization Data
                if (res.data.data.defaultPricing) {
                    const globalRates = { 
                        imageCost: res.data.data.defaultPricing.imageCost.toString(), 
                        videoCost: res.data.data.defaultPricing.videoCost.toString() 
                    };
                    setGlobalPricing(globalRates);
                    setFormData(prev => ({ ...prev, imageCost: globalRates.imageCost, videoCost: globalRates.videoCost }));
                }
                if (res.data.data.coinPackages) setCoinPackages(res.data.data.coinPackages);
                if (res.data.data.miniEvents) setMiniEvents(res.data.data.miniEvents);
            }
        } catch(e) { console.log("No settings found yet"); }
    };

    const fetchBookings = async () => {
        try {
            const res = await axios.get(`${API_BASE}/get-bookings`);
            if (res.data.success) setBookings(res.data.data);
        } catch(e) { console.log("Failed to fetch bookings"); }
    };

    const fetchCollabs = async () => {
        try {
            const res = await axios.get(`${API_BASE}/get-collabs`);
            if (res.data.success) setCollabRequests(res.data.data);
        } catch(e) { console.log("Failed to fetch collabs"); }
    };

    const fetchServices = async () => { 
        try { const res = await axios.get(`${API_BASE}/get-available-services`); if (res.data.success) setAvailableServices(res.data.data || []); } catch(e) {} 
    };

    // ==========================================
    // 🚀 HELPERS
    // ==========================================
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

    const handleDpChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAdminDp(reader.result);
                localStorage.setItem('adminDp', reader.result);
            };
            reader.readAsDataURL(file);
        }
    };
    const removeDp = () => { setAdminDp(''); localStorage.removeItem('adminDp'); };

    // ==========================================
    // 🚀 UPLOAD DATA LOGIC
    // ==========================================
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFormData({ ...formData, files: selectedFiles });
        
        const photos = selectedFiles.filter(file => file.type.startsWith('image/')).length;
        const videos = selectedFiles.filter(file => file.type.startsWith('video/')).length;
        setFileStats({ photos, videos });
        
        const filePreviews = selectedFiles.map(file => ({ url: URL.createObjectURL(file), type: file.type }));
        setPreviews(filePreviews);
    };

    const handleMobileChange = (e) => {
        const val = e.target.value;
        setFormData({ ...formData, mobile: val });
        setShowSuggestions(val.length > 0);

        const exactMatch = accounts.find(c => c.mobile === val);
        if (exactMatch) {
            setFormData(prev => ({
                ...prev,
                name: exactMatch.name || exactMatch.studioName || '',
                type: exactMatch.role || 'USER',
                email: (exactMatch.email && !exactMatch.email.includes('dummy_')) ? exactMatch.email : ''
            }));
            if (exactMatch.email && !exactMatch.email.includes('dummy_')) {
                setIsEmailLocked(true);
            } else {
                setIsEmailLocked(false);
            }
        } else {
            setIsEmailLocked(false);
        }
    };

    const handleSuggestionClick = (acc) => {
        setFormData({ 
            ...formData, 
            mobile: acc.mobile, 
            name: acc.name || acc.studioName || '', 
            type: acc.role || 'USER',
            email: (acc.email && !acc.email.includes('dummy_')) ? acc.email : ''
        });
        
        if (acc.email && !acc.email.includes('dummy_')) {
            setIsEmailLocked(true);
        } else {
            setIsEmailLocked(false);
        }
        setShowSuggestions(false);
    };

    const handleFolderSuggestionClick = (folderName) => {
        setFormData({ ...formData, folderName: folderName });
        setShowFolderSuggestions(false);
    };

    // 🚀 CLOUDINARY UPLOAD WITH SMART DATE FOLDER LOGIC
    const handleAddManualUser = async (e) => {
        if(e) e.preventDefault(); // ✅ Safe form submit integration
        if (formData.mobile.length !== 10) return alert("Valid 10-digit mobile required!");
        if (formData.files.length === 0) return alert("Please select files to upload.");
        
        // ✅ Calculate Final Folder Name dynamically based on Date Checkbox
        let baseFolder = formData.folderName.trim() || 'Stranger Photography';
        let submitFolderName = baseFolder;
        if (useDateFolder) {
            const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-'); 
            submitFolderName = `${baseFolder} ➔ ${dateStr}`;
        }
        const displayFolder = submitFolderName;

        const expiryText = formData.expiryDays === '0' ? 'Never' : `${formData.expiryDays} Days`;
        if (!window.confirm(`Upload Data for ${formData.name || formData.mobile}?\n\nTarget Folder: 📂 ${displayFolder}\nFolder Expiry: ${expiryText}\nImage Cost: ${formData.imageCost} Coins\nVideo Cost: ${formData.videoCost} Coins\nUnlock Validity: ${formData.unlockValidity}`)) return;

        setLoading(true);
        setUploadProgress(0);
        setUploadSpeed('Starting Upload...');
        setUploadETA('Calculating...');

        const totalBytes = formData.files.reduce((acc, file) => acc + file.size, 0);
        const loadedBytesArray = new Array(formData.files.length).fill(0);
        const uploadedUrls = [];

        let startTime = Date.now();
        let lastTime = startTime;
        let lastTotalLoaded = 0;

        try {
            // STEP 1: UPLOAD TO CLOUDINARY
            for (let i = 0; i < formData.files.length; i++) {
                const file = formData.files[i];
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

            // STEP 2: SEND LINKS TO BACKEND TO SAVE
            setUploadProgress(100);
            setUploadSpeed('Finalizing...');
            setUploadETA('Saving Data to Server...');

            // ✅ Added unlockValidity
            const payloadData = {
                type: formData.type,
                name: formData.name,
                mobile: formData.mobile,
                email: formData.email, 
                folderName: submitFolderName, 
                expiryDays: formData.expiryDays,
                downloadLimit: formData.downloadLimit,
                addedBy: 'ADMIN',
                fileUrls: uploadedUrls,
                imageCost: formData.imageCost,
                videoCost: formData.videoCost,
                unlockValidity: formData.unlockValidity 
            };

            const res = await axios.post(`${API_BASE}/admin-add-user-cloud`, payloadData);
            
            if (res.data.success) {
                setUploadETA('Complete!');
                setTimeout(() => {
                    alert(`✅ Success: Data saved in folder "${displayFolder}"\n📩 Notifications triggered!`);
                    setFormData({ type: 'USER', name: '', mobile: '', email: '', folderName: '', files: [], expiryDays: '30', downloadLimit: '0', imageCost: globalPricing.imageCost, videoCost: globalPricing.videoCost, unlockValidity: '24 Hours' }); 
                    setPreviews([]); 
                    setIsEmailLocked(false);
                    setUseDateFolder(false); // Reset checkbox
                    setFileStats({ photos: 0, videos: 0 });
                    document.getElementById('admin-file-input').value = '';
                    setUploadSubTab('BASIC');
                    fetchAccounts();
                    setLoading(false);
                }, 500);
            } else { 
                alert(res.data.message); 
                setLoading(false);
            }
        } catch (error) { 
            alert("Upload Error. Please check your internet connection."); 
            setLoading(false); 
        } 
    };


    // ==========================================
    // 🚀 MANAGE ACCOUNTS LOGIC
    // ==========================================
    const handleDeleteAccount = async (mobile, role) => {
        if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete this ${role}?`)) return;
        try {
            const res = await axios.post(`${API_BASE}/delete-account`, { targetMobile: mobile, targetRole: role });
            if (res.data.success) { alert("🗑️ Account deleted!"); fetchAccounts(); }
        } catch (error) { alert("Error deleting account."); }
    };

    // ==========================================
    // 🗑️ GLOBAL REMOVE LOGIC WITH THUMBNAILS
    // ==========================================
    const searchUserForRemoval = (mobile) => {
        if(mobile.length !== 10) return alert("Please enter valid 10-digit mobile number.");
        const user = accounts.find(a => a.mobile === mobile);
        if (user) {
            setGlobalRemoveUserObj(user);
            setGlobalRemoveSearchSuggestions(false);
        } else {
            alert("No account found with this mobile number in the database.");
            setGlobalRemoveUserObj(null);
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
                setGlobalRemoveUserObj(prev => ({ ...prev, uploadedData: res.data.updatedData }));
                fetchAccounts(); 
            } else {
                alert(res.data.message || "Failed to delete.");
            }
        } catch (e) { alert("Error connecting to server."); }
    };


    const toggleStudioApproval = async (mobile, currentStatus) => {
        const actionText = currentStatus ? "REVOKE" : "APPROVE";
        if (!window.confirm(`Are you sure you want to ${actionText} feed access for this Studio?`)) return;

        setAccounts(prevAccounts => prevAccounts.map(acc => acc.mobile === mobile ? { ...acc, isFeedApproved: !currentStatus } : acc));
        try {
            const res = await axios.post(`${API_BASE}/update-studio-approval`, { mobile, isFeedApproved: !currentStatus });
            if (!res.data.success) { fetchAccounts(); alert("Failed to update approval on server."); }
        } catch (error) { fetchAccounts(); alert("Error connecting to server."); }
    };

    // ==========================================
    // 🚀 ADMIN SETTINGS & PRICING
    // ==========================================
    const handleUpdateAdminProfile = async (e) => {
        if(e) e.preventDefault(); // ✅ Safe form submit integration
        if (!window.confirm("Are you sure you want to save these profile changes?")) return;

        try {
            const identifier = user?.mobile || "0000000000CODEIS*@OWNER*";
            const res = await axios.post(`${API_BASE}/update-admin`, { mobile: identifier, ...adminProfile });
            if (res.data.success) {
                alert("✅ Admin Profile Updated Successfully!");
                const updatedUser = { ...user, name: adminProfile.name };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                sessionStorage.setItem('user', JSON.stringify(updatedUser));
            }
            else alert("Update failed: " + res.data.message);
        } catch (error) { alert("Server error updating profile."); }
    };

    const handleSaveGlobalCharges = async () => {
        if (!window.confirm("Save all Global Charges, Coin Packages, and Events?")) return;
        try {
            const payload = {
                imageCost: globalPricing.imageCost,
                videoCost: globalPricing.videoCost,
                coinPackages: coinPackages,
                miniEvents: miniEvents
            };
            const res = await axios.post(`${API_BASE}/update-global-charges`, payload);
            if (res.data.success) {
                alert("✅ Global Monetization Settings Saved Successfully!");
                setFormData(prev => ({ ...prev, imageCost: globalPricing.imageCost, videoCost: globalPricing.videoCost }));
            }
        } catch (e) { alert("Server error saving settings."); }
    };

    const handleCreateSubAdmin = async (e) => {
        if(e) e.preventDefault(); // ✅ Safe form submit integration
        if (!window.confirm(`Create new Sub-Admin: ${subAdmin.name}?`)) return;

        try {
            const res = await axios.post(`${API_BASE}/add-subadmin`, subAdmin);
            if (res.data.success) {
                alert("✅ Sub-Admin Created Successfully!");
                setSubAdmin({ name: '', mobile: '', email: '', password: '' });
                fetchAccounts();
            } else alert(res.data.message);
        } catch (error) { alert("Server error."); }
    };

    const handleAddLink = () => {
        if (!newLink.url) return alert("Please enter URL");
        setSocialLinks(prev => {
            const exists = prev.find(link => link.platform === newLink.platform);
            if (exists) return prev.map(link => link.platform === newLink.platform ? { ...link, url: newLink.url } : link);
            return [...prev, newLink];
        });
        setNewLink({ platform: 'Instagram', url: '' });
    };

    const saveLinksToServer = async () => {
        if (!window.confirm("Are you sure you want to update Social Links on the platform?")) return;
        try {
            await axios.post(`${API_BASE}/update-social-links`, { links: socialLinks });
            alert("✅ Links Saved to Database!");
        } catch (e) { alert("Error connecting to backend."); }
    };

    const handlePolicySave = async (e) => {
        if(e) e.preventDefault(); // ✅ Safe form submit integration
        if (!window.confirm("Are you sure you want to update Platform Policies?")) return;
        try {
            await axios.post(`${API_BASE}/update-policies`, { policies: policyData });
            alert("✅ Policies Updated Successfully!");
        } catch (e) { alert("Failed to save policies."); }
    };

    const handleCollabAction = async (id, action) => {
        if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;
        try {
            const res = await axios.post(`${API_BASE}/update-collab-status`, { collabId: id, status: action });
            if(res.data.success) { alert(`✅ Request ${action}!`); fetchCollabs(); }
        } catch(e) { alert("Failed to update collab status"); }
    };

    const handleBookingStatus = async (id, newStatus) => {
        if (!window.confirm(`Are you sure you want to ${newStatus} this booking?`)) return;
        try {
            const res = await axios.post(`${API_BASE}/update-booking-status`, { bookingId: id, status: newStatus });
            if(res.data.success) { alert(`✅ Booking marked as ${newStatus}!`); fetchBookings(); }
        } catch (e) { alert("Failed to update booking"); }
    };

    // ==========================================
    // ✅ ADDED: EDIT SERVICE & SEND PROPOSAL LOGIC
    // ==========================================

    const startEditingService = (service) => {
        setEditingServiceId(service._id);
        setNewService({
            title: service.title,
            shortDescription: service.shortDescription,
            fullDescription: service.fullDescription,
            startingPrice: service.startingPrice,
            features: service.features
        });
        setServiceImage(null); 
        document.getElementById('service-form-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    const cancelEditing = () => {
        setEditingServiceId(null);
        setNewService({ title: '', shortDescription: '', fullDescription: '', startingPrice: '', features: '' });
        setServiceImage(null);
    };

    const handleAddOrUpdateService = async (e) => {
        if(e) e.preventDefault();
        if(!newService.title || !newService.startingPrice) return alert("Title and Price are required.");
        
        setLoading(true);
        try {
            let uploadedImageUrl = '';

            if (serviceImage) {
                const fd = new FormData();
                fd.append('file', serviceImage);
                fd.append('upload_preset', 'xgujeuol'); 
                const cloudRes = await axios.post('https://api.cloudinary.com/v1_1/dq1wfpqhs/auto/upload', fd);
                uploadedImageUrl = cloudRes.data.secure_url;
            }

            const payloadData = {
                title: newService.title,
                startingPrice: newService.startingPrice,
                shortDescription: newService.shortDescription,
                fullDescription: newService.fullDescription,
                features: newService.features,
                addedBy: 'ADMIN'
            };

            if (uploadedImageUrl) payloadData.imageUrl = uploadedImageUrl;

            let res;
            if (editingServiceId) {
                payloadData.id = editingServiceId;
                res = await axios.post(`${API_BASE}/update-service`, payloadData);
            } else {
                res = await axios.post(`${API_BASE}/add-service`, payloadData);
            }

            if (res.data.success) {
                alert(`✅ Service ${editingServiceId ? 'updated' : 'published'} successfully!`);
                cancelEditing();
                fetchServices(); 
            } else {
                alert("Failed to save service: " + res.data.message);
            }
        } catch (error) {
            console.error("Save Service Error:", error);
            alert("Upload Error. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteService = async (id) => {
        if (!window.confirm("Are you sure you want to completely remove this service from the App?")) return;
        try {
            const res = await axios.post(`${API_BASE}/delete-service`, { id });
            if (res.data.success) {
                alert("Service Removed.");
                fetchServices();
            }
        } catch (e) {
            alert("Failed to delete.");
        }
    };

    // ✅ OPEN PROPOSAL MODAL
    const openProposalModal = (booking) => {
        setProposalData({
            bookingId: booking._id,
            clientName: booking.name,
            totalPrice: booking.amount || '',
            advanceAmount: '',
            deliverables: booking.type || '',
            terms: '1. Advance is non-refundable.\n2. Final deliverables within 15 days.',
            expiryHours: '24'
        });
        setShowProposalModal(true);
    };

    // ✅ SEND PROPOSAL
    const handleSendProposal = async (e) => {
        if(e) e.preventDefault();
        if(!proposalData.totalPrice || !proposalData.advanceAmount) return alert("Pricing details are required.");

        if (!window.confirm(`Send this proposal to ${proposalData.clientName}? An email will be sent immediately.`)) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/send-proposal`, proposalData);
            if (res.data.success) {
                alert("✅ Proposal sent to User. Status is now 'Pending Payment'.");
                setShowProposalModal(false);
                fetchBookings(); 
            } else {
                alert("Failed to send proposal.");
            }
        } catch (e) {
            alert("Error connecting to server.");
        } finally {
            setLoading(false);
        }
    };


    // ✅ DROPDOWN TOGGLE LOGIC
    const toggleMenu = (menuName) => {
        setOpenDropdown(openDropdown === menuName ? null : menuName);
    };


    const displayedAccounts = accounts.filter(acc => filterRole === 'ALL' ? true : acc.role === filterRole);
    const filteredSuggestions = accounts.filter(acc => acc.mobile && acc.mobile.includes(formData.mobile));
    const globalRemoveFilteredSuggestions = accounts.filter(acc => acc.mobile && acc.mobile.includes(globalRemoveMobile));
    const isExistingAccount = accounts.some(acc => acc.mobile === formData.mobile);

    const selectedAccount = accounts.find(acc => acc.mobile === formData.mobile);
    let existingFolders = [];
    if (selectedAccount && Array.isArray(selectedAccount.uploadedData)) existingFolders = selectedAccount.uploadedData.map(f => f.folderName).filter(Boolean); 
    const filteredFolderSuggestions = existingFolders.filter(fName => fName.toLowerCase().includes(formData.folderName.toLowerCase()));

    const totalUsers = accounts.filter(a => a.role === 'USER').length;
    const totalStudios = accounts.filter(a => a.role === 'STUDIO').length;

    return (
        <div className="owner-dashboard-container">
            
            {showLogoutPopup && (
                <div className="popup-overlay-fixed" style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <div style={{background:'#fff', padding:'30px', borderRadius:'10px', textAlign:'center', color:'#333', boxShadow:'0 10px 25px rgba(0,0,0,0.5)'}}>
                        <h3 style={{marginBottom:'20px'}}>Are you sure you want to logout?</h3>
                        <div style={{display:'flex', gap:'15px', justifyContent:'center'}}>
                            <button onClick={() => onLogout()} style={{background:'#e74c3c', color:'#fff', padding:'10px 25px', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'16px'}}>Yes</button>
                            <button onClick={() => setShowLogoutPopup(false)} style={{background:'#bdc3c7', color:'#333', padding:'10px 25px', border:'none', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'16px'}}>No</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ SEND PROPOSAL MODAL */}
            {showProposalModal && (
                <div className="popup-overlay-fixed" style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter: 'blur(5px)'}}>
                    <div style={{background:'#1a1a2e', padding:'25px', borderRadius:'15px', width:'90%', maxWidth:'500px', border: '1px solid #333', boxShadow:'0 20px 50px rgba(0,0,0,0.5)'}}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{color:'#f39c12', margin: 0}}>Create Custom Proposal</h2>
                            <button onClick={() => setShowProposalModal(false)} style={{background:'transparent', color:'#fff', border:'none', fontSize:'20px', cursor:'pointer'}}>✖</button>
                        </div>

                        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '15px' }}>Client: <strong style={{ color: '#fff' }}>{proposalData.clientName}</strong></p>

                        <form onSubmit={handleSendProposal} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{color: '#aaa', fontSize: '12px'}}>Deliverables / Package Type</label>
                                <input type="text" required value={proposalData.deliverables} onChange={e => setProposalData({...proposalData, deliverables: e.target.value})} className="custom-admin-input" style={{ marginTop: '5px' }} />
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div style={{flex: 1}}>
                                    <label style={{color: '#aaa', fontSize: '12px'}}>Total Price (₹)</label>
                                    <input type="number" required value={proposalData.totalPrice} onChange={e => setProposalData({...proposalData, totalPrice: e.target.value})} className="custom-admin-input" style={{ marginTop: '5px' }} />
                                </div>
                                <div style={{flex: 1}}>
                                    <label style={{color: '#aaa', fontSize: '12px'}}>Advance Required (₹)</label>
                                    <input type="number" required value={proposalData.advanceAmount} onChange={e => setProposalData({...proposalData, advanceAmount: e.target.value})} className="custom-admin-input" style={{ marginTop: '5px' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{color: '#aaa', fontSize: '12px'}}>Terms & Conditions (User must agree)</label>
                                <textarea required rows="3" value={proposalData.terms} onChange={e => setProposalData({...proposalData, terms: e.target.value})} className="custom-admin-input" style={{ marginTop: '5px', resize: 'vertical' }}></textarea>
                            </div>

                            <div>
                                <label style={{color: '#aaa', fontSize: '12px'}}>Proposal Expiry Time</label>
                                <select value={proposalData.expiryHours} onChange={e => setProposalData({...proposalData, expiryHours: e.target.value})} className="custom-admin-input" style={{ marginTop: '5px' }}>
                                    <option value="12">12 Hours</option>
                                    <option value="24">24 Hours (1 Day)</option>
                                    <option value="48">48 Hours (2 Days)</option>
                                    <option value="168">7 Days</option>
                                </select>
                            </div>

                            <button type="submit" disabled={loading} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
                                {loading ? 'Sending...' : '📤 Send Proposal & Email'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <aside className="admin-sidebar">
                <div className="sidebar-header" style={{ paddingBottom: '10px' }}>
                    <h1 className="admin-title">SandN Cinema</h1>
                </div>
                
                <div style={{ background: '#0f3460', padding: '20px 15px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#ccc', margin: '0 auto 10px', overflow: 'hidden', border: '2px solid #4dabf7', cursor: 'pointer' }} onClick={() => dpInputRef.current.click()}>
                        {adminDp ? <img src={adminDp} alt="Admin DP" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '30px', lineHeight: '70px' }}>👤</span>}
                    </div>
                    <input type="file" accept="image/*" ref={dpInputRef} style={{ display: 'none' }} onChange={handleDpChange} />
                    {adminDp && <span style={{ fontSize: '10px', color: '#ff4d4d', cursor: 'pointer', display: 'block', marginBottom: '10px' }} onClick={removeDp}>Remove DP</span>}
                    
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '20px', color: '#fff', letterSpacing: '1px' }}>Super Admin</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#4dabf7', fontWeight: 'bold' }}>{adminProfile.name}</p>
                </div>

                {/* ✅ NEW: CATEGORIZED DROPDOWN SIDEBAR */}
                <ul className="sidebar-menu">
                    
                    {/* 🌍 GLOBAL PLATFORM */}
                    <div className="menu-group">
                        <div className={`menu-group-header ${openDropdown === 'GLOBAL' ? 'open' : ''}`} onClick={() => toggleMenu('GLOBAL')} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#1a1a2e', cursor: 'pointer', fontWeight: 'bold', color: '#fff', borderRadius: '5px', marginBottom: '5px' }}>
                            <span>🌍 Global Platform</span>
                            <span>{openDropdown === 'GLOBAL' ? '▲' : '▼'}</span>
                        </div>
                        {openDropdown === 'GLOBAL' && (
                            <div className="menu-dropdown-content" style={{ paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                                <li className={activeTab === 'DASHBOARD' ? 'active' : ''} onClick={() => setActiveTab('DASHBOARD')}>📊 Dashboard</li>
                                <li className={activeTab === 'UPLOAD' ? 'active' : ''} onClick={() => setActiveTab('UPLOAD')}>📤 Upload Data</li>
                                <li className={activeTab === 'GLOBAL_CHARGES' ? 'active' : ''} onClick={() => setActiveTab('GLOBAL_CHARGES')}>💰 Global Charges</li>
                                <li className={activeTab === 'GLOBAL_REMOVE' ? 'active' : ''} onClick={() => setActiveTab('GLOBAL_REMOVE')}>🗑️ Global Remove</li>
                                <li className={activeTab === 'ACCOUNTS' ? 'active' : ''} onClick={() => setActiveTab('ACCOUNTS')}>👥 Manage Accounts</li>
                                <li className={activeTab === 'CRITERIA' ? 'active' : ''} onClick={() => setActiveTab('CRITERIA')}>📈 Criteria & Traffic</li>
                                <li className={activeTab === 'INCOME' ? 'active' : ''} onClick={() => setActiveTab('INCOME')}>💰 Income</li>
                            </div>
                        )}
                    </div>

                    {/* 📱 USER PLATFORM */}
                    <div className="menu-group">
                        <div className={`menu-group-header ${openDropdown === 'USER' ? 'open' : ''}`} onClick={() => toggleMenu('USER')} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#1a1a2e', cursor: 'pointer', fontWeight: 'bold', color: '#fff', borderRadius: '5px', marginBottom: '5px' }}>
                            <span>📱 User Platform</span>
                            <span>{openDropdown === 'USER' ? '▲' : '▼'}</span>
                        </div>
                        {openDropdown === 'USER' && (
                            <div className="menu-dropdown-content" style={{ paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                                <li className={activeTab === 'BOOKINGS' ? 'active' : ''} onClick={() => setActiveTab('BOOKINGS')}>📅 Direct Bookings</li>
                                <li className={activeTab === 'MANAGE_SERVICES' ? 'active' : ''} onClick={() => setActiveTab('MANAGE_SERVICES')} style={{ color: '#f1c40f' }}>🛠️ Manage Services</li>
                            </div>
                        )}
                    </div>

                    {/* 🎥 STUDIO PLATFORM */}
                    <div className="menu-group">
                        <div className={`menu-group-header ${openDropdown === 'STUDIO' ? 'open' : ''}`} onClick={() => toggleMenu('STUDIO')} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#1a1a2e', cursor: 'pointer', fontWeight: 'bold', color: '#fff', borderRadius: '5px', marginBottom: '5px' }}>
                            <span>🎥 Studio Platform</span>
                            <span>{openDropdown === 'STUDIO' ? '▲' : '▼'}</span>
                        </div>
                        {openDropdown === 'STUDIO' && (
                            <div className="menu-dropdown-content" style={{ paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                                <li style={{color:'#7f8c8d', fontSize:'12px', listStyle:'none', padding:'10px'}}>Future Studio Features</li>
                            </div>
                        )}
                    </div>

                    {/* ⚙️ MYSELF (ADMIN) */}
                    <div className="menu-group">
                        <div className={`menu-group-header ${openDropdown === 'ADMIN' ? 'open' : ''}`} onClick={() => toggleMenu('ADMIN')} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#1a1a2e', cursor: 'pointer', fontWeight: 'bold', color: '#fff', borderRadius: '5px', marginBottom: '5px' }}>
                            <span>⚙️ Myself (Admin)</span>
                            <span>{openDropdown === 'ADMIN' ? '▲' : '▼'}</span>
                        </div>
                        {openDropdown === 'ADMIN' && (
                            <div className="menu-dropdown-content" style={{ paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                                <li className={activeTab === 'SOCIAL' ? 'active' : ''} onClick={() => setActiveTab('SOCIAL')}>🌐 Social Links</li>
                                <li className={activeTab === 'SECURITY' ? 'active' : ''} onClick={() => setActiveTab('SECURITY')}>🔒 Security Policy</li>
                                <li className={activeTab === 'SUB_ADMIN' ? 'active' : ''} onClick={() => setActiveTab('SUB_ADMIN')}>🧑‍💼 Sub-Admins</li> 
                                <li className={activeTab === 'SETTINGS' ? 'active' : ''} onClick={() => setActiveTab('SETTINGS')}>⚙️ Settings</li>
                            </div>
                        )}
                    </div>

                </ul>
                <button onClick={() => setShowLogoutPopup(true)} className="admin-logout-btn" style={{marginTop: '20px'}}>Log Out</button> 
            </aside>

            <main className="admin-main-content">
                
                {activeTab === 'DASHBOARD' && (
                    <div className="view-section">
                        <div className="section-header"><h2>Overview Statistics</h2></div>
                        <div className="dashboard-stats-grid">
                            <div className="stat-card blue" onClick={() => setActiveTab('ACCOUNTS')} style={{cursor:'pointer'}}>
                                <h3>{accounts.length}</h3><p>Total Accounts</p>
                            </div>
                            <div className="stat-card green" onClick={() => {setActiveTab('ACCOUNTS'); setFilterRole('USER');}} style={{cursor:'pointer'}}>
                                <h3>{totalUsers}</h3><p>Total Users</p>
                            </div>
                            <div className="stat-card purple" onClick={() => {setActiveTab('ACCOUNTS'); setFilterRole('STUDIO');}} style={{cursor:'pointer'}}>
                                <h3>{totalStudios}</h3><p>Total Studios</p>
                            </div>
                            <div className="stat-card red" onClick={() => setActiveTab('BOOKINGS')} style={{cursor:'pointer'}}>
                                <h3>{bookings.length}</h3><p>Total Bookings</p>
                            </div>
                            
                            <div className="stat-card" onClick={() => { setActiveTab('MANAGE_SERVICES'); setOpenDropdown('USER'); }} style={{cursor:'pointer', background: '#e67e22', color: 'white', borderRadius: '10px', padding: '20px', textAlign: 'center'}}>
                                <h3 style={{margin: 0, fontSize: '28px', color: 'white'}}>{availableServices.length}</h3>
                                <p style={{margin: '5px 0 0 0', fontSize: '14px', color: 'white', fontWeight: 'bold'}}>Total Services</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🔴 MANAGE SERVICES (UNDER USER PLATFORM) */}
                {activeTab === 'MANAGE_SERVICES' && (
                    <div className="view-section">
                        <div className="section-header"><h2>🛠️ Manage App Services</h2></div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Add or Edit premium services that users can view and book directly from their app.</p>

                        <div id="service-form-section" className="update-creation-container" style={{ maxWidth: '700px', margin: '0 auto 30px', borderTop: editingServiceId ? '4px solid #f1c40f' : 'none' }}>
                            {editingServiceId && <div style={{ background: '#fcf3cf', padding: '10px', borderRadius: '8px', color: '#d4ac0d', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>✏️ You are editing an existing service</div>}
                            
                            <form onSubmit={handleAddOrUpdateService} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div><label style={{fontSize: '13px', fontWeight: 'bold'}}>Service Title</label><input type="text" placeholder="e.g. Pre-Wedding Shoot" value={newService.title} onChange={e => setNewService({...newService, title: e.target.value})} className="custom-admin-input" required/></div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{flex: 1}}><label style={{fontSize: '13px', fontWeight: 'bold'}}>Starting Price (₹)</label><input type="number" placeholder="e.g. 15000" value={newService.startingPrice} onChange={e => setNewService({...newService, startingPrice: e.target.value})} className="custom-admin-input" required/></div>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '13px', fontWeight: 'bold'}}>Upload Cover Image {editingServiceId && <span style={{fontSize: '10px', color: '#aaa'}}>(Leave blank to keep old)</span>}</label>
                                        <input type="file" accept="image/*" onChange={e => setServiceImage(e.target.files[0])} className="custom-admin-input" style={{padding: '9px'}}/>
                                    </div>
                                </div>
                                <div><label style={{fontSize: '13px', fontWeight: 'bold'}}>Short Description (For Card View)</label><textarea placeholder="Brief overview (max 2 lines)" value={newService.shortDescription} onChange={e => setNewService({...newService, shortDescription: e.target.value})} className="custom-admin-input" rows="2"></textarea></div>
                                <div><label style={{fontSize: '13px', fontWeight: 'bold'}}>Full Description (For Detail View)</label><textarea placeholder="Detailed explanation of what the user gets..." value={newService.fullDescription} onChange={e => setNewService({...newService, fullDescription: e.target.value})} className="custom-admin-input" rows="4"></textarea></div>
                                <div><label style={{fontSize: '13px', fontWeight: 'bold'}}>Included Features (Comma Separated)</label><input type="text" placeholder="e.g. 50 Edited Photos, Drone Shoot, 3 Outfits" value={newService.features} onChange={e => setNewService({...newService, features: e.target.value})} className="custom-admin-input"/></div>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {editingServiceId && <button type="button" onClick={cancelEditing} style={{ background: '#95a5a6', color: '#fff', border: 'none', padding: '15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>}
                                    <button type="submit" disabled={loading} className="global-update-btn" style={{ background: editingServiceId ? '#2ecc71' : '#f39c12', padding: '15px', marginTop: editingServiceId ? 0 : '10px', flex: 1 }}>
                                        {loading ? 'Processing...' : (editingServiceId ? '💾 Update Live Service' : '➕ Publish New Service')}
                                    </button>
                                </div>
                            </form>
                        </div>

                        <h3 style={{ padding: '15px' }}>📦 Live Services on App</h3>
                        <div className="data-table-container">
                            <table className="admin-table">
                                <thead><tr><th>Service Title</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {availableServices.length > 0 ? availableServices.map((srv, idx) => (
                                        <tr key={idx}>
                                            <td><strong>{srv.title}</strong></td>
                                            <td>₹{srv.startingPrice}</td>
                                            <td><span className="status-badge active">Live</span></td>
                                            <td>
                                                <button onClick={() => startEditingService(srv)} style={{background: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px'}}>✏️ Edit</button>
                                                <button onClick={() => handleDeleteService(srv._id)} className="pdf-btn" style={{background: '#e74c3c', padding: '5px 10px'}}>Remove</button>
                                            </td>
                                        </tr>
                                    )) : <tr><td colSpan="4" style={{textAlign: 'center', padding: '20px', color: '#888'}}>No services published yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🔴 NEW TAB: GLOBAL REMOVE (GRANULAR FILE/FOLDER DELETION) WITH PREVIEWS */}
                {activeTab === 'GLOBAL_REMOVE' && (
                    <div className="view-section">
                        <div className="section-header"><h2>🗑️ Global Data Remove (Pro)</h2></div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Search for any client and selectively delete their Main Folder, Sub-Folder, or Specific Media Files.</p>

                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto 30px' }}>
                            <div style={{ position: 'relative', display: 'flex', gap: '10px' }}>
                                <div style={{flex: 1, position: 'relative'}}>
                                    <input 
                                        type="number" 
                                        placeholder="Enter 10-digit mobile number" 
                                        value={globalRemoveMobile} 
                                        onChange={(e) => {
                                            setGlobalRemoveMobile(e.target.value);
                                            setGlobalRemoveSearchSuggestions(e.target.value.length > 0);
                                        }}
                                        onKeyDown={(e) => handleKeyDown(e, () => searchUserForRemoval(globalRemoveMobile))}
                                        onBlur={() => setTimeout(() => setGlobalRemoveSearchSuggestions(false), 200)}
                                        className="custom-admin-input" 
                                        style={{margin: 0}}
                                    />
                                    {globalRemoveSearchSuggestions && globalRemoveMobile && globalRemoveFilteredSuggestions.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                                            {globalRemoveFilteredSuggestions.map((acc, idx) => (
                                                <li key={idx} onMouseDown={() => {
                                                    setGlobalRemoveMobile(acc.mobile);
                                                    searchUserForRemoval(acc.mobile);
                                                }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                                                    {acc.mobile} - {acc.name || acc.studioName}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <button onClick={() => searchUserForRemoval(globalRemoveMobile)} className="global-update-btn" style={{margin: 0, width: 'auto', background: '#34495e'}}>Search Data</button>
                            </div>
                        </div>

                        {globalRemoveUserObj && (
                            <div className="update-creation-container" style={{ maxWidth: '900px', margin: '0 auto', background: '#f8f9fa', border: '1px solid #ddd' }}>
                                <h3 style={{ borderBottom: '2px solid #bdc3c7', paddingBottom: '10px', color: '#2c3e50', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>👤 Data for: {globalRemoveUserObj.name || globalRemoveUserObj.studioName} ({globalRemoveUserObj.mobile})</span>
                                    <button onClick={() => setGlobalRemoveUserObj(null)} style={{background: 'transparent', border: 'none', fontSize: '16px', cursor: 'pointer'}}>✖</button>
                                </h3>

                                {globalRemoveUserObj.uploadedData && globalRemoveUserObj.uploadedData.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                                        {globalRemoveUserObj.uploadedData.map((folder, fIdx) => (
                                            <div key={fIdx} style={{ background: '#fff', border: '1px solid #bdc3c7', borderRadius: '8px', padding: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                                
                                                {/* MAIN FOLDER HEADER */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecf0f1', padding: '10px', borderRadius: '5px' }}>
                                                    <h4 style={{ margin: 0, color: '#2980b9' }}>📁 {folder.folderName}</h4>
                                                    <button onClick={() => handleAdvancedDelete(globalRemoveUserObj.mobile, folder.folderName)} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Delete Entire Folder</button>
                                                </div>

                                                {/* ROOT FILES IN MAIN FOLDER (WITH PREVIEWS) */}
                                                {folder.files && folder.files.length > 0 && (
                                                    <div style={{ padding: '10px', borderBottom: folder.subFolders?.length > 0 ? '1px dashed #ccc' : 'none' }}>
                                                        <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#7f8c8d' }}>Root Media Files:</p>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
                                                            {folder.files.map((fileUrl, idx) => (
                                                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fdfefe', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }}>
                                                                    
                                                                    {/* IMAGE / VIDEO THUMBNAIL */}
                                                                    <div style={{ width: '100%', height: '80px', background: '#000', marginBottom: '8px', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                                        {isVideo(fileUrl) ? (
                                                                            <>
                                                                                <video src={getCleanUrl(fileUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white'}}>▶️</div>
                                                                            </>
                                                                        ) : (
                                                                            <img src={getCleanUrl(fileUrl)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                        )}
                                                                    </div>

                                                                    <button onClick={() => handleAdvancedDelete(globalRemoveUserObj.mobile, folder.folderName, null, fileUrl)} style={{ background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', padding: '3px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', width: '100%' }}>Delete File</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* SUB-FOLDERS (DATES) WITH PREVIEWS */}
                                                {folder.subFolders && folder.subFolders.length > 0 && (
                                                    <div style={{ padding: '10px' }}>
                                                        <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#8e44ad' }}>Date Sub-Folders:</p>
                                                        {folder.subFolders.map((sub, sIdx) => (
                                                            <div key={sIdx} style={{ marginBottom: '15px', borderLeft: '3px solid #9b59b6', paddingLeft: '10px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5eef8', padding: '8px', borderRadius: '4px', marginBottom: '8px' }}>
                                                                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>🗓️ {sub.name}</span>
                                                                    <button onClick={() => handleAdvancedDelete(globalRemoveUserObj.mobile, folder.folderName, sub.name)} style={{ background: '#e67e22', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Delete Sub-Folder</button>
                                                                </div>
                                                                
                                                                {/* SUB-FOLDER FILES PREVIEW */}
                                                                {sub.files && sub.files.length > 0 ? (
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
                                                                        {sub.files.map((subFileUrl, fidx) => (
                                                                            <div key={fidx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }}>
                                                                                
                                                                                {/* IMAGE / VIDEO THUMBNAIL */}
                                                                                <div style={{ width: '100%', height: '80px', background: '#000', marginBottom: '8px', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                                                                                    {isVideo(subFileUrl) ? (
                                                                                        <>
                                                                                            <video src={getCleanUrl(subFileUrl)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                            <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white'}}>▶️</div>
                                                                                        </>
                                                                                    ) : (
                                                                                        <img src={getCleanUrl(subFileUrl)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                    )}
                                                                                </div>
                                                                                <button onClick={() => handleAdvancedDelete(globalRemoveUserObj.mobile, folder.folderName, sub.name, subFileUrl)} style={{ background: 'transparent', color: '#c0392b', border: '1px solid #c0392b', padding: '3px 6px', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', width: '100%' }}>Delete File</button>
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

                {/* 🔴 TAB: UPLOAD DATA */}
                {activeTab === 'UPLOAD' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📤 Manual Registration & Upload</h2></div>
                        
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                                <button onClick={() => setUploadSubTab('BASIC')} style={{ flex: 1, padding: '10px', background: uploadSubTab === 'BASIC' ? '#0f3460' : '#f0f2f5', color: uploadSubTab === 'BASIC' ? 'white' : '#333', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', fontSize: '12px' }}>
                                    1. Basic Info
                                </button>
                                <button onClick={() => setUploadSubTab('LIMITS')} style={{ flex: 1, padding: '10px', background: uploadSubTab === 'LIMITS' ? '#0f3460' : '#f0f2f5', color: uploadSubTab === 'LIMITS' ? 'white' : '#333', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', fontSize: '12px' }}>
                                    2. Limits
                                </button>
                                <button onClick={() => setUploadSubTab('CHARGES')} style={{ flex: 1, padding: '10px', background: uploadSubTab === 'CHARGES' ? '#0f3460' : '#f0f2f5', color: uploadSubTab === 'CHARGES' ? 'white' : '#333', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', fontSize: '12px' }}>
                                    3. Charges 💰
                                </button>
                            </div>

                            <form onSubmit={handleAddManualUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                
                                {uploadSubTab === 'BASIC' && (
                                    <>
                                        <div style={{ position: 'relative' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Mobile Number (Auto-suggest)</label>
                                            <input type="number" placeholder="e.g. 9876543210" required value={formData.mobile} onChange={handleMobileChange} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} onKeyDown={(e) => handleKeyDown(e, () => setUploadSubTab('LIMITS'))} className="custom-admin-input" />
                                            {showSuggestions && formData.mobile && filteredSuggestions.length > 0 && (
                                                <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', borderRadius: '5px' }}>
                                                    {filteredSuggestions.map((acc, idx) => (
                                                        <li key={idx} onMouseDown={() => handleSuggestionClick(acc)} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>{acc.mobile} - {acc.name || acc.studioName}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        
                                        <div>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Client Name {isExistingAccount && <span style={{color: '#2ecc71', fontSize: '11px'}}>(Auto-filled)</span>}</label>
                                            <input type="text" placeholder="Enter Full Name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} onKeyDown={(e) => handleKeyDown(e, () => setUploadSubTab('LIMITS'))} className="custom-admin-input" />
                                        </div>

                                        <div>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>
                                                Client Email Address 
                                                {isEmailLocked && <span style={{color: '#2ecc71', fontSize: '11px'}}> (Locked)</span>}
                                            </label>
                                            <input type="email" placeholder="example@mail.com (Optional for notification)" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} disabled={isEmailLocked} onKeyDown={(e) => handleKeyDown(e, () => setUploadSubTab('LIMITS'))} className="custom-admin-input" style={{ background: isEmailLocked ? '#f5f5f5' : '#fff', cursor: isEmailLocked ? 'not-allowed' : 'text' }} />
                                            <p style={{fontSize:'11px', color:'#777', margin:'3px 0 0 0'}}>Client will receive an email notification when data is uploaded.</p>
                                        </div>
                                        
                                        <div>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Role</label>
                                            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="custom-admin-input">
                                                <option value="USER">User</option><option value="STUDIO">Studio</option>
                                            </select>
                                        </div>
                                        
                                        <div style={{ background: '#ebf5fb', padding: '15px', borderRadius: '8px', border: '1px solid #bce0fd', position: 'relative' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#2b5876' }}>📂 Folder Name</label>
                                            <p style={{ fontSize: '11px', color: '#555', margin: '5px 0 10px 0' }}>Type to select existing or create new.</p>
                                            <input type="text" placeholder="Leave blank for 'Stranger Photography' or type name" value={formData.folderName} onChange={(e) => { setFormData({ ...formData, folderName: e.target.value }); setShowFolderSuggestions(true); }} onFocus={() => setShowFolderSuggestions(true)} onBlur={() => setTimeout(() => setShowFolderSuggestions(false), 200)} onKeyDown={(e) => handleKeyDown(e, () => setUploadSubTab('LIMITS'))} className="custom-admin-input" />
                                            
                                            {(!formData.folderName || formData.folderName.trim() === '') && (
                                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#e67e22', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span>⚠️</span> Default folder "Stranger Photography" will be used.
                                                </div>
                                            )}

                                            {showFolderSuggestions && existingFolders.length > 0 && (
                                                <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', borderRadius: '5px' }}>
                                                    {filteredFolderSuggestions.map((folder, idx) => (
                                                        <li key={idx} onMouseDown={() => { handleFolderSuggestionClick(folder); }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#333' }}>
                                                            📁 <strong>{folder}</strong>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}

                                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <input type="checkbox" id="useDateFolder" checked={useDateFolder} onChange={(e) => setUseDateFolder(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                                <label htmlFor="useDateFolder" style={{ fontSize: '12px', color: '#333', cursor: 'pointer', fontWeight: 'bold' }}>🗓️ Auto-append Today's Date (e.g. {formData.folderName ? `${formData.folderName} - ` : ''}{new Date().toLocaleDateString('en-GB').replace(/\//g, '-')})</label>
                                            </div>
                                        </div>
                                        
                                        <div style={{ border: '2px dashed #ccc', padding: '20px', borderRadius: '10px', textAlign: 'center', background: '#f9f9f9' }}>
                                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#444' }}>📁 Select Photos/Videos</label>
                                            <input id="admin-file-input" type="file" multiple accept="image/*,video/*" onChange={handleFileChange} style={{ color: '#333' }} />
                                            {formData.files.length > 0 && (
                                                <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                                                    <div style={{ background: '#e8f8f5', border: '1px solid #2ecc71', color: '#27ae60', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>📸 Photos: {fileStats.photos}</div>
                                                    <div style={{ background: '#fdedec', border: '1px solid #e74c3c', color: '#c0392b', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>🎥 Videos: {fileStats.videos}</div>
                                                </div>
                                            )}
                                        </div>

                                        <button type="button" onClick={() => setUploadSubTab('LIMITS')} className="global-update-btn" style={{ padding: '15px', background: '#3498db' }}>Next: Set Limits ➡️</button>
                                    </>
                                )}

                                {uploadSubTab === 'LIMITS' && (
                                    <>
                                        <div style={{ background: '#fcf3cf', padding: '20px', borderRadius: '8px', border: '1px solid #f1c40f' }}>
                                            <h3 style={{ marginTop: 0, color: '#d4ac0d' }}>⏳ Set Expiry & Access</h3>
                                            <p style={{ fontSize: '12px', color: '#555', marginBottom: '20px' }}>Auto-delete data after selected time to save server storage. You can also restrict how many times the user can download.</p>
                                            
                                            <div style={{ marginBottom: '15px' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Folder Auto-Delete (Time)</label>
                                                <select value={formData.expiryDays} onChange={(e) => setFormData({ ...formData, expiryDays: e.target.value })} className="custom-admin-input" style={{ marginTop: '5px' }}>
                                                    <option value="7">7 Days</option>
                                                    <option value="15">15 Days</option>
                                                    <option value="30">1 Month (30 Days)</option>
                                                    <option value="90">3 Months (90 Days)</option>
                                                    <option value="0">Never Expire (Permanent)</option>
                                                </select>
                                            </div>

                                            <div style={{ marginBottom: '20px' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Download Limit per user</label>
                                                <select value={formData.downloadLimit} onChange={(e) => setFormData({ ...formData, downloadLimit: e.target.value })} className="custom-admin-input" style={{ marginTop: '5px' }}>
                                                    <option value="0">Unlimited Downloads</option>
                                                    <option value="1">Only 1 Time</option>
                                                    <option value="3">Max 3 Times</option>
                                                    <option value="5">Max 5 Times</option>
                                                </select>
                                            </div>
                                            
                                            <div style={{ background: '#fff', padding: '10px', borderRadius: '5px', border: '1px dashed #e74c3c' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#e74c3c' }}>🔓 Media Unlock Validity (For User)</label>
                                                <select value={formData.unlockValidity} onChange={(e) => setFormData({ ...formData, unlockValidity: e.target.value })} className="custom-admin-input" style={{ marginTop: '5px', border: '1px solid #e74c3c' }}>
                                                    <option value="24 Hours">24 Hours (Default)</option>
                                                    <option value="7 Days">7 Days</option>
                                                    <option value="Permanent">Permanent</option>
                                                </select>
                                                <p style={{fontSize: '11px', color: '#777', margin: '3px 0 0 0'}}>Once user pays coins, how long can they access it?</p>
                                            </div>
                                        </div>

                                        <button type="button" onClick={() => setUploadSubTab('CHARGES')} className="global-update-btn" style={{ padding: '15px', background: '#3498db' }}>Next: Set Charges 💰 ➡️</button>
                                        <button type="button" onClick={() => setUploadSubTab('BASIC')} style={{ width: '100%', padding: '10px', marginTop: '5px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', textDecoration: 'underline' }}>
                                            ⬅️ Back to Basic Info
                                        </button>
                                    </>
                                )}

                                {/* 🟢 STEP 3: SET CHARGES (MANUAL OVERRIDE) */}
                                {uploadSubTab === 'CHARGES' && (
                                    <>
                                        <div style={{ background: '#e8f8f5', padding: '20px', borderRadius: '8px', border: '1px solid #2ecc71' }}>
                                            <h3 style={{ marginTop: 0, color: '#27ae60' }}>💰 Set Folder Charges</h3>
                                            <p style={{ fontSize: '12px', color: '#555', marginBottom: '20px' }}>These values are pre-filled with your Global Default Pricing. You can change them specifically for this client/folder.</p>

                                            <div style={{ marginBottom: '15px' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Cost per Photo (Coins)</label>
                                                <input type="number" min="0" value={formData.imageCost} onChange={(e) => setFormData({ ...formData, imageCost: e.target.value })} className="custom-admin-input" style={{ marginTop: '5px' }} />
                                            </div>

                                            <div style={{ marginBottom: '20px' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Cost per Video (Coins)</label>
                                                <input type="number" min="0" value={formData.videoCost} onChange={(e) => setFormData({ ...formData, videoCost: e.target.value })} className="custom-admin-input" style={{ marginTop: '5px' }} />
                                            </div>
                                        </div>

                                        {loading && (
                                            <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>
                                                    <span>{uploadProgress === 100 ? 'Saving to Database...' : `Cloud Upload... ${uploadProgress}%`}</span>
                                                    <span style={{ color: '#3498db' }}>{uploadSpeed}</span>
                                                </div>
                                                <div style={{ width: '100%', background: '#eee', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #3498db, #2ecc71)', height: '100%', transition: 'width 0.3s ease' }}></div>
                                                </div>
                                                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: '#e67e22', fontWeight: 'bold' }}>⏳ {uploadETA}</div>
                                            </div>
                                        )}

                                        <button type="submit" disabled={loading} className="global-update-btn" style={{ padding: '15px', width: '100%', background: loading ? '#95a5a6' : '#27ae60', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                            {loading ? 'Uploading & Setting Rules...' : '🚀 Final Upload Data'}
                                        </button>
                                        
                                        <button type="button" onClick={() => setUploadSubTab('LIMITS')} style={{ width: '100%', padding: '10px', marginTop: '5px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', textDecoration: 'underline' }}>
                                            ⬅️ Back to Limits
                                        </button>
                                    </>
                                )}

                            </form>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB: GLOBAL CHARGES */}
                {activeTab === 'GLOBAL_CHARGES' && (
                    <div className="view-section">
                        <div className="section-header">
                            <h2>💰 Global Charges & Events Configuration</h2>
                            <button onClick={handleSaveGlobalCharges} className="global-update-btn" style={{ background: '#2ecc71', width: 'auto', padding: '8px 20px' }}>💾 Save Configs</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                            
                            {/* 1. DEFAULT UPLOAD PRICING */}
                            <div className="update-creation-container" style={{ margin: 0, borderTop: '4px solid #3498db' }}>
                                <h3>📂 1. Default Upload Pricing (Coins)</h3>
                                <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>Standard coin charge for unlocking newly uploaded media.</p>
                                <div style={{display: 'flex', gap: '15px'}}>
                                    <div style={{flex: 1}}><label>Image Cost</label><input type="number" value={globalPricing.imageCost} onChange={e=>setGlobalPricing({...globalPricing, imageCost: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleSaveGlobalCharges)} className="custom-admin-input"/></div>
                                    <div style={{flex: 1}}><label>Video Cost</label><input type="number" value={globalPricing.videoCost} onChange={e=>setGlobalPricing({...globalPricing, videoCost: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleSaveGlobalCharges)} className="custom-admin-input"/></div>
                                </div>
                            </div>

                            {/* 2. REAL MONEY COIN PACKAGES */}
                            <div className="update-creation-container" style={{ margin: 0, borderTop: '4px solid #f1c40f' }}>
                                <h3>🪙 2. Real Money Coin Packages</h3>
                                <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>Set offers for users to buy coins with Rupees (₹).</p>
                                
                                {coinPackages.map((pkg, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', background: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
                                        <div style={{flex: 1}}><label style={{fontSize:'11px'}}>Coins to Give</label><input type="number" value={pkg.coins} onChange={e=>{let arr=[...coinPackages]; arr[i].coins=e.target.value; setCoinPackages(arr)}} className="custom-admin-input" style={{margin:0, padding:'5px'}}/></div>
                                        <div style={{flex: 1}}><label style={{fontSize:'11px'}}>Price (₹)</label><input type="number" value={pkg.price} onChange={e=>{let arr=[...coinPackages]; arr[i].price=e.target.value; setCoinPackages(arr)}} className="custom-admin-input" style={{margin:0, padding:'5px'}}/></div>
                                        <div style={{flex: 1.5}}><label style={{fontSize:'11px'}}>Offer Tag (e.g. Best Value!)</label><input type="text" value={pkg.tag} onChange={e=>{let arr=[...coinPackages]; arr[i].tag=e.target.value; setCoinPackages(arr)}} className="custom-admin-input" style={{margin:0, padding:'5px'}}/></div>
                                        <button onClick={()=>{let arr=[...coinPackages]; arr.splice(i,1); setCoinPackages(arr)}} style={{background:'#e74c3c', color:'white', border:'none', padding:'8px 12px', borderRadius:'5px', cursor:'pointer', marginTop:'15px'}}>X</button>
                                    </div>
                                ))}
                                <button onClick={()=>setCoinPackages([...coinPackages, {coins: 100, price: 50, tag: ''}])} className="global-update-btn" style={{background: '#f39c12', padding: '10px', marginTop: '10px'}}>➕ Add New Package</button>
                            </div>

                            {/* 3. MINI EVENTS / FREE COINS */}
                            <div className="update-creation-container" style={{ margin: 0, borderTop: '4px solid #9b59b6' }}>
                                <h3>🎉 3. Mini Events (Earn Free Coins)</h3>
                                <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>Reward users for organic growth (e.g. Subscribe to YouTube, Follow Instagram).</p>

                                {miniEvents.map((ev, i) => (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', background: '#f5eeef', padding: '15px', borderRadius: '5px' }}>
                                        <div style={{display: 'flex', gap: '10px'}}>
                                            <div style={{flex: 2}}><label style={{fontSize:'11px'}}>Task Title</label><input type="text" placeholder="e.g. Follow us on Instagram!" value={ev.title} onChange={e=>{let arr=[...miniEvents]; arr[i].title=e.target.value; setMiniEvents(arr)}} className="custom-admin-input" style={{margin:0, padding:'5px'}}/></div>
                                            <div style={{flex: 1}}><label style={{fontSize:'11px'}}>Reward Coins</label><input type="number" value={ev.reward} onChange={e=>{let arr=[...miniEvents]; arr[i].reward=e.target.value; setMiniEvents(arr)}} className="custom-admin-input" style={{margin:0, padding:'5px'}}/></div>
                                        </div>
                                        <div style={{display: 'flex', gap: '10px', alignItems:'center'}}>
                                            <div style={{flex: 1}}><label style={{fontSize:'11px'}}>Action Link (URL)</label><input type="text" placeholder="https://instagram.com/..." value={ev.link} onChange={e=>{let arr=[...miniEvents]; arr[i].link=e.target.value; setMiniEvents(arr)}} className="custom-admin-input" style={{margin:0, padding:'5px'}}/></div>
                                            <button onClick={()=>{let arr=[...miniEvents]; arr.splice(i,1); setMiniEvents(arr)}} style={{background:'#e74c3c', color:'white', border:'none', padding:'8px 12px', borderRadius:'5px', cursor:'pointer', marginTop:'15px'}}>Remove Event</button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={()=>setMiniEvents([...miniEvents, { id: Date.now().toString(), title: '', reward: 5, link: ''}])} className="global-update-btn" style={{background: '#8e44ad', padding: '10px', marginTop: '10px'}}>➕ Add Mini Event</button>
                            </div>

                        </div>
                    </div>
                )}

                {/* 🔴 TAB: ACCOUNTS */}
                {activeTab === 'ACCOUNTS' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📋 Manage Users & Studios</h2></div>
                        <div className="admin-filter-tabs">
                            <button className={filterRole === 'ALL' ? 'active' : ''} onClick={() => setFilterRole('ALL')}>All Accounts</button>
                            <button className={filterRole === 'USER' ? 'active' : ''} onClick={() => setFilterRole('USER')}>Users Only</button>
                            <button className={filterRole === 'STUDIO' ? 'active' : ''} onClick={() => setFilterRole('STUDIO')}>Studios Only</button>
                            <button className={filterRole === 'ADMIN' ? 'active' : ''} onClick={() => setFilterRole('ADMIN')}>Sub-Admins</button>
                        </div>
                        <div className="data-table-container" style={{ marginTop: '20px' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Role</th><th>Name</th><th>Mobile</th><th>Feed Approval</th><th>Action</th></tr>
                                </thead>
                                <tbody>
                                    {displayedAccounts.map((acc, index) => (
                                        <tr key={index}>
                                            <td><span className={`status-badge ${acc.role === 'STUDIO' ? 'active' : acc.role === 'ADMIN' ? 'inactive' : 'normal'}`}>{acc.role}</span></td>
                                            <td>{acc.name || acc.studioName || acc.ownerName}</td>
                                            <td>{acc.mobile}</td>
                                            <td>
                                                {acc.role === 'STUDIO' ? (
                                                    <button onClick={() => toggleStudioApproval(acc.mobile, acc.isFeedApproved)} style={{ background: acc.isFeedApproved ? '#2ecc71' : '#f1c40f', border: 'none', padding: '5px 10px', borderRadius: '5px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>{acc.isFeedApproved ? '✅ Approved' : '🔒 Pending'}</button>
                                                ) : <span style={{ color: '#ccc' }}>-</span>}
                                            </td>
                                            <td><button onClick={() => handleDeleteAccount(acc.mobile, acc.role)} className="pdf-btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#e74c3c' }}>Delete Account</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB: BOOKINGS (WITH EMERGENCY HIGHLIGHT & SEND PROPOSAL) */}
                {activeTab === 'BOOKINGS' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📅 Direct Bookings & Emergencies</h2></div>
                        <div className="data-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Client Details</th><th>Date/Time</th><th>Type & Request</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {bookings.map(b => {
                                        const isEmergency = b.isEmergency;
                                        return (
                                        <tr key={b._id} style={{ background: isEmergency ? 'rgba(231, 76, 60, 0.1)' : 'transparent' }}>
                                            <td>
                                                <strong>{b.name}</strong><br/>
                                                <span style={{fontSize:'12px', color:'#666'}}>{b.mobile}</span><br/>
                                                {isEmergency && <span style={{color:'#e74c3c', fontSize:'11px', fontWeight:'bold'}}>🚨 Location: {b.location}</span>}
                                            </td>
                                            <td style={{fontSize:'13px'}}>{b.startDate || new Date(b.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                {isEmergency ? <span style={{color: '#c0392b', fontWeight:'bold'}}>EMERGENCY CALL</span> : b.type}<br/>
                                                <span style={{fontSize:'11px', color:'#777'}}>{b.reason || b.eventPlaceName}</span>
                                            </td>
                                            <td><span className={`status-badge ${b.status === 'Accepted' ? 'active' : b.status === 'Declined' ? 'inactive' : 'normal'}`}>{b.status}</span></td>
                                            <td style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                                {b.status === 'Pending' && (
                                                    <>
                                                        <button onClick={() => handleBookingStatus(b._id, 'Accepted')} style={{background:'#2ecc71', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', cursor:'pointer'}}>Accept</button>
                                                        <button onClick={() => handleBookingStatus(b._id, 'Declined')} style={{background:'#e74c3c', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', cursor:'pointer'}}>Decline</button>
                                                    </>
                                                )}
                                                {b.status === 'Accepted' && (
                                                    <button onClick={() => openProposalModal(b)} style={{background:'#f39c12', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', cursor:'pointer'}}>✉️ Send Proposal</button>
                                                )}
                                            </td>
                                        </tr>
                                    )})}
                                    {bookings.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>No bookings yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'CRITERIA' && (
                    <div className="view-section">
                        <div className="section-header"><h2>📈 Platform Criteria & Traffic</h2></div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                            <div className="setting-card" style={{background: '#f8f9f9'}}>
                                <h3 style={{color:'#2980b9'}}>📊 Traffic Status</h3>
                                <p>Real-time analytics of platform visitors.</p>
                                <div style={{ marginTop: '15px' }}>
                                    <p><strong>Total Accounts:</strong> {accounts.length}</p>
                                    <p><strong>Today's Visitors:</strong> 1,240 (Simulated)</p>
                                </div>
                            </div>
                            <div className="setting-card" style={{background: '#fcf3cf'}}>
                                <h3 style={{color:'#d4ac0d'}}>📢 Business & Ads</h3>
                                <p>Manage homepage banners and promotions.</p>
                                <button className="global-update-btn" style={{ background: '#f1c40f', color: '#000', marginTop: '10px' }}>Manage Ad Banners</button>
                            </div>
                        </div>

                        <div className="data-table-container">
                            <h3 style={{ padding: '15px' }}>🤝 Collaboration Requests</h3>
                            <table className="admin-table">
                                <thead><tr><th>Name</th><th>Brand</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {collabRequests.map(req => (
                                        <tr key={req._id}>
                                            <td>{req.name}</td><td>{req.brand}</td><td>{req.email}</td>
                                            <td><span className={`status-badge ${req.status === 'Accepted' ? 'active' : req.status === 'Declined' ? 'inactive' : 'normal'}`}>{req.status}</span></td>
                                            <td>
                                                {req.status === 'Pending' && (
                                                    <>
                                                        <button onClick={() => handleCollabAction(req._id, 'Accepted')} style={{background:'#2ecc71', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', marginRight:'5px', cursor:'pointer'}}>Accept</button>
                                                        <button onClick={() => handleCollabAction(req._id, 'Declined')} style={{background:'#e74c3c', color:'#fff', border:'none', padding:'5px', borderRadius:'3px', cursor:'pointer'}}>Decline</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {collabRequests.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>No new collab requests.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'SOCIAL' && (
                    <div className="view-section">
                        <div className="section-header"><h2>🌐 Manage Social Links</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Platform</label>
                                    <select value={newLink.platform} onChange={(e) => setNewLink({...newLink, platform: e.target.value})} className="custom-admin-input">
                                        <option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Facebook">Facebook</option><option value="WhatsApp">WhatsApp</option><option value="Twitter">Twitter</option>
                                    </select>
                                </div>
                                <div><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Profile URL</label><input type="text" placeholder="e.g. https://instagram.com/sandncinema" value={newLink.url} onChange={(e) => setNewLink({...newLink, url: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleAddLink)} className="custom-admin-input" /></div>
                                <button onClick={handleAddLink} className="global-update-btn">➕ Add to List</button>
                            </div>
                            
                            <button onClick={saveLinksToServer} className="global-update-btn" style={{background: '#27ae60', marginBottom: '30px', width: '100%'}}>💾 SAVE ALL TO DATABASE</button>

                            <h4>Current Links Saved</h4>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {socialLinks.filter(l => l.url !== '').map((link, i) => (
                                    <li key={i} style={{ background:'#f9f9f9', padding:'10px', marginBottom:'5px', display:'flex', justifyContent:'space-between' }}><strong>{link.platform}</strong><a href={link.url} target="_blank" rel="noreferrer">{link.url.substring(0, 20)}...</a></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'SECURITY' && (
                    <div className="view-section">
                        <div className="section-header"><h2>🔒 Security & App Policies</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '700px', margin: '0 auto' }}>
                            <form onSubmit={handlePolicySave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{fontWeight:'bold'}}>Terms & Conditions</label>
                                    <textarea value={policyData.terms} onChange={e => setPolicyData({...policyData, terms: e.target.value})} className="custom-admin-input" rows="4" style={{resize:'vertical'}}></textarea>
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold'}}>Privacy Policy</label>
                                    <textarea value={policyData.privacy} onChange={e => setPolicyData({...policyData, privacy: e.target.value})} className="custom-admin-input" rows="4"></textarea>
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold'}}>How do we best for you? (USP Section)</label>
                                    <textarea value={policyData.bestForYou} onChange={e => setPolicyData({...policyData, bestForYou: e.target.value})} className="custom-admin-input" rows="4"></textarea>
                                </div>
                                <button type="submit" className="global-update-btn" style={{background:'#e74c3c'}}>💾 Save Policies to App</button>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === 'INCOME' && (
                    <div className="view-section">
                        <div className="section-header"><h2>💰 Financial Overview</h2></div>
                        <div className="stat-card green" style={{ padding: '30px', maxWidth: '400px' }}>
                            <p style={{ color: '#555', fontWeight: 'bold' }}>Real-time Platform Earnings</p>
                            <h3 style={{ fontSize: '45px', color: '#27ae60' }}>₹ {incomeData.total.toLocaleString()}</h3>
                            <button className="global-update-btn" style={{ background: '#27ae60', marginTop: '15px' }}>🏦 Withdraw Funds</button>
                        </div>
                    </div>
                )}

                {activeTab === 'SUB_ADMIN' && (
                    <div className="view-section">
                        <div className="section-header"><h2>🧑‍💼 Manage Sub-Admins</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '500px', margin: '0 auto' }}>
                            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Sub-admins have limited access to manage user data.</p>
                            <form onSubmit={handleCreateSubAdmin} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Name</label><input type="text" required placeholder="Enter Sub-Admin Name" value={subAdmin.name} onChange={e => setSubAdmin({...subAdmin, name: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleCreateSubAdmin)} className="custom-admin-input" /></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Mobile Number</label><input type="number" required placeholder="Enter 10-digit number" value={subAdmin.mobile} onChange={e => setSubAdmin({...subAdmin, mobile: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleCreateSubAdmin)} className="custom-admin-input" /></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Email (Optional)</label><input type="email" placeholder="example@email.com" value={subAdmin.email} onChange={e => setSubAdmin({...subAdmin, email: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleCreateSubAdmin)} className="custom-admin-input" /></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px'}}>Password</label><input type="text" required placeholder="Set a secure password" value={subAdmin.password} onChange={e => setSubAdmin({...subAdmin, password: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleCreateSubAdmin)} className="custom-admin-input" /></div>
                                <button type="submit" className="global-update-btn" style={{ background: '#27ae60', padding: '15px', marginTop:'10px' }}>+ Add Sub-Admin</button>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === 'SETTINGS' && (
                    <div className="view-section">
                        <div className="section-header"><h2>⚙️ Admin Profile Settings</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '500px', margin: '0 auto' }}>
                            <form onSubmit={handleUpdateAdminProfile} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                <div><label>Admin Name</label><input type="text" placeholder="Update your name" value={adminProfile.name} onChange={e => setAdminProfile({...adminProfile, name: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleUpdateAdminProfile)} className="custom-admin-input"/></div>
                                <div><label>Email Address</label><input type="email" placeholder="Update email" value={adminProfile.email} onChange={e => setAdminProfile({...adminProfile, email: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleUpdateAdminProfile)} className="custom-admin-input" /></div>
                                <div><label>New Password</label><input type="password" placeholder="Leave blank to keep current password" value={adminProfile.password} onChange={e => setAdminProfile({...adminProfile, password: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleUpdateAdminProfile)} className="custom-admin-input" /></div>
                                <button type="submit" className="global-update-btn" style={{padding: '15px', marginTop:'10px'}}>💾 Save Profile Details</button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default OwnerDashboard;