import React, { useRef, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/components.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const TrendingFeed = ({ type, onClose }) => {
    const title = type === 'trending' ? '🔥 Trending Now' : '🚀 Viral Content';
    
    // 🟢 SWIPE LOGIC STATES
    const touchStartX = useRef(0);
    const [translateX, setTranslateX] = useState(0);
    const screenWidth = window.innerWidth;

    const [feedData, setFeedData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);
    
    // 🟢 READ MORE & POPUP STATES
    const [expandedTextIndex, setExpandedTextIndex] = useState(null);
    const [selectedStudio, setSelectedStudio] = useState(null);

    // 🟢 OPTIMIZATION REFS
    const observer = useRef(null);
    const viewedAds = useRef(new Set()); // To track which ads are already counted
    const videoRefs = useRef({});

    useEffect(() => {
        const fetchFeedAndAds = async () => {
            try {
                // 1. Fetch Posts
                const postRes = await axios.get(`${API_BASE}/get-public-feed?t=${Date.now()}`);
                let posts = [];
                if (postRes.data.success) {
                    posts = postRes.data.data.map(item => ({
                        ...item,
                        likes: Math.floor(Math.random() * 500) + 50,
                        isLiked: false,
                        commentsCount: Math.floor(Math.random() * 50) + 5,
                        shares: Math.floor(Math.random() * 20) + 1
                    }));
                    posts = posts.sort(() => 0.5 - Math.random()); // Shuffle posts
                }

                // 2. Fetch Targeted Ads (Getting User Context from Session)
                let userLoc = 'ALL';
                let userInt = type; // 'trending' or 'viral'
                const userStr = sessionStorage.getItem('user');
                if(userStr) {
                    const u = JSON.parse(userStr);
                    if(u.location) userLoc = u.location;
                }

                const adRes = await axios.post(`${API_BASE}/get-targeted-ads`, { userLocation: userLoc, userInterest: userInt });
                let ads = [];
                if (adRes.data.success) ads = adRes.data.data;

                // 3. 🚀 THE SMART AD INSERTION ALGORITHM (5-7 then 15-20)
                let mergedFeed = [];
                let adIndex = 0;
                let postCounter = 0;
                // Pehla ad 5 se 7 ke beech (random)
                let nextAdTarget = Math.floor(Math.random() * 3) + 5; 

                for (let i = 0; i < posts.length; i++) {
                    mergedFeed.push(posts[i]);
                    postCounter++;

                    if (postCounter === nextAdTarget && adIndex < ads.length) {
                        mergedFeed.push({ ...ads[adIndex], isAdvertisement: true });
                        adIndex++;
                        postCounter = 0;
                        // Agla ad 15 se 20 ke beech (random)
                        nextAdTarget = Math.floor(Math.random() * 6) + 15; 
                    }
                }

                setFeedData(mergedFeed);
            } catch (error) {
                console.error("Failed to load feed", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFeedAndAds();
    }, [type]);

    // 🚀 ENTERPRISE OPTIMIZATION: Intersection Observer for Video Playback & Ad Tracking
    const handleObserver = useCallback((node, index, isAd, adId) => {
        if (!observer.current) {
            observer.current = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    const idx = entry.target.dataset.index;
                    const adTargetId = entry.target.dataset.adid;
                    const isAdNode = entry.target.dataset.isad === "true";
                    
                    // 1. Memory Management: Auto Play/Pause Videos
                    const vid = videoRefs.current[idx];
                    if (vid) {
                        if (entry.isIntersecting) {
                            vid.play().catch(e => console.log("Autoplay prevented"));
                        } else {
                            vid.pause();
                        }
                    }

                    // 2. Anti-Spam Ad View Tracking (Only count if in view for > 1.5 seconds)
                    if (entry.isIntersecting && isAdNode && adTargetId && !viewedAds.current.has(adTargetId)) {
                        entry.target.viewTimer = setTimeout(() => {
                            viewedAds.current.add(adTargetId);
                            axios.post(`${API_BASE}/track-ad-view`, { adId: adTargetId }).catch(()=>console.log("Ad track failed quietly"));
                        }, 1500); // 1.5 seconds delay
                    } else if (!entry.isIntersecting && entry.target.viewTimer) {
                        clearTimeout(entry.target.viewTimer); // Cancel if user scrolls away fast
                    }
                });
            }, { threshold: 0.6 }); // 60% of item must be visible
        }
        
        if (node) {
            node.dataset.index = index;
            node.dataset.isad = isAd;
            node.dataset.adid = adId;
            observer.current.observe(node);
        }
    }, []);


    // --- SWIPE HANDLERS (ANTI-SHAKE & 30% RULE) ---
    const handleTouchStart = (e) => { touchStartX.current = e.targetTouches[0].clientX; };
    const handleTouchMove = (e) => {
        const diff = e.targetTouches[0].clientX - touchStartX.current;
        if (Math.abs(diff) < 20) return; // Anti-Shake

        if (type === 'trending' && diff > 0) setTranslateX(diff);
        else if (type === 'viral' && diff < 0) setTranslateX(diff);
    };
    const handleTouchEnd = () => {
        const threshold = screenWidth * 0.30; 
        if (type === 'trending' && translateX > threshold) onClose();
        else if (type === 'viral' && translateX < -threshold) onClose();
        else setTranslateX(0); 
    };

    // --- UTILS & INTERACTIONS ---
    const isVideo = (filename) => filename.match(/\.(mp4|mov|avi|wmv|webm)$/i);
    const getCleanUrl = (filePath) => filePath.startsWith('http') ? filePath : `https://sandn-cinema.onrender.com/${filePath}`;

    const handleLike = (index) => {
        const newData = [...feedData];
        newData[index].isLiked = !newData[index].isLiked;
        newData[index].likes += newData[index].isLiked ? 1 : -1;
        setFeedData(newData);
    };

    const handleShare = async (item) => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: item.isAdvertisement ? item.title : `Check out this shot by ${item.studioName}`,
                    text: 'Featured on SandN Cinema!',
                    url: item.isAdvertisement ? item.actionLink : getCleanUrl(item.file)
                });
            } else {
                navigator.clipboard.writeText(item.isAdvertisement ? item.actionLink : getCleanUrl(item.file));
                alert("Link copied to clipboard!");
            }
        } catch (e) { console.log(e); }
    };

    const openStudioProfile = async (mobile) => {
        try {
            const res = await axios.post(`${API_BASE}/search-account`, { mobile, roleFilter: 'STUDIO' });
            if (res.data.success) setSelectedStudio(res.data.data);
            else alert("Studio details currently unavailable.");
        } catch (e) { console.error(e); }
    };

    const handleAddToCart = (item) => {
        const userStr = sessionStorage.getItem('user');
        const serviceToBook = {
            _id: item._id || Date.now().toString(),
            title: `Premium Session by ${item.studioName || 'Featured Studio'}`,
            startingPrice: item.price || 5000, 
            addedBy: item.studioName || 'SandN Cinema',
            imageUrl: getCleanUrl(item.file)
        };

        if (userStr) {
            const currentCart = JSON.parse(localStorage.getItem('userCart')) || [];
            if (currentCart.find(c => c.title === serviceToBook.title && c.addedBy === serviceToBook.addedBy)) {
                return alert("This session is already in your cart!");
            }
            const newCart = [{ ...serviceToBook, addedAt: Date.now() }, ...currentCart];
            localStorage.setItem('userCart', JSON.stringify(newCart));
            alert(`🛒 Added to Cart!`);
        } else {
            localStorage.setItem('pendingCartItem', JSON.stringify(serviceToBook));
            alert("✨ Please sign in to add this to your cart!");
            onClose(); 
        }
    };

    const handleDirectBook = async (item) => {
        const userStr = sessionStorage.getItem('user');
        if (userStr) {
            const userObj = JSON.parse(userStr);
            if (!window.confirm(`⚡ Ready to book ${item.studioName}? Your contact details will remain hidden until accepted.`)) return;

            setBookingLoading(true);
            try {
                const res = await axios.post(`${API_BASE}/checkout-cart`, {
                    mobile: userObj.mobile,
                    items: [{
                        _id: item._id || Date.now().toString(),
                        title: `Premium Session by ${item.studioName}`,
                        startingPrice: item.price || 5000, 
                        addedBy: item.studioName,
                        imageUrl: getCleanUrl(item.file)
                    }]
                });
                
                if (res.data.success) {
                    alert(`✅ Booking Request Sent Securely! Check your Dashboard.`);
                    onClose(); 
                } else alert("Booking failed. Try again.");
            } catch (error) { alert("Server error."); } 
            finally { setBookingLoading(false); }
        } else {
            alert("✨ Please sign in to book this studio securely!");
            onClose(); 
        }
    };

    return (
        <div className="modal-overlay" style={{ background: `rgba(0,0,0, ${1 - Math.abs(translateX)/(screenWidth*1.5)})` }}>
            <div 
                className="modal-card full-screen fade-in"
                style={{
                    transform: `translateX(${translateX}px)`,
                    transition: translateX === 0 ? 'transform 0.3s ease-out' : 'none',
                    width: '100%', height: '100dvh', maxWidth: '100%', borderRadius: 0, margin: 0,
                    display: 'flex', flexDirection: 'column', background: '#000'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Header */}
                <div className="modal-header" style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)', border: 'none', position: 'absolute', top: 0, width: '100%', zIndex: 10}}>
                    <h3 style={{color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>{title}</h3>
                </div>
                
                <div className="feed-content" style={{ flex: 1, overflowY: 'auto', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth' }}>
                    
                    {loading ? (
                        <div style={{height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'}}><p>Loading magic... ✨</p></div>
                    ) : feedData.length > 0 ? (
                        feedData.map((item, index) => {
                            const fileUrl = getCleanUrl(item.file);
                            const isVid = isVideo(item.file);
                            const maxChars = 60;
                            const isExpanded = expandedTextIndex === index;
                            
                            return (
                                <div 
                                    key={index} 
                                    ref={(node) => handleObserver(node, index, !!item.isAdvertisement, item._id)}
                                    className="feed-item" 
                                    style={{ height: '100dvh', scrollSnapAlign: 'start', position: 'relative', overflow: 'hidden', background: '#111' }}
                                >
                                    
                                    {/* 📢 ADVERTISEMENT BADGE */}
                                    {item.isAdvertisement && (
                                        <div style={{ position: 'absolute', top: '70px', left: '15px', background: 'rgba(255,255,255,0.8)', color: '#000', padding: '4px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 'bold', zIndex: 15, backdropFilter: 'blur(5px)' }}>
                                            Sponsored
                                        </div>
                                    )}

                                    {/* ⏳ FOMO Expiry Timer Highlight (Top Center) */}
                                    {item.expiryDate && !item.isAdvertisement && (
                                        <div style={{ position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #e74c3c, #c0392b)', color: '#fff', padding: '6px 15px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', zIndex: 15, boxShadow: '0 4px 10px rgba(0,0,0,0.5)', border: '1px solid #fff' }}>
                                            ⏳ Offer Ends: {new Date(item.expiryDate).toLocaleDateString()}
                                        </div>
                                    )}

                                    {/* ✅ Media Layer (objectFit: contain ensures no cropping) */}
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {isVid ? (
                                            <video 
                                                ref={(el) => (videoRefs.current[index] = el)}
                                                src={fileUrl} 
                                                loop 
                                                muted 
                                                playsInline
                                                preload="metadata"
                                                style={{width:'100%', height:'100%', objectFit:'contain'}} 
                                            />
                                        ) : (
                                            <img src={fileUrl} alt={`Feed ${index}`} loading="lazy" style={{width:'100%', height:'100%', objectFit:'contain'}} />
                                        )}
                                    </div>

                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 1 }}></div>

                                    {/* Content Info (Left Bottom) */}
                                    <div style={{ position: 'absolute', bottom: '30px', left: '15px', right: '80px', zIndex: 5, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                        
                                        {/* ADVERTISEMENT VS NORMAL POST UI */}
                                        {item.isAdvertisement ? (
                                            <>
                                                <h3 style={{margin: '0 0 5px 0', fontSize: '20px', color: '#f1c40f'}}>{item.title}</h3>
                                                <button onClick={() => window.open(item.actionLink, '_blank')} style={{ background: '#3498db', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '25px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', marginTop: '10px', width: '100%', boxShadow: '0 4px 10px rgba(52, 152, 219, 0.4)' }}>
                                                    Learn More ↗️
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div onClick={() => openStudioProfile(item.studioMobile)} style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer'}}>
                                                    <div style={{width: '35px', height: '35px', borderRadius: '50%', background: 'linear-gradient(45deg, #f1c40f, #e67e22)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#000', border: '2px solid #fff'}}>
                                                        {(item.studioName || 'S')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h4 style={{margin: '0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '5px'}}>{item.studioName || 'Featured Studio'} <span style={{color: '#3498db', fontSize: '14px'}}>✔️</span></h4>
                                                        <p style={{margin: 0, fontSize: '11px', color: '#ccc'}}>Verified Creator • Click to view profile</p>
                                                    </div>
                                                </div>
                                                
                                                <p style={{margin: '0 0 10px 0', fontSize: '13px', lineHeight: '1.4', opacity: 0.9}}>
                                                    {item.description && item.description.length > maxChars && !isExpanded ? item.description.substring(0, maxChars) + '...' : (item.description || "Check out this beautiful shot! ✨")}
                                                    {item.description && item.description.length > maxChars && !isExpanded && (
                                                        <span onClick={() => setExpandedTextIndex(index)} style={{ color: '#ccc', fontWeight: 'bold', marginLeft: '5px', cursor: 'pointer' }}>Read More</span>
                                                    )}
                                                </p>

                                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                    <button onClick={() => handleAddToCart(item)} style={{ flex: 1, background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid #fff', padding: '10px 5px', borderRadius: '25px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', backdropFilter: 'blur(5px)' }}>🛒 Add to Cart</button>
                                                    <button onClick={() => handleDirectBook(item)} disabled={bookingLoading} style={{ flex: 1.5, background: 'linear-gradient(90deg, #f1c40f, #f39c12)', color: '#000', border: 'none', padding: '10px 5px', borderRadius: '25px', fontWeight: 'bold', fontSize: '12px', cursor: bookingLoading ? 'not-allowed' : 'pointer', animation: 'pulse 2s infinite' }}>
                                                        {bookingLoading ? '⏳ Wait...' : `⚡ Book @ ₹${item.price || 5000}`}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Action Bar (Right Side) */}
                                    <div style={{ position: 'absolute', bottom: '50px', right: '15px', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                                        <div onClick={() => handleLike(index)} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'}}>
                                            <div style={{fontSize: '28px', transform: item.isLiked ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s'}}>{item.isLiked ? '❤️' : '🤍'}</div>
                                            <span style={{color: '#fff', fontSize: '12px', fontWeight: 'bold', marginTop: '2px'}}>{item.likes || '1.2k'}</span>
                                        </div>
                                        {!item.isAdvertisement && (
                                            <div onClick={() => alert("Comments phase 2")} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'}}>
                                                <div style={{fontSize: '28px'}}>💬</div>
                                                <span style={{color: '#fff', fontSize: '12px', fontWeight: 'bold', marginTop: '2px'}}>{item.commentsCount || 45}</span>
                                            </div>
                                        )}
                                        <div onClick={() => handleShare(item)} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'}}>
                                            <div style={{fontSize: '28px'}}>↗️</div>
                                            <span style={{color: '#fff', fontSize: '12px', fontWeight: 'bold', marginTop: '2px'}}>{item.shares || 12}</span>
                                        </div>
                                    </div>

                                </div>
                            );
                        })
                    ) : (
                        <div style={{height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888'}}>
                            <span style={{fontSize: '50px', marginBottom: '20px'}}>📭</span><p>No content uploaded to public feed yet.</p>
                        </div>
                    )}
                    
                    {!loading && feedData.length > 0 && (
                        <div style={{position: 'absolute', top: '20px', width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.7)', zIndex: 10, fontSize: '12px', fontWeight: 'bold'}}>
                            Swipe {type === 'trending' ? 'Right 👉' : '👈 Left'} to go back
                        </div>
                    )}

                </div>
            </div>

            {/* ✅ STUDIO PROFILE POPUP MODAL */}
            {selectedStudio && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#fff', width: '90%', maxWidth: '350px', borderRadius: '20px', padding: '30px', textAlign: 'center', position: 'relative', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                        <button onClick={() => setSelectedStudio(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#eee', border: 'none', width: '30px', height: '30px', borderRadius: '50%', fontSize: '14px', cursor: 'pointer' }}>✖</button>
                        
                        <div style={{ width: '80px', height: '80px', background: 'linear-gradient(45deg, #3498db, #8e44ad)', borderRadius: '50%', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', color: '#fff', fontWeight: 'bold', border: '4px solid #fdfdfd', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                            {(selectedStudio.studioName || 'S')[0].toUpperCase()}
                        </div>
                        <h2 style={{ margin: '0 0 5px 0', color: '#2c3e50', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                            {selectedStudio.studioName} <span style={{ color: '#3498db', fontSize: '18px' }}>✔️</span>
                        </h2>
                        <p style={{ margin: '0 0 15px 0', color: '#7f8c8d', fontSize: '13px' }}>Location: {selectedStudio.location || 'India'}</p>

                        {selectedStudio.portfolioUrl ? (
                            <a href={selectedStudio.portfolioUrl.startsWith('http') ? selectedStudio.portfolioUrl : `https://${selectedStudio.portfolioUrl}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#fdf2e9', color: '#e67e22', padding: '12px', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', border: '1px solid #f8c471', marginBottom: '15px' }}>
                                🌐 View Complete Portfolio
                            </a>
                        ) : (
                            <p style={{ background: '#f4f6f7', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#95a5a6' }}>No portfolio link available.</p>
                        )}

                        <button onClick={() => setSelectedStudio(null)} style={{ width: '100%', padding: '12px', background: '#2c3e50', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Close</button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default TrendingFeed;