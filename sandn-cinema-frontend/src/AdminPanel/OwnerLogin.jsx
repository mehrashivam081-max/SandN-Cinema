import React, { useState } from 'react';
import './OwnerPanel.css';

const OwnerLogin = ({ onLoginSuccess, onBack }) => {
    const [adminId, setAdminId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
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