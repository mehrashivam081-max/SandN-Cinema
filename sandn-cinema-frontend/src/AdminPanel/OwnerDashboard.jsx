import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './OwnerDashboard.css';
import useBackButton from '../hooks/useBackButton';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import io from 'socket.io-client'; // 👈 NAYA: Socket.io Client Import

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';
const SERVER_URL = 'https://sandn-cinema.onrender.com/';

// ✅ SUPER TOKEN GRABBER (Security ke liye)
const getValidToken = () => {
    // 🛠️ FIX: Naye 'authToken' ko pehle uthayega, purane 'token' ke kachre ko ignore karega
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('token') || '';
};

const OwnerDashboard = ({ user, onLogout }) => {
    // --- UI STATES ---
    const [activeTab, setActiveTab] = useState('DASHBOARD');
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [filterRole, setFilterRole] = useState('ALL'); 
    
    // ✅ MISSING STATE FIXED
    const [showExitPopup, setShowExitPopup] = useState(false);
    
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
        unlockValidity: '24 Hours',
        assignToStudio: '' // 🔥 NAYA: Studio assignment
    });
    
    const [previews, setPreviews] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);
    const [uploadSubTab, setUploadSubTab] = useState('BASIC'); 
    const [isEmailLocked, setIsEmailLocked] = useState(false); 
    
    const [useDateFolder, setUseDateFolder] = useState(false);
    const [uploadMode, setUploadMode] = useState('NORMAL'); // 🔥 NAYA: For Smart Selection Upload

    const [globalRemoveMobile, setGlobalRemoveMobile] = useState('');
    const [globalRemoveSearchSuggestions, setGlobalRemoveSearchSuggestions] = useState(false);
    const [globalRemoveUserObj, setGlobalRemoveUserObj] = useState(null);

    // --- UPLOAD PROGRESS TRACKER STATES ---
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [uploadETA, setUploadETA] = useState('');
    const [uploadStats, setUploadStats] = useState(''); // 🔥 NAYA (For Ad Manager MB)
    const [uploadController, setUploadController] = useState(null); // 🔥 NAYA (For Ad Manager Stop)
    const [fileStats, setFileStats] = useState({ photos: 0, videos: 0 }); 
    const [uploadLogSearch, setUploadLogSearch] = useState('');
    const [uploadLogLimit, setUploadLogLimit] = useState(5);

    // 🚀 NEW: LIVE TRACKER STATES
    const [liveActionText, setLiveActionText] = useState(''); 
    const [fileProgressMap, setFileProgressMap] = useState({}); 
    const fileProgressRef = useRef({});
    
    // ✅ NEW: BACKGROUND UPLOAD QUEUE
    const [uploadJobs, setUploadJobs] = useState([]); 

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
    
    // Check: Agar normal upload ya koi Queue job chal rahi hai toh true hoga
    const isActivelyUploading = loading || uploadJobs.some(job => job.progress > 0 && job.progress < 100 && !job.status.includes('❌') && !job.status.includes('🛑'));

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

    // 👑 GOD VIEW: ALL SELECTIONS
    const [allSelections, setAllSelections] = useState([]);    

    // ✅ NEW: SMART DOWNLOADER & PREVIEW STATES (FOR ADMIN)
    const [downloadManager, setDownloadManager] = useState({ 
        active: false, paused: false, projectId: null, clientName: '', 
        totalFiles: 0, downloadedFiles: 0, progressPercent: 0, speed: '', eta: '', failedFiles: [] 
    });
    const abortControllerRef = useRef(null);
    // ✅ NEW: VIEW CLIENT UI STATE (For Modal)
    const [previewProject, setPreviewProject] = useState(null);
    const [renderLimit, setRenderLimit] = useState(50); // 🔥 NAYA: Infinite Scroll DOM Chunking (Speed Booster)

    // 👑 GOD MODE EDIT STATES
    const [isEditMode, setIsEditMode] = useState(false);
    const [editDraftImages, setEditDraftImages] = useState([]);
    const [albumIsFrozen, setAlbumIsFrozen] = useState(false);
    const [removeMode, setRemoveMode] = useState(null); // 'FILE' ya 'FOLDER'
    const [editUploading, setEditUploading] = useState(false);
    const [editTargetCloud, setEditTargetCloud] = useState('SAME_AS_ALBUM'); // 🔥 NEW: Target Cloud for Edit Mode

    // Jab bhi Preview Modal naya khule, limit wapas 50 pe reset kar do
    useEffect(() => {
        if (previewProject) {
            setRenderLimit(50);
            setIsEditMode(false);
            setRemoveMode(null);
            setEditTargetCloud('SAME_AS_ALBUM'); // 🔥 Reset to default
        }
    }, [previewProject]);

    // 🛠️ GOD MODE FUNCTIONS
    const toggleEditMode = () => {
        if (!isEditMode) {
            setEditDraftImages([...previewProject.images]);
            setAlbumIsFrozen(previewProject.isFrozen || false);
        } else {
            setRemoveMode(null);
        }
        setIsEditMode(!isEditMode);
    };

const handleEditFileUpload = async (e, isFolder = false) => {
        const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
        if(selectedFiles.length === 0) return;

        setEditUploading(true);
        setUploadProgress(0);
        setUploadStats('Starting...');
        setUploadETA('Calculating...');
        
        const newImgs = [];
        const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
        
        // 🔥 DYNAMIC SERVER RAM PROTECTOR (EDIT MODE)
        const maxBatchGB = parseFloat(cloudRoutingForm.maxBatchSizeGB) || 1.5;
        const totalGB = totalBytes / (1024 * 1024 * 1024);
        if (totalGB > maxBatchGB) {
            setEditUploading(false);
            e.target.value = ''; 
            return alert(`🚨 Upload Limit Exceeded!\n\nYou selected ${totalGB.toFixed(2)} GB. Max allowed per batch is ${maxBatchGB} GB. Please select fewer files.`);
        }

        let totalLoadedBytes = 0;
        let startTime = Date.now();
        let successCount = 0;
        let failCount = 0;

        try {
            for (let file of selectedFiles) {
                // 🔥 INNER TRY-CATCH START: Ek file fail hui toh loop nahi tootega!
                try {
                    let subF = 'Main Event';
                    
                    // 🔥 THE FOLDER FIX: Sahi se folder ka naam nikalna
                    if (isFolder && file.webkitRelativePath) {
                        const parts = file.webkitRelativePath.split('/');
                        if (parts.length >= 3) subF = parts[parts.length - 2];
                        else if (parts.length === 2) subF = parts[0]; 
                    }

                    // 1. Backend se Direct Upload Signature maango
                    const sigRes = await axios.post(`${API_BASE}/generate-upload-signature`, {
                        fileName: file.name, 
                        fileType: file.type, 
                        fileSizeGB: file.size / (1024 * 1024 * 1024),
                        targetFolder: `${previewProject.folderName}/${subF}`,
                        overrideCloudId: editTargetCloud !== 'SAME_AS_ALBUM' ? editTargetCloud : null // 🔥 NAYA: Force Cloud Logic
                    }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });

                    let finalUrl = '';
                    let previewUrl = '';

                    // 2. DIRECT CLOUD UPLOAD LOGIC
                    if (sigRes.data.directUpload) {
                        
                        // 🟢 A) CLOUDINARY LOGIC
                        if (sigRes.data.provider === 'CLOUDINARY') {
                            const cFormData = new FormData();
                            cFormData.append('file', file);
                            cFormData.append('api_key', sigRes.data.apiKey);
                            cFormData.append('timestamp', sigRes.data.timestamp);
                            cFormData.append('signature', sigRes.data.signature);
                            cFormData.append('folder', sigRes.data.folder);

                            finalUrl = await new Promise((resolve, reject) => {
                                const xhr = new XMLHttpRequest();
                                xhr.open('POST', `https://api.cloudinary.com/v1_1/${sigRes.data.cloudName}/auto/upload`);
                                
                                xhr.upload.onprogress = (event) => {
                                    if (event.lengthComputable) {
                                        const currentGlobalLoaded = totalLoadedBytes + event.loaded;
                                        const percent = Math.round((currentGlobalLoaded * 100) / totalBytes);
                                        setUploadProgress(Math.min(percent, 99));
                                        setUploadStats(`${(currentGlobalLoaded / (1024 * 1024)).toFixed(2)} MB / ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
                                        
                                        const elapsed = (Date.now() - startTime) / 1000;
                                        if (elapsed > 1) {
                                            const speed = currentGlobalLoaded / elapsed;
                                            const remaining = Math.max(0, (totalBytes - currentGlobalLoaded) / speed);
                                            setUploadETA(`${Math.floor(remaining)}s left`);
                                        }
                                    }
                                };
                                
                                xhr.onload = () => {
                                    if (xhr.status === 200) {
                                        totalLoadedBytes += file.size; // Commit size
                                        resolve(JSON.parse(xhr.responseText).secure_url);
                                    } else reject(new Error("Cloudinary Error"));
                                };
                                xhr.onerror = () => reject(new Error("Network Error"));
                                xhr.send(cFormData);
                            });
                            previewUrl = finalUrl;
                        } 
                        // 🟠 B) AWS S3 / CLOUDFLARE R2 LOGIC
                        else {
                            // 🔥 THE FIX: Use XHR instead of Fetch so we can track LIVE progress
                            finalUrl = await new Promise((resolve, reject) => {
                                const xhr = new XMLHttpRequest();
                                xhr.open('PUT', sigRes.data.signedUrl);
                                xhr.setRequestHeader('Content-Type', file.type);
                                
                                xhr.upload.onprogress = (event) => {
                                    if (event.lengthComputable) {
                                        const currentGlobalLoaded = totalLoadedBytes + event.loaded;
                                        const percent = Math.round((currentGlobalLoaded * 100) / totalBytes);
                                        setUploadProgress(Math.min(percent, 99));
                                        setUploadStats(`${(currentGlobalLoaded / (1024 * 1024)).toFixed(2)} MB / ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
                                        
                                        const elapsed = (Date.now() - startTime) / 1000;
                                        if (elapsed > 1) {
                                            const speed = currentGlobalLoaded / elapsed;
                                            const remaining = Math.max(0, (totalBytes - currentGlobalLoaded) / speed);
                                            setUploadETA(`${Math.floor(remaining)}s left`);
                                        }
                                    }
                                };
                                
                                xhr.onload = () => {
                                    if (xhr.status === 200) {
                                        totalLoadedBytes += file.size; // Commit size
                                        resolve(sigRes.data.publicUrl);
                                    } else reject(new Error("AWS Error"));
                                };
                                xhr.onerror = () => reject(new Error("Network Error"));
                                xhr.send(file);
                            });
                            previewUrl = finalUrl;
                        }
                    } 
                    else {
                        // 3. Fallback to Proxy
                        const fd = new FormData();
                        fd.append('file', file);
                        fd.append('skipPreview', 'true'); 
                        if (previewProject && previewProject._id) {
                            fd.append('projectId', previewProject._id);
                        }
                        if (editTargetCloud !== 'SAME_AS_ALBUM') {
                            fd.append('overrideCloudId', editTargetCloud); // 🔥 NAYA: Force Cloud Logic
                        }
                        
                        // 🔥 THE FIX: Added onUploadProgress tracker for Axios Proxy Call
                        const res = await axios.post(`${API_BASE}/proxy-upload`, fd, { 
                            headers: { 'Authorization': `Bearer ${getValidToken()}` },
                            onUploadProgress: (event) => {
                                if (event.lengthComputable) {
                                    const currentGlobalLoaded = totalLoadedBytes + event.loaded;
                                    const percent = Math.round((currentGlobalLoaded * 100) / totalBytes);
                                    setUploadProgress(Math.min(percent, 99));
                                    setUploadStats(`${(currentGlobalLoaded / (1024 * 1024)).toFixed(2)} MB / ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
                                    
                                    const elapsed = (Date.now() - startTime) / 1000;
                                    if (elapsed > 1) {
                                        const speed = currentGlobalLoaded / elapsed;
                                        const remaining = Math.max(0, (totalBytes - currentGlobalLoaded) / speed);
                                        setUploadETA(`${Math.floor(remaining)}s left`);
                                    }
                                }
                            }
                        });
                        finalUrl = res.data.url;
                        previewUrl = res.data.previewUrl || finalUrl;
                        totalLoadedBytes += file.size; // Commit bytes
                    }

                    if (finalUrl) {
                        newImgs.push({
                            url: finalUrl,
                            previewUrl: previewUrl,
                            status: 'active',
                            selectedBy: [],
                            subFolder: subF,
                            deletedAt: null
                        });
                        successCount++;
                    }

                } catch (innerError) {
                    console.error(`🚨 Failed to upload file: ${file.name}`, innerError);
                    failCount++;
                    totalLoadedBytes += file.size; // Skip bytes to keep progress moving
                }
                // 🔥 INNER TRY-CATCH END
            }
            
            // Loop ke baahar final updates
            setEditDraftImages(prev => [...prev, ...newImgs]);
            setUploadProgress(100);
            setUploadStats('Completed!');
            setUploadETA('Done');
            
            if (failCount > 0) {
                alert(`⚠️ ${successCount} files added to draft, but ${failCount} files failed.\nClick '💾 Save & Update Album' to finalize the successful ones.`);
            } else {
                alert(`✅ All ${successCount} files added to draft! Click '💾 Save & Update Album' to finalize.`);
            }
            
        } catch (err) {
            console.error("Edit Upload Fatal Error:", err);
            alert("❌ Fatal error occurred. Please refresh and try again.");
        }
        
        setEditUploading(false);
        setUploadProgress(0);
        e.target.value = ''; // clear input
    };

    const saveGodModeChanges = async () => {
        setLoading(true);
        try {
            const allUrls = editDraftImages.map(i => i.url);
            const res = await axios.post(`${API_BASE}/admin-force-update-album`, {
                projectId: previewProject._id,
                images: editDraftImages,
                allImages: allUrls,
                isFrozen: albumIsFrozen
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });

            if(res.data.success) {
                alert("✅ Album Updated Successfully!");
                setAllSelections(prev => prev.map(p => p._id === previewProject._id ? { ...p, images: editDraftImages, allImages: allUrls, isFrozen: albumIsFrozen } : p));
                setPreviewProject({ ...previewProject, images: editDraftImages, allImages: allUrls, isFrozen: albumIsFrozen });
                setIsEditMode(false);
                setRemoveMode(null);
            } else {
                alert("❌ Failed: " + res.data.message);
            }
        } catch(e) { alert("Server Error"); }
        setLoading(false);
    };   

    // ==========================================
    // 🚀 ADMIN SMART DOWNLOADER & PREVIEW ENGINE
    // ==========================================
    const handleMagicLogin = (project) => {
        if (!project || !project.images || project.images.length === 0) return alert("No images found.");
        setPreviewProject(project); 
    };

    // ✅ NEW: DELETE ENTIRE SMART SELECTION PROJECT (God View)
    const handleDeleteSelectionProject = async (projectId) => {
        if (!window.confirm("⚠️ WARNING: Are you absolutely sure you want to delete this Selection Project? All data and client progress will be permanently lost!")) return;
        try {
            const token = getValidToken();
            const res = await axios.post(`${API_BASE}/delete-selection-project`, { projectId }, { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (res.data.success) {
                alert("✅ Project deleted successfully!");
                setAllSelections(prev => prev.filter(sel => sel._id !== projectId)); // 🔥 Removes from God View instantly
            } else {
                alert("❌ Failed to delete: " + res.data.message);
            }
        } catch (e) {
            alert(`Error deleting project.`);
        }
    };

    const isSplitWindowActive = (project) => {
        if (!project || !project.finalSubmissionDate) return false;
        if (project.splitCompleted) return false;
        const now = new Date();
        const submittedAt = new Date(project.finalSubmissionDate);
        const hoursDiff = (now - submittedAt) / (1000 * 60 * 60);
        return hoursDiff <= 72;
    };

    const startSmartDownload = async (selectionProject) => {
        if (!selectionProject || !selectionProject.images) return;
        const selectedImages = selectionProject.images.filter(img => img.status === 'selected');
        if (selectedImages.length === 0) return alert("No images selected yet!");
        if (!window.confirm(`Start downloading ${selectedImages.length} photos for ${selectionProject.folderName}?`)) return;

        setDownloadManager({
            active: true, paused: false, projectId: selectionProject._id, clientName: selectionProject.clientMobile, 
            totalFiles: selectedImages.length, downloadedFiles: 0, progressPercent: 0, speed: 'Starting...', eta: 'Calculating...', failedFiles: []
        });

        const zip = new JSZip();
        const mainFolder = zip.folder(`${selectionProject.folderName}_Final_Selection`);
        abortControllerRef.current = new AbortController();

        let successfulDownloads = 0; let failedDownloads = []; let startTime = Date.now(); let totalDownloadedBytes = 0;

        for (let i = 0; i < selectedImages.length; i++) {
            if (abortControllerRef.current.signal.aborted) {
                setDownloadManager(prev => ({ ...prev, paused: true, speed: 'Paused' })); return; 
            }
            const imgUrl = getCleanUrl(selectedImages[i].url);
            const originalName = imgUrl.split('/').pop().split('?')[0] || `image_${i + 1}.jpg`;
            const fileExt = originalName.includes('.') ? originalName.split('.').pop() : 'jpg';
            const safeName = originalName.split('.')[0].slice(-10); 
            const uniqueFileName = `${String(i + 1).padStart(3, '0')}_${safeName}.${fileExt}`; // Smart Auto-Numbering

            try {
                const response = await axios.post(`${API_BASE}/proxy-download`, { fileUrl: imgUrl }, { responseType: 'blob', signal: abortControllerRef.current.signal });
                totalDownloadedBytes += response.data.size;
                
                const isSplit = selectionProject.splitCompleted && selectionProject.splitDetails?.hasSplit;
                const albumFolderName = isSplit ? `${selectedImages[i].albumTag || 'Album 1'}/` : '';
                const zipSubFolder = selectedImages[i].subFolder ? `${selectedImages[i].subFolder}/` : 'Other_Photos/';
                
                mainFolder.file(`${albumFolderName}${zipSubFolder}${uniqueFileName}`, response.data);
                successfulDownloads++;

                const currentSpeedBps = totalDownloadedBytes / ((Date.now() - startTime) / 1000);
                const bytesLeft = (totalDownloadedBytes / successfulDownloads) * (selectedImages.length - successfulDownloads);
                const secondsLeft = bytesLeft / currentSpeedBps;

                setDownloadManager(prev => ({
                    ...prev, downloadedFiles: successfulDownloads, progressPercent: Math.round((successfulDownloads / selectedImages.length) * 100),
                    speed: `${(currentSpeedBps / (1024 * 1024)).toFixed(2)} MB/s`, eta: secondsLeft > 60 ? `${Math.floor(secondsLeft/60)}m left` : `${Math.floor(secondsLeft)}s left`
                }));
            } catch (err) {
                if (axios.isCancel(err)) console.log('Paused'); else failedDownloads.push(uniqueFileName);
            }
        }
        if (!abortControllerRef.current.signal.aborted) {
            setDownloadManager(prev => ({ ...prev, speed: 'Zipping files...', eta: 'Almost ready...' }));
            zip.generateAsync({ type: "blob" }).then((content) => {
                saveAs(content, `${selectionProject.folderName}_${selectionProject.clientMobile}_Final.zip`);
                setDownloadManager(prev => ({ ...prev, active: false }));
                alert(`✅ Download Complete!\n${successfulDownloads} downloaded.\n${failedDownloads.length > 0 ? `⚠️ ${failedDownloads.length} files failed.` : ''}`);
            });
        }
    };

    const pauseDownload = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort(); 
    };

    // 🛑 STOP UPLOAD LOGIC (Ad Manager ke liye)
    const handleStopUpload = () => {
        if (uploadController) {
            uploadController.abort();
            setUploadController(null);
            setLoading(false);
            setUploadProgress(0);
            setUploadStats('');
            setUploadSpeed('');
            alert("⚠️ Ad Upload stopped by user.");
        }
    };

    // 🛑 STOP UPLOAD LOGIC (Client Queue ke liye)
    const handleStopJob = (jobIdToStop) => {
        setUploadJobs(prev => prev.map(job => {
            if (job.id === jobIdToStop && job.controller) {
                job.controller.abort(); 
                return { ...job, status: '🛑 Upload Stopped', speed: '', eta: '', stats: '' };
            }
            return job;
        }));
    };

    // --- ADMIN SETTINGS STATES ---
    const [adminProfile, setAdminProfile] = useState({ name: user?.name || 'Owner', email: user?.email || '', password: user?.password || '' });
    const [subAdmin, setSubAdmin] = useState({ name: '', mobile: '', email: '', password: '' });

    // --- SOCIAL LINKS & POLICY STATE ---
    const [socialLinks, setSocialLinks] = useState([]);
    const [newLink, setNewLink] = useState({ platform: 'Instagram', url: '' });
    const [policyData, setPolicyData] = useState({
        terms: "",
        privacy: "",
        shipping: "",
        contact: "",
        bestForYou: ""
    });

    // ✅ CAREER STATES
    const [vacancies, setVacancies] = useState([]);
    const [newJob, setNewJob] = useState({ role: '', type: 'Long Term', time: '', salary: '', urgent: false, description: '' });

    // --- DATABASE LIST STATES ---
    const [collabRequests, setCollabRequests] = useState([]);
    const [bookings, setBookings] = useState([]);

    // --- REVENUE DATA ---
    const calculatedTotal = accounts.length * 1500; 
    const [incomeData, setIncomeData] = useState({ total: calculatedTotal, transactions: [] });
    
    // ✅ NEW: PAYOUT MANAGEMENT STATES
    const [payoutRequests, setPayoutRequests] = useState([]);
    const [fetchingPayouts, setFetchingPayouts] = useState(false);

    // ✅ MANAGE SERVICES STATES 
    const [newService, setNewService] = useState({ title: '', shortDescription: '', fullDescription: '', startingPrice: '', features: '', discountPercentage: '', offerText: '' });
    const [serviceImage, setServiceImage] = useState(null);
    const [availableServices, setAvailableServices] = useState([]);
    const [editingServiceId, setEditingServiceId] = useState(null);

    // ✅ PROPOSAL STATES
    const [showProposalModal, setShowProposalModal] = useState(false);
    const [proposalData, setProposalData] = useState({ bookingId: '', clientName: '', deliverables: '', totalPrice: '', advanceAmount: '', terms: '', expiryHours: '24' });

    // ✅ DENIAL MODAL STATES
    const [showDenyModal, setShowDenyModal] = useState(false);
    const [bookingToDeny, setBookingToDeny] = useState(null);
    const [denyReason, setDenyReason] = useState('Booking session full.');
    const [customDenyReason, setCustomDenyReason] = useState('');
    const PRESET_DENY_REASONS = ['Booking session full.', 'Equipment not available.', 'Venue booking conflicts.', 'Service area not covered.', 'Other Custom logic...'];

    // 📣 NEW: SMART AD MANAGER STATES
    const [adForm, setAdForm] = useState({ title: '', location: 'ALL', interest: 'ALL', link: '', maxViews: '0' });
    const [adFile, setAdFile] = useState(null);
    const [adList, setAdList] = useState([]);
    const [fetchingAds, setFetchingAds] = useState(false);
    const [previewAd, setPreviewAd] = useState(null); // ✅ NEW: Preview State
    const [editingAdId, setEditingAdId] = useState(null); // ✅ NEW: Edit State

    // 🏢 NEW: STUDIO PLAN MANAGEMENT STATES
    const [editingStudioPlan, setEditingStudioPlan] = useState(null);
    const [newStudioPlan, setNewStudioPlan] = useState('FREE');
    const [customLimitGB, setCustomLimitGB] = useState('');

    // 🏷️ NEW: DYNAMIC SUBSCRIPTION PLANS STATES
    const [subPlans, setSubPlans] = useState([]);
    const [subPlanForm, setSubPlanForm] = useState({ id: null, planName: '', storageLimitGB: '', monthlyPrice: '', yearlyPrice: '', discountPercentage: '', offerText: '', features: '' });

    // ☁️ NEW: CLOUD STORAGE MANAGER STATES
    const [storageAccounts, setStorageAccounts] = useState([]);
    const [editingStorageId, setEditingStorageId] = useState(null); // ✅ Tracking ID
    const [storageForm, setStorageForm] = useState({
        nickname: '', provider: 'CLOUDINARY', maxLimitGB: 5, setAsActive: false,
        credentials: { cloudName: '', apiKey: '', apiSecret: '', region: '', bucketName: '' }
    });
    const [cloudRoutingForm, setCloudRoutingForm] = useState({ freeCloudId: '', paidCloudId: '', adminCloudId: '', freeMaxFileMB: '100', paidMaxFileMB: '2048', adminMaxFileMB: '50000', defaultFreeStorageGB: '5', freeUploadLogic: 'STREAM', paidUploadLogic: 'DIRECT', adminUploadLogic: 'DIRECT', maxBatchSizeGB: '1.5' });

    // ✅ Dynamic Location Counter

    // ✅ Dynamic Location Counter (BUG FIXED - Safe Check Added)
    const locationStats = accounts.reduce((acc, userObj) => {
        // Checking if location exists AND is actually a string before trimming
        const loc = (userObj.location && typeof userObj.location === 'string') ? userObj.location.trim() : 'Unknown';
        if(loc) acc[loc] = (acc[loc] || 0) + 1;
        return acc;
    }, {});

    // ✅ FEATURE 1: OFFLINE SECURITY (Auto-Logout on Connection Lost)
    useEffect(() => {
        const handleOffline = () => {
            alert("⚠️ Internet connection lost! For security reasons, your session has been locked.");
            sessionStorage.removeItem('user'); 
            localStorage.removeItem('user');
            if (onLogout) onLogout();
            else window.location.href = "/Snevio/"; // Updated Redirect Path
        };
        window.addEventListener('offline', handleOffline);
        return () => window.removeEventListener('offline', handleOffline);
    }, [onLogout]);

    // ✅ REFS FOR BACK BUTTON STATE (To avoid history loop)
    const backStateRef = useRef({ activeTab, uploadSubTab, showDenyModal, showProposalModal, showLogoutPopup, globalRemoveUserObj });
    useEffect(() => {
        backStateRef.current = { activeTab, uploadSubTab, showDenyModal, showProposalModal, showLogoutPopup, globalRemoveUserObj };
    }, [activeTab, uploadSubTab, showDenyModal, showProposalModal, showLogoutPopup, globalRemoveUserObj]);

    // ✅ NATIVE BROWSER BACK BUTTON TRAP (Fixes direct logout bug)
    useEffect(() => {
        // Push initial state to trap the back button
        window.history.pushState(null, null, window.location.href);

        const handlePopState = (event) => {
            // Force the browser to stay on this page
            window.history.pushState(null, null, window.location.href); 
            
            const state = backStateRef.current;

            // Execute logic safely
            if (state.showDenyModal) { setShowDenyModal(false); return; }
            if (state.showProposalModal) { setShowProposalModal(false); return; }
            if (state.showLogoutPopup) { setShowLogoutPopup(false); return; }
            if (state.globalRemoveUserObj) { setGlobalRemoveUserObj(null); return; }
            
            if (state.activeTab === 'UPLOAD') {
                if (state.uploadSubTab === 'CHARGES') { setUploadSubTab('LIMITS'); return; }
                if (state.uploadSubTab === 'LIMITS') { setUploadSubTab('BASIC'); return; }
            }
            
            if (state.activeTab !== 'DASHBOARD') { setActiveTab('DASHBOARD'); return; }
            
            // If on Dashboard Basic, show Exit Alert!
            setShowExitPopup(true);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleKeyDown = (e, action) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            action(e);
        }
    };

    // 🟢 INITIAL FETCH, ADMIN SYNC & 🔥 REAL-TIME WEBSOCKETS
    useEffect(() => {
        // 1. Initial Load (Pehli baar page khulte hi data laao)
        fetchAccounts();
        fetchPlatformSettings(); 
        fetchBookings();         
        fetchCollabs();
        fetchServices(); 
        fetchAds(); 
        fetchVacancies();
        fetchStorageConfigs(); // ☁️ Load Storage configs
        fetchSubPlans(); // 🏷️ Load Subscription Plans

        // 👑 GOD VIEW API CALL
        const fetchAllSelections = async () => {
            try {
                const res = await axios.get(`${API_BASE}/admin-get-all-selections`, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                if (res.data.success) setAllSelections(res.data.data);
            } catch(e) { console.log("Failed to load God View Selections"); }
        };
        fetchAllSelections();

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
                    sessionStorage.setItem('user', JSON.stringify(updatedUser)); 
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }
            } catch (e) { console.log("Sync failed", e); }
        };
        syncAdminData();

        // 🚀 SOCKET.IO REAL-TIME CONNECTION FOR ADMIN
        let activeUser = user || JSON.parse(sessionStorage.getItem('user'));
        let socket;

        if (activeUser && activeUser.mobile) {
            socket = io(SERVER_URL); 
            socket.on('connect', () => {
                socket.emit('join_user_room', activeUser.mobile);
                // Admin ko 'admin_room' mein daal do taaki system-wide updates mil sakein
                socket.emit('join_user_room', 'admin_room');
            });

            // 🔥 JAB BHI SYSTEM MEIN KUCH NAYA HO, REFRESH MARO!
            socket.on('data_updated', (data) => {
                console.log("⚡ Admin Real-time update received! Fetching fresh data...");
                fetchAccounts(); 
                fetchBookings(); 
                fetchCollabs();  
                fetchAllSelections();
            });
        }

        // Cleanup Socket on unmount
        return () => {
            if (socket) socket.disconnect();
        };
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
                
                // 🔥 THE FIX: Safely merge DB data into the form state so it survives refresh
                if (res.data.data.cloudRouting) {
                    setCloudRoutingForm(prev => ({
                        freeCloudId: res.data.data.cloudRouting.freeCloudId || '',
                        paidCloudId: res.data.data.cloudRouting.paidCloudId || '',
                        adminCloudId: res.data.data.cloudRouting.adminCloudId || '',
                        freeMaxFileMB: res.data.data.cloudRouting.freeMaxFileMB || prev.freeMaxFileMB,
                        paidMaxFileMB: res.data.data.cloudRouting.paidMaxFileMB || prev.paidMaxFileMB,
                        adminMaxFileMB: res.data.data.cloudRouting.adminMaxFileMB || prev.adminMaxFileMB,
                        defaultFreeStorageGB: res.data.data.cloudRouting.defaultFreeStorageGB || prev.defaultFreeStorageGB,
                        freeUploadLogic: res.data.data.cloudRouting.freeUploadLogic || 'STREAM',
                        paidUploadLogic: res.data.data.cloudRouting.paidUploadLogic || 'DIRECT',
                        adminUploadLogic: res.data.data.cloudRouting.adminUploadLogic || 'DIRECT',
                        maxBatchSizeGB: res.data.data.cloudRouting.maxBatchSizeGB || '1.5'
                    }));
                }
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

    // ✅ FETCH PAYOUT REQUESTS
    const fetchPayouts = async () => {
        setFetchingPayouts(true);
        try {
            const res = await axios.get(`${API_BASE}/get-withdrawals`, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if (res.data.success) setPayoutRequests(res.data.data);
        } catch(e) { console.log("Failed to fetch payouts"); }
        setFetchingPayouts(false);
    };

    // ✅ PROCESS PAYOUT (Approve or Reject)
    const handleProcessPayout = async (id, action) => {
        if(!window.confirm(`Are you sure you want to mark this payout as ${action}?`)) return;
        try {
            const res = await axios.post(`${API_BASE}/process-withdrawal`, { id, action }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if(res.data.success) {
                alert(`✅ Payout ${action} Successfully!`);
                fetchPayouts(); // Refresh the list
            } else {
                alert(res.data.message);
            }
        } catch(e) { alert("Error processing payout."); }
    };

    const fetchServices = async () => { 
        try { const res = await axios.get(`${API_BASE}/get-available-services`); if (res.data.success) setAvailableServices(res.data.data || []); } catch(e) {} 
    };

    const fetchAds = async () => {
        setFetchingAds(true);
        try {
            const res = await axios.post(`${API_BASE}/get-targeted-ads`, { userLocation: '', userInterest: '' });
            if (res.data.success) setAdList(res.data.data || []);
        } catch(e) { console.error("Failed to fetch ads"); }
        setFetchingAds(false);
    };

    

    const fetchVacancies = async () => {
        try {
            const res = await axios.get(`${API_BASE}/get-vacancies`);
            if (res.data.success) setVacancies(res.data.data);
        } catch(e) { console.log("Failed to fetch jobs"); }
    };

    // ☁️ STORAGE MANAGEMENT API CALLS
    const fetchStorageConfigs = async () => {
        try {
            const res = await axios.get(`${API_BASE}/list-storage`, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if (res.data.success) setStorageAccounts(res.data.data);
        } catch(e) { console.log("Failed to fetch storage accounts"); }
    };

    const handleAddStorage = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            let res;
            if (editingStorageId) {
                // ✅ अगर ID है, तो अपडेट करो
                res = await axios.post(`${API_BASE}/update-storage`, { ...storageForm, id: editingStorageId }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            } else {
                // 🆕 वरना नया बनाओ
                res = await axios.post(`${API_BASE}/add-storage`, storageForm, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            }

            if (res.data.success) {
                alert(editingStorageId ? "☁️ Storage Updated!" : "☁️ Storage Linked!");
                setEditingStorageId(null); // Reset
                setStorageForm({ nickname: '', provider: 'CLOUDINARY', maxLimitGB: 5, setAsActive: false, credentials: { cloudName: '', apiKey: '', apiSecret: '', region: '', bucketName: '' } });
                fetchStorageConfigs();
            }
            if (res.data.success) {
                alert("☁️ Storage Account Linked Successfully!");
                setStorageForm({ nickname: '', provider: 'CLOUDINARY', maxLimitGB: 5, setAsActive: false, credentials: { cloudName: '', apiKey: '', apiSecret: '', region: '', bucketName: '' } });
                fetchStorageConfigs();
            } else alert("Failed: " + res.data.message);
        } catch (err) { alert("Error linking storage account."); }
        setLoading(false);
    };

    const handleSetActiveStorage = async (accountId) => {
        if (!window.confirm("Make this the active storage for all new uploads?")) return;
        try {
            const res = await axios.post(`${API_BASE}/set-active-storage`, { accountId }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if (res.data.success) fetchStorageConfigs();
        } catch (e) { alert("Failed to switch active storage."); }
    };

    const handleDeleteStorage = async (accountId) => {
        if (!window.confirm("Remove this storage configuration? (Data on the cloud will NOT be deleted, only unlinked from platform)")) return;
        try {
            const res = await axios.post(`${API_BASE}/delete-storage`, { accountId }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if (res.data.success) fetchStorageConfigs(); else alert(res.data.message);
        } catch (e) { alert("Failed to remove storage config."); }
    };

    // ✏️ EDIT CLOUD CONFIG
    const handleEditCloud = (acc) => {
        setEditingStorageId(acc._id); // ✅ यहाँ ID सेव करें
        setStorageForm({
            nickname: acc.nickname,
            provider: acc.provider,
            maxLimitGB: acc.maxLimitGB,
            setAsActive: acc.isActive,
            credentials: { ...acc.credentials }
        });
        document.getElementById('storage-form-top')?.scrollIntoView({ behavior: 'smooth' });
    };

    // 💣 WIPE ALL DATA FROM SPECIFIC CLOUD
    const handleWipeSpecificCloud = async (accountId, nickname) => {
        const pass = prompt(`DANGER! ${nickname} का सारा डेटा (Photos/Videos) हमेशा के लिए डिलीट हो जाएगा।\n\nConfirm करने के लिए Admin Password डालें:`);
        if (!pass) return;

        if (window.confirm(`क्या आप वाकई ${nickname} की हर एक फाइल को जड़ से मिटाना चाहते हैं? यह वापस नहीं आएगा!`)) {
            try {
                const res = await axios.delete(`${API_BASE}/wipe-cloud/${accountId}`, { 
                    data: { adminPassword: pass },
                    headers: { 'Authorization': `Bearer ${getValidToken()}` }
                });
                alert("Success: " + res.data.message);
                fetchStorageConfigs();
            } catch (err) {
                alert("Error: " + (err.response?.data?.message || "Wipe failed"));
            }
        }
    };

    // 🚦 SAVE CLOUD ROUTING RULES
    const handleSaveCloudRouting = async (e) => {
        e.preventDefault();
        if (!window.confirm("Update Cloud Routing Rules for Free and Paid Studios?")) return;
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/update-cloud-routing`, cloudRoutingForm, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            alert(res.data.message);
        } catch (e) { alert("Error updating cloud routing rules."); }
        setLoading(false);
    };

    // 🏷️ SUBSCRIPTION PLANS API CALLS
    const fetchSubPlans = async () => {
        try {
            const res = await axios.get(`${API_BASE}/admin-get-subscription-plans`, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if(res.data.success) setSubPlans(res.data.data);
        } catch(e) { console.log("Failed to fetch sub plans"); }
    };

    const handleSaveSubPlan = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const featuresArray = typeof subPlanForm.features === 'string' ? subPlanForm.features.split(',').map(f => f.trim()).filter(f => f) : subPlanForm.features;
            const payload = { ...subPlanForm, features: featuresArray };
            const res = await axios.post(`${API_BASE}/manage-subscription-plan`, payload, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if(res.data.success) {
                alert(`✅ ${res.data.message}`);
                setSubPlanForm({ id: null, planName: '', storageLimitGB: '', monthlyPrice: '', yearlyPrice: '', discountPercentage: '', offerText: '', features: '' });
                fetchSubPlans();
            } else alert(`❌ Error: ${res.data.message}`);
        } catch(e) { alert("Server Error saving plan."); }
        setLoading(false);
    };

    const handleDeleteSubPlan = async (id) => {
        if(!window.confirm("Delete this Subscription Plan permanently?")) return;
        try {
            const res = await axios.post(`${API_BASE}/delete-subscription-plan`, { id }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            if(res.data.success) { alert("🗑️ Plan Deleted."); fetchSubPlans(); }
        } catch(e) { alert("Failed to delete plan."); }
    };

    const editSubPlan = (plan) => {
        setSubPlanForm({
            id: plan._id, planName: plan.planName, storageLimitGB: plan.storageLimitGB,
            monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice, discountPercentage: plan.discountPercentage,
            offerText: plan.offerText, features: plan.features.join(', ')
        });
        document.getElementById('plan-form-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    // 🏢 UPDATE STUDIO STORAGE PLAN API
    const handleUpdateStudioPlan = async (e) => {
        e.preventDefault();
        if (!window.confirm(`Update storage plan for ${editingStudioPlan.name || editingStudioPlan.studioName}?`)) return;
        setLoading(true);
        try {
            const manualExp = document.getElementById('manualExpiryInput')?.value || '';
            const res = await axios.post(`${API_BASE}/update-studio-storage-plan`, {
                targetMobile: editingStudioPlan.mobile,
                newPlanName: newStudioPlan,
                customLimitGB: customLimitGB,
                expiryDays: manualExp
            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
            
            if (res.data.success) {
                alert(`✅ ${res.data.message}`);
                setEditingStudioPlan(null);
                fetchAccounts(); // Nayi limit load karne ke liye
            } else {
                alert(`❌ Error: ${res.data.message}`);
            }
        } catch (error) { alert("Server Error updating plan."); }
        setLoading(false);
    };

    // ✅ POST NEW JOB
    const handleAddJob = async (e) => {
        if(e) e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/add-vacancy`, newJob);
            if (res.data.success) {
                alert("✅ Job Vacancy Posted!");
                setNewJob({ role: '', type: 'Long Term', time: '', salary: '', urgent: false, description: '' });
                fetchVacancies();
            }
        } catch (e) { alert("Error posting job."); }
        finally { setLoading(false); }
    };

    // ✅ DELETE JOB
    const handleDeleteJob = async (id) => {
        if (!window.confirm("Are you sure you want to remove this job post?")) return;
        try {
            const res = await axios.post(`${API_BASE}/delete-vacancy`, { id });
            if (res.data.success) { 
                alert("🗑️ Job Deleted."); 
                fetchVacancies(); 
            }
        } catch (e) { alert("Error."); }
    };


    // ==========================================
    // 🚀 HELPERS
    // ==========================================
    const isVideo = (filePath) => {
        if (!filePath || typeof filePath !== 'string') return false;
        if (filePath.includes('/video/upload/')) return true; 
        return filePath.match(/\.(mp4|webm|ogg|mov)$/i);
    };

    // ✅ 100% SAFE & FAST IMAGE URL GENERATOR FOR ADMIN
    const getCleanUrl = (fileData, isThumbnail = false) => {
        try {
            if (!fileData) return '';
            let filePath = typeof fileData === 'object' ? (fileData.previewUrl || fileData.url || fileData.fileUrl) : fileData;
            if (typeof filePath !== 'string' || filePath.trim() === '') return '';
            if (filePath.startsWith('CINEMATIC::')) return filePath; 

            // 🚀 Cloudinary Ultra-Compression
            if (filePath.includes('cloudinary.com') && !filePath.includes('/video/upload')) {
                const uploadIndex = filePath.indexOf('/upload/');
                if (uploadIndex !== -1 && isThumbnail) {
                    const baseUrl = filePath.slice(0, uploadIndex + 8);
                    const imagePath = filePath.slice(uploadIndex + 8);
                    return `${baseUrl}c_scale,w_400,q_auto,f_auto/${imagePath}`;
                }
                return filePath; 
            }
            if (filePath.startsWith('http')) return filePath; 
            return `${SERVER_URL}${filePath.replace(/\\/g, '/')}`; 
        } catch (error) {
            return typeof fileData === 'string' && fileData.startsWith('http') ? fileData : '';
        }
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
    // 🚀 AD MANAGER LOGIC (NEW)
    // ==========================================
    const handleAdSubmit = async (e) => {
        e.preventDefault();
        if(!adFile) return alert("Please select an Image or Video file for the Ad.");
        if(!adForm.title) return alert("Please enter an Ad Title.");

        setLoading(true);
        setUploadProgress(0);
        setUploadSpeed('Uploading Ad Media...');
        
        // 🛑 NAYA: Start Controller
        const controller = new AbortController();
        setUploadController(controller);

        try {
            // 1. Upload Media Securely via Backend Proxy
            const fd = new FormData();
            fd.append('file', adFile);
            
            const cloudRes = await axios.post(`${API_BASE}/proxy-upload`, fd, {
                headers: { 'Authorization': `Bearer ${getValidToken()}` },
                signal: controller.signal, // 🛑 Signal attached
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(Math.min(percentCompleted, 99));
                    // 📊 MB Stats
                    const loadedMB = (progressEvent.loaded / (1024 * 1024)).toFixed(2);
                    const totalMBStr = (progressEvent.total / (1024 * 1024)).toFixed(2);
                    setUploadStats(`${loadedMB} MB / ${totalMBStr} MB`);
                }
            });
            
            const fileUrl = cloudRes.data.url;
            const fileType = fileUrl.match(/\.(mp4|mov|avi|wmv|webm)$/i) ? 'video' : 'image';

            setUploadProgress(100);
            setUploadSpeed('Publishing Ad Campaign...');

            // 2. Save Ad to Database
            const payload = {
                title: adForm.title,
                file: fileUrl,
                fileType: fileType,
                targetLocation: adForm.location || 'ALL',
                targetInterest: adForm.interest || 'ALL',
                actionLink: adForm.link,
                maxViews: parseInt(adForm.maxViews) || 0
            };

            const res = await axios.post(`${API_BASE}/upload-ad`, payload);
            
            if(res.data.success) {
                alert("✅ Smart Ad Published Successfully!");
                fetchAds();
                setAdForm({ title: '', location: 'ALL', interest: 'ALL', link: '', maxViews: '0' });
                setAdFile(null);
                document.getElementById('ad-file-input').value = '';
            } else {
                alert("Failed to publish Ad: " + res.data.message);
            }
        } catch (error) {
            console.error(error);
            alert("Error uploading Ad. Please check connection.");
        } finally {
            setLoading(false);
            setUploadProgress(0);
            setUploadSpeed('');
        }
    };

    const handleDeleteAd = async (adId) => {
        if(!window.confirm("Are you sure you want to permanently delete this Ad campaign?")) return;
        try {
            const res = await axios.post(`${API_BASE}/delete-ad`, { adId });
            if(res.data.success) {
                alert("🗑️ Ad Deleted Successfully.");
                fetchAds();
            }
        } catch (e) {
            alert("Error deleting ad.");
        }
    };

    // ==========================================
    // 🚀 UPLOAD DATA LOGIC
    // ==========================================

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

        // Hamesha purani files me nayi files append karo (taki user multiple folder ek sath select kar sake)
        setFormData(prev => ({ ...prev, files: [...prev.files, ...structuredFiles] }));
        
        const photos = structuredFiles.filter(file => file.type.startsWith('image/')).length;
        const videos = structuredFiles.filter(file => file.type.startsWith('video/')).length;
        
        // 🚀 NEW: Count unique folders
        const uniqueFolders = new Set(structuredFiles.map(f => f.customSubFolder || 'Main Event'));
        setFileStats(prev => ({ 
            photos: prev.photos + photos, 
            videos: prev.videos + videos,
            subFolders: uniqueFolders.size 
        }));
        
        const filePreviews = structuredFiles.map(file => ({ url: URL.createObjectURL(file), type: file.type }));
        setPreviews(prev => [...prev, ...filePreviews]);
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

// 🚀 ENTERPRISE BACKGROUND UPLOAD QUEUE (MULTI-TASKING)
    const handleUpload = async (isFeed = false) => {
        const activeMobile = formData.mobile;
        const activeFiles = formData.files;
        const activeFolderName = formData.folderName;
        const activeName = formData.name;
        const activeEmail = formData.email;
        const activeUploadMode = uploadMode; // 🔥 THE FIX: Mode ko lock kar liya!

        if (!isFeed && (!activeMobile || activeMobile.length !== 10)) return alert("Please enter a valid 10-digit mobile number.");
        
        const currentFiles = isFeed ? feedFiles : activeFiles;
        if (currentFiles.length === 0) return alert("Please select files to upload.");

        let baseFolder = activeFolderName.trim() || 'Snevio Photography';
        let targetSubFolder = '';
        if (useDateFolder && !isFeed) {
            targetSubFolder = new Date().toLocaleDateString('en-GB').replace(/\//g, '-'); 
        }

        const controller = new AbortController();

        let jobId = null;
        if (!isFeed) {
            jobId = Date.now().toString();
            const newJob = {
                id: jobId, mobile: activeMobile, name: activeName || 'Client', folderName: baseFolder,
                progress: 0, status: 'Preparing...', speed: '', eta: '', stats: '', controller: controller, 
                files: currentFiles, fileProgressMap: {}, liveActionText: ''   
            };
            setUploadJobs(prev => [newJob, ...prev]);
            
            setFormData({ type: 'USER', name: '', mobile: '', email: '', folderName: '', files: [], expiryDays: '30', downloadLimit: '0', imageCost: globalPricing.imageCost, videoCost: globalPricing.videoCost, unlockValidity: '24 Hours' });
            setUseDateFolder(false);
            setUploadMode('NORMAL'); 
            const fileInput = document.getElementById('admin-file-input'); if (fileInput) fileInput.value = '';
            setFileStats({ photos: 0, videos: 0 });
            setPreviews([]);
            setUploadSubTab('BASIC'); 
            alert("✅ Upload Queued in Background!");
        } else {
            setLoading(true);
            setUploadProgress(0); setUploadSpeed('Preparing Feed Upload...'); setUploadETA('Calculating...');
        }

        const totalBytes = currentFiles.reduce((acc, file) => acc + file.size, 0);
        
        // 🔥 DYNAMIC SERVER RAM PROTECTOR: Admin controlled batch limit
        const maxBatchGB = parseFloat(cloudRoutingForm.maxBatchSizeGB) || 1.5;
        const totalGB = totalBytes / (1024 * 1024 * 1024);
        if (totalGB > maxBatchGB) {
            setLoading(false);
            return alert(`🚨 Upload Limit Exceeded!\n\nYou are trying to upload ${totalGB.toFixed(2)} GB at once.\nTo prevent server crash, the maximum allowed size per batch is ${maxBatchGB} GB.\n\nPlease select fewer files and try again.`);
        }

        const loadedBytesArray = new Array(currentFiles.length).fill(0);
        const uploadedUrls = [];

        let startTime = Date.now();
        let lastTime = startTime;
        let lastTotalLoaded = 0;
        let fallbackSpeed = '0.00';

        setUploadController(controller);
        if (!fileProgressRef.current) fileProgressRef.current = {};

        try {
            const speedTracker = setInterval(() => {
                const totalLoaded = loadedBytesArray.reduce((acc, val) => acc + val, 0);
                let bytesLoadedSinceLast = totalLoaded - lastTotalLoaded;
                if (bytesLoadedSinceLast < 0) bytesLoadedSinceLast = 0;

                const instantSpeedBps = bytesLoadedSinceLast / 0.5;
                const speedMbps = (instantSpeedBps / (1024 * 1024)).toFixed(2);
                if (instantSpeedBps > 0) fallbackSpeed = speedMbps;

                const elapsedTimeSec = (Date.now() - startTime) / 1000;
                const averageSpeedBps = totalLoaded / elapsedTimeSec;
                const bytesRemaining = Math.max(0, totalBytes - totalLoaded);
                const etaSeconds = averageSpeedBps > 0 ? bytesRemaining / averageSpeedBps : 0;

                const percentCompleted = Math.round((totalLoaded * 100) / totalBytes) || 0;
                const loadedMB = (totalLoaded / (1024 * 1024)).toFixed(2);
                const totalMBStr = (totalBytes / (1024 * 1024)).toFixed(2);
                const statsStr = `${loadedMB} MB / ${totalMBStr} MB`;

                let etaStr = etaSeconds > 60 ? `Total: ${Math.floor(etaSeconds / 60)}m ${Math.floor(etaSeconds % 60)}s left` : `Total: ${Math.floor(etaSeconds)}s left`;
                if (etaSeconds <= 0 || percentCompleted >= 98) etaStr = "Saving to Database...";

                if (!isFeed) {
                    setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, progress: Math.min(percentCompleted, 99), speed: `${fallbackSpeed} MB/s`, status: `Cloud Upload... ${Math.min(percentCompleted, 99)}%`, eta: etaStr, stats: statsStr, fileProgressMap: {...fileProgressRef.current} } : job));
                } else {
                    setUploadProgress(Math.min(percentCompleted, 99)); 
                    setUploadSpeed(`${fallbackSpeed} MB/s 🚀`);
                    setUploadETA(etaStr);
                    setUploadStats(statsStr);
                }

                lastTotalLoaded = totalLoaded;
            }, 500);

            let currentIndex = 0;
            const activePromises = new Set();

            while (currentIndex < currentFiles.length) {
                const file = currentFiles[currentIndex];
                const globalIndex = currentIndex;
                currentIndex++;

                const isVid = file.type.startsWith('video/');
                const concurrencyLimit = isVid ? 1 : 5; 

                while (activePromises.size >= concurrencyLimit) {
                    await Promise.race(activePromises);
                }

                await new Promise(resolve => setTimeout(resolve, 100));

                const actionTxt = `Uploading ${file.name.substring(0, 15)}...`;
                if (!isFeed) {
                    setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, liveActionText: actionTxt } : job));
                }

                const uploadTask = (async () => {
                    let attempt = 0;
                    const maxAttempts = 3;
                    let successData = null;

                    while (attempt < maxAttempts) {
                        try {
                            attempt++;
                            loadedBytesArray[globalIndex] = 0; 

                            // Ask backend for routing decision (Stream vs Direct)
                            const sigRes = await axios.post(`${API_BASE}/generate-upload-signature`, {
                                fileName: file.name, 
                                fileType: file.type, 
                                fileSizeGB: file.size / (1024 * 1024 * 1024),
                                targetFolder: file.customSubFolder ? `${baseFolder}/${file.customSubFolder}` : baseFolder
                            }, { headers: { 'Authorization': `Bearer ${getValidToken()}` }, signal: controller.signal });

                            // 🟢 DIRECT CLOUD UPLOAD (NO CORS)
                            if (sigRes.data.directUpload) {
                                let finalUrl = '';
                                
                                if (sigRes.data.provider === 'CLOUDINARY') {
                                    const cFormData = new FormData();
                                    cFormData.append('file', file);
                                    cFormData.append('api_key', sigRes.data.apiKey);
                                    cFormData.append('timestamp', sigRes.data.timestamp);
                                    cFormData.append('signature', sigRes.data.signature);
                                    cFormData.append('folder', sigRes.data.folder);

                                    // 🔥 THE ULTIMATE CORS FIX: Native Fetch API instead of Axios
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
                                    // AWS S3 / R2 using Native Fetch
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
                            // 🔵 PROXY UPLOAD (STREAMING)
                            else {
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
                                attempt--; 
                                await new Promise(res => {
                                    const goOnline = () => { window.removeEventListener('online', goOnline); res(); };
                                    window.addEventListener('online', goOnline);
                                });
                            } else {
                                console.error(`🚨 Error on [${file.name}]:`, err.message);
                                if (attempt >= maxAttempts) { 
                                    loadedBytesArray[globalIndex] = 0; 
                                    fileProgressRef.current[file.name] = -1; // ❌ FAILED
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
                        if (data) uploadedUrls.push(data);
                        return data;
                    } finally {
                        activePromises.delete(wrappedTask);
                    }
                })();

                activePromises.add(wrappedTask);
            }

            await Promise.all(activePromises);
            clearInterval(speedTracker);

            const failedFilesList = currentFiles.filter(f => fileProgressRef.current[f.name] === -1).map(f => f.name);
            const failedFilesCount = failedFilesList.length;

            if (failedFilesCount > 0) {
                if (!isFeed) setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, speed: `⚠️ ${failedFilesCount} failed`, eta: 'Action Required' } : job));
                else { setUploadSpeed(`⚠️ ${failedFilesCount} files failed`); setUploadETA('Waiting for your permission...'); }

                const userWantsRetry = window.confirm(`⚠️ ${failedFilesCount} files failed due to network drop.\n\nDo you want the system to Auto-Retry them right now?\n\n✅ Click 'OK' to Retry failed files.\n❌ Click 'Cancel' to skip them and save the successful files to the database.`);
                
                if (userWantsRetry) {
                    if (!isFeed) setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, status: '🔄 Retrying...', progress: 0 } : job));
                    return handleUpload(isFeed);
                }
            }

            if (uploadedUrls.length === 0) {
                if (!isFeed) setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, status: '❌ Failed. Cloud Error.' } : job));
                else { setLoading(false); alert("❌ All uploads failed."); }
                return;
            }

            if (!isFeed) {
                setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, progress: 100, status: 'Saving to Database...', speed: '', eta: '' } : job));
            } else {
                setUploadProgress(100); setUploadSpeed('Finalizing...'); setUploadETA('Saving Data to Server...');
            }

            // 💾 3. SAVE TO DATABASE (🔥 FIX: Removed Extra Payload Data to prevent 400 Bad Request)
            
            if (activeUploadMode === 'SELECTION') { // 🔥 THE FIX: Hamesha Smart Album hi banega!
                const selPayload = {
                    clientMobile: activeMobile, 
                    clientEmail: activeEmail, 
                    folderName: baseFolder, 
                    addedBy: user?.mobile || 'ADMIN',
                    assignToStudio: formData.assignToStudio, // 🔥 BHEJO BACKEND KO
                    sheetLimit: '30',
                    imagesPerSheet: '4',
                    costPerExtraSheet: '150',
                    totalPhases: '3',
                    cloudProvider: 'CLOUDINARY',
                    fileUrls: uploadedUrls // 🔥 THE FIX: Backend 'fileUrls' expect kar raha hai, 'images' nahi!
                };
                
                const dbRes1 = await axios.post(`${API_BASE}/create-album-selection`, selPayload, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });

                if (dbRes1.data.success) {
                    setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, progress: 100, status: '✅ Completed & Notified' } : job));
                    fetchAccounts();
                } else { 
                    setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, status: `❌ DB Error: ${dbRes1.data.message}` } : job));
                }

            } else if (isFeed) {
                const feedPayload = {
                    mobile: user?.mobile,
                    studioName: user?.name || 'Admin',
                    description: feedDescription,
                    feedCategory: feedCategory,
                    price: feedPrice,
                    expiryHours: feedExpiryType === 'custom' ? customExpiryHours : feedExpiryType, 
                    fileUrls: uploadedUrls 
                };
                
                const dbRes2 = await axios.post(`${API_BASE}/upload-feed-post`, feedPayload, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                
                if (dbRes2.data.success) {
                    alert(`✅ Success: ${dbRes2.data.message}`);
                    setUploadProgress(0); setUploadSpeed(''); setUploadETA('');
                    setFeedFiles([]); setFeedPreviews([]);
                    setLoading(false);
                } else {
                    alert(`❌ Error: ${dbRes2.data.message}`); 
                    setLoading(false);
                }
            } else {
                // NORMAL UPLOAD
                const normalPayloadData = {
                    mobile: activeMobile, name: activeName || 'Client', type: formData.type || 'USER',
                    folderName: baseFolder, subFolderName: targetSubFolder, email: activeEmail,
                    expiryDays: formData.expiryDays, downloadLimit: formData.downloadLimit,
                    addedBy: user?.mobile || 'ADMIN', 
                    imageCost: formData.imageCost || '5', videoCost: formData.videoCost || '10', unlockValidity: formData.unlockValidity || '24 Hours',
                    uploadType: activeUploadMode, // 🔥 THE FIX: Ab ye Normal hi jayega
                    fileUrls: uploadedUrls.map(obj => ({ url: obj.url || obj }))
                };

                const dbRes3 = await axios.post(`${API_BASE}/admin-add-user-cloud`, normalPayloadData, {
                    headers: { 'Authorization': `Bearer ${getValidToken()}` }
                });

                if (dbRes3.data.success) {
                    setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, progress: 100, status: '✅ Completed & Notified' } : job));
                    fetchAccounts();
                } else { 
                    setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, status: `❌ DB Error: ${dbRes3.data.message}` } : job));
                }
            }
        } catch (error) { 
            if (error.name === "AbortError" || axios.isCancel(error)) return console.log('Upload aborted.');
            console.error(error);
            if (!isFeed) setUploadJobs(prev => prev.map(job => job.id === jobId ? { ...job, status: '❌ Failed. Network Error.' } : job));
            else { alert("Upload Failed. Check internet connection."); setLoading(false); }
        } 
    };


    // ==========================================
    // 🚀 MANAGE ACCOUNTS LOGIC
    // ==========================================
    const handleDeleteAccount = async (mobile, role) => {
        if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete this ${role}?`)) return;
        try {
            const res = await axios.post(`${API_BASE}/delete-account`, { targetMobile: mobile, targetRole: role }, {
                headers: { 'Authorization': `Bearer ${getValidToken()}` }
            });
            if (res.data.success) { alert("🗑️ Account deleted!"); fetchAccounts(); } else { alert(`❌ Failed: ${res.data.message}`); }
        } catch (error) { alert("Error deleting account."); console.error(error); }
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
            const res = await axios.post(`${API_BASE}/delete-specific-data`, { mobile, folderName, subFolderName, fileUrl }, {
                headers: { 'Authorization': `Bearer ${getValidToken()}` }
            });
            if (res.data.success) {
                alert("🗑️ Deleted successfully!");
                setGlobalRemoveUserObj(prev => ({ ...prev, uploadedData: res.data.updatedData }));
                fetchAccounts(); 
            } else {
                alert(res.data.message || "Failed to delete.");
            }
        } catch (e) { alert("Error connecting to server."); }
    };


    // 🔥 NEW: Studio Account Approval Logic (Login Access)
    const toggleStudioLoginAccess = async (mobile, currentStatus) => {
        const actionText = currentStatus ? "REVOKE LOGIN ACCESS" : "APPROVE ACCOUNT";
        if (!window.confirm(`Are you sure you want to ${actionText} for this Studio?\n\nIf approved, an email will be sent automatically.`)) return;

        try {
            const res = await axios.post(`${API_BASE}/approve-studio-account`, 
                { mobile, isApproved: !currentStatus }, 
                { headers: { 'Authorization': `Bearer ${getValidToken()}` } }
            );
            
            if (res.data.success) {
                alert(res.data.message);
                fetchAccounts(); // UI refresh
            } else {
                alert("Failed: " + res.data.message);
            }
        } catch (error) { 
            alert("Error connecting to server."); 
            console.error(error);
        }
    };

    // ==========================================
    // 🚀 ADMIN SETTINGS & PRICING
    // ==========================================
    const handleUpdateAdminProfile = async (e) => {
        if(e) e.preventDefault(); 
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
        if(e) e.preventDefault(); 
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
        if(e) e.preventDefault(); 
        if (!window.confirm("Are you sure you want to update Platform Policies?")) return;
        try {
            await axios.post(`${API_BASE}/update-policies`, { policies: policyData });
            alert("✅ Policies Updated Successfully!");
        } catch (e) { alert("Failed to save policies."); }
    };

    const handleCollabAction = async (id, action) => {
        if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;
        try {
            const res = await axios.post(`${API_BASE}/update-collab-status`, { collabId: id, status: action }, {
                headers: { 'Authorization': `Bearer ${getValidToken()}` }
            });
            if(res.data.success) { alert(`✅ Request ${action}!`); fetchCollabs(); }
        } catch(e) { alert("Failed to update collab status"); console.error(e); }
    };

    const handleBookingStatus = async (id, newStatus) => {
        if (!window.confirm(`Are you sure you want to ${newStatus} this booking?`)) return;
        try {
            const res = await axios.post(`${API_BASE}/update-booking-status`, { bookingId: id, status: newStatus });
            if(res.data.success) { alert(`✅ Booking marked as ${newStatus}!`); fetchBookings(); }
        } catch (e) { alert("Failed to update booking"); }
    };

    const openDenyModal = (booking) => {
        setBookingToDeny(booking);
        setShowDenyModal(true);
        setDenyReason('Booking session full.');
        setCustomDenyReason('');
    };

    const handleDenyBooking = async () => {
        if (!bookingToDeny) return;
        const finalReason = customDenyReason.trim() !== '' ? customDenyReason : denyReason;

        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/update-booking-status`, { 
                bookingId: bookingToDeny._id, 
                status: 'Declined',
                cancelReason: finalReason
            });
            if (res.data.success) { 
                alert(`✅ Booking marked as Declined!`); 
                setShowDenyModal(false);
                fetchBookings(); 
            }
        } catch (e) { alert("Failed to update booking"); }
        finally { setLoading(false); }
    };

    const startEditingService = (service) => {
        setEditingServiceId(service._id);
        setNewService({
            title: service.title,
            shortDescription: service.shortDescription,
            fullDescription: service.fullDescription,
            startingPrice: service.startingPrice,
            features: service.features,
            discountPercentage: service.discountPercentage || '', 
            offerText: service.offerText || '' 
        });
        setServiceImage(null); 
        document.getElementById('service-form-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    const cancelEditing = () => {
        setEditingServiceId(null);
        setNewService({ title: '', shortDescription: '', fullDescription: '', startingPrice: '', features: '', discountPercentage: '', offerText: '' });
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
                
                const cloudRes = await axios.post(`${API_BASE}/proxy-upload`, fd, {
                    headers: { 'Authorization': `Bearer ${getValidToken()}` }
                });
                uploadedImageUrl = cloudRes.data.url;
            }

            const payloadData = {
                title: newService.title,
                startingPrice: newService.startingPrice,
                shortDescription: newService.shortDescription,
                fullDescription: newService.fullDescription,
                features: newService.features,
                discountPercentage: newService.discountPercentage || 0,
                offerText: newService.offerText || '',
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

    const emergencyPendingCountVal = bookings.filter(b => (b.type === 'Emergency Booking' || b.isEmergency) && b.status === 'Pending').length;

    // 📄 PDF GENERATOR FOR FAILED UPLOADS (ADMIN)
    const generateFailedReportPDF = (log) => {
        if (!log.report) return alert("No report data available for this upload.");
        try {
            const doc = new jsPDF();
            doc.setFontSize(18); doc.setTextColor(231, 76, 60);
            doc.text("Snevio Admin - Upload Failure Report", 14, 20);
            doc.setFontSize(12); doc.setTextColor(50);
            doc.text(`Date: ${log.date}`, 14, 30);
            doc.text(`Action: ${log.action}`, 14, 38);
            doc.text(`Folder: ${log.amount || 'N/A'}`, 14, 46);
            doc.setFontSize(14); doc.setTextColor(41, 128, 185);
            doc.text("Upload Statistics:", 14, 60);
            doc.setFontSize(12); doc.setTextColor(0);
            doc.text(`Total Files Attempted: ${log.report.total}`, 14, 70);
            doc.text(`Successfully Uploaded: ${log.report.success}`, 14, 78);
            doc.setTextColor(231, 76, 60); 
            doc.text(`Failed Files: ${log.report.failed}`, 14, 86);
            
            if (log.report.failedNames && log.report.failedNames.length > 0) {
                const tableData = log.report.failedNames.map((name, index) => [index + 1, name, "Network / Cloud Timeout"]);
                autoTable(doc, { startY: 95, head: [['#', 'Failed File Name', 'Reason']], body: tableData, headStyles: { fillColor: [231, 76, 60] } });
            }
            doc.save(`Admin_Failed_Upload_Report_${Date.now()}.pdf`);
        } catch (err) { console.error(err); alert("Error generating PDF."); }
    };

    return (
        <div className="owner-dashboard-container">
            
            {/* ✅ FLOATING SMART DOWNLOAD MANAGER */}
            {downloadManager.active && (
                <div style={{ position: 'fixed', bottom: '20px', right: '20px', width: '350px', background: '#fff', borderRadius: '15px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', zIndex: 999999, border: '1px solid #3498db', overflow: 'hidden' }}>
                    <div style={{ background: '#3498db', padding: '15px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '14px' }}>📥 Downloading Album Data</h4>
                        {downloadManager.paused ? (
                            <button onClick={() => startSmartDownload(allSelections.find(s => s._id === downloadManager.projectId))} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>▶️ Resume</button>
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
                    </div>
                </div>
            )}

            {/* ✅ CLIENT DATA PREVIEW MODAL (GOD MODE EDITOR) */}
            {previewProject && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1a1a2e', padding: '20px', borderRadius: '15px', width: '90%', maxWidth: '900px', height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', border: isEditMode ? '2px solid #e74c3c' : '1px solid #333' }}>
                        
                        {/* HEADER */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#fff', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    📂 {previewProject.folderName} 
                                    <button onClick={toggleEditMode} style={{ background: isEditMode ? '#34495e' : '#e74c3c', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        {isEditMode ? '👁️ Exit Edit Mode' : '✏️ Edit Album'}
                                    </button>
                                </h2>
                                <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#aaa' }}>Client: {previewProject.clientMobile} | Total Images: {isEditMode ? editDraftImages.length : (previewProject.images?.length || 0)}</p>
                            </div>
                            <button disabled={editUploading || loading} onClick={() => setPreviewProject(null)} style={{ background: 'transparent', border: 'none', fontSize: '24px', color: '#fff', cursor: (editUploading || loading) ? 'not-allowed' : 'pointer' }}>✖</button>
                        </div>

                        {/* 🔥 PRO-LEVEL GOD MODE TOOLBAR */}
                        {isEditMode && (
                            <div style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid #3498db', marginBottom: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                                    <h4 style={{ margin: 0, color: '#3498db', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>🛠️ Admin Control Center</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        {/* 🔥 NEW: Cloud Selector Dropdown */}
                                        <select value={editTargetCloud} onChange={e => setEditTargetCloud(e.target.value)} disabled={editUploading} style={{ background: '#1a1a2e', color: '#f1c40f', border: '1px solid #f1c40f', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', outline: 'none', cursor: editUploading ? 'not-allowed' : 'pointer' }}>
                                            <option value="SAME_AS_ALBUM">🔄 Same Cloud as Album</option>
                                            {storageAccounts.map(acc => <option key={acc._id} value={acc._id}>☁️ Force: {acc.nickname}</option>)}
                                        </select>
                                        
                                        <span style={{ fontSize: '12px', color: '#aaa', marginLeft: '5px' }}>Visibility:</span>
                                        <button onClick={() => setAlbumIsFrozen(!albumIsFrozen)} style={{ background: albumIsFrozen ? '#e74c3c' : '#2ecc71', color: '#fff', border: 'none', padding: '6px 15px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            {albumIsFrozen ? '🔴 Locked (View Only)' : '🟢 Active (Editable)'}
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button onClick={() => document.getElementById('edit-add-files').click()} disabled={editUploading} style={{ flex: 1, background: '#3498db', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        📄 Add Files
                                    </button>
                                    <button onClick={() => document.getElementById('edit-add-folder').click()} disabled={editUploading} style={{ flex: 1, background: '#8e44ad', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        🗂️ Add Folder
                                    </button>
                                    <button onClick={() => setRemoveMode(removeMode === 'FILE' ? null : 'FILE')} style={{ background: removeMode === 'FILE' ? '#c0392b' : '#e74c3c', color: '#fff', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: removeMode === 'FILE' ? '2px solid #fff' : 'none' }}>
    {removeMode === 'FILE' ? '⏹️ Stop Removing' : '🎯 Remove Files'}
</button>
                                    <button onClick={() => {
                                        const targetFolder = window.prompt("Enter exact Sub-Folder name to delete (e.g. Haldi):");
                                        if (targetFolder) {
                                            const filtered = editDraftImages.filter(img => (img.subFolder || 'Main Event') !== targetFolder);
                                            setEditDraftImages(filtered);
                                            alert(`Deleted folder: ${targetFolder}`);
                                        }
                                    }} style={{ flex: 1, background: '#d35400', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        🗑️ Remove Folder
                                    </button>
                                </div>

                                {/* ✅ ENHANCED PROGRESS BAR FOR GOD MODE UPLOADS */}
                                {editUploading && (
                                    <div style={{ marginTop: '20px', background: '#1a1a2e', padding: '15px', borderRadius: '10px', border: '1px solid #3498db' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#fff', fontSize: '12px' }}>
                                            <strong>Uploading to Cloud...</strong>
                                            <strong>{uploadProgress}%</strong>
                                        </div>
                                        <div style={{ width: '100%', height: '10px', background: '#333', borderRadius: '5px', overflow: 'hidden' }}>
                                            <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #3498db, #2ecc71)', transition: 'width 0.3s ease' }}></div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', fontWeight: 'bold' }}>
                                            <span style={{ color: '#f1c40f' }}>{uploadStats || 'Calculating...'}</span>
                                            <span style={{ color: '#e67e22' }}>⏳ {uploadETA || 'Estimating time...'}</span>
                                        </div>
                                        <p style={{ color: '#aaa', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
                                            Please do not close this window while files are processing.
                                        </p>
                                    </div>
                                )}
                                <input id="edit-add-files" type="file" multiple accept="image/*,video/*" onChange={(e) => handleEditFileUpload(e, false)} style={{ display: 'none' }} />
                                <input id="edit-add-folder" type="file" webkitdirectory="true" directory="true" multiple onChange={(e) => handleEditFileUpload(e, true)} style={{ display: 'none' }} />
                            </div>
                        )}

                        {removeMode === 'FILE' && <div style={{ background: '#e74c3c', color: '#fff', textAlign: 'center', padding: '8px', fontSize: '12px', fontWeight: 'bold', borderRadius: '5px', marginBottom: '10px', animation: 'pulse-red 1.5s infinite', border: '1px solid #c0392b' }}>🎯 SNIPER MODE: Click any image below to permanently remove it from the draft!</div>}
                        
                        {/* IMAGES GRID */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }} onScroll={(e) => {
                            if (e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 400) {
                                setRenderLimit(prev => Math.min(prev + 50, (isEditMode ? editDraftImages : previewProject.images)?.length || prev));
                            }
                        }}>
                            {(() => {
                                const dataSource = isEditMode ? editDraftImages : previewProject.images;
                                if (!dataSource || dataSource.length === 0) return <p style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>No images available.</p>;

                                const displayImgs = dataSource.slice(0, renderLimit);
                                const groupedData = {};
                                displayImgs.forEach(img => {
                                    const aTag = img.albumTag || 'Album 1';
                                    const sTag = img.subFolder || 'Main Event';
                                    if (!groupedData[aTag]) groupedData[aTag] = {};
                                    if (!groupedData[aTag][sTag]) groupedData[aTag][sTag] = [];
                                    groupedData[aTag][sTag].push(img);
                                });

                                return (
                                    <>
                                        {Object.keys(groupedData).sort().map((albumName) => (
                                            <div key={albumName} style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #1a1a2e, #0f172a)', padding: '20px', borderRadius: '15px', border: `1px solid ${albumName === 'Album 2' ? '#f39c12' : '#3498db'}`, position: 'relative' }}>
                                                <h3 style={{ color: albumName === 'Album 2' ? '#f1c40f' : '#3498db', fontSize: '16px', marginBottom: '20px' }}>{albumName === 'Album 2' ? '📙' : '📘'} {albumName}</h3>
                                                {Object.keys(groupedData[albumName]).sort().map(folderName => (
                                                    <div key={folderName} style={{ marginBottom: '25px' }}>
                                                        <h4 style={{ margin: '0 0 12px 0', color: '#e0e0e0', fontSize: '14px' }}>📁 {folderName}</h4>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
                                                            {groupedData[albumName][folderName].map((img, idx) => (
                                                                <div key={idx} 
                                                                    onClick={() => { if(removeMode === 'FILE') setEditDraftImages(prev => prev.filter(i => i.url !== img.url)); }}
                                                                    style={{ position: 'relative', height: '100px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${albumName === 'Album 2' ? '#f39c12' : '#3498db'}`, cursor: removeMode === 'FILE' ? 'pointer' : 'default', opacity: (removeMode === 'FILE') ? 0.8 : 1 }}>
                                                                    {removeMode === 'FILE' && <div style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', background: 'rgba(231,76,60,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#fff', zIndex: 10 }}>✖</div>}
                                                                    <img src={getCleanUrl(img.url, true)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                        {dataSource.length > renderLimit && (
                                            <div style={{textAlign: 'center', padding: '15px', color: '#f1c40f', fontWeight: 'bold'}}>
                                                ⏳ Scroll down to load more images... ({renderLimit} / {dataSource.length})
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        {/* 💾 FINAL SAVE BUTTON (Only in Edit Mode) */}
                        {isEditMode && (
                            <div style={{ borderTop: '1px solid #333', paddingTop: '15px', marginTop: '10px', textAlign: 'center' }}>
                                <button disabled={loading || editUploading} onClick={saveGodModeChanges} style={{ width: '100%', background: '#2ecc71', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: (loading || editUploading) ? 'not-allowed' : 'pointer', boxShadow: '0 5px 15px rgba(46, 204, 113, 0.3)' }}>
                                    {loading ? 'Saving to Database...' : '💾 Save & Update Album'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ✅ EXIT APP POPUP */}
            {showExitPopup && (
                <div className="popup-overlay-fixed" style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter: 'blur(5px)'}}>
                    <div style={{background:'#1a1a2e', padding:'30px', borderRadius:'15px', textAlign:'center', color:'#fff', boxShadow:'0 10px 30px rgba(0,0,0,0.7)', border: '1px solid #333', maxWidth: '300px', width: '90%'}}>
                        <div style={{fontSize: '40px', marginBottom: '10px'}}>🔐</div>
                        <h3 style={{marginBottom:'10px', marginTop: 0}}>Close Admin Panel?</h3>
                        <p style={{fontSize: '13px', color: '#aaa', marginBottom: '20px'}}>Are you sure you want to exit the Owner Control Center?</p>
                        
                        <div style={{display:'flex', gap:'15px', justifyContent:'center'}}>
                            <button onClick={() => window.location.href = '/'} style={{background:'#e74c3c', color:'#fff', padding:'10px 20px', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', flex: 1}}>Yes, Exit</button>
                            <button onClick={() => setShowExitPopup(false)} style={{background:'#34495e', color:'#fff', padding:'10px 20px', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', flex: 1}}>No, Stay</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ EMERGENCY ROW CSS */}
            <style>{`
                @keyframes pulse-red {
                    0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
                }
                .emergency-row {
                    animation: pulse-red 2s infinite;
                    border-left: 5px solid #e74c3c !important;
                }
            `}</style>
            
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
            {/* ✅ DENIAL REASON MODAL */}
            {showDenyModal && (
                <div className="popup-overlay-fixed" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 9999999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#1a1a2e', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 style={{ color: '#e74c3c', margin: 0 }}>Decline Booking</h2>
                            <button onClick={() => setShowDenyModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#fff', cursor: 'pointer' }}>✖</button>
                        </div>
                        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '20px' }}>Please provide a reason for declining this request from <strong>{bookingToDeny?.name}</strong>.</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: '#ccc' }}>Select Preset Reason</label>
                                <select 
                                    value={denyReason} 
                                    onChange={(e) => {
                                        setDenyReason(e.target.value);
                                        if (e.target.value !== 'Other Custom logic...') setCustomDenyReason('');
                                    }} 
                                    className="custom-admin-input" style={{ marginTop: '5px' }}
                                >
                                    {PRESET_DENY_REASONS.map((r, i) => <option key={i} value={r}>{r}</option>)}
                                </select>
                            </div>

                            {denyReason === 'Other Custom logic...' && (
                                <div>
                                    <label style={{ fontSize: '12px', color: '#ccc' }}>Write Custom Reason</label>
                                    <textarea 
                                        rows="3" 
                                        placeholder="Type your reason here..." 
                                        value={customDenyReason} 
                                        onChange={(e) => setCustomDenyReason(e.target.value)} 
                                        className="custom-admin-input" 
                                        style={{ marginTop: '5px', resize: 'vertical' }}
                                    ></textarea>
                                </div>
                            )}

                            <button onClick={handleDenyBooking} disabled={loading} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                {loading ? 'Processing...' : 'Confirm Decline'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <aside className="admin-sidebar">
                {/* 🚀 SNEVIO LOGO + SUPER ADMIN INDICATOR */}
                <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '25px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '400', letterSpacing: '3px', color: '#fff' }}>
                            SNE<span style={{ fontWeight: '800', color: '#f1c40f' }}>VIO</span>
                        </h2>
                    </div>
                    {/* 👇 Ye clear karega ki ye Owner/Admin Panel hai (Red color for Super Admin) 👇 */}
                    <span style={{ marginTop: '8px', background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', fontSize: '10px', padding: '3px 12px', borderRadius: '15px', letterSpacing: '2px', fontWeight: 'bold' }}>
                        OWNER PANEL
                    </span>
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

                <ul className="sidebar-menu">
                    
                    {/* 🌍 GLOBAL PLATFORM */}
                    <div className="menu-group">
                        <div className={`menu-group-header ${openDropdown === 'GLOBAL' ? 'open' : ''}`} onClick={() => toggleMenu('GLOBAL')} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#1a1a2e', cursor: 'pointer', fontWeight: 'bold', color: '#fff', borderRadius: '5px', marginBottom: '5px' }}>
                            <span>🌍 Global Platform</span>
                            <span>{openDropdown === 'GLOBAL' ? '▲' : '▼'}</span>
                        </div>
                        {openDropdown === 'GLOBAL' && (
                            <div className="menu-dropdown-content" style={{ paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
                                <li className={activeTab === 'DASHBOARD' ? 'active' : ''} onClick={() => { setActiveTab('DASHBOARD'); setOpenDropdown(null); }}>📊 Dashboard</li>
                                <li className={activeTab === 'UPLOAD' ? 'active' : ''} onClick={() => { setActiveTab('UPLOAD'); setOpenDropdown(null); }}>📤 Upload Data</li>
                                <li className={activeTab === 'GLOBAL_CHARGES' ? 'active' : ''} onClick={() => { setActiveTab('GLOBAL_CHARGES'); setOpenDropdown(null); }}>💰 Global Charges</li>
                                <li className={activeTab === 'GLOBAL_REMOVE' ? 'active' : ''} onClick={() => { setActiveTab('GLOBAL_REMOVE'); setOpenDropdown(null); }}>🗑️ Global Remove</li>
                                <li className={activeTab === 'ACCOUNTS' ? 'active' : ''} onClick={() => { setActiveTab('ACCOUNTS'); setOpenDropdown(null); }}>👥 Manage Accounts</li>
                                <li className={activeTab === 'GOD_SELECTIONS' ? 'active' : ''} onClick={() => { setActiveTab('GOD_SELECTIONS'); setOpenDropdown(null); }} style={{color: '#f1c40f', fontWeight: 'bold'}}>✨ Smart Albums (God View)</li>
                                <li className={activeTab === 'CRITERIA' ? 'active' : ''} onClick={() => { setActiveTab('CRITERIA'); setOpenDropdown(null); }}>📈 Criteria & Traffic</li>
                                {/* 📣 NEW ADS TAB */}
                                <li className={activeTab === 'ADS' ? 'active' : ''} onClick={() => { setActiveTab('ADS'); setOpenDropdown(null); }} style={{color: '#f1c40f'}}>📣 Ad Manager</li>
                                <li className={activeTab === 'INCOME' ? 'active' : ''} onClick={() => { setActiveTab('INCOME'); setOpenDropdown(null); }}>💰 Income</li>
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
                                <li className={activeTab === 'BOOKINGS' ? 'active' : ''} onClick={() => { setActiveTab('BOOKINGS'); setOpenDropdown(null); }}>📅 Direct Bookings</li>
                                <li className={activeTab === 'MANAGE_SERVICES' ? 'active' : ''} onClick={() => { setActiveTab('MANAGE_SERVICES'); setOpenDropdown(null); }} style={{ color: '#f1c40f' }}>🛠️ Manage Services</li>
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
                                <li className={activeTab === 'STUDIO_PLANS' ? 'active' : ''} onClick={() => { setActiveTab('STUDIO_PLANS'); setOpenDropdown(null); }} style={{color: '#2ecc71', fontWeight: 'bold'}}>🗄️ Studio Storage Plans</li>
                                <li style={{color:'#7f8c8d', fontSize:'12px', listStyle:'none', padding:'10px'}}>More Studio Features Soon...</li>
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
                                <li className={activeTab === 'STORAGE' ? 'active' : ''} onClick={() => { setActiveTab('STORAGE'); setOpenDropdown(null); }} style={{color: '#3498db'}}>☁️ My Storage</li>
                                <li className={activeTab === 'SOCIAL' ? 'active' : ''} onClick={() => { setActiveTab('SOCIAL'); setOpenDropdown(null); }}>🌐 Social Links</li>
                                <li className={activeTab === 'SECURITY' ? 'active' : ''} onClick={() => { setActiveTab('SECURITY'); setOpenDropdown(null); }}>🔒 Security Policy</li>
                                <li className={activeTab === 'SUB_ADMIN' ? 'active' : ''} onClick={() => { setActiveTab('SUB_ADMIN'); setOpenDropdown(null); }}>🧑‍💼 Sub-Admins</li> 
                                <li className={activeTab === 'CAREERS' ? 'active' : ''} onClick={() => { setActiveTab('CAREERS'); setOpenDropdown(null); }}>💼 Job Vacancies</li>
                                <li className={activeTab === 'SETTINGS' ? 'active' : ''} onClick={() => { setActiveTab('SETTINGS'); setOpenDropdown(null); }}>⚙️ Settings</li>
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
                        📲 Install Admin App
                    </button>
                )}

                <button onClick={() => setShowLogoutPopup(true)} className="admin-logout-btn" style={{marginTop: '15px'}}>Log Out</button> 
            </aside>

            <main className="admin-main-content">
                
                {/* 👑 GOD VIEW: SMART ALBUM SELECTIONS */}
                {activeTab === 'GOD_SELECTIONS' && (
                    <div className="view-section">
                        <div className="section-header">
                            <h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>✨ Global Smart Albums</h2>
                            <button className="refresh-btn" onClick={async () => {
                                try {
                                    const res = await axios.get(`${API_BASE}/admin-get-all-selections`, { headers: { 'Authorization': `Bearer ${getValidToken()}` } });
                                    if (res.data.success) setAllSelections(res.data.data);
                                } catch(e) { console.log("Failed to refresh"); }
                            }} style={{background:'#8e44ad', color:'white', border:'none', padding:'8px 15px', borderRadius:'5px', cursor:'pointer'}}>🔄 Refresh Status</button>
                        </div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Monitor all active client selection projects running across your studio network.</p>

                        <div className="data-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Studio</th><th>Client & Folder</th><th>Phase Progress</th><th>Extra Amount</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {allSelections.length > 0 ? allSelections.map((sel, i) => {
                                        const totalImgs = sel.allImages ? sel.allImages.length : 0;
                                        const selectedImgs = sel.images ? sel.images.filter(img => img.status === 'selected').length : 0;
                                        return (
                                            <tr key={i}>
                                                <td><strong style={{color: '#3498db'}}>{sel.studioMobile}</strong></td>
                                                <td>
                                                    <strong>{sel.folderName}</strong><br/>
                                                    <span style={{fontSize:'11px', color:'#777'}}>Client: {sel.clientMobile}</span>
                                                </td>
                                                <td>
                                                    <span style={{background: sel.status === 'Completed' ? '#2ecc71' : '#f1c40f', color: '#fff', padding: '3px 8px', borderRadius: '15px', fontSize: '11px', fontWeight: 'bold'}}>
                                                        {sel.status}
                                                    </span>
                                                    <div style={{fontSize:'11px', marginTop:'5px'}}>Phase: {sel.currentPhase} / {sel.totalPhases}</div>
                                                    <div style={{fontSize:'11px', color:'#8e44ad'}}><strong>{selectedImgs}</strong> of {totalImgs} picked</div>
                                                </td>
                                                <td><strong style={{color: sel.extraAmountToPay > 0 ? '#e74c3c' : '#2ecc71'}}>₹{sel.extraAmountToPay || 0}</strong></td>
                                                <td style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                    <button onClick={() => handleMagicLogin(sel)} style={{background:'#34495e', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', fontSize:'11px', cursor:'pointer', fontWeight: 'bold'}}>👁️ Preview Data</button>
                                                    
                                                    {/* 🔥 THE DELETE BUTTON FOR ENTIRE PROJECT */}
                                                    <button onClick={() => handleDeleteSelectionProject(sel._id)} style={{background:'#e74c3c', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', fontSize:'11px', cursor:'pointer', fontWeight: 'bold'}}>🗑️ Delete</button>
                                                    
                                                    {sel.status === 'Confirmed' || (sel.status === 'Completed' && !isSplitWindowActive(sel)) ? (
                                                        <button onClick={() => startSmartDownload(sel)} disabled={downloadManager.active && downloadManager.projectId === sel._id} style={{background: (downloadManager.active && downloadManager.projectId === sel._id) ? '#bdc3c7' : '#2ecc71', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', fontSize:'11px', cursor:'pointer', fontWeight: 'bold'}}>
                                                            {downloadManager.active && downloadManager.projectId === sel._id ? 'Downloading...' : '📥 Download ZIP'}
                                                        </button>
                                                    ) : (sel.status === 'Submitted' || sel.status === 'Split Mode') ? (
                                                        <button disabled style={{background:'#95a5a6', color:'white', border:'none', padding:'6px 10px', borderRadius:'4px', fontSize:'10px', cursor:'not-allowed', fontWeight: 'bold'}}>
                                                            ⏳ Locked (Splitting...)
                                                        </button>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        );
                                    }) : <tr><td colSpan="5" style={{textAlign:'center', color:'#888', padding:'20px'}}>No Smart Selections running.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'DASHBOARD' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>Overview Statistics</h2></div>

                        {/* ✅ UNIQUE ALERT ON DASHBOARD */}
                        {emergencyPendingCountVal > 0 && (
                            <div style={{ background: '#e74c3c', color: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 5px 20px rgba(231,76,60,0.4)', animation: 'pulse-red 2s infinite' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <span style={{ fontSize: '30px' }}>🚨</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '18px' }}>ATTENTION: PENDING EMERGENCY REQUESTS!</h3>
                                        <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>You have <strong>{emergencyPendingCountVal} PENDING Emergency Booking(s)</strong>. User is waiting for your call!</p>
                                    </div>
                                </div>
                                <button onClick={() => setActiveTab('BOOKINGS')} style={{ background: '#fff', color: '#e74c3c', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>View Now ➡️</button>
                            </div>
                        )}

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

                {/* 📣 NEW: SMART AD MANAGER TAB */}
                {activeTab === 'ADS' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>📣 Smart Ad Manager (Pro)</h2></div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Create targeted ads or promotions that automatically inject into user feeds.</p>

                        <div className="update-creation-container" style={{ maxWidth: '700px', margin: '0 auto 30px', borderTop: editingAdId ? '4px solid #f1c40f' : 'none' }}>
                            {editingAdId && <div style={{ background: '#fcf3cf', padding: '10px', borderRadius: '8px', color: '#d4ac0d', fontWeight: 'bold', marginBottom: '15px', textAlign: 'center' }}>✏️ You are modifying an existing Ad Campaign</div>}
                            
                            <form onSubmit={handleAdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '13px', fontWeight: 'bold', color: '#333'}}>Ad Campaign Title</label>
                                        <input type="text" placeholder="e.g. Diwali Mega Sale" value={adForm.title} onChange={e => setAdForm({...adForm, title: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} required/>
                                    </div>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '13px', fontWeight: 'bold', color: '#333'}}>Upload Media {editingAdId && <span style={{fontSize: '10px', color: '#666'}}>(Leave blank to keep old)</span>}</label>
                                        <input type="file" accept="image/*,video/*" onChange={e => setAdFile(e.target.files[0])} className="custom-admin-input" id="ad-file-input" style={{padding: '9px', color: '#000', fontWeight: '500'}} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '15px', background: '#f4f6f9', padding: '15px', borderRadius: '8px', border: '1px dashed #3498db' }}>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '13px', fontWeight: 'bold', color: '#2980b9'}}>Target Location</label>
                                        <select value={adForm.location} onChange={e => setAdForm({...adForm, location: e.target.value})} className="custom-admin-input" style={{marginBottom: 0, color: '#000', fontWeight: 'bold'}}>
                                            <option value="ALL">🌍 ALL Locations (Global)</option>
                                            {Object.keys(locationStats).filter(k => k !== 'Unknown').map((loc, idx) => (
                                                <option key={idx} value={loc}>📍 {loc} ({locationStats[loc]} Users)</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '13px', fontWeight: 'bold', color: '#2980b9'}}>Target Feed Category</label>
                                        <select value={adForm.interest} onChange={e => setAdForm({...adForm, interest: e.target.value})} className="custom-admin-input" style={{marginBottom: 0, color: '#000', fontWeight: 'bold'}}>
                                            <option value="ALL">🌍 Both Feeds (Global)</option>
                                            <option value="trending">🔥 Trending Feed Only</option>
                                            <option value="viral">🚀 Viral Feed Only</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{flex: 2}}>
                                        <label style={{fontSize: '13px', fontWeight: 'bold', color: '#333'}}>Action Link (On Click)</label>
                                        <input type="url" placeholder="https://..." value={adForm.link} onChange={e => setAdForm({...adForm, link: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} />
                                    </div>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '13px', fontWeight: 'bold', color: '#333'}}>Max Views Limit</label>
                                        <input type="number" placeholder="0 = Unlimited" value={adForm.maxViews} onChange={e => setAdForm({...adForm, maxViews: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} />
                                    </div>
                                </div>

                                    {loading && (
                                    <div style={{ background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>
                                            <span>{uploadSpeed} {uploadProgress}%</span>
                                            <span style={{ color: '#f39c12' }}>{uploadStats}</span>
                                        </div>
                                        <div style={{ width: '100%', background: '#eee', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
                                            <div style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #f39c12, #e74c3c)', height: '100%', transition: 'width 0.3s ease' }}></div>
                                        </div>
                                        <div style={{ textAlign: 'center', marginTop: '15px' }}>
                                            <button type="button" onClick={handleStopUpload} style={{ background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', border: '1px solid #e74c3c', padding: '6px 15px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                🛑 Stop Upload
                                            </button>
                                        </div>
                                        {/* 🛑 FAILURES RETRY ACTION FOR FEED */}
                                        {uploadSpeed.includes('failed') && !loading && (
                                            <div style={{ background: '#fdf2e9', padding: '15px', borderRadius: '8px', marginTop: '15px', border: '1px dashed #e67e22', textAlign: 'center' }}>
                                                <p style={{ margin: '0 0 10px 0', color: '#d35400', fontWeight: 'bold', fontSize: '13px' }}>⚠️ Some files failed to upload</p>
                                                <button type="button" onClick={() => handleUpload(true)} style={{ background: '#e67e22', color: '#fff', padding: '8px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>🔄 Retry Failed Files</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {editingAdId && <button type="button" onClick={() => {setEditingAdId(null); setAdForm({ title: '', location: 'ALL', interest: 'ALL', link: '', maxViews: '0' });}} style={{ background: '#95a5a6', color: '#fff', border: 'none', padding: '15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>}
                                    <button type="submit" disabled={loading} className="global-update-btn" style={{ background: editingAdId ? '#2ecc71' : '#f39c12', padding: '15px', marginTop: editingAdId ? 0 : '10px', flex: 1 }}>
                                        {loading ? 'Processing...' : (editingAdId ? '💾 Update Live Ad' : '🚀 Publish Smart Ad Campaign')}
                                    </button>
                                </div>
                            </form>
                        </div>

                        <h3 style={{ padding: '15px', color: '#2c3e50', fontWeight: 'bold', margin: 0 }}>📊 Live Advertisement Campaigns</h3>
                        <div className="data-table-container">
                            <table className="admin-table" style={{color: '#333'}}>
                                <thead><tr><th style={{color: '#2c3e50'}}>Preview Image</th><th style={{color: '#2c3e50'}}>Ad Title</th><th style={{color: '#2c3e50'}}>Targeting</th><th style={{color: '#2c3e50'}}>Views Status</th><th style={{color: '#2c3e50'}}>Actions</th></tr></thead>
                                <tbody>
                                    {fetchingAds ? <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>Loading Ads...</td></tr> : 
                                    adList.length > 0 ? adList.map((ad, idx) => (
                                        <tr key={idx} style={{ opacity: ad.isActive ? 1 : 0.6 }}>
                                            <td style={{width: '80px', cursor: 'pointer'}} onClick={() => setPreviewAd(ad)}>
                                                {ad.fileType === 'video' ? 
                                                    <div style={{position:'relative', width:'60px', height:'60px'}}>
                                                        <video src={getCleanUrl(ad.file)} style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'5px'}} />
                                                        <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', color:'white', fontSize:'12px', background:'rgba(0,0,0,0.5)', padding:'2px', borderRadius:'50%'}}>▶️</div>
                                                    </div> :
                                                    <img src={getCleanUrl(ad.file)} style={{width:'60px', height:'60px', objectFit:'cover', borderRadius:'5px', border:'1px solid #ddd'}} />
                                                }
                                                <div style={{fontSize:'9px', color:'#3498db', textAlign:'center', marginTop:'2px'}}>Click to preview</div>
                                            </td>
                                            <td>
                                                <strong>{ad.title}</strong><br/>
                                                <a href={ad.actionLink} target="_blank" rel="noreferrer" style={{fontSize:'10px', color:'#3498db'}}>Test Link ↗️</a>
                                            </td>
                                            <td style={{fontSize:'12px'}}>
                                                📍 {ad.targetLocation}<br/>
                                                🎯 {ad.targetInterest}
                                            </td>
                                            <td>
                                                <strong style={{color: '#27ae60'}}>{ad.currentViews}</strong> / {ad.maxViews === 0 ? '∞' : ad.maxViews}
                                                <br/><span style={{fontSize:'10px', color: ad.isActive ? '#2ecc71' : '#e74c3c', fontWeight:'bold'}}>{ad.isActive ? '🟢 Active' : '🔴 Stopped'}</span>
                                            </td>
                                            <td>
                                                <button onClick={() => {
                                                    setEditingAdId(ad._id);
                                                    setAdForm({ title: ad.title, location: ad.targetLocation, interest: ad.targetInterest, link: ad.actionLink, maxViews: ad.maxViews });
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }} style={{background: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px', fontSize:'11px'}}>✏️ Edit</button>
                                                <button onClick={() => handleDeleteAd(ad._id)} className="pdf-btn" style={{background: '#e74c3c', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize:'11px'}}>🗑️ Delete</button>
                                            </td>
                                        </tr>
                                    )) : <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px', color: '#888'}}>No Ads currently running.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        {/* ✅ FULL SCREEN AD PREVIEW MODAL */}
                        {previewAd && (
                            <div style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                                <button onClick={() => setPreviewAd(null)} style={{position: 'absolute', top: '20px', right: '20px', background: 'red', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '18px', cursor: 'pointer', zIndex: 10}}>✖</button>
                                <h3 style={{color: '#fff', marginBottom: '15px'}}>{previewAd.title}</h3>
                                <div style={{width: '90%', maxWidth: '400px', height: '70vh', background: '#000', borderRadius: '15px', overflow: 'hidden', border: '2px solid #333'}}>
                                    {previewAd.fileType === 'video' ? (
                                        <video src={getCleanUrl(previewAd.file)} controls autoPlay style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                                    ) : (
                                        <img src={getCleanUrl(previewAd.file)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 🔴 MANAGE SERVICES (UNDER USER PLATFORM) */}
                {activeTab === 'MANAGE_SERVICES' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>🛠️ Manage App Services</h2></div>
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
                                {/* ✅ NEW: DISCOUNT SECTION */}
                                <div style={{ display: 'flex', gap: '15px', background: '#f4f6f9', padding: '15px', borderRadius: '8px', border: '1px dashed #3498db' }}>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '13px', fontWeight: 'bold', color: '#2980b9'}}>Offer Tag (Optional)</label>
                                        <input type="text" placeholder="e.g. Diwali Sale 20% Off!" value={newService.offerText} onChange={e => setNewService({...newService, offerText: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleAddOrUpdateService)} className="custom-admin-input" style={{marginBottom: 0}}/>
                                    </div>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '13px', fontWeight: 'bold', color: '#2980b9'}}>Discount Percentage (%)</label>
                                        <input type="number" placeholder="e.g. 15" min="0" max="100" value={newService.discountPercentage} onChange={e => setNewService({...newService, discountPercentage: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleAddOrUpdateService)} className="custom-admin-input" style={{marginBottom: 0}}/>
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
                                <thead><tr><th>Service Title</th><th>Price Details</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {availableServices.length > 0 ? availableServices.map((srv, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <strong>{srv.title}</strong>
                                                {srv.offerText && <div style={{fontSize: '10px', background: '#e74c3c', color: '#fff', display: 'inline-block', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', fontWeight: 'bold'}}>{srv.offerText}</div>}
                                            </td>
                                            <td>
                                                {srv.discountPercentage > 0 ? (
                                                    <div>
                                                        <span style={{textDecoration: 'line-through', color: '#888', fontSize: '12px'}}>₹{srv.startingPrice}</span>
                                                        <strong style={{color: '#2ecc71', marginLeft: '5px', fontSize: '15px'}}>₹{srv.finalPrice}</strong>
                                                    </div>
                                                ) : (
                                                    <strong>₹{srv.startingPrice}</strong>
                                                )}
                                            </td>
                                            <td><span className="status-badge active">Live</span></td>
                                            <td>
                                                <button onClick={() => startEditingService(srv)} style={{background: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', marginRight: '5px'}}>✏️ Edit</button>
                                                <button onClick={() => handleDeleteService(srv._id)} className="pdf-btn" style={{background: '#e74c3c', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer'}}>Remove</button>
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
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>🗑️ Global Data Remove (Pro)</h2></div>
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
                                        style={{margin: 0, color: '#333', fontWeight: 'bold'}}
                                    />
                                    {globalRemoveSearchSuggestions && globalRemoveMobile && globalRemoveFilteredSuggestions.length > 0 && (
                                        <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.15)', borderRadius: '5px' }}>
                                            {globalRemoveFilteredSuggestions.map((acc, idx) => (
                                                <li key={idx} onMouseDown={() => {
                                                    setGlobalRemoveMobile(acc.mobile);
                                                    searchUserForRemoval(acc.mobile);
                                                }} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#000', fontWeight: 'bold' }}>
                                                    📞 {acc.mobile} - <span style={{color: '#2980b9'}}>{acc.name || acc.studioName}</span>
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
                                                                            <img src={getCleanUrl(fileUrl, true)} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>📤 Upload Client Data</h2></div>
                        
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            
                            {/* 🔥 NAYA: Top Level Main Switch (Normal vs Smart) */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', background: '#f8f9fa', padding: '5px', borderRadius: '12px', border: '1px solid #ddd' }}>
                                <button type="button" onClick={() => setUploadMode('NORMAL')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', background: uploadMode === 'NORMAL' ? '#3498db' : 'transparent', color: uploadMode === 'NORMAL' ? '#fff' : '#555', boxShadow: uploadMode === 'NORMAL' ? '0 4px 10px rgba(52, 152, 219, 0.3)' : 'none' }}>
                                    📁 Normal Gallery
                                </button>
                                <button type="button" onClick={() => setUploadMode('SELECTION')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', background: uploadMode === 'SELECTION' ? '#8e44ad' : 'transparent', color: uploadMode === 'SELECTION' ? '#fff' : '#555', boxShadow: uploadMode === 'SELECTION' ? '0 4px 10px rgba(142, 68, 173, 0.3)' : 'none' }}>
                                    ✨ Smart Album
                                </button>
                            </div>

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

                            <form onSubmit={(e) => { e.preventDefault(); handleUpload(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                
                                {uploadSubTab === 'BASIC' && (
                                    <>
                                        <div style={{ position: 'relative' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Mobile Number (Auto-suggest)</label>
                                            <input type="number" placeholder="e.g. 9876543210" required value={formData.mobile} onChange={handleMobileChange} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} onKeyDown={(e) => handleKeyDown(e, () => setUploadSubTab('LIMITS'))} className="custom-admin-input" />
                                            {showSuggestions && formData.mobile && filteredSuggestions.length > 0 && (
                                                <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#fff', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: 0, listStyle: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', borderRadius: '5px' }}>
                                                    {filteredSuggestions.map((acc, idx) => (
                                                        <li key={idx} onMouseDown={() => handleSuggestionClick(acc)} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', color: '#000', fontWeight: '500' }}>
                                                            📞 {acc.mobile} - {acc.name || acc.studioName}
                                                        </li>
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

                                        {/* 🔥 NAYA: Assign to Studio Dropdown */}
                                        {uploadMode === 'SELECTION' && (
                                            <div style={{ background: '#fff9c4', padding: '10px', borderRadius: '8px', border: '1px solid #f1c40f' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#d35400' }}>🏢 Assign to Studio (Optional)</label>
                                                <select value={formData.assignToStudio} onChange={(e) => setFormData({ ...formData, assignToStudio: e.target.value })} className="custom-admin-input" style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                                    <option value="">-- Keep it for Admin Only --</option>
                                                    {accounts.filter(a => a.role === 'STUDIO').map((studio, idx) => (
                                                        <option key={idx} value={studio.mobile}>
                                                            {studio.studioName || studio.ownerName} ({studio.mobile})
                                                        </option>
                                                    ))}
                                                </select>
                                                <p style={{ fontSize: '11px', color: '#555', margin: '3px 0 0 0' }}>If selected, this studio will be able to manage this album in their dashboard.</p>
                                            </div>
                                        )}

                                        {/* Show Active Mode Indicator */}
                                        {uploadMode === 'SELECTION' && (
                                            <div style={{ background: '#f5eef8', padding: '10px', borderRadius: '8px', border: '1px dashed #8e44ad', fontSize: '12px', color: '#8e44ad', fontWeight: 'bold', marginBottom: '15px' }}>
                                                ✨ Smart Album Mode Active. User can select photos.
                                            </div>
                                        )}

                                        {/* 🔥 NAYA: Assign to Studio Dropdown */}
                                        {uploadMode === 'SELECTION' && (
                                            <div style={{ background: '#fff9c4', padding: '15px', borderRadius: '8px', border: '1px solid #f1c40f', marginBottom: '20px' }}>
                                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#d35400' }}>🏢 Assign to Studio (Optional)</label>
                                                <select value={formData.assignToStudio || ''} onChange={(e) => setFormData({ ...formData, assignToStudio: e.target.value })} className="custom-admin-input" style={{ marginTop: '5px', fontWeight: 'bold' }}>
                                                    <option value="">-- Private (Admin Only, Hidden from Studios) --</option>
                                                    {accounts.filter(a => a.role === 'STUDIO').map((studio, idx) => (
                                                        <option key={idx} value={studio.mobile}>
                                                            {studio.studioName || studio.ownerName} ({studio.mobile})
                                                        </option>
                                                    ))}
                                                </select>
                                                <p style={{ fontSize: '11px', color: '#555', margin: '5px 0 0 0' }}>If left blank, NO studio will see this album. If selected, it transfers to their dashboard.</p>
                                            </div>
                                        )}
                                        
                                        <div style={{ background: '#ebf5fb', padding: '15px', borderRadius: '8px', border: '1px solid #bce0fd', position: 'relative' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#2b5876' }}>📂 Folder Name</label>
                                            <p style={{ fontSize: '11px', color: '#555', margin: '5px 0 10px 0' }}>Type to select existing or create new.</p>
                                            <input type="text" placeholder="Leave blank for 'Stranger Photography' or type name" value={formData.folderName} onChange={(e) => { setFormData({ ...formData, folderName: e.target.value }); setShowFolderSuggestions(true); }} onFocus={() => setShowFolderSuggestions(true)} onBlur={() => setTimeout(() => setShowFolderSuggestions(false), 200)} onKeyDown={(e) => handleKeyDown(e, () => setUploadSubTab('LIMITS'))} className="custom-admin-input" />
                                            
                                            {(!formData.folderName || formData.folderName.trim() === '') && (
                                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#e67e22', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <span>⚠️</span> Default folder "Snevio Photography" will be used.
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
                                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '15px', color: '#444' }}>📁 Upload Media (Smart Structuring)</label>
                                    
                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                                        <button type="button" onClick={() => document.getElementById('admin-file-input').click()} style={{ background: '#3498db', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            📄 Select Specific Files
                                        </button>
                                        <button type="button" onClick={() => document.getElementById('admin-folder-input').click()} style={{ background: '#8e44ad', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            🗂️ Select Entire Folder
                                        </button>
                                    </div>
                                    <p style={{ fontSize: '11px', color: '#777', margin: '0 0 15px 0' }}>Tip: Select a root folder (e.g. 'Wedding') and we'll automatically detect its sub-folders (Haldi, Mehndi)!</p>

                                    <input id="admin-file-input" type="file" multiple accept="image/*,video/*" onChange={(e) => handleFileChange(e, false)} style={{ display: 'none' }} />
                                    {/* ✅ THE MAGIC DIRECTORY ATTRIBUTE */}
                                    <input id="admin-folder-input" type="file" webkitdirectory="true" directory="true" multiple onChange={(e) => handleFileChange(e, true)} style={{ display: 'none' }} />
                                    
                                    {formData.files.length > 0 && (
                                        <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
                                            <div style={{ background: '#e8f8f5', border: '1px solid #2ecc71', color: '#27ae60', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>📸 Photos: {fileStats.photos}</div>
                                            <div style={{ background: '#fdedec', border: '1px solid #e74c3c', color: '#c0392b', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>🎥 Videos: {fileStats.videos}</div>
                                            {fileStats.subFolders > 0 && (
                                                <div style={{ background: '#f5eef8', border: '1px solid #9b59b6', color: '#8e44ad', padding: '5px 15px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>📂 Folders: {fileStats.subFolders}</div>
                                            )}
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

                                        <button type="submit" className="global-update-btn" style={{ padding: '15px', width: '100%', background: '#27ae60', cursor: 'pointer' }}>
                                            🚀 Put in Upload Queue
                                        </button>
                                        
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                                            <button type="button" onClick={() => setUploadSubTab('LIMITS')} style={{ padding: '10px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', textDecoration: 'underline' }}>
                                                ⬅️ Back to Limits
                                            </button>
                                            <button type="button" onClick={() => {
                                                if(window.confirm("Clear all filled data in this form?")) {
                                                    setFormData({ type: 'USER', name: '', mobile: '', email: '', folderName: '', files: [], expiryDays: '30', downloadLimit: '0', imageCost: globalPricing.imageCost, videoCost: globalPricing.videoCost, unlockValidity: '24 Hours' });
                                                    setUploadSubTab('BASIC');
                                                }
                                            }} style={{ padding: '10px', background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontWeight: 'bold' }}>
                                                🗑️ Clear Form
                                            </button>
                                        </div>
                                    </>
                                )}
                            </form>
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
                                    // 🔥 ULTIMATE FIX: Fetching Real History directly from Backend Logs across all accounts + Admin Logs
                                    let allUploads = [];
                                    
                                    // 1. Admin's own uploads
                                    const adminLogs = user?.logs || [];
                                    adminLogs.forEach(log => {
                                        allUploads.push({
                                            action: log.action,
                                            date: log.time ? new Date(log.time).toLocaleString('en-IN') : 'Recently',
                                            timestamp: log.time ? new Date(log.time).getTime() : Date.now(),
                                            amount: log.amount,
                                            report: log.report
                                        });
                                    });

                                    // 2. Users & Studios uploads
                                    accounts.forEach(client => {
                                        const rawHistory = client.wallet?.history || [];
                                        const userUploads = rawHistory.filter(item => item.type === 'received' || (item.action && (item.action.includes('pload') || item.action.includes('Album'))));
                                        
                                        userUploads.forEach(log => {
                                            allUploads.push({
                                                action: `${log.action} (User: ${client.name || client.mobile})`,
                                                date: log.date || (log.time ? new Date(log.time).toLocaleString('en-IN') : 'Recently'),
                                                timestamp: log.time ? new Date(log.time).getTime() : (log.date ? new Date(log.date).getTime() : Date.now()),
                                                amount: log.amount,
                                                report: log.report
                                            });
                                        });
                                    });
                                    // Naye uploads sabse upar aayenge
                                    allUploads.sort((a, b) => b.timestamp - a.timestamp);

                                    const filteredLogs = allUploads.filter(log => log.action.toLowerCase().includes(uploadLogSearch.toLowerCase()));

                                    if (filteredLogs.length === 0) return <p style={{ textAlign: 'center', color: '#999', fontSize: '12px', padding: '10px 0' }}>No upload history found.</p>;

                                    return (
                                        <>
                                            {filteredLogs.slice(0, uploadLogLimit).map((log, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #8e44ad', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>
                                                    <div>
                                                        <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>{log.action}</p>
                                                        <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>🕒 {log.date}</p>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                                                        {log.amount && (
                                                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#8e44ad', background: 'rgba(142, 68, 173, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
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

                        {/* ✅ BACKGROUND UPLOAD QUEUE DASHBOARD */}
                        {uploadJobs.length > 0 && (
                            <div className="update-creation-container" style={{ maxWidth: '600px', margin: '30px auto 0', background: '#fdfefe', border: '2px solid #3498db' }}>
                                <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>📡 Queue & History</span>
                                    <span style={{background: '#3498db', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '10px'}}>{uploadJobs.filter(j => j.progress < 100 && !j.status.includes('❌')).length} Running</span>
                                </h3>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
                                    {uploadJobs.map((job, idx) => (
                                        <div key={job.id} style={{ background: '#fff', border: '1px solid #eee', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'relative' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <div>
                                                    <strong style={{ fontSize: '14px', color: '#2c3e50' }}>{job.name} <span style={{color: '#7f8c8d', fontSize: '12px'}}>({job.mobile})</span></strong>
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#3498db', fontWeight: 'bold' }}>📁 {job.folderName}</p>
                                                </div>
                                                
                                                {/* Manage Button for completed uploads */}
                                                {job.status.includes('Completed') && (
                                                    <button onClick={() => {
                                                        setGlobalRemoveMobile(job.mobile);
                                                        searchUserForRemoval(job.mobile);
                                                        setActiveTab('GLOBAL_REMOVE');
                                                    }} style={{ background: '#f39c12', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', height: 'fit-content' }}>
                                                        ⚙️ Manage Upload
                                                    </button>
                                                )}
                                            </div>

                                            {/* Progress Bar Display */}
                                            {(() => {
                                                let successCount = 0;
                                                let failCount = 0;
                                                let pendingCount = 0;
                                                const failedFilesList = [];
                                                
                                                (job.files || []).forEach((f, i) => {
                                                    const prog = job.fileProgressMap ? job.fileProgressMap[i] : 0;
                                                    if (prog === 100) successCount++;
                                                    else if (prog === -1) { failCount++; failedFilesList.push(f.name); }
                                                    else pendingCount++;
                                                });

                                                return (
                                                    <>
                                                        {job.progress < 100 && !job.status.includes('❌') && !job.status.includes('🛑') && (
                                                            <>
                                                                <div style={{ width: '100%', background: '#eee', borderRadius: '10px', height: '8px', overflow: 'hidden', marginBottom: '5px' }}>
                                                                    <div style={{ width: `${job.progress}%`, background: 'linear-gradient(90deg, #3498db, #2ecc71)', height: '100%', transition: 'width 0.3s ease' }}></div>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#7f8c8d', fontWeight: 'bold' }}>
                                                                    <span>⚡ {job.speed}</span>
                                                                    <span style={{ color: '#f1c40f' }}>{job.stats}</span>
                                                                    <span>⏳ {job.eta}</span>
                                                                </div>
                                                                {job.liveActionText && (
                                                                    <div style={{ marginTop: '10px', padding: '8px', background: '#f5f6fa', borderRadius: '5px', fontSize: '11px', color: '#2c3e50', borderLeft: '3px solid #3498db', fontWeight: 'bold' }}>
                                                                        🔄 {job.liveActionText}
                                                                    </div>
                                                                )}
                                                                {/* 🛑 Stop Button */}
                                                                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                                                                    <button onClick={() => handleStopJob(job.id)} style={{ background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', border: '1px solid #e74c3c', padding: '4px 12px', borderRadius: '15px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                                        🛑 Cancel Upload
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}

                                                        {/* 📊 SUCCESS / FAIL STATS */}
                                                        {job.files && job.files.length > 0 && (
                                                            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                                                                <div style={{ flex: 1, background: '#e8f8f5', border: '1px solid #2ecc71', color: '#27ae60', padding: '6px', borderRadius: '6px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>✅ {successCount} Uploaded</div>
                                                                <div style={{ flex: 1, background: '#fdedec', border: '1px solid #e74c3c', color: '#c0392b', padding: '6px', borderRadius: '6px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>❌ {failCount} Failed</div>
                                                                <div style={{ flex: 1, background: '#ebf5fb', border: '1px solid #3498db', color: '#2980b9', padding: '6px', borderRadius: '6px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>⏳ {pendingCount} Queued</div>
                                                            </div>
                                                        )}

                                                        {/* 🛑 FAILURES LIST */}
                                                        {failCount > 0 && job.progress >= 100 && (
                                                            <div style={{ background: '#fdf2e9', padding: '10px', borderRadius: '8px', marginTop: '10px', border: '1px dashed #e67e22', textAlign: 'center' }}>
                                                                <p style={{ margin: '0 0 8px 0', color: '#d35400', fontWeight: 'bold', fontSize: '11px' }}>⚠️ Some files failed to upload</p>
                                                                <button onClick={() => alert(`FAILED FILES:\n\n${failedFilesList.join('\n')}`)} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>👁️ View Failed Files</button>
                                                            </div>
                                                        )}

                                                        <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 'bold', color: job.status.includes('Completed') ? '#27ae60' : (job.status.includes('❌') || job.status.includes('🛑') || job.status.includes('failed')) ? '#e74c3c' : '#e67e22' }}>
                                                            {job.status}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 🔴 TAB: GLOBAL CHARGES */}
                {activeTab === 'GLOBAL_CHARGES' && (
                    <div className="view-section">
                        <div className="section-header">
                            <h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>💰 Global Charges & Events Configuration</h2>
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
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>📋 Manage Users & Studios</h2></div>
                        <div className="admin-filter-tabs">
                            <button className={filterRole === 'ALL' ? 'active' : ''} onClick={() => setFilterRole('ALL')}>All Accounts</button>
                            <button className={filterRole === 'USER' ? 'active' : ''} onClick={() => setFilterRole('USER')}>Users Only</button>
                            <button className={filterRole === 'STUDIO' ? 'active' : ''} onClick={() => setFilterRole('STUDIO')}>Studios Only</button>
                            <button className={filterRole === 'ADMIN' ? 'active' : ''} onClick={() => setFilterRole('ADMIN')}>Sub-Admins</button>
                        </div>
                        <div className="data-table-container" style={{ marginTop: '20px' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Role</th><th>Name</th><th>Mobile</th><th>Approve Login</th><th>Feed Auth</th><th>Action</th></tr>
                                </thead>
                                <tbody>
                                    {displayedAccounts.map((acc, index) => (
                                        <tr key={index}>
                                            <td><span className={`status-badge ${acc.role === 'STUDIO' ? 'active' : acc.role === 'ADMIN' ? 'inactive' : 'normal'}`}>{acc.role}</span></td>
                                            <td>{acc.name || acc.studioName || acc.ownerName}</td>
                                            <td>{acc.mobile}</td>
                                            
                                            {/* 🔥 NAYA: Studio Login Approval Button */}
                                            <td>
                                                {acc.role === 'STUDIO' ? (
                                                    <button 
                                                        onClick={() => toggleStudioLoginAccess(acc.mobile, acc.isAccountApproved)} 
                                                        style={{ 
                                                            background: acc.isAccountApproved ? '#2ecc71' : '#e74c3c', 
                                                            border: '1px solid #fff', 
                                                            padding: '6px 12px', 
                                                            borderRadius: '6px', 
                                                            color: '#fff', 
                                                            cursor: 'pointer', 
                                                            fontWeight: 'bold',
                                                            fontSize: '11px',
                                                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                                        }}
                                                    >
                                                        {acc.isAccountApproved ? '🟢 Verified' : '🔴 Unverified'}
                                                    </button>
                                                ) : <span style={{ color: '#ccc' }}>-</span>}
                                            </td>

                                            {/* Purana Feed Approval Button */}
                                            <td>
                                                {acc.role === 'STUDIO' ? (
                                                    <button onClick={() => toggleStudioApproval(acc.mobile, acc.isFeedApproved)} style={{ background: acc.isFeedApproved ? '#2ecc71' : '#f1c40f', border: 'none', padding: '5px 10px', borderRadius: '5px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>{acc.isFeedApproved ? '✅ Approved' : '🔒 Pending'}</button>
                                                ) : <span style={{ color: '#ccc' }}>-</span>}
                                            </td>
                                            <td><button onClick={() => handleDeleteAccount(acc.mobile, acc.role)} className="pdf-btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#e74c3c', borderRadius: '6px' }}>Delete</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB: BOOKINGS */}
                {activeTab === 'BOOKINGS' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>📅 Direct Bookings & Emergencies</h2></div>
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
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>📈 Platform Criteria & Traffic</h2></div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                            <div className="setting-card" style={{background: '#f8f9f9', padding: '20px', borderRadius: '10px', color: '#333', border: '1px solid #e1e8ed'}}>
                                <h3 style={{color:'#2980b9', marginTop: 0}}>📊 Traffic Status</h3>
                                <p style={{color: '#7f8c8d', fontSize: '13px', margin: '5px 0 15px 0'}}>Real-time analytics of platform visitors.</p>
                                <div style={{ marginTop: '15px' }}>
                                    <p style={{margin: '5px 0', fontSize: '14px', color: '#2c3e50'}}><strong>Total Accounts:</strong> {accounts.length}</p>
                                    <p style={{margin: '5px 0', fontSize: '14px', color: '#2c3e50'}}><strong>Today's Visitors:</strong> 1,240 (Simulated)</p>
                                </div>
                            </div>
                            <div className="setting-card" style={{background: '#fcf3cf', padding: '20px', borderRadius: '10px', color: '#333', border: '1px solid #f9e79f'}}>
                                <h3 style={{color:'#d35400', marginTop: 0}}>📢 Business & Ads</h3>
                                <p style={{color: '#7f8c8d', fontSize: '13px', margin: '5px 0 15px 0'}}>Manage homepage banners and promotions.</p>
                                <button onClick={() => setActiveTab('ADS')} className="global-update-btn" style={{ background: '#f1c40f', color: '#000', marginTop: '10px', border: 'none', padding: '10px 15px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Manage Ad Banners</button>
                            </div>
                        </div>

                        <div className="data-table-container">
                            <h3 style={{ padding: '15px', color: '#2c3e50', fontWeight: 'bold', margin: 0 }}>🤝 Collaboration Requests</h3>
                            <table className="admin-table" style={{color: '#333'}}>
                                <thead><tr><th style={{color: '#2c3e50'}}>Name</th><th style={{color: '#2c3e50'}}>Brand</th><th style={{color: '#2c3e50'}}>Email</th><th style={{color: '#2c3e50'}}>Status</th><th style={{color: '#2c3e50'}}>Actions</th></tr></thead>
                                <tbody>
                                    {collabRequests.map(req => (
                                        <tr key={req._id}>
                                            <td style={{fontWeight: '500'}}>{req.name}</td>
                                            <td>{req.brand}</td>
                                            <td style={{color: '#2980b9'}}>{req.email}</td>
                                            <td><span className={`status-badge ${req.status === 'Accepted' ? 'active' : req.status === 'Declined' ? 'inactive' : 'normal'}`}>{req.status}</span></td>
                                            <td>
                                                {req.status === 'Pending' && (
                                                    <>
                                                        <button onClick={() => handleCollabAction(req._id, 'Accepted')} style={{background:'#2ecc71', color:'#fff', border:'none', padding:'5px 10px', borderRadius:'3px', marginRight:'5px', cursor:'pointer', fontWeight: 'bold'}}>Accept</button>
                                                        <button onClick={() => handleCollabAction(req._id, 'Declined')} style={{background:'#e74c3c', color:'#fff', border:'none', padding:'5px 10px', borderRadius:'3px', cursor:'pointer', fontWeight: 'bold'}}>Decline</button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {collabRequests.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:'20px', color: '#7f8c8d'}}>No new collab requests.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'SOCIAL' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>🌐 Manage Social Links</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Platform</label>
                                    <select value={newLink.platform} onChange={(e) => setNewLink({...newLink, platform: e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}}>
                                        <option value="Instagram">Instagram</option><option value="YouTube">YouTube</option><option value="Facebook">Facebook</option><option value="WhatsApp">WhatsApp</option><option value="Twitter">Twitter</option>
                                    </select>
                                </div>
                                <div><label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Profile URL</label><input type="text" placeholder="e.g. https://instagram.com/sandncinema" value={newLink.url} onChange={(e) => setNewLink({...newLink, url: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleAddLink)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}}/></div>
                                <button onClick={handleAddLink} className="global-update-btn">➕ Add to List</button>
                            </div>
                            
                            <button onClick={saveLinksToServer} className="global-update-btn" style={{background: '#27ae60', marginBottom: '30px', width: '100%'}}>💾 SAVE ALL TO DATABASE</button>

                            <h4 style={{color: '#2c3e50', fontWeight: 'bold', borderBottom: '2px solid #eee', paddingBottom: '10px'}}>Current Links Saved</h4>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {socialLinks.filter(l => l.url !== '').map((link, i) => (
                                    <li key={i} style={{ background:'#f9f9f9', padding:'10px', marginBottom:'5px', display:'flex', justifyContent:'space-between', border: '1px solid #ddd', borderRadius: '4px' }}>
                                        <strong style={{color: '#000'}}>{link.platform}</strong>
                                        <a href={link.url} target="_blank" rel="noreferrer" style={{color: '#2980b9', fontWeight: 'bold'}}>{link.url.substring(0, 20)}...</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'SECURITY' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>⚖️ App Policies & Legal Content</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '850px', margin: '0 auto' }}>
                            <form onSubmit={handlePolicySave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <label style={{fontWeight:'bold', color: '#2b5876'}}>📄 Terms & Conditions</label>
                                        <textarea value={policyData.terms} onChange={e => setPolicyData({...policyData, terms: e.target.value})} className="custom-admin-input" rows="6" style={{resize:'vertical', marginTop: '5px', color: '#000', fontWeight: '500'}} placeholder="Enter T&C here..."></textarea>
                                    </div>
                                    <div>
                                        <label style={{fontWeight:'bold', color: '#2b5876'}}>🔒 Privacy Policy</label>
                                        <textarea value={policyData.privacy} onChange={e => setPolicyData({...policyData, privacy: e.target.value})} className="custom-admin-input" rows="6" style={{resize:'vertical', marginTop: '5px', color: '#000', fontWeight: '500'}} placeholder="Enter Privacy Policy..."></textarea>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                        <label style={{fontWeight:'bold', color: '#e67e22'}}>🚚 Shipping & Delivery</label>
                                        <textarea value={policyData.shipping} onChange={e => setPolicyData({...policyData, shipping: e.target.value})} className="custom-admin-input" rows="6" style={{resize:'vertical', marginTop: '5px', color: '#000', fontWeight: '500'}} placeholder="How do you deliver media?"></textarea>
                                    </div>
                                    <div>
                                        <label style={{fontWeight:'bold', color: '#e67e22'}}>📞 Contact Page Details</label>
                                        <textarea value={policyData.contact} onChange={e => setPolicyData({...policyData, contact: e.target.value})} className="custom-admin-input" rows="6" style={{resize:'vertical', marginTop: '5px', color: '#000', fontWeight: '500'}} placeholder="Address, Email, Phone..."></textarea>
                                    </div>
                                </div>
                                <div>
                                    <label style={{fontWeight:'bold', color: '#2ecc71'}}>🤝 Why choose Snevio? (USP Section)</label>
                                    <textarea value={policyData.bestForYou} onChange={e => setPolicyData({...policyData, bestForYou: e.target.value})} className="custom-admin-input" rows="3" style={{marginTop: '5px', color: '#000', fontWeight: '500'}} placeholder="What makes Snevio best?"></textarea>
                                </div>
                                <button type="submit" className="global-update-btn" style={{background:'#e74c3c', padding: '15px', fontSize: '16px'}}>💾 UPDATE ALL POLICIES</button>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === 'CAREERS' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>💼 Manage Job Vacancies</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '700px', margin: '0 auto 30px' }}>
                            <h3 style={{marginTop: 0, color: '#27ae60'}}>Post a New Opening</h3>
                            <form onSubmit={handleAddJob} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                                <div style={{display:'flex', gap:'10px'}}>
                                    <div style={{flex: 2}}>
                                        <label style={{fontSize: '12px', fontWeight:'bold', color: '#333'}}>Role Title</label>
                                        <input type="text" placeholder="e.g. Senior Video Editor" required value={newJob.role} onChange={e=>setNewJob({...newJob, role:e.target.value})} className="custom-admin-input" style={{marginTop:'5px', color: '#000', fontWeight: '500'}}/>
                                    </div>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '12px', fontWeight:'bold', color: '#333'}}>Job Type</label>
                                        <select value={newJob.type} onChange={e=>setNewJob({...newJob, type:e.target.value})} className="custom-admin-input" style={{marginTop:'5px', color: '#000', fontWeight: '500'}}>
                                            <option value="Long Term">Long Term</option>
                                            <option value="Short Term">Short Term (Gig)</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{display:'flex', gap:'10px'}}>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '12px', fontWeight:'bold', color: '#333'}}>Time/Shift</label>
                                        <input type="text" placeholder="e.g. 10AM - 7PM" value={newJob.time} onChange={e=>setNewJob({...newJob, time:e.target.value})} className="custom-admin-input" style={{marginTop:'5px', color: '#000', fontWeight: '500'}}/>
                                    </div>
                                    <div style={{flex: 1}}>
                                        <label style={{fontSize: '12px', fontWeight:'bold', color: '#333'}}>Salary/Budget</label>
                                        <input type="text" placeholder="e.g. ₹25k - ₹40k" value={newJob.salary} onChange={e=>setNewJob({...newJob, salary:e.target.value})} className="custom-admin-input" style={{marginTop:'5px', color: '#000', fontWeight: '500'}}/>
                                    </div>
                                </div>
                                <div style={{display:'flex', alignItems:'center', gap:'10px', background: '#fff9c4', padding: '10px', borderRadius: '8px'}}>
                                    <input type="checkbox" id="urgentCheck" checked={newJob.urgent} onChange={e=>setNewJob({...newJob, urgent:e.target.checked})} style={{width:'18px', height:'18px'}} /> 
                                    <label htmlFor="urgentCheck" style={{fontWeight:'bold', cursor:'pointer', color: '#e67e22'}}>Mark as URGENT Hiring 🔥</label>
                                </div>
                                <div>
                                    <label style={{fontSize: '12px', fontWeight:'bold', color: '#333'}}>Job Description (Optional)</label>
                                    <textarea placeholder="Write job requirements..." value={newJob.description} onChange={e=>setNewJob({...newJob, description:e.target.value})} className="custom-admin-input" rows="3" style={{marginTop:'5px', color: '#000', fontWeight: '500'}}></textarea>
                                </div>
                                <button type="submit" disabled={loading} className="global-update-btn" style={{background:'#27ae60', padding:'15px'}}>{loading ? 'Posting...' : '🚀 PUBLISH VACANCY'}</button>
                            </form>
                        </div>

                        <div className="data-table-container">
                            <h3 style={{padding: '15px', color: '#2c3e50', fontWeight: 'bold'}}>📋 Current Job Openings</h3>
                            <table className="admin-table" style={{color: '#333'}}>
                                <thead><tr><th style={{color: '#2c3e50'}}>Role</th><th style={{color: '#2c3e50'}}>Type</th><th style={{color: '#2c3e50'}}>Salary</th><th style={{color: '#2c3e50'}}>Action</th></tr></thead>
                                <tbody>
                                    {vacancies.length > 0 ? vacancies.map(v => (
                                        <tr key={v._id}>
                                            <td><strong>{v.role}</strong> {v.urgent && <span style={{color:'red', fontSize:'10px', fontWeight:'bold'}}>URGENT</span>}</td>
                                            <td>{v.type}</td>
                                            <td>{v.salary || 'Not Mentioned'}</td>
                                            <td><button onClick={()=>handleDeleteJob(v._id)} className="pdf-btn" style={{background:'#e74c3c', padding:'5px 10px'}}>Remove</button></td>
                                        </tr>
                                    )) : <tr><td colSpan="4" style={{textAlign:'center', padding:'20px', color:'#999'}}>No jobs posted yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'INCOME' && (
                    <div className="view-section">
                        <div className="section-header">
                            <h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>💰 Financial & Payout Overview</h2>
                            <button className="refresh-btn" onClick={fetchPayouts} disabled={fetchingPayouts} style={{padding: '8px 15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
                                {fetchingPayouts ? 'Refreshing...' : '🔄 Refresh Data'}
                            </button>
                        </div>
                        
                        {/* 📊 PLATFORM EARNINGS STATS */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                            <div className="stat-card green" style={{ padding: '25px', textAlign: 'center' }}>
                                <p style={{ color: '#555', fontWeight: 'bold', margin: '0 0 10px 0' }}>Total Platform Earnings</p>
                                <h3 style={{ fontSize: '35px', color: '#27ae60', margin: 0 }}>₹ {incomeData.total.toLocaleString()}</h3>
                                <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>Estimated Value from Active Accounts</p>
                            </div>
                            <div className="stat-card blue" style={{ padding: '25px', textAlign: 'center', background: '#fdf2e9', border: '1px solid #f39c12' }}>
                                <p style={{ color: '#d35400', fontWeight: 'bold', margin: '0 0 10px 0' }}>Pending Payouts</p>
                                <h3 style={{ fontSize: '35px', color: '#e67e22', margin: 0 }}>
                                    ₹ {payoutRequests.filter(p => p.status === 'Pending').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                                </h3>
                                <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>Needs to be cleared</p>
                            </div>
                        </div>

                        {/* 🏦 PAYOUT REQUESTS TABLE */}
                        <h3 style={{ padding: '15px 0', color: '#2c3e50', fontWeight: 'bold', borderBottom: '2px solid #eee', margin: 0 }}>🏦 Studio Payout Requests</h3>
                        <p style={{fontSize: '12px', color: '#777', marginBottom: '20px'}}>Approve requests after transferring money to their UPI ID from your bank app.</p>
                        
                        <div className="data-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Studio Details</th><th>UPI ID (Pay Here)</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {payoutRequests.length > 0 ? payoutRequests.map((req, idx) => (
                                        <tr key={idx} style={{ background: req.status === 'Pending' ? '#fffdf5' : 'transparent' }}>
                                            <td>
                                                <strong style={{color: '#2c3e50'}}>{req.studioName}</strong><br/>
                                                <span style={{fontSize: '11px', color: '#7f8c8d'}}>{req.studioMobile}</span><br/>
                                                <span style={{fontSize: '10px', color: '#aaa'}}>{new Date(req.requestedAt).toLocaleDateString()}</span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8f9fa', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}>
                                                    <strong style={{ color: '#8e44ad', fontSize: '13px' }}>{req.upiId}</strong>
                                                    <button onClick={() => { navigator.clipboard.writeText(req.upiId); alert("UPI ID Copied!"); }} style={{ background: '#3498db', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>Copy</button>
                                                </div>
                                            </td>
                                            <td><strong style={{ color: '#e67e22', fontSize: '16px' }}>₹{req.amount}</strong></td>
                                            <td>
                                                <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '15px', color: '#fff', background: req.status === 'Approved' ? '#2ecc71' : (req.status === 'Rejected' ? '#e74c3c' : '#f1c40f') }}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                                                {req.status === 'Pending' ? (
                                                    <>
                                                        <button onClick={() => handleProcessPayout(req._id, 'Approved')} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>✅ Mark Approved</button>
                                                        <button onClick={() => handleProcessPayout(req._id, 'Rejected')} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}>❌ Reject (Refund)</button>
                                                    </>
                                                ) : (
                                                    <span style={{ fontSize: '10px', color: '#777' }}>Processed: {new Date(req.processedAt).toLocaleDateString()}</span>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#888'}}>No withdrawal requests yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'SUB_ADMIN' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>🧑‍💼 Manage Sub-Admins</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '500px', margin: '0 auto' }}>
                            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>Sub-admins have limited access to manage user data.</p>
                            <form onSubmit={handleCreateSubAdmin} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                <div><label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Name</label><input type="text" required placeholder="Enter Sub-Admin Name" value={subAdmin.name} onChange={e => setSubAdmin({...subAdmin, name: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleCreateSubAdmin)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}} /></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Mobile Number</label><input type="number" required placeholder="Enter 10-digit number" value={subAdmin.mobile} onChange={e => setSubAdmin({...subAdmin, mobile: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleCreateSubAdmin)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}}/></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Email (Optional)</label><input type="email" placeholder="example@email.com" value={subAdmin.email} onChange={e => setSubAdmin({...subAdmin, email: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleCreateSubAdmin)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}}/></div>
                                <div><label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Password</label><input type="text" required placeholder="Set a secure password" value={subAdmin.password} onChange={e => setSubAdmin({...subAdmin, password: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleCreateSubAdmin)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}}/></div>
                                <button type="submit" className="global-update-btn" style={{ background: '#27ae60', padding: '15px', marginTop:'10px' }}>+ Add Sub-Admin</button>
                            </form>
                        </div>
                    </div>
                )}

                {activeTab === 'SETTINGS' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>⚙️ Admin Profile Settings</h2></div>
                        <div className="update-creation-container" style={{ maxWidth: '500px', margin: '0 auto' }}>
                            <form onSubmit={handleUpdateAdminProfile} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                                <div><label style={{color: '#333', fontWeight: 'bold'}}>Admin Name</label><input type="text" placeholder="Update your name" value={adminProfile.name} onChange={e => setAdminProfile({...adminProfile, name: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleUpdateAdminProfile)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}}/></div>
                                <div><label style={{color: '#333', fontWeight: 'bold'}}>Email Address</label><input type="email" placeholder="Update email" value={adminProfile.email} onChange={e => setAdminProfile({...adminProfile, email: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleUpdateAdminProfile)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}}/></div>
                                <div><label style={{color: '#333', fontWeight: 'bold'}}>New Password</label><input type="password" placeholder="Leave blank to keep current password" value={adminProfile.password} onChange={e => setAdminProfile({...adminProfile, password: e.target.value})} onKeyDown={(e) => handleKeyDown(e, handleUpdateAdminProfile)} className="custom-admin-input" style={{color: '#000', fontWeight: '500'}}/></div>
                                <button type="submit" className="global-update-btn" style={{padding: '15px', marginTop:'10px'}}>💾 Save Profile Details</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 🔴 TAB: MY STORAGE (CLOUD MANAGER) */}
                {activeTab === 'STORAGE' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>☁️ Manage Cloud Storage</h2></div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Connect multiple cloud providers. Only one account can be ACTIVE for new uploads. Data stays safe across all linked accounts.</p>

                        {/* CONNECTED ACCOUNTS GRID */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                            {storageAccounts.map(acc => {
                                const usagePercent = Math.min((acc.usedStorageGB / acc.maxLimitGB) * 100, 100).toFixed(1);
                                const isCritical = usagePercent > 90;
                                
                                // 🔥 THE MAGIC: Check routing assignments
                                const isFreeRoute = cloudRoutingForm.freeCloudId === acc._id;
                                const isPaidRoute = cloudRoutingForm.paidCloudId === acc._id;

                                return (
                                    <div key={acc._id} style={{ background: '#fff', border: acc.isActive ? '2px solid #2ecc71' : '1px solid #ddd', borderRadius: '10px', padding: '15px', position: 'relative', marginTop: '10px', boxShadow: acc.isActive ? '0 5px 15px rgba(46,204,113,0.2)' : '0 2px 5px rgba(0,0,0,0.05)' }}>
                                        
                                        {/* 🔥 MULTIPLE BADGES FOR ROUTING STATUS */}
                                        <div style={{ position: 'absolute', top: '-12px', right: '10px', display: 'flex', gap: '5px', zIndex: 5 }}>
                                            {isFreeRoute && <span style={{ background: '#7f8c8d', color: '#fff', padding: '3px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>🆓 FREE ROUTE</span>}
                                            {isPaidRoute && <span style={{ background: '#f39c12', color: '#fff', padding: '3px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>💎 PAID ROUTE</span>}
                                            {acc.isActive && <span style={{ background: '#2ecc71', color: '#fff', padding: '3px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>🟢 DEFAULT</span>}
                                        </div>
                                        
                                        <h3 style={{ margin: '0 0 5px 0', color: '#2c3e50', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px' }}>{acc.provider === 'CLOUDINARY' ? '☁️' : '📦'} {acc.nickname}</h3>
                                        <p style={{ fontSize: '11px', color: '#7f8c8d', margin: '0 0 15px 0', fontWeight: 'bold' }}>Provider: {acc.provider}</p>

                                        <div style={{ marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: isCritical ? '#e74c3c' : '#34495e', marginBottom: '5px' }}>
                                                <span>Used: {acc.usedStorageGB}GB</span>
                                                <span>{usagePercent}% of {acc.maxLimitGB}GB</span>
                                            </div>
                                            <div style={{ width: '100%', background: '#eee', height: '8px', borderRadius: '5px', overflow: 'hidden' }}>
                                                <div style={{ width: `${usagePercent}%`, background: isCritical ? '#e74c3c' : (acc.isActive ? '#2ecc71' : '#3498db'), height: '100%' }}></div>
                                            </div>
                                            {isCritical && <p style={{ fontSize: '10px', color: '#e74c3c', margin: '5px 0 0 0', fontWeight: 'bold' }}>CRITICAL: Switch account advised!</p>}
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            {!acc.isActive ? (
                                                <button onClick={() => handleSetActiveStorage(acc._id)} style={{ flex: 1, background: '#3498db', color: '#fff', border: 'none', padding: '8px', borderRadius: '5px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Make Active</button>
                                            ) : (
                                                <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(46,204,113,0.1)', color: '#27ae60', borderRadius: '5px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #2ecc71' }}>Receiving Data</div>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                <button onClick={() => handleEditCloud(acc)} style={{ background: '#3498db', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>✏️ Edit Config</button>
                                                <button onClick={() => handleWipeSpecificCloud(acc._id, acc.nickname)} style={{ background: '#000', color: '#e74c3c', border: '1px solid #e74c3c', padding: '5px 10px', borderRadius: '5px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>💣 Wipe All Data</button>
                                                <button onClick={() => handleDeleteStorage(acc._id)} style={{ background: '#e74c3c', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '5px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>🗑️ Unlink Cloud</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 🚦 SMART CLOUD ROUTING & LIMITS */}
                        <div className="update-creation-container" style={{ maxWidth: '800px', margin: '0 auto 30px', background: '#fdf2e9', border: '1px solid #e67e22', borderTop: '5px solid #d35400' }}>
                            <h3 style={{ marginTop: 0, color: '#d35400' }}>🚦 Free vs Paid - Smart Cloud Routing</h3>
                            <p style={{ fontSize: '13px', color: '#555', marginBottom: '20px' }}>Control where data is saved and limit file sizes based on the Studio's subscription tier.</p>
                            
                            <form onSubmit={handleSaveCloudRouting} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #ccc' }}>
                                        <h4 style={{ margin: '0 0 10px 0', color: '#7f8c8d' }}>🆓 FREE Studios</h4>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Assign Cloud Account</label>
                                        <select value={cloudRoutingForm.freeCloudId} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, freeCloudId: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px', marginTop:'5px'}}>
                                            <option value="">-- Use Default Active Route --</option>
                                            {storageAccounts.map(acc => <option key={acc._id} value={acc._id}>{acc.nickname} ({acc.provider})</option>)}
                                        </select>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Upload Method (Logic)</label>
                                        <select value={cloudRoutingForm.freeUploadLogic} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, freeUploadLogic: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px', marginTop:'5px', color: '#8e44ad', fontWeight: 'bold'}}>
                                            <option value="STREAM">Proxy Stream (Safe, with Limits & Watermarks)</option>
                                            <option value="DIRECT">Direct Cloud (Fast, No limits, No Watermarks)</option>
                                        </select>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Max File Size Limit (MB)</label>
                                        <input type="number" required value={cloudRoutingForm.freeMaxFileMB} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, freeMaxFileMB: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px', marginTop:'5px'}} />
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Total Free Storage limit (GB)</label>
                                        <input type="number" required value={cloudRoutingForm.defaultFreeStorageGB} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, defaultFreeStorageGB: e.target.value})} className="custom-admin-input" style={{marginTop:'5px'}} />
                                    </div>

                                    <div style={{ flex: 1, background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #f1c40f' }}>
                                        <h4 style={{ margin: '0 0 10px 0', color: '#f39c12' }}>💎 PAID (Premium/VIP) Studios</h4>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Assign Cloud Account</label>
                                        <select value={cloudRoutingForm.paidCloudId} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, paidCloudId: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px', marginTop:'5px'}}>
                                            <option value="">-- Use Default Active Route --</option>
                                            {storageAccounts.map(acc => <option key={acc._id} value={acc._id}>{acc.nickname} ({acc.provider})</option>)}
                                        </select>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Upload Method (Logic)</label>
                                        <select value={cloudRoutingForm.paidUploadLogic} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, paidUploadLogic: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px', marginTop:'5px', color: '#27ae60', fontWeight: 'bold'}}>
                                            <option value="DIRECT">Direct Cloud (Fast, No limits, No Watermarks)</option>
                                            <option value="STREAM">Proxy Stream (Safe, with Limits & Watermarks)</option>
                                        </select>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Max File Size Limit (MB)</label>
                                        <input type="number" required value={cloudRoutingForm.paidMaxFileMB} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, paidMaxFileMB: e.target.value})} className="custom-admin-input" style={{marginTop:'5px'}} />
                                    </div>

                                    {/* 🔥 NEW: ADMIN CLOUD ROUTE */}
                                    <div style={{ flex: 1, background: '#fff', padding: '15px', borderRadius: '8px', border: '2px solid #e74c3c', minWidth: '200px' }}>
                                        <h4 style={{ margin: '0 0 10px 0', color: '#c0392b' }}>👑 ADMIN / OWNER</h4>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Assign Cloud Account</label>
                                        <select value={cloudRoutingForm.adminCloudId} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, adminCloudId: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px', marginTop:'5px'}}>
                                            <option value="">-- Fallback to Paid Route --</option>
                                            {storageAccounts.map(acc => <option key={acc._id} value={acc._id}>{acc.nickname} ({acc.provider})</option>)}
                                        </select>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Upload Method (Logic)</label>
                                        <select value={cloudRoutingForm.adminUploadLogic} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, adminUploadLogic: e.target.value})} className="custom-admin-input" style={{marginBottom:'10px', marginTop:'5px', color: '#e74c3c', fontWeight: 'bold'}}>
                                            <option value="DIRECT">Direct Cloud (Fast, No limits, No Watermarks)</option>
                                            <option value="STREAM">Proxy Stream (Safe, with Limits)</option>
                                        </select>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Max File Size Limit (MB)</label>
                                        <input type="number" required value={cloudRoutingForm.adminMaxFileMB} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, adminMaxFileMB: e.target.value})} className="custom-admin-input" style={{marginTop:'5px'}} />
                                    </div>

                                    {/* 🔥 NEW: ADMIN CONTROL FOR RAM BATCH LIMIT */}
                                    <div style={{ flex: '1 1 100%', background: '#fdfefe', padding: '15px', borderRadius: '8px', border: '1px dashed #e74c3c' }}>
                                        <h4 style={{ margin: '0 0 10px 0', color: '#c0392b' }}>🛑 Anti-Crash RAM Protector</h4>
                                        <label style={{fontSize:'12px', fontWeight:'bold'}}>Max Batch Upload Limit (GB per request)</label>
                                        <input type="number" step="0.1" required value={cloudRoutingForm.maxBatchSizeGB} onChange={e=>setCloudRoutingForm({...cloudRoutingForm, maxBatchSizeGB: e.target.value})} className="custom-admin-input" style={{marginTop:'5px', fontWeight: 'bold', color: '#e74c3c'}} />
                                        <p style={{fontSize: '11px', color: '#777', margin: '3px 0 0 0'}}>Set the total GB allowed per upload batch. Prevents user browsers & your server from running "Out of Memory" (Recommended: 1.5 to 2.5 GB).</p>
                                    </div>

                                </div>
                                <button type="submit" disabled={loading} className="global-update-btn" style={{ background: '#d35400', padding: '15px', fontSize: '15px', fontWeight: 'bold' }}>
                                    {loading ? 'Saving...' : '💾 Save Smart Routing Rules'}
                                </button>
                            </form>
                        </div>

                        {/* ADD NEW ACCOUNT FORM */}
                        <div id="storage-form-top" className="update-creation-container" style={{ maxWidth: '600px', margin: '0' }}>
                            <h3 style={{ marginTop: 0, color: '#27ae60' }}>➕ Link New Cloud Account</h3>
                            <form onSubmit={handleAddStorage} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Storage Nickname</label>
                                    <input type="text" placeholder="e.g. My Free Cloudinary 2" required value={storageForm.nickname} onChange={e=>setStorageForm({...storageForm, nickname:e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: 'bold'}}/>
                                </div>
                                
                                <div style={{display:'flex', gap:'15px'}}>
                                    <div style={{flex: 1}}>
                                        <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Cloud Provider</label>
                                        <select value={storageForm.provider} onChange={e=>setStorageForm({...storageForm, provider:e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: 'bold'}}>
                                            <option value="CLOUDINARY">Cloudinary (Free Tier)</option>
                                            <option value="AWS_S3">Amazon AWS S3</option>
                                            <option value="CLOUDFLARE_R2">Cloudflare R2</option>
                                            <option value="MEGA">Mega.nz (20GB Free)</option>
                                            <option value="STORJ">Storj Cloud (25GB Free)</option>
                                            <option value="IMGBB">Infinite Image Cloud (Unlimited Photos)</option>
                                        </select>
                                    </div>
                                    <div style={{flex: 1}}>
                                        <label style={{fontWeight:'bold', fontSize:'13px', color: '#333'}}>Max Limit (GB)</label>
                                        <input type="number" placeholder="e.g. 5" required value={storageForm.maxLimitGB} onChange={e=>setStorageForm({...storageForm, maxLimitGB:e.target.value})} className="custom-admin-input" style={{color: '#000', fontWeight: 'bold'}}/>
                                    </div>
                                </div>

                                <div style={{ background: '#f4f6f9', padding: '15px', borderRadius: '8px', border: '1px dashed #3498db' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#2980b9' }}>🔐 Secret API Credentials</h4>
                                    {storageForm.provider === 'CLOUDINARY' ? (
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                            <div><label style={{fontSize:'12px', color: '#555', fontWeight: 'bold'}}>Cloud Name</label><input type="text" required value={storageForm.credentials.cloudName} onChange={e=>setStorageForm({...storageForm, credentials:{...storageForm.credentials, cloudName: e.target.value}})} className="custom-admin-input" style={{padding: '8px', color: '#000'}}/></div>
                                            <div><label style={{fontSize:'12px', color: '#555', fontWeight: 'bold'}}>API Key</label><input type="text" required value={storageForm.credentials.apiKey} onChange={e=>setStorageForm({...storageForm, credentials:{...storageForm.credentials, apiKey: e.target.value}})} className="custom-admin-input" style={{padding: '8px', color: '#000'}}/></div>
                                            <div><label style={{fontSize:'12px', color: '#555', fontWeight: 'bold'}}>API Secret</label><input type="password" required value={storageForm.credentials.apiSecret} onChange={e=>setStorageForm({...storageForm, credentials:{...storageForm.credentials, apiSecret: e.target.value}})} className="custom-admin-input" style={{padding: '8px', color: '#000'}}/></div>
                                        </div>
                                    ) : (
                                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                            <div><label style={{fontSize:'12px', color: '#555', fontWeight: 'bold'}}>Bucket Name</label><input type="text" required value={storageForm.credentials.bucketName} onChange={e=>setStorageForm({...storageForm, credentials:{...storageForm.credentials, bucketName: e.target.value}})} className="custom-admin-input" style={{padding: '8px', color: '#000'}}/></div>
                                            <div><label style={{fontSize:'12px', color: '#555', fontWeight: 'bold'}}>Region</label><input type="text" required value={storageForm.credentials.region} onChange={e=>setStorageForm({...storageForm, credentials:{...storageForm.credentials, region: e.target.value}})} className="custom-admin-input" style={{padding: '8px', color: '#000'}}/></div>
                                            <div><label style={{fontSize:'12px', color: '#555', fontWeight: 'bold'}}>Access Key ID</label><input type="text" required value={storageForm.credentials.apiKey} onChange={e=>setStorageForm({...storageForm, credentials:{...storageForm.credentials, apiKey: e.target.value}})} className="custom-admin-input" style={{padding: '8px', color: '#000'}}/></div>
                                            <div><label style={{fontSize:'12px', color: '#555', fontWeight: 'bold'}}>Secret Access Key</label><input type="password" required value={storageForm.credentials.apiSecret} onChange={e=>setStorageForm({...storageForm, credentials:{...storageForm.credentials, apiSecret: e.target.value}})} className="custom-admin-input" style={{padding: '8px', color: '#000'}}/></div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fdfefe', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}>
                                    <input type="checkbox" id="setActive" checked={storageForm.setAsActive} onChange={e=>setStorageForm({...storageForm, setAsActive: e.target.checked})} style={{width: '18px', height: '18px', cursor: 'pointer'}}/>
                                    <label htmlFor="setActive" style={{fontWeight: 'bold', cursor: 'pointer', color: '#27ae60'}}>Make this Active Storage immediately</label>
                                </div>

                                <button type="submit" disabled={loading} className="global-update-btn" style={{ background: '#2ecc71', padding: '15px', fontSize: '15px' }}>
                                    {loading ? 'Linking...' : '💾 Link Storage Account'}
                                </button>
                            </form>
                        </div>
                    </div>
                )} 
                {/* 🔴 TAB: STUDIO STORAGE PLANS */}
                {activeTab === 'STUDIO_PLANS' && (
                    <div className="view-section">
                        <div className="section-header"><h2 style={{color: '#2c3e50', fontWeight: 'bold'}}>🗄️ Studio Storage Management</h2></div>
                        <p style={{fontSize: '13px', color: '#666', marginBottom: '20px'}}>Create custom cloud storage plans and assign them to your registered studios.</p>

                        {/* ✅ CREATE / EDIT PLAN FORM */}
                        <div id="plan-form-section" className="update-creation-container" style={{ maxWidth: '800px', margin: '0 auto 30px', borderTop: '4px solid #8e44ad' }}>
                            <h3 style={{ margin: '0 0 15px 0', color: '#8e44ad' }}>{subPlanForm.id ? '✏️ Edit Storage Plan' : '➕ Create New Storage Plan'}</h3>
                            <form onSubmit={handleSaveSubPlan} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{ flex: 1 }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Plan Name (e.g. Elite Plan)</label><input type="text" required placeholder="Name visible to Studio" value={subPlanForm.planName} onChange={e => setSubPlanForm({...subPlanForm, planName: e.target.value})} className="custom-admin-input"/></div>
                                    <div style={{ flex: 1 }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Total Storage Limit (GB)</label><input type="number" required placeholder="e.g. 500" value={subPlanForm.storageLimitGB} onChange={e => setSubPlanForm({...subPlanForm, storageLimitGB: e.target.value})} className="custom-admin-input"/></div>
                                </div>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                    <div style={{ flex: 1 }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Monthly Price (₹)</label><input type="number" required placeholder="e.g. 999" value={subPlanForm.monthlyPrice} onChange={e => setSubPlanForm({...subPlanForm, monthlyPrice: e.target.value})} className="custom-admin-input"/></div>
                                    <div style={{ flex: 1 }}><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Yearly Price (₹)</label><input type="number" placeholder="Optional discounted price" value={subPlanForm.yearlyPrice} onChange={e => setSubPlanForm({...subPlanForm, yearlyPrice: e.target.value})} className="custom-admin-input"/></div>
                                </div>
                                <div style={{ display: 'flex', gap: '15px', background: '#fdf2e9', padding: '10px', borderRadius: '8px', border: '1px solid #f39c12' }}>
                                    <div style={{ flex: 1 }}><label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d35400' }}>Discount (%)</label><input type="number" placeholder="e.g. 20" value={subPlanForm.discountPercentage} onChange={e => setSubPlanForm({...subPlanForm, discountPercentage: e.target.value})} className="custom-admin-input" style={{marginBottom:0}}/></div>
                                    <div style={{ flex: 2 }}><label style={{ fontSize: '12px', fontWeight: 'bold', color: '#d35400' }}>Offer Tag (Badge Text)</label><input type="text" placeholder="e.g. Save 30% Today!" value={subPlanForm.offerText} onChange={e => setSubPlanForm({...subPlanForm, offerText: e.target.value})} className="custom-admin-input" style={{marginBottom:0}}/></div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Plan Features (Comma Separated)</label>
                                    <textarea rows="2" placeholder="e.g. High Speed Upload, Unlimited Event Subfolders, 24/7 Priority Support" value={subPlanForm.features} onChange={e => setSubPlanForm({...subPlanForm, features: e.target.value})} className="custom-admin-input"></textarea>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {subPlanForm.id && <button type="button" onClick={() => setSubPlanForm({ id: null, planName: '', storageLimitGB: '', monthlyPrice: '', yearlyPrice: '', discountPercentage: '', offerText: '', features: '' })} style={{ background: '#95a5a6', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>}
                                    <button type="submit" disabled={loading} style={{ flex: 1, background: subPlanForm.id ? '#2ecc71' : '#8e44ad', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                        {loading ? 'Saving...' : (subPlanForm.id ? '💾 Update Custom Plan' : '🚀 Publish New Storage Plan')}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* ✅ LIVE PLANS TABLE */}
                        <h3 style={{ color: '#2c3e50', padding: '15px 0 5px', margin: 0, borderBottom: '2px solid #eee' }}>🏷️ Custom Packages (Available for Studios)</h3>
                        <div className="data-table-container" style={{ marginBottom: '40px' }}>
                            <table className="admin-table">
                                <thead><tr><th>Plan Details</th><th>Capacity</th><th>Pricing (Mo / Yr)</th><th>Perks</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {subPlans.map((plan, idx) => (
                                        <tr key={idx}>
                                            <td><strong>{plan.planName}</strong><br/>{plan.offerText && <span style={{fontSize:'9px', background:'#e74c3c', color:'#fff', padding:'2px 4px', borderRadius:'3px', fontWeight:'bold'}}>{plan.offerText}</span>}</td>
                                            <td><strong style={{color:'#2980b9'}}>{plan.storageLimitGB} GB</strong></td>
                                            <td style={{fontSize:'12px'}}>
                                                <strong>₹{plan.monthlyPrice}</strong> /mo <br/>
                                                {plan.yearlyPrice > 0 && <span style={{color: '#8e44ad'}}><strong>₹{plan.yearlyPrice}</strong> /yr</span>} 
                                                {plan.discountPercentage > 0 && <span style={{color:'#27ae60', marginLeft:'5px'}}>{plan.discountPercentage}% OFF</span>}
                                            </td>
                                            <td style={{fontSize:'11px', color:'#555', maxWidth:'200px'}}>{plan.features.join(', ')}</td>
                                            <td>
                                                <button onClick={() => editSubPlan(plan)} style={{background: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', marginRight: '5px', fontSize:'11px'}}>Edit</button>
                                                <button onClick={() => handleDeleteSubPlan(plan._id)} style={{background: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize:'11px'}}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {subPlans.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:'15px', color:'#777'}}>No Custom Plans Added Yet. Create one above!</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        {/* ✅ ASSIGN TO STUDIOS TABLE */}
                        <h3 style={{ color: '#2c3e50', padding: '15px 0 5px', margin: 0, borderBottom: '2px solid #eee' }}>🧑‍💼 Active Studios Usage & Limits</h3>
                        <div className="data-table-container" style={{ marginTop: '10px' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Studio Name</th><th>Mobile</th><th>Current Assigned Plan</th><th>Storage Capacity Used</th><th>Action</th></tr>
                                </thead>
                                <tbody>
                                    {accounts.filter(a => a.role === 'STUDIO').map((studio, index) => {
                                        const allocated = studio.allocatedStorageGB || 5;
                                        const used = studio.usedStorageGB || 0;
                                        const percent = Math.min((used / allocated) * 100, 100).toFixed(1);
                                        const isFull = percent > 95;
                                        
                                        return (
                                            <tr key={index}>
                                                <td><strong style={{color: '#2c3e50'}}>{studio.studioName || studio.ownerName}</strong></td>
                                                <td>{studio.mobile}</td>
                                                <td>
                                                    <span style={{ fontSize: '11px', background: studio.storagePlan === 'CUSTOM' ? '#f39c12' : (studio.storagePlan === 'FREE' ? '#7f8c8d' : '#8e44ad'), color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                        {studio.storagePlan || 'FREE'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '120px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: isFull ? '#e74c3c' : '#7f8c8d', fontWeight: 'bold' }}>
                                                            <span>{used.toFixed(2)}GB</span>
                                                            <span>{allocated}GB</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '5px', background: '#ecf0f1', borderRadius: '5px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${percent}%`, height: '100%', background: isFull ? '#e74c3c' : '#2ecc71' }}></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <button onClick={() => { 
                                                        setEditingStudioPlan(studio); 
                                                        setNewStudioPlan(studio.storagePlan || 'FREE'); 
                                                        setCustomLimitGB(studio.allocatedStorageGB || 5); 
                                                    }} style={{background: '#34495e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '5px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold'}}>
                                                        ⚙️ Override
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {accounts.filter(a => a.role === 'STUDIO').length === 0 && (
                                        <tr><td colSpan="5" style={{textAlign: 'center', padding: '20px', color: '#888'}}>No Studios Registered Yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🏢 STUDIO PLAN OVERRIDE MODAL (DYNAMICS PLANS) */}
                {editingStudioPlan && (
                    <div className="popup-overlay-fixed" style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter: 'blur(5px)'}}>
                        <div style={{background:'#1a1a2e', padding:'25px', borderRadius:'15px', width:'90%', maxWidth:'400px', border: '1px solid #2ecc71', boxShadow:'0 20px 50px rgba(0,0,0,0.5)'}}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h2 style={{color:'#2ecc71', margin: 0}}>Upgrade Storage</h2>
                                <button onClick={() => setEditingStudioPlan(null)} style={{background:'transparent', color:'#fff', border:'none', fontSize:'20px', cursor:'pointer'}}>✖</button>
                            </div>
                            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '20px' }}>Adjust storage limit for: <strong style={{ color: '#fff' }}>{editingStudioPlan.name || editingStudioPlan.studioName}</strong></p>

                            <form onSubmit={handleUpdateStudioPlan} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <label style={{color: '#aaa', fontSize: '12px'}}>Select New Plan to Assign</label>
                                    <select value={newStudioPlan} onChange={e => setNewStudioPlan(e.target.value)} className="custom-admin-input" style={{ marginTop: '5px' }}>
                                        <option value="FREE">FREE Plan (Default 5 GB)</option>
                                        {/* Dynamically list created plans */}
                                        {subPlans.map(p => (
                                            <option key={p._id} value={p.planName}>{p.planName} ({p.storageLimitGB} GB)</option>
                                        ))}
                                        <option value="CUSTOM">MANUAL / CUSTOM OVERRIDE</option>
                                    </select>
                                </div>

                                {/* Custom Days Expiry (Optional override from Admin) */}
                                <div>
                                    <label style={{color: '#aaa', fontSize: '12px'}}>Add Expiry to Plan? (Optional)</label>
                                    <input type="number" id="manualExpiryInput" placeholder="Days to Expire (e.g. 30)" className="custom-admin-input" style={{ marginTop: '5px' }} />
                                    <p style={{fontSize:'10px', color:'#777', margin:'3px 0 0 0'}}>Leave blank for no expiry. If set, cron-job will auto downgrade them back to Free.</p>
                                </div>

                                {newStudioPlan === 'CUSTOM' && (
                                    <div style={{background: 'rgba(243, 156, 18, 0.1)', padding: '10px', borderRadius: '5px', borderLeft: '3px solid #f39c12'}}>
                                        <label style={{color: '#f39c12', fontSize: '12px', fontWeight:'bold'}}>Custom Storage Limit (GB)</label>
                                        <input type="number" required placeholder="e.g. 500" value={customLimitGB} onChange={e => setCustomLimitGB(e.target.value)} className="custom-admin-input" style={{ marginTop: '5px', border: '1px solid #f39c12' }} />
                                    </div>
                                )}

                                <button type="submit" disabled={loading} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '15px', borderRadius: '10px', fontSize: '15px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px' }}>
                                    {loading ? 'Saving...' : '💾 Assign Plan & Execute'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default OwnerDashboard;