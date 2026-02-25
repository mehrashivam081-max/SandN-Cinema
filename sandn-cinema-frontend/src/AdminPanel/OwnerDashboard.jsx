import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const OwnerDashboard = () => {
    const cardStyle = { background: 'var(--bg-card, #222)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color, #444)', textAlign: 'center', color: '#fff' };
    
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // ✅ Form State updated for Multiple Files
    const [formData, setFormData] = useState({
        type: 'USER',
        name: '',
        mobile: '',
        files: [] // Array to store multiple files
    });
    
    const [previews, setPreviews] = useState([]); // Array to store preview URLs
    const [accounts, setAccounts] = useState([]); // To store list of users/studios
    
    // ✅ New State for Auto-suggest Dropdown
    const [showSuggestions, setShowSuggestions] = useState(false);

    // ✅ Fetch Accounts on Component Load
    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            // Admin can see everyone
            const res = await axios.post(`${API_BASE}/list-accounts`, { requesterRole: 'ADMIN' });
            if (res.data.success) {
                setAccounts(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch accounts", error);
        }
    };

    // ✅ Handle Multiple File Selection & Previews
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFormData({ ...formData, files: selectedFiles });

        // Generate Preview URLs
        const filePreviews = selectedFiles.map(file => ({
            url: URL.createObjectURL(file),
            type: file.type
        }));
        setPreviews(filePreviews);
    };

    // ✅ Auto-suggest Mobile Input Logic
    const handleMobileChange = (e) => {
        const val = e.target.value;
        setFormData({ ...formData, mobile: val });
        if (val.length > 0) {
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    // ✅ Handle Suggestion Click (Auto-fill data)
    const handleSuggestionClick = (acc) => {
        setFormData({
            ...formData,
            mobile: acc.mobile,
            name: acc.name || acc.studioName || '',
            type: acc.role || 'USER'
        });
        setShowSuggestions(false);
    };

    // Check if current mobile number already exists in accounts list
    const isExistingAccount = accounts.some(acc => acc.mobile === formData.mobile);

    // ✅ Add New User/Studio Logic or Append Data
    const handleAddManualUser = async (e) => {
        e.preventDefault();
        if (formData.mobile.length !== 10) return alert("Please enter a valid 10-digit mobile number!");
        
        setLoading(true);

        const data = new FormData();
        data.append('type', formData.type);
        data.append('name', formData.name);
        data.append('mobile', formData.mobile);
        data.append('addedBy', 'ADMIN'); // Tagging that admin added this
        
        // ✅ Append multiple files
        formData.files.forEach(file => {
            data.append('mediaFiles', file); // Matches backend 'upload.array' name
        });

        try {
            const res = await axios.post(`${API_BASE}/admin-add-user`, data, {
                headers: { 'Content-Type': 'multipart/form-data' } 
            });

            if (res.data.success) {
                alert(`✅ Success: ${res.data.message}`);
                setShowModal(false);
                setFormData({ type: 'USER', name: '', mobile: '', files: [] }); 
                setPreviews([]); // Clear previews
                fetchAccounts(); // Refresh the list
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

    // ✅ Delete Account Logic
    const handleDelete = async (mobile, role) => {
        if (!window.confirm(`Are you sure you want to delete this ${role}?`)) return;

        try {
            const res = await axios.post(`${API_BASE}/delete-account`, { targetMobile: mobile, targetRole: role });
            if (res.data.success) {
                alert("🗑️ Account deleted successfully!");
                fetchAccounts(); // Refresh list after delete
            } else {
                alert("Failed to delete account.");
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Error deleting account.");
        }
    };

    // Filter accounts for auto-suggest based on typed mobile number
    const filteredSuggestions = accounts.filter(acc => acc.mobile.includes(formData.mobile));

    return (
        <div style={{ padding: '40px' }}>
            <h2 style={{ color: 'var(--accent-gold, #ffd700)', textAlign: 'center', marginBottom: '40px' }}>👑 Super Admin Control</h2>
            
            {/* Top Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px', marginBottom: '40px' }}>
                <div style={cardStyle}>
                    <h3>Total Accounts</h3>
                    <p style={{ fontSize: '2.5rem', color: 'var(--primary-red, #ff4d4d)', margin: '10px 0' }}>{accounts.length}</p>
                </div>

                {/* ✅ New Registration Card */}
                <div style={{ ...cardStyle, border: '1px solid #28a745' }}>
                    <h3>Manual Registration</h3>
                    <p style={{ fontSize: '12px', color: '#aaa', margin: '10px 0' }}>Add New or Append Data</p>
                    <button 
                        onClick={() => setShowModal(true)} 
                        style={{ marginTop: '10px', padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                        ➕ Manage Accounts
                    </button>
                </div>
            </div>

            {/* ✅ Accounts List Table */}
            <div style={{ background: '#222', padding: '20px', borderRadius: '10px', overflowX: 'auto' }}>
                <h3 style={{ color: '#fff', marginBottom: '15px' }}>📋 Registered Users & Studios</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: '#333', borderBottom: '2px solid #555' }}>
                            <th style={{ padding: '12px' }}>Role</th>
                            <th style={{ padding: '12px' }}>Name</th>
                            <th style={{ padding: '12px' }}>Mobile</th>
                            <th style={{ padding: '12px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.map((acc, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #444' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold', color: acc.role === 'STUDIO' ? '#ffd700' : '#4dabf7' }}>
                                    {acc.role}
                                </td>
                                <td style={{ padding: '12px' }}>{acc.name || acc.studioName}</td>
                                <td style={{ padding: '12px' }}>{acc.mobile}</td>
                                <td style={{ padding: '12px' }}>
                                    <button 
                                        onClick={() => handleDelete(acc.mobile, acc.role)}
                                        style={{ background: '#ff4d4d', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {accounts.length === 0 && (
                            <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>No accounts found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ✅ Registration Modal with Previews & Auto-suggest */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', width: '95%', maxWidth: '500px', color: '#333', maxHeight: '90vh', overflowY: 'auto' }}>
                        
                        <span onClick={() => {setShowModal(false); setPreviews([]); setShowSuggestions(false);}} style={{ float: 'right', cursor: 'pointer', color: 'red', fontWeight: 'bold' }}>✖</span>
                        <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#2b5876' }}>User Entry & Data Upload</h3>
                        
                        <form onSubmit={handleAddManualUser} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            
                            {/* ✅ AUTO-SUGGEST MOBILE INPUT */}
                            <div style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Mobile Number (Type to search)</label>
                                <input type="number" placeholder="10-Digit Mobile No." required value={formData.mobile}
                                    onChange={handleMobileChange}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay hides suggestion to allow click
                                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                                
                                {/* Dropdown for matching numbers */}
                                {showSuggestions && formData.mobile && filteredSuggestions.length > 0 && (
                                    <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#f9f9f9', border: '1px solid #ccc', borderRadius: '5px', maxHeight: '150px', overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none', zIndex: 10 }}>
                                        {filteredSuggestions.map((acc, idx) => (
                                            <li key={idx} 
                                                onClick={() => handleSuggestionClick(acc)}
                                                style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer', fontSize: '12px' }}>
                                                <strong>{acc.mobile}</strong> - {acc.name || acc.studioName} ({acc.role})
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Name</label>
                                <input type="text" placeholder="Name" required value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
                            </div>

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

                            {/* ✅ MULTIPLE DATA UPLOAD FIELD */}
                            <div style={{ border: '2px dashed #ccc', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>📁 Upload Multiple Files (Img/Video)</label>
                                <input 
                                    type="file" 
                                    multiple // ✅ Allows selecting multiple files
                                    accept="image/*,video/*"
                                    onChange={handleFileChange}
                                    style={{ fontSize: '12px', width: '100%' }} 
                                />
                                
                                {/* ✅ Live Previews */}
                                {previews.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '15px', justifyContent: 'center' }}>
                                        {previews.map((src, idx) => (
                                            <div key={idx} style={{ width: '60px', height: '60px', overflow: 'hidden', borderRadius: '5px', border: '1px solid #ddd' }}>
                                                {src.type.startsWith('video/') ? (
                                                    <video src={src.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <img src={src.url} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ✅ DYNAMIC SUBMIT BUTTON */}
                            <button type="submit" disabled={loading} style={{ background: isExistingAccount ? '#ff8c00' : '#2b5876', color: 'white', border: 'none', padding: '15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                {loading ? 'Uploading Data...' : isExistingAccount ? '🚀 Append Data (Re-upload)' : '🚀 Finalize & Upload'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OwnerDashboard;