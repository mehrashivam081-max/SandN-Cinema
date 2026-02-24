import React, { useRef, useState } from 'react';
import '../styles/components.css';

// ✅ NAYA LOGIC: feedData prop added for Admin Panel Uploads
const TrendingFeed = ({ type, onClose, feedData = [] }) => {
    // Determine title based on type (Trending or Viral)
    const title = type === 'trending' ? '🔥 Trending Now' : '🚀 Viral Content';
    
    // Swipe Logic Tracking
    const touchStartX = useRef(0);
    const [translateX, setTranslateX] = useState(0);

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

    // ✅ NAYA LOGIC: Admin Data Array Map (Fallback to old dummy data if empty)
    const itemsToShow = feedData && feedData.length > 0 ? feedData : [
        { id: 1, title: "Amazing Cinema Moment #1", mediaUrl: "" },
        { id: 2, title: "Behind the Scenes #2", mediaUrl: "" }
    ];

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
                    flexDirection: 'column'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* ✅ Close button hata diya gaya hai */}
                <div className="modal-header">
                    <h3>{title}</h3>
                </div>
                
                <div className="feed-content" style={{ flex: 1, overflowY: 'auto' }}>
                    
                    {/* ✅ NAYA LOGIC: Map through feedData dynamically */}
                    {itemsToShow.map((item) => (
                        <div key={item.id} className="feed-item" style={{ marginBottom: '20px' }}>
                            <div style={{height: '300px', background: '#ccc', display:'flex', alignItems:'center', justifyContent:'center', color: '#333', overflow: 'hidden'}}>
                                {item.mediaUrl ? (
                                    <img src={item.mediaUrl} alt={item.title} style={{width:'100%', height:'100%', objectFit:'cover'}} />
                                ) : (
                                    `Video/Image ${item.id}`
                                )}
                            </div>
                            <p style={{padding: '10px', color: '#fff'}}>{item.title}</p>
                        </div>
                    ))}
                    
                    <div style={{textAlign: 'center', padding: '20px', color: '#888', marginTop: 'auto'}}>
                        Swipe {type === 'trending' ? 'Right 👉' : '👈 Left'} to go back
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrendingFeed;