import React, { useRef, useState, useEffect } from 'react';
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
    
    // 🟢 READ MORE STATES
    const [expandedTextIndex, setExpandedTextIndex] = useState(null);

    // 🟢 STUDIO PROFILE POPUP STATES
    const [selectedStudio, setSelectedStudio] = useState(null);

    useEffect(() => {
        const fetchPublicFeed = async () => {
            try {
                // Fetch latest data with anti-caching
                const res = await axios.get(`${API_BASE}/get-public-feed?t=${Date.now()}`);
                if (res.data.success && res.data.data.length > 0) {
                    const shuffled = res.data.data.sort(() => 0.5 - Math.random()).map(item => ({
                        ...item,
                        likes: Math.floor(Math.random() * 500) + 50,
                        isLiked: false,
                        commentsCount: Math.floor(Math.random() * 50) + 5,
                        shares: Math.floor(Math.random() * 20) + 1
                    }));
                    setFeedData(shuffled);
                }
            } catch (error) {
                console.error("Failed to load feed", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPublicFeed();
    }, []);

    // ✅ VIEW ANALYTICS SENDER
    const handleViewAnalytics = async (postId) => {
        try {
            await axios.post(`${API_BASE}/view-feed-post`, { postId });
        } catch (e) { console.log("Analytics error silently ignored"); }
    };

    // --- SWIPE HANDLERS (ANTI-SHAKE & 30% RULE) ---
    const handleTouchStart = (e) => { 
        touchStartX.current = e.targetTouches[0].clientX; 
    };

    const handleTouchMove = (e) => {
        const diff = e.targetTouches[0].clientX - touchStartX.current;
        // Anti-Shake: 20px buffer before swipe starts registering
        if (Math.abs(diff) < 20) return; 

        if (type === 'trending' && diff > 0) setTranslateX(diff);
        else if (type === 'viral' && diff < 0) setTranslateX(diff);
    };

    const handleTouchEnd = () => {
        const threshold = screenWidth * 0.30; // 30% of screen width

        if (type === 'trending' && translateX > threshold) onClose();
        else if (type === 'viral' && translateX < -threshold) onClose();
        else setTranslateX(0); // Snap back to center
    };

    // --- UTILS & INTERACTIONS ---
    const isVideo = (filename) => filename.match(/\.(mp4|mov|avi|wmv)$/i);

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
                    title: `Check out this shot by ${item.studioName}`,
                    text: 'Amazing work featured on SandN Cinema!',
                    url: `https://sandn-cinema.onrender.com/${item.file}`
                });
            } else {
                navigator.clipboard.writeText(`https://sandn-cinema.onrender.com/${item.file}`);
                alert("Link copied to clipboard! Share it anywhere.");
            }
        } catch (e) { console.log(e); }
    };

    const handleCommentClick = () => {
        alert("Comment section will open here! (Phase 2)");
    };

    // Fetch Full Studio Details for Profile Popup
    const openStudioProfile = async (mobile) => {
        try {
            const res = await axios.post(`${API_BASE}/search-account`, { mobile, roleFilter: 'STUDIO' });
            if (res.data.success) {
                setSelectedStudio(res.data.data);
            } else {
                alert("Studio details currently unavailable.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // HELPER FOR SERVICE OBJECT
    const getServiceObject = (item) => ({
        _id: item._id || Date.now().toString(),
        title: `Premium Session by ${item.studioName || 'Featured Studio'}`,
        startingPrice: item.price || 5000, 
        addedBy: item.studioName || 'SandN Cinema',
        imageUrl: item.file.startsWith('http') ? item.file : `https://sandn-cinema.onrender.com/${item.file}`
    });

    const handleAddToCart = (item) => {
        const userStr = sessionStorage.getItem('user');
        const serviceToBook = getServiceObject(item);

        if (userStr) {
            const currentCart = JSON.parse(localStorage.getItem('userCart')) || [];
            if (currentCart.find(c => c.title === serviceToBook.title && c.addedBy === serviceToBook.addedBy)) {
                return alert("This session is already in your cart!");
            }
            const newCart = [{ ...serviceToBook, addedAt: Date.now() }, ...currentCart];
            localStorage.setItem('userCart', JSON.stringify(newCart));
            alert(`🛒 Added to Cart!\nGo back to your Dashboard and open your cart to complete the booking later.`);
        } else {
            localStorage.setItem('pendingCartItem', JSON.stringify(serviceToBook));
            alert("✨ Please sign in or create an account to add this to your cart!");
            onClose(); 
        }
    };

    const handleDirectBook = async (item) => {
        const userStr = sessionStorage.getItem('user');
        const serviceToBook = getServiceObject(item);

        if (userStr) {
            const userObj = JSON.parse(userStr);
            if (!window.confirm(`⚡ Ready to book ${item.studioName}?\nA booking request will be sent securely. Your contact details will remain completely hidden until the studio accepts.`)) return;

            setBookingLoading(true);
            try {
                const res = await axios.post(`${API_BASE}/checkout-cart`, {
                    mobile: userObj.mobile,
                    items: [serviceToBook]
                });
                
                if (res.data.success) {
                    alert(`✅ Booking Request Sent Securely!\n\nThe studio has received your requirement. Check your Dashboard to see the proposal and pay the advance.`);
                    onClose(); 
                } else {
                    alert("Booking failed. Please try again later.");
                }
            } catch (error) {
                alert("Server error connecting to studio.");
            } finally {
                setBookingLoading(false);
            }
        } else {
            localStorage.setItem('pendingCartItem', JSON.stringify(serviceToBook));
            alert("✨ Please sign in or create an account to book this amazing studio securely!");
            onClose(); 
        }
    };

    return (
        <div 
           className="modal-overlay"
           style={{ background: `rgba(0,0,0, ${1 - Math.abs(translateX)/(screenWidth*1.5)})` }}
        >
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
                        <div style={{height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'}}>
                            <p>Loading magic... ✨</p>
                        </div>
                    ) : feedData.length > 0 ? (
                        feedData.map((item, index) => {
                            const fileUrl = item.file.startsWith('http') ? item.file : `https://sandn-cinema.onrender.com/${item.file}`;
                            const isVid = isVideo(item.file);
                            
                            // Read More text trimming logic
                            const maxChars = 60;
                            const isExpanded = expandedTextIndex === index;
                            const displayText = (item.description && item.description.length > maxChars && !isExpanded) 
                                                ? item.description.substring(0, maxChars) + '...' 
                                                : item.description;
                            
                            return (
                                <div 
                                    key={index} 
                                    className="feed-item" 
                                    style={{ height: '100dvh', scrollSnapAlign: 'start', position: 'relative', overflow: 'hidden', background: '#111' }}
                                    onMouseEnter={() => handleViewAnalytics(item._id)} // Fire view event when entering view
                                >
                                    
                                    {/* ✅ FOMO Expiry Timer Highlight (Top Center) */}
                                    {item.expiryDate && (
                                        <div style={{ position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #e74c3c, #c0392b)', color: '#fff', padding: '6px 15px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', zIndex: 15, boxShadow: '0 4px 10px rgba(0,0,0,0.5)', border: '1px solid #fff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            ⏳ Offer Ends: {new Date(item.expiryDate).toLocaleDateString()} {new Date(item.expiryDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    )}

                                    {/* ✅ Media Layer (objectFit: contain ensures no cropping) */}
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {isVid ? (
                                            <video 
                                                src={fileUrl} 
                                                autoPlay={index === 0} 
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

                                    {/* Black Gradient Overlay at bottom for text visibility */}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 1 }}></div>

                                    {/* Content Info (Left Bottom) */}
                                    <div style={{ position: 'absolute', bottom: '30px', left: '15px', right: '80px', zIndex: 5, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                        
                                        {/* ✅ Clickable Studio Profile Area */}
                                        <div 
                                            onClick={() => openStudioProfile(item.studioMobile)}
                                            style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer'}}
                                        >
                                            <div style={{width: '35px', height: '35px', borderRadius: '50%', background: 'linear-gradient(45deg, #f1c40f, #e67e22)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#000', border: '2px solid #fff'}}>
                                                {(item.studioName || 'S')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 style={{margin: '0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '5px'}}>{item.studioName || 'Featured Studio'} <span style={{color: '#3498db', fontSize: '14px'}}>✔️</span></h4>
                                                <p style={{margin: 0, fontSize: '11px', color: '#ccc'}}>Verified Creator • Click to view profile</p>
                                            </div>
                                        </div>
                                        
                                        {/* ✅ Read More Description Logic */}
                                        <p style={{margin: '0 0 10px 0', fontSize: '13px', lineHeight: '1.4', opacity: 0.9}}>
                                            {displayText || "Check out this beautiful shot! Let's create something amazing for your next event. ✨"}
                                            {item.description && item.description.length > maxChars && !isExpanded && (
                                                <span onClick={() => setExpandedTextIndex(index)} style={{ color: '#ccc', fontWeight: 'bold', marginLeft: '5px', cursor: 'pointer' }}>...Read More</span>
                                            )}
                                        </p>

                                        {/* Split Buttons: Cart & Book */}
                                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                            <button 
                                                onClick={() => handleAddToCart(item)}
                                                style={{ flex: 1, background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid #fff', padding: '10px 5px', borderRadius: '25px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', backdropFilter: 'blur(5px)' }}
                                            >
                                                🛒 Add to Cart
                                            </button>
                                            
                                            <button 
                                                onClick={() => handleDirectBook(item)}
                                                disabled={bookingLoading}
                                                style={{ flex: 1.5, background: 'linear-gradient(90deg, #f1c40f, #f39c12)', color: '#000', border: 'none', padding: '10px 5px', borderRadius: '25px', fontWeight: 'bold', fontSize: '12px', cursor: bookingLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(241, 196, 15, 0.4)', animation: 'pulse 2s infinite' }}
                                            >
                                                {bookingLoading ? '⏳ Wait...' : `⚡ Book @ ₹${item.price || 5000}`}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Bar (Right Side like Reels) */}
                                    <div style={{ position: 'absolute', bottom: '50px', right: '15px', zIndex: 5, display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                                        <div onClick={() => handleLike(index)} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'}}>
                                            <div style={{fontSize: '28px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))', transform: item.isLiked ? 'scale(1.2)' : 'scale(1)', transition: 'transform 0.2s'}}>
                                                {item.isLiked ? '❤️' : '🤍'}
                                            </div>
                                            <span style={{color: '#fff', fontSize: '12px', fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.8)', marginTop: '2px'}}>{item.likes}</span>
                                        </div>

                                        <div onClick={handleCommentClick} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'}}>
                                            <div style={{fontSize: '28px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>💬</div>
                                            <span style={{color: '#fff', fontSize: '12px', fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.8)', marginTop: '2px'}}>{item.commentsCount}</span>
                                        </div>

                                        <div onClick={() => handleShare(item)} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer'}}>
                                            <div style={{fontSize: '28px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>↗️</div>
                                            <span style={{color: '#fff', fontSize: '12px', fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.8)', marginTop: '2px'}}>{item.shares}</span>
                                        </div>
                                    </div>

                                </div>
                            );
                        })
                    ) : (
                        <div style={{height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888'}}>
                            <span style={{fontSize: '50px', marginBottom: '20px'}}>📭</span>
                            <p>No content uploaded to public feed yet.</p>
                            <p style={{fontSize: '12px', marginTop: '10px'}}>Verified studios can upload here!</p>
                        </div>
                    )}
                    
                    {!loading && feedData.length > 0 && (
                        <div style={{position: 'absolute', top: '20px', width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.7)', zIndex: 10, fontSize: '12px', fontWeight: 'bold', textShadow: '0 1px 3px rgba(0,0,0,0.8)'}}>
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

                        {/* Portfolio Link Display */}
                        {selectedStudio.portfolioUrl ? (
                            <a href={selectedStudio.portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#fdf2e9', color: '#e67e22', padding: '12px', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold', fontSize: '13px', border: '1px solid #f8c471', marginBottom: '15px' }}>
                                🌐 View Complete Portfolio
                            </a>
                        ) : (
                            <p style={{ background: '#f4f6f7', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#95a5a6' }}>No portfolio link available.</p>
                        )}

                        <button onClick={() => setSelectedStudio(null)} style={{ width: '100%', padding: '12px', background: '#2c3e50', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                            Close
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default TrendingFeed;