import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const OwnerDashboard = () => {
    const cardStyle = { background: 'var(--bg-card, #222)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color, #444)', textAlign: 'center', color: '#fff' };
    
    // ✅ New States for Manual Add User Form
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'USER', // 'USER' or 'STUDIO'
        name: '',
        mobile: ''
    });

    // ✅ Form Submit Handler
    const handleAddManualUser = async (e) => {
        e.preventDefault();
        if (formData.mobile.length !== 10) return alert("Please enter a valid 10-digit mobile number!");
        
        setLoading(true);
        try {
            // ✅ पासवर्ड को खाली स्ट्रिंग "" भेज रहे हैं ताकि backend इसे 'isNewUser' माने
            const res = await axios.post(`${API_BASE}/admin-add-user`, {
                ...formData,
                password: "" 
            });

            if (res.data.success) {
                alert(`✅ ${formData.type} Added Successfully!\nNow they can login via OTP and setup their own password.`);
                setShowModal(false);
                setFormData({ type: 'USER', name: '', mobile: '' }); 
            } else {
                alert(res.data.message || "Failed to add user.");
            }
        } catch (error) {
            alert("Server Error. Please make sure backend is updated.");
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

                <div style={cardStyle}>
                    <h3>Content Manager</h3>
                    <button style={{ marginTop: '20px', padding: '10px 20px', background: '#444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Edit Terms</button>
                </div>

                {/* ✅ New Card For Manual Registration */}
                <div style={{ ...cardStyle, border: '1px solid #28a745' }}>
                    <h3>Manual Registration</h3>
                    <p style={{ fontSize: '12px', color: '#aaa', margin: '10px 0' }}>Add User/Studio without OTP</p>
                    <button 
                        onClick={() => setShowModal(true)} 
                        style={{ marginTop: '10px', padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                        ➕ Add New
                    </button>
                </div>
            </div>

            {/* ✅ Manual Add User Modal/Popup */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', width: '90%', maxWidth: '400px', color: '#333', position: 'relative' }}>
                        
                        <span onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '15px', right: '20px', fontSize: '20px', cursor: 'pointer', color: 'red', fontWeight: 'bold' }}>✖</span>
                        
                        <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#2b5876' }}>Manual Registration</h3>
                        
                        <form onSubmit={handleAddManualUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Account Type</label>
                                <select 
                                    value={formData.type} 
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', marginTop: '5px' }}>
                                    <option value="USER">Normal User</option>
                                    <option value="STUDIO">Studio Owner</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Full Name / Studio Name</label>
                                <input 
                                    type="text" 
                                    placeholder="Enter Name" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', marginTop: '5px' }} 
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Mobile Number</label>
                                <input 
                                    type="number" 
                                    placeholder="10-Digit Mobile No." 
                                    required
                                    value={formData.mobile}
                                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', marginTop: '5px' }} 
                                />
                            </div>

                            <button type="submit" disabled={loading} style={{ background: '#2b5876', color: 'white', border: 'none', padding: '12px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                                {loading ? 'Saving...' : 'Register User'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OwnerDashboard;