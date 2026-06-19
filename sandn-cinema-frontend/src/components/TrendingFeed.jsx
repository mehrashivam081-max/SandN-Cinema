import React, { useRef, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/components.css';

const API_BASE = import.meta.env.VITE_API_BASE;

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
    const viewedAds = useRef(new Set()); 
    const videoRefs = useRef({});

    useEffect(() => {
        const fetchFeedAndAds = async () => {
            try {
                // 1. Fetch Posts (Anti-Cache)
                const postRes = await axios.get(`${API_BASE}/get-public-feed?t=${Date.now()}`);
                let posts = [];
                if (postRes.data.success) {
                    // ✅ FIX 1: Filter strictly by category (trending vs viral)
                    const filteredPosts = postRes.data.data.filter(item => item.feedCategory === type || !item.feedCategory);
                    
                    // 🔥 FIX: 100% Real API Data (Removed all fake random numbers)
                    posts = filteredPosts.map(item => ({
                        ...item,
                        likes: item.likes || 0,
                        isLiked: item.isLiked || false,
                        commentsCount: item.commentsCount || 0,
                        shares: item.shares || 0
                    }));
                    posts = posts.sort(() => 0.5 - Math.random()); // Shuffle posts
                }

                // 2. Fetch Targeted Ads
                let userLoc = 'ALL';
                let userInt = type; 
                const userStr = sessionStorage.getItem('user');
                if(userStr) {
                    const u = JSON.parse(userStr);
                    if(u.location) userLoc = u.location;
                }

                const adRes = await axios.post(`${API_BASE}/get-targeted-ads`, { userLocation: userLoc, userInterest: userInt });
                let ads = [];
                if (adRes.data.success) ads = adRes.data.data;

                // 3. ✅ FIX 2: TRUE RANDOM AD ALGORITHM (Unpredictable injection)
                let mergedFeed = [];
                let adQueue = ads.sort(() => 0.5 - Math.random()); 

                posts.forEach((post, i) => {
                    mergedFeed.push(post);
                    
                    // 25% Chance to show an ad after a post (but never at the very first swipe)
                    if (i > 0 && adQueue.length > 0 && Math.random() < 0.25) {
                        mergedFeed.push({ ...adQueue.shift(), isAdvertisement: true });
                    }
                });

                // If any ads are left and posts are over, just push them at the end
                while(adQueue.length > 0) {
                    mergedFeed.push({ ...adQueue.shift(), isAdvertisement: true });
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

    // 🚀 ENTERPRISE OPTIMIZATION: Intersection Observer
    const handleObserver = useCallback((node, index, isAd, adId) => {
        if (!observer.current) {
            observer.current = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    const idx = entry.target.dataset.index;
                    const adTargetId = entry.target.dataset.adid;
                    const isAdNode = entry.target.dataset.isad === "true";
                    
                    const vid = videoRefs.current[idx];
                    if (vid) {
                        if (entry.isIntersecting) {
                            vid.play().catch(e => console.log("Autoplay prevented"));
                        } else {
                            vid.pause();
                        }
                    }

                    if (entry.isIntersecting && isAdNode && adTargetId && !viewedAds.current.has(adTargetId)) {
                        entry.target.viewTimer = setTimeout(() => {
                            viewedAds.current.add(adTargetId);
                            axios.post(`${API_BASE}/track-ad-view`, { adId: adTargetId }).catch(()=>{});
                        }, 1500); 
                    } else if (!entry.isIntersecting && entry.target.viewTimer) {
                        clearTimeout(entry.target.viewTimer); 
                    }
                });
            }, { threshold: 0.6 }); 
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

    // ✅ FIX 3: stopPropagation so clicking popup doesn't trigger swipe issues
    const openStudioProfile = async (e, mobile) => {
        e.stopPropagation();
        try {
            const res = await axios.post(`${API_BASE}/search-account`, { mobile, roleFilter: 'STUDIO' });
            if (res.data.success) setSelectedStudio(res.data.data);
            else alert("Studio details currently unavailable.");
        } catch (e) { console.error(e); }
    };

    const handleAddToCart = (e, item) => {
        e.stopPropagation();
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

    // ✅ SAFE EXTERNAL LINK OPENER (Crash-Proof)
    const handleOpenPortfolio = (url) => {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            alert("No valid portfolio link available for this profile.");
            return;
        }
        
        let finalUrl = url.trim();
        // Agar link me http nahi hai, toh auto-add karo taaki error na aaye
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl;
        }
        
        window.open(finalUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDirectBook = async (e, item) => {
        e.stopPropagation();
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
        <div className="modal-overlay" style={{ 
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
            overflow: 'hidden', 
            background: `rgba(0,0,0, ${1 - Math.abs(translateX)/(screenWidth*1.5)})`, zIndex: 99999,
            display: 'flex', justifyContent: 'center', alignItems: 'center' /* 🔥 Fully centers the feed vertically & horizontally */
        }}>
            <div 
                /* 🔥 FIX: Removed 'full-screen' class that was overriding our Desktop width! */
                className="modal-card fade-in hide-scroll"
                style={{
                    transform: `translateX(${translateX}px)`,
                    transition: translateX === 0 ? 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
                    width: '100%', height: '100dvh', 
                    maxWidth: '450px', /* 🔥 Strict 450px lock for Desktop */
                    position: 'relative',
                    overflow: 'hidden', 
                    display: 'flex', flexDirection: 'column', 
                    background: '#000',
                    boxShadow: '0 0 50px rgba(0,0,0,0.8)' /* 🔥 Premium shadow for Desktop view */
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* 🔥 Force Hide Scrollbar using internal style */}
                <style>{`.hide-scroll::-webkit-scrollbar { display: none !important; width: 0 !important; }`}</style>

                {/* 🔥 Ultra-Premium Glass Header */}
                <div className="modal-header" style={{
                    background: 'rgba(15, 23, 42, 0.4)', 
                    backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)', 
                    position: 'absolute', top: 0, width: '100%', zIndex: 50, 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '15px 20px', boxSizing: 'border-box',
                    fontFamily: "'Poppins', sans-serif"
                }}>
                    {/* 🔥 Luxe Typography for Header */}
                    <h3 style={{color: '#fff', margin: 0, fontSize: '15px', fontWeight: '500', letterSpacing: '2px', textTransform: 'uppercase'}}>{title}</h3>
                    {/* 🔥 Clean SVG Cross Button */}
                    <button onClick={onClose} style={{background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7, transition: '0.3s', padding: '5px'}} onMouseEnter={(e)=>e.currentTarget.style.opacity=1} onMouseLeave={(e)=>e.currentTarget.style.opacity=0.7}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                {/* 🔥 Scrollable Feed Content (Scrollbar Hidden via Inline & CSS) */}
                <div className="feed-content hide-scroll" style={{ flex: 1, overflowY: 'auto', scrollSnapType: 'y mandatory', scrollBehavior: 'smooth', paddingTop: '0', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                    
                    {loading ? (
                        <div style={{height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#000'}}>
                            <div className="premium-spinner"></div>
                            <p style={{color: '#FFD700', fontWeight: 'bold', marginTop: '15px', letterSpacing: '1px'}}>Loading Premium Content...</p>
                        </div>
                    ) : feedData.length > 0 ? (
                        feedData.map((item, index) => {
                            const fileUrl = getCleanUrl(item.file);
                            const isVid = isVideo(item.file);
                            
                            const maxChars = 60;
                            const isExpanded = expandedTextIndex === index;
                            const fullDesc = item.description || "Check out this beautiful shot! ✨";
                            const showReadMore = fullDesc.length > maxChars;
                            const displayDesc = isExpanded || !showReadMore ? fullDesc : fullDesc.substring(0, maxChars) + '...';
                            
                            return (
                                <div 
                                    key={index} 
                                    ref={(node) => handleObserver(node, index, !!item.isAdvertisement, item._id)}
                                    className="feed-item" 
                                    style={{ height: '100dvh', scrollSnapAlign: 'start', position: 'relative', overflow: 'hidden', background: '#000' }}
                                >
                                    {/* 📢 ADVERTISEMENT BADGE */}
                                    {item.isAdvertisement && (
                                        <div style={{ position: 'absolute', top: '80px', left: '15px', background: 'rgba(243, 156, 18, 0.9)', color: '#000', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '900', zIndex: 15, textTransform: 'uppercase' }}>
                                            Sponsored
                                        </div>
                                    )}

                                    {/* ⏳ FOMO Expiry Timer */}
                                    {item.expiryDate && !item.isAdvertisement && (
                                        <div style={{ position: 'absolute', top: '80px', right: '15px', background: 'rgba(231, 76, 60, 0.9)', color: '#fff', padding: '5px 12px', borderRadius: '15px', fontSize: '11px', fontWeight: 'bold', zIndex: 15, border: '1px solid rgba(255,255,255,0.2)' }}>
                                            ⏳ Ends: {new Date(item.expiryDate).toLocaleDateString()}
                                        </div>
                                    )}

                                    {/* 🔥 MEDIA VIEWER (Optimized for Ultra-Fast Loading) */}
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                                        {isVid ? (
                                            <video 
                                                ref={(el) => (videoRefs.current[index] = el)}
                                                src={fileUrl} 
                                                loop 
                                                muted 
                                                playsInline
                                                preload={index === 0 ? "auto" : "metadata"} /* 🔥 पहली वीडियो तुरंत रेडी रहेगी */
                                                style={{width:'100%', height:'100%', objectFit:'contain'}} 
                                            />
                                        ) : (
                                            <img 
                                                src={fileUrl} 
                                                alt={`Feed ${index}`} 
                                                /* 🔥 पहली इमेज बिना देरी के (eager) लोड होगी, बाकी बैकग्राउंड में (lazy) */
                                                loading={index === 0 ? "eager" : "lazy"} 
                                                decoding="async" /* 🔥 UI को हैंग नहीं होने देगा */
                                                fetchPriority={index === 0 ? "high" : "auto"} /* 🔥 ब्राउज़र को इसे सबसे पहले डाउनलोड करने का कमांड */
                                                style={{maxWidth:'100%', maxHeight:'100%', objectFit:'contain'}} 
                                            />
                                        )}
                                    </div>

                                    {/* 🔥 Dark Gradient Overlay (Bottom) */}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)', zIndex: 1, pointerEvents: 'none' }}></div>

                                    {/* 🔥 CONTENT INFO (Left Bottom - Premium Editorial Typography) */}
                                    <div style={{ position: 'absolute', bottom: '90px', left: '20px', right: '80px', zIndex: 5, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)', fontFamily: "'Poppins', sans-serif" }}>
                                        {item.isAdvertisement ? (
                                            <>
                                                {/* 🔥 Luxe Font for Ad Title */}
                                                <h3 style={{margin: '0 0 10px 0', fontSize: '18px', color: '#FFD700', fontWeight: '600', letterSpacing: '1.5px', textTransform: 'uppercase'}}>{item.title}</h3>
                                                {/* 🔥 Luxe Font for "Learn More" Button */}
                                                <button onClick={(e) => { e.stopPropagation(); window.open(item.actionLink, '_blank'); }} style={{ background: 'rgba(52, 152, 219, 0.9)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '10px 22px', borderRadius: '25px', fontWeight: '600', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', marginTop: '5px', width: 'auto', backdropFilter: 'blur(5px)', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)', transition: 'transform 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>
                                                    Learn More ↗️
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {/* Profile Area */}
                                                <div onClick={(e) => openStudioProfile(e, item.studioMobile)} style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer', background: 'rgba(0,0,0,0.4)', padding: '6px 15px 6px 6px', borderRadius: '30px', width: 'max-content', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.1)'}}>
                                                    <div style={{width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(45deg, #FFD700, #F39C12)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#000', fontSize: '14px', border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,0.5)'}}>
                                                        {(item.studioName || 'S')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h4 style={{margin: '0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500', letterSpacing: '0.5px'}}>{item.studioName || 'Featured Studio'} <span style={{color: '#3498db', fontSize: '12px', background: '#fff', borderRadius: '50%', padding: '2px'}}>✔️</span></h4>
                                                    </div>
                                                </div>
                                                
                                                {/* Description */}
                                                <p style={{margin: '0 0 15px 0', fontSize: '13px', lineHeight: '1.6', opacity: 0.95, color: '#eaeaea', fontWeight: '300', letterSpacing: '0.5px', maxWidth: '90%'}}>
                                                    {displayDesc}
                                                    {showReadMore && !isExpanded && (
                                                        <span onClick={(e) => { e.stopPropagation(); setExpandedTextIndex(index); }} style={{ color: '#FFD700', fontWeight: '500', marginLeft: '5px', cursor: 'pointer' }}> Read More</span>
                                                    )}
                                                    {showReadMore && isExpanded && (
                                                        <span onClick={(e) => { e.stopPropagation(); setExpandedTextIndex(null); }} style={{ color: '#aaa', fontWeight: '500', marginLeft: '5px', cursor: 'pointer' }}> Show Less</span>
                                                    )}
                                                </p>

                                                {/* Buttons */}
                                                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                    <button onClick={(e) => handleAddToCart(e, item)} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 18px', borderRadius: '25px', fontWeight: '500', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'transform 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>
                                                        🛒 Add Cart
                                                    </button>
                                                    <button onClick={(e) => handleDirectBook(e, item)} disabled={bookingLoading} style={{ background: 'linear-gradient(135deg, #FFD700, #F39C12)', color: '#000', border: 'none', padding: '10px 18px', borderRadius: '25px', fontWeight: '700', fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', cursor: bookingLoading ? 'not-allowed' : 'pointer', boxShadow: '0 5px 15px rgba(243, 156, 18, 0.4)', transition: 'transform 0.2s' }} onMouseEnter={(e)=>e.currentTarget.style.transform='scale(1.05)'} onMouseLeave={(e)=>e.currentTarget.style.transform='scale(1)'}>
                                                        {bookingLoading ? '⏳ Wait...' : `⚡ Book @ ₹${item.price || 5000}`}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* 🔥 ACTION BAR (Right Side - Raised Safely for Mobile Nav Bars) */}
                                    <div style={{ position: 'absolute', bottom: '100px', right: '15px', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '22px', alignItems: 'center' }}>
                                        <div onClick={(e) => { e.stopPropagation(); handleLike(index); }} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'}}>
                                            <div style={{fontSize: '30px', transform: item.isLiked ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>{item.isLiked ? '❤️' : '🤍'}</div>
                                            {/* Real Likes */}
                                            <span style={{color: '#fff', fontSize: '12px', fontWeight: 'bold', marginTop: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.8)'}}>{item.likes || 0}</span>
                                        </div>
                                        {!item.isAdvertisement && (
                                            <div onClick={(e) => { e.stopPropagation(); alert("Comments phase 2"); }} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'}}>
                                                <div style={{fontSize: '28px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>💬</div>
                                                {/* Real Comments */}
                                                <span style={{color: '#fff', fontSize: '12px', fontWeight: 'bold', marginTop: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.8)'}}>{item.commentsCount || 0}</span>
                                            </div>
                                        )}
                                        <div onClick={(e) => { e.stopPropagation(); handleShare(item); }} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'}}>
                                            <div style={{fontSize: '28px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>↗️</div>
                                            {/* Real Shares */}
                                            <span style={{color: '#fff', fontSize: '12px', fontWeight: 'bold', marginTop: '4px', textShadow: '0 2px 4px rgba(0,0,0,0.8)'}}>{item.shares || 0}</span>
                                        </div>
                                    </div>

                                </div>
                            );
                        })
                    ) : (
                        <div style={{height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888', background: '#000', padding: '0 30px', textAlign: 'center', fontFamily: "'Poppins', sans-serif"}}>
                            <div style={{ width: '80px', height: '80px', background: 'rgba(255, 215, 0, 0.05)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '25px', boxShadow: '0 0 40px rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.15)' }}>
                                <span style={{fontSize: '35px', filter: 'drop-shadow(0 0 15px rgba(255,215,0,0.6))'}}>✨</span>
                            </div>
                            {/* 🔥 Premium Editorial Typography */}
                            <h3 style={{color: '#E0E0E0', fontSize: '18px', marginBottom: '12px', fontWeight: '400', letterSpacing: '4px', textTransform: 'uppercase'}}>
                                Curating <span style={{color: '#FFD700', fontWeight: '600'}}>Magic</span>
                            </h3>
                            <p style={{fontSize: '13px', lineHeight: '1.8', maxWidth: '320px', color: '#888', fontWeight: '300', letterSpacing: '0.5px'}}>
                                We are handpicking the most exclusive content for you. Check back soon for trending moments.
                            </p>
                        </div>
                    )}
                    
                    {!loading && feedData.length > 0 && (
                        <div style={{position: 'absolute', top: '80px', width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.5)', zIndex: 10, fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px'}}>
                            SWIPE {type === 'trending' ? 'RIGHT 👉' : '👈 LEFT'} TO GO BACK
                        </div>
                    )}

                </div>
            </div>

            {/* ✅ STUDIO PROFILE POPUP (Glassmorphism + Ultra High Z-Index) */}
            {selectedStudio && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }} onClick={(e) => e.stopPropagation()}>
                    <div className="fade-in" style={{ background: 'rgba(25, 30, 40, 0.9)', border: '1px solid rgba(255,255,255,0.1)', width: '90%', maxWidth: '350px', borderRadius: '25px', padding: '30px', textAlign: 'center', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', zIndex: 10000000, backdropFilter: 'blur(20px)' }}>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedStudio(null); }} style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', width: '30px', height: '30px', borderRadius: '50%', fontSize: '14px', cursor: 'pointer' }}>✖</button>
                        
                        <div style={{ width: '90px', height: '90px', background: 'linear-gradient(45deg, #3498db, #8e44ad)', borderRadius: '50%', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '35px', color: '#fff', fontWeight: 'bold', border: '4px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                            {(selectedStudio.studioName || 'S')[0].toUpperCase()}
                        </div>
                        <h2 style={{ margin: '0 0 5px 0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '20px' }}>
                            {selectedStudio.studioName} <span style={{ color: '#3498db', fontSize: '18px' }}>✔️</span>
                        </h2>
                        <p style={{ margin: '0 0 20px 0', color: '#aaa', fontSize: '12px' }}>📍 Location: {selectedStudio.location || 'India'}</p>

                        {/* ✅ BULLETPROOF PORTFOLIO BUTTON */}
                        {selectedStudio.portfolioUrl ? (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleOpenPortfolio(selectedStudio.portfolioUrl); }} 
                                style={{ width: '100%', display: 'block', background: 'linear-gradient(135deg, #FFD700, #F39C12)', color: '#000', padding: '14px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', border: 'none', marginBottom: '15px', cursor: 'pointer', boxShadow: '0 5px 15px rgba(243, 156, 18, 0.3)' }}
                            >
                                🌐 View Complete Portfolio
                            </button>
                        ) : (
                            <p style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', fontSize: '12px', color: '#777', marginBottom: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>No portfolio link available.</p>
                        )}

                        <button onClick={(e) => { e.stopPropagation(); setSelectedStudio(null); }} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>Close Profile</button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default TrendingFeed;