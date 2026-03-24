import React, { useState } from 'react';
import './OwnerPanel.css';
import useBackButton from '../hooks/useBackButton'; // ✅ NEW: Import your global back button hook

const OwnerLogin = ({ onLoginSuccess, onBack }) => {
    const [adminId, setAdminId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // ✅ NEW: Trigger mobile hardware back button to go back to the main app
    useBackButton(() => {
        if (onBack) {
            onBack();
        }
    });

    const handleLogin = (e) => {
        e.preventDefault(); // This stops the page from refreshing on Enter key press
        if (adminId === 'admin' && password === 'sandn@123') {
            onLoginSuccess();
        } else {
            setError('❌ Invalid Admin Credentials');
        }
    };

    return (
        <div className="admin-login-wrapper">
            <div className="admin-login-card">
                <h2 className="admin-title">Owner Panel</h2>
                <p className="admin-subtitle">Control Center</p>
                
                {/* Enter Key automatically works because of this <form> tag */}
                <form onSubmit={handleLogin}>
                    <div className="admin-input-group">
                        <label>Admin ID</label>
                        <input type="text" placeholder="Enter Admin ID" value={adminId} onChange={(e) => setAdminId(e.target.value)} />
                    </div>
                    <div className="admin-input-group">
                        <label>Password</label>
                        <input type="password" placeholder="Enter Secure Key" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    {error && <p className="admin-error">{error}</p>}
                    <button type="submit" className="admin-login-btn">ACCESS PANEL</button>
                </form>
                
                <button className="back-home-link" onClick={onBack}>← Back to App</button>
            </div>
        </div>
    );
};

export default OwnerLogin;