import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/components.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const TrendingFeed = ({ type, onClose }) => {
    const title = type === 'trending' ? '🔥 Trending Now' : '🚀 Viral Content';
    
    const touchStartX = useRef(0);
    const [translateX, setTranslateX] = useState(0);

    const [feedData, setFeedData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false); // Naya state direct booking ke loading ke liye

    // 🟢 FETCH PUBLIC FEED DATA
    useEffect(() => {
        const fetchPublicFeed = async () => {
            try {
                const res = await axios.get(`${API_BASE}/get-public-feed`);
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

    // --- SWIPE HANDLERS ---
    const handleTouchStart = (e) => { touchStartX.current = e.targetTouches[0].clientX; };
    const handleTouchMove = (e) => {
        const diff = e.targetTouches[0].clientX - touchStartX.current;
        if (type === 'trending' && diff > 0) setTranslateX(diff);
        else if (type === 'viral' && diff < 0) setTranslateX(diff);
    };
    const handleTouchEnd = () => {
        if (type === 'trending' && translateX > 100) onClose();
        else if (type === 'viral' && translateX < -100) onClose();
        else setTranslateX(0); 
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
        const userStr = sessionStorage.getItem('user');
        if (!userStr) {
            alert("Please sign in to leave a comment!");
            onClose(); 
        } else {
            alert("Comment section will open here! (Phase 2)");
        }
    };

    // ✅ HELPER FOR SERVICE OBJECT
    const getServiceObject = (item) => ({
        _id: item._id || Date.now().toString(),
        title: `Premium Session by ${item.studioName || 'Featured Studio'}`,
        startingPrice: item.price || 5000, 
        addedBy: item.studioName || 'SandN Cinema',
        imageUrl: `https://sandn-cinema.onrender.com/${item.file}`
    });

    // ✅ ACTION 1: ADD TO CART LOGIC
    const handleAddToCart = (item) => {
        const userStr = sessionStorage.getItem('user');
        const serviceToBook = getServiceObject(item);

        if (userStr) {
            // 🟢 LOGGED IN: Add to Cart silently
            const currentCart = JSON.parse(localStorage.getItem('userCart')) || [];
            if (currentCart.find(c => c.title === serviceToBook.title && c.addedBy === serviceToBook.addedBy)) {
                return alert("This session is already in your cart!");
            }
            const newCart = [{ ...serviceToBook, addedAt: Date.now() }, ...currentCart];
            localStorage.setItem('userCart', JSON.stringify(newCart));
            alert(`🛒 Added to Cart!\nGo back to your Dashboard and open your cart to complete the booking later.`);
        } else {
            // 🔴 GUEST: Save to pending and redirect to Login
            localStorage.setItem('pendingCartItem', JSON.stringify(serviceToBook));
            alert("✨ Please sign in or create an account to add this to your cart!");
            onClose(); 
        }
    };

    // ✅ ACTION 2: DIRECT BOOKING LOGIC (Triggers Blind Booking Flow)
    const handleDirectBook = async (item) => {
        const userStr = sessionStorage.getItem('user');
        const serviceToBook = getServiceObject(item);

        if (userStr) {
            // 🟢 LOGGED IN: Send Blind Booking Request Directly
            const userObj = JSON.parse(userStr);
            if (!window.confirm(`⚡ Ready to book ${item.studioName}?\nA booking request will be sent to the studio. Your contact details will remain completely hidden for safety until the studio accepts and you pay the 30% advance.`)) return;

            setBookingLoading(true);
            try {
                // Call the checkout API which creates a booking request
                const res = await axios.post(`${API_BASE}/checkout-cart`, {
                    mobile: userObj.mobile,
                    items: [serviceToBook]
                });
                
                if (res.data.success) {
                    alert(`✅ Booking Request Sent Securely!\n\nThe studio has received your requirement (Contact Hidden). Once they accept, you'll be notified to pay the advance.`);
                    onClose(); // Close feed, take them to dashboard to see bookings
                } else {
                    alert("Booking failed. Please try again later.");
                }
            } catch (error) {
                alert("Server error connecting to studio.");
            } finally {
                setBookingLoading(false);
            }
        } else {
            // 🔴 GUEST: Save to pending and redirect to Login
            localStorage.setItem('pendingCartItem', JSON.stringify(serviceToBook));
            alert("✨ Please sign in or create an account to book this amazing studio securely!");
            onClose(); 
        }
    };

    return (
        <div 
           className="modal-overlay"
           style={{ background: `rgba(0,0,0, ${1 - Math.abs(translateX)/500})` }}
        >
            <div 
                className="modal-card full-screen fade-in"
                style={{
                    transform: `translateX(${translateX}px)`,
                    transition: translateX === 0 ? 'transform 0.3s ease-out' : 'none',
                    width: '100%',
                    height: '100dvh',
                    maxWidth: '100%',
                    borderRadius: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#000'
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
                            const fileUrl = `https://sandn-cinema.onrender.com/${item.file}`;
                            const isVid = isVideo(item.file);
                            
                            return (
                                <div key={index} className="feed-item" style={{ height: '100dvh', scrollSnapAlign: 'start', position: 'relative', overflow: 'hidden' }}>
                                    
                                    {/* Media Layer */}
                                    {isVid ? (
                                        <video 
                                            src={fileUrl} 
                                            autoPlay={index === 0} 
                                            loop 
                                            muted 
                                            playsInline
                                            style={{width:'100%', height:'100%', objectFit:'cover'}} 
                                        />
                                    ) : (
                                        <img src={fileUrl} alt={`Feed ${index}`} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                                    )}

                                    {/* Black Gradient Overlay at bottom for text visibility */}
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', zIndex: 1 }}></div>

                                    {/* Content Info (Left Bottom) */}
                                    <div style={{ position: 'absolute', bottom: '30px', left: '15px', right: '80px', zIndex: 5, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
                                            <div style={{width: '35px', height: '35px', borderRadius: '50%', background: 'linear-gradient(45deg, #f1c40f, #e67e22)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#000', border: '2px solid #fff'}}>
                                                {(item.studioName || 'S')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <h4 style={{margin: '0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '5px'}}>{item.studioName || 'Featured Studio'} <span style={{color: '#3498db', fontSize: '14px'}}>✔️</span></h4>
                                                <p style={{margin: 0, fontSize: '11px', color: '#ccc'}}>Verified Creator</p>
                                            </div>
                                        </div>
                                        
                                        <p style={{margin: '0 0 10px 0', fontSize: '13px', lineHeight: '1.4', opacity: 0.9}}>
                                            Check out this beautiful {isVid ? 'video' : 'shot'}! Let's create something amazing for your next event. ✨
                                        </p>

                                        {/* ✅ SPLIT BUTTONS: ADD TO CART & BOOK NOW */}
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
                                                {bookingLoading ? '⏳ Wait...' : '⚡ Book Session'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Bar (Right Side like Reels/TikTok) */}
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
        </div>
    );
};

export default TrendingFeed;