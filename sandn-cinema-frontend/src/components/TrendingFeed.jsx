import React from 'react';
import '../styles/components.css';

const TrendingFeed = ({ type, onClose }) => {
    // Determine title based on type (Trending or Viral)
    const title = type === 'trending' ? '🔥 Trending Now' : '🚀 Viral Content';

    return (
        <div className="modal-overlay">
            <div className="modal-card full-screen fade-in">
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="close-btn" onClick={onClose}>Close</button>
                </div>
                
                <div className="feed-content">
                    {/* Placeholder Content */}
                    <div className="feed-item">
                        <div className="video-placeholder">Video/Image 1</div>
                        <p>Amazing Cinema Moment #1</p>
                    </div>
                    <div className="feed-item">
                        <div className="video-placeholder">Video/Image 2</div>
                        <p>Behind the Scenes #2</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrendingFeed;