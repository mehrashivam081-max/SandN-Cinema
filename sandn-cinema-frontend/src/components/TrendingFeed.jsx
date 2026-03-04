import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/components.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const TrendingFeed = ({ type, onClose }) => {
    // Determine title based on type (Trending or Viral)
    const title = type === 'trending' ? '🔥 Trending Now' : '🚀 Viral Content';
    
    // Swipe Logic Tracking
    const touchStartX = useRef(0);
    const [translateX, setTranslateX] = useState(0);

    // ✅ NAYA STATE: For fetching real feed from backend
    const [feedData, setFeedData] = useState([]);
    const [loading, setLoading] = useState(true);

    // 🟢 FETCH PUBLIC FEED DATA ON MOUNT
    useEffect(() => {
        const fetchPublicFeed = async () => {
            try {
                const res = await axios.get(`${API_BASE}/get-public-feed`);
                if (res.data.success && res.data.data.length > 0) {
                    // Randomize array to show different feed every time
                    const shuffled = res.data.data.sort(() => 0.5 - Math.random());
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

    const handleTouchStart = (e) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e) => {
        const currentX = e.targetTouches[0].clientX;
        const diff = currentX - touchStartX.current;
        
        // Trending: Screen open hota hai left swipe se, to close hoga Right swipe se (diff > 0)
        if (type === 'trending' && diff > 0) {
            setTranslateX(diff);
        } 
        // Viral: Screen open hota hai right swipe se, to close hoga Left swipe se (diff < 0)
        else if (type === 'viral' && diff < 0) {
            setTranslateX(diff);
        }
    };

    const handleTouchEnd = () => {
        // Agar thoda lamba swipe kiya hai to close kardo, warna wapas apni jagah le aao
        if (type === 'trending' && translateX > 100) {
            onClose();
        } else if (type === 'viral' && translateX < -100) {
            onClose();
        } else {
            setTranslateX(0); 
        }
    };

    // Helper function to check if file is video
    const isVideo = (filename) => {
        return filename.match(/\.(mp4|mov|avi|wmv)$/i);
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
                        // ✅ NAYA LOGIC: Render Real Content
                        feedData.map((item, index) => {
                            const fileUrl = `https://sandn-cinema.onrender.com/${item.file}`;
                            const isVid = isVideo(item.file);
                            
                            return (
                                <div key={index} className="feed-item" style={{ height: '100dvh', scrollSnapAlign: 'start', position: 'relative' }}>
                                    
                                    {isVid ? (
                                        <video 
                                            src={fileUrl} 
                                            autoPlay={index === 0} // Only auto-play the first video
                                            loop 
                                            muted 
                                            playsInline
                                            style={{width:'100%', height:'100%', objectFit:'cover'}} 
                                        />
                                    ) : (
                                        <img src={fileUrl} alt={`Feed ${index}`} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                                    )}

                                    {/* Creator Info Overlay */}
                                    <div style={{ position: 'absolute', bottom: '80px', left: '20px', right: '20px', zIndex: 5, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                        <h4 style={{margin: '0 0 5px 0', fontSize: '18px'}}>📸 {item.studioName}</h4>
                                        <p style={{margin: 0, fontSize: '14px', opacity: 0.8}}>Featured Creator</p>
                                    </div>

                                </div>
                            );
                        })
                    ) : (
                        // Fallback if DB is empty
                        <div style={{height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888'}}>
                            <span style={{fontSize: '50px', marginBottom: '20px'}}>📭</span>
                            <p>No content uploaded to public feed yet.</p>
                            <p style={{fontSize: '12px', marginTop: '10px'}}>Verified studios can upload here!</p>
                        </div>
                    )}
                    
                    {/* Swipe indicator at the very bottom */}
                    {!loading && (
                        <div style={{position: 'absolute', bottom: '20px', width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.5)', zIndex: 10}}>
                            Swipe {type === 'trending' ? 'Right 👉' : '👈 Left'} to go back
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default TrendingFeed;