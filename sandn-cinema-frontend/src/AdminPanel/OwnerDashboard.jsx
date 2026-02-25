import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const OwnerDashboard = () => {
    const cardStyle = { background: 'var(--bg-card, #222)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color, #444)', textAlign: 'center', color: '#fff' };
    
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'USER',
        name: '',
        mobile: '',
        file: null // ✅ To store image/video file
    });

    const handleAddManualUser = async (e) => {
        e.preventDefault();
        if (formData.mobile.length !== 10) return alert("Please enter a valid 10-digit mobile number!");
        
        setLoading(true);

        // ✅ Using FormData to send File and Text data together
        const data = new FormData();
        data.append('type', formData.type);
        data.append('name', formData.name);
        data.append('mobile', formData.mobile);
        data.append('password', ""); // Password empty for first-time setup logic
        
        if (formData.file) {
            data.append('mediaFile', formData.file); // ✅ Sending File
        }

        try {
            const res = await axios.post(`${API_BASE}/admin-add-user`, data, {
                headers: { 'Content-Type': 'multipart/form-data' } // ✅ Important for Files
            });

            if (res.data.success) {
                alert(`✅ ${formData.type} Added Successfully with Data!`);
                setShowModal(false);
                setFormData({ type: 'USER', name: '', mobile: '', file: null }); 
            } else {
                alert(res.data.message || "Failed to add user.");
            }
        } catch (error) {
            console.error("Upload Error:", error);
            alert("Server Error. Check Render Logs.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '40px' }}>
            <h2 style={{ color: 'var(--accent-gold, #ffd700)', textAlign: 'center', marginBottom: '40px' }}>👑 Super Admin Control</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px' }}>
                <div style={cardStyle}>
                    <h3>Total Users</h3>
                    <p style={{ fontSize: '2.5rem', color: 'var(--primary-red, #ff4d4d)', margin: '10px 0' }}>120</p>
                </div>
                
                <div style={{ ...cardStyle, borderColor: 'var(--accent-gold, #ffd700)' }}>
                    <h3>Active Studios</h3>
                    <p style={{ fontSize: '2.5rem', color: 'var(--accent-gold, #ffd700)', margin: '10px 0' }}>15</p>
                </div>

                {/* ✅ New Registration Card */}
                <div style={{ ...cardStyle, border: '1px solid #28a745' }}>
                    <h3>Manual Registration</h3>
                    <p style={{ fontSize: '12px', color: '#aaa', margin: '10px 0' }}>Add & Upload User Media</p>
                    <button 
                        onClick={() => setShowModal(true)} 
                        style={{ marginTop: '10px', padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                        ➕ Add & Upload
                    </button>
                </div>

                <div style={cardStyle}>
                    <h3>Content Manager</h3>
                    <button style={{ marginTop: '20px', padding: '10px 20px', background: '#444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Edit Terms</button>
                </div>
            </div>

            {/* ✅ Registration Modal with File Upload */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', width: '95%', maxWidth: '450px', color: '#333', maxHeight: '90vh', overflowY: 'auto' }}>
                        
                        <span onClick={() => setShowModal(false)} style={{ float: 'right', cursor: 'pointer', color: 'red', fontWeight: 'bold' }}>✖</span>
                        <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#2b5876' }}>User Entry & Data Upload</h3>
                        
                        <form onSubmit={handleAddManualUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Role</label>
                                <select 
                                    value={formData.type} 
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
                                    <option value="USER">User</option>
                                    <option value="STUDIO">Studio</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Name</label>
                                <input type="text" placeholder="Name" required value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Mobile (Password/Email: Optional)</label>
                                <input type="number" placeholder="Mobile" required value={formData.mobile}
                                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                            </div>

                            {/* ✅ NEW: DATA UPLOAD FIELD */}
                            <div style={{ border: '2px dashed #ccc', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>📁 Upload User Data (Img/Video)</label>
                                <input 
                                    type="file" 
                                    accept="image/*,video/*"
                                    onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                                    style={{ fontSize: '12px' }} 
                                />
                                {formData.file && <p style={{ fontSize: '10px', color: 'green', marginTop: '5px' }}>Selected: {formData.file.name}</p>}
                            </div>

                            <button type="submit" disabled={loading} style={{ background: '#2b5876', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                {loading ? 'Uploading Data...' : '🚀 Register & Upload'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OwnerDashboard;