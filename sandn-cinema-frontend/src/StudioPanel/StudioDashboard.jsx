import React, { useState } from 'react';
import './StudioDashboard.css';

const StudioDashboard = ({ user, onLogout }) => {
    const [upload, setUpload] = useState({ mobile: '', file: null });

    const handleUpload = () => {
        if(!upload.mobile || !upload.file) return alert("Please fill all details");
        alert("Upload Successful! Notification Sent.");
        setUpload({ mobile: '', file: null });
    };

    return (
        <div className="studio-container">
            <div className="studio-header">
                <h2>🎬 Studio Panel: {user.name}</h2>
                <button className="logout-btn-studio" onClick={onLogout}>Logout</button>
            </div>
            
            <div className="studio-grid">
                <div className="studio-card">
                    <h3>📤 Upload Data</h3>
                    <input 
                        placeholder="Client Mobile No" 
                        value={upload.mobile}
                        onChange={(e) => setUpload({...upload, mobile: e.target.value})}
                    />
                    <input 
                        type="file" 
                        onChange={(e) => setUpload({...upload, file: e.target.files[0]})}
                        className="file-input"
                    />
                    <button className="action-btn upload-btn" onClick={handleUpload}>
                        Upload & Notify
                    </button>
                </div>

                <div className="studio-card">
                    <h3>💰 Revenue</h3>
                    <div className="revenue-stats">
                        <div className="stat"><span>Today</span><h4>₹ 0</h4></div>
                        <div className="stat"><span>Total</span><h4>₹ 0</h4></div>
                    </div>
                    <button className="action-btn withdraw-btn">Withdraw Funds</button>
                </div>
            </div>
        </div>
    );
};

export default StudioDashboard;