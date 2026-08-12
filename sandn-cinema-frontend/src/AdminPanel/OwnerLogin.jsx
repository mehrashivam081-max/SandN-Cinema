import React, { useState } from 'react';
import axios from 'axios';
import './OwnerPanel.css';
import useBackButton from '../hooks/useBackButton'; // ✅ NEW: Import your global back button hook

const API_BASE = import.meta.env.VITE_API_BASE;

const OwnerLogin = ({ onLoginSuccess, onBack }) => {
    const [adminId, setAdminId] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // ✅ NEW: Trigger mobile hardware back button to go back to the main app
    useBackButton(() => {
        if (onBack) {
            onBack();
        }
    });

    const handleLogin = async (e) => {
        e.preventDefault(); // This stops the page from refreshing on Enter key press
        if (!adminId || !password) return setError('❌ Please enter your Admin credentials');
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/login`, {
                mobile: adminId.trim(),
                password: password.trim(),
                roleFilter: 'ADMIN'
            });

            if (res.data.success && res.data.token) {
                localStorage.setItem('authToken', res.data.token);
                sessionStorage.setItem('user', JSON.stringify(res.data.user));
                onLoginSuccess();
            } else {
                setError('❌ Invalid Admin Credentials');
            }
        } catch (err) {
            setError(err.response?.data?.message || '❌ Login failed. Please try again.');
        } finally {
            setLoading(false);
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
                    <button type="submit" className="admin-login-btn" disabled={loading}>{loading ? 'VERIFYING...' : 'ACCESS PANEL'}</button>
                </form>
                
                <button className="back-home-link" onClick={onBack}>← Back to App</button>
            </div>
        </div>
    );
};

export default OwnerLogin;