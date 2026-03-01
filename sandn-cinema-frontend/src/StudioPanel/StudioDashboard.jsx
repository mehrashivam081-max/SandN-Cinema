import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StudioDashboard.css';

// ✅ API BASE URL - Render link for production
const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const StudioDashboard = ({ user, onLogout }) => {
    // --- 1. STATES ---
    const [clientMobile, setClientMobile] = useState('');
    const [clientName, setClientName] = useState('');
    const [files, setFiles] = useState([]);
    const [clients, setClients] = useState([]); 
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    // --- 2. FETCH CLIENTS LOGIC ---
    const fetchClients = async () => {
        setFetching(true);
        try {
            const res = await axios.post(`${API_BASE}/list-accounts`, {
                requesterRole: 'STUDIO',
                requesterMobile: user.mobile
            });
            if (res.data.success) {
                setClients(res.data.data);
            }
        } catch (error) {
            console.error("Failed to fetch clients:", error);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        if (user && user.mobile) {
            fetchClients();
        }
    }, [user]);

    // --- 3. DELETE CLIENT LOGIC ---
    const handleDeleteClient = async (targetMobile) => {
        if (!window.confirm(`Are you sure you want to delete client ${targetMobile}? This will remove their account and all uploaded data.`)) return;

        try {
            const res = await axios.post(`${API_BASE}/delete-account`, {
                targetMobile: targetMobile,
                targetRole: 'USER' 
            });

            if (res.data.success) {
                alert("✅ Client deleted successfully.");
                fetchClients(); 
            } else {
                alert("❌ Failed to delete: " + res.data.message);
            }
        } catch (error) {
            alert("Error connecting to server.");
        }
    };

    // --- 4. UPLOAD LOGIC ---
    const handleFileChange = (e) => {
        setFiles(e.target.files);
    };

    const handleUpload = async () => {
        if (!clientMobile || clientMobile.length !== 10) {
            return alert("Please enter a valid 10-digit mobile number.");
        }
        if (files.length === 0) {
            return alert("Please select files to upload.");
        }

        setLoading(true);

        const formData = new FormData();
        formData.append('mobile', clientMobile);
        formData.append('name', clientName || 'Client');
        formData.append('type', 'USER');
        formData.append('addedBy', user.mobile); 

        for (let i = 0; i < files.length; i++) {
            formData.append('mediaFiles', files[i]);
        }

        try {
            const res = await axios.post(`${API_BASE}/admin-add-user`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                alert(`✅ Success: ${res.data.message}`);
                setClientMobile('');
                setClientName('');
                setFiles([]);
                document.getElementById('file-input-field').value = '';
                fetchClients();
            } else {
                alert(`❌ Error: ${res.data.message}`);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload Failed. Backend check karein.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="studio-container">
            {/* --- HEADER --- */}
            <div className="studio-header">
                <div className="header-info">
                    <h2>🎬 Studio Panel</h2>
                    <p>Welcome, <strong>{user.name || user.ownerName}</strong></p>
                </div>
                <button className="logout-btn-studio" onClick={onLogout}>Logout</button>
            </div>
            
            <div className="studio-grid">
                {/* --- UPLOAD CARD --- */}
                <div className="studio-card upload-section">
                    <h3>📤 Upload Client Data</h3>
                    <div className="input-group">
                        <label>Client Mobile</label>
                        <input 
                            type="number"
                            placeholder="e.g. 9876543210" 
                            value={clientMobile}
                            onChange={(e) => setClientMobile(e.target.value)}
                        />
                    </div>
                    
                    <div className="input-group">
                        <label>Client Name</label>
                        <input 
                            type="text"
                            placeholder="Enter Client Name" 
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                        />
                    </div>
                    
                    <div className="input-group">
                        <label>Media Files (Photos/Videos)</label>
                        <input 
                            id="file-input-field"
                            type="file" 
                            multiple 
                            onChange={handleFileChange}
                            className="file-input-custom"
                        />
                    </div>
                    
                    <button 
                        className="action-btn upload-btn" 
                        onClick={handleUpload} 
                        disabled={loading}
                    >
                        {loading ? 'Processing...' : 'Upload & Notify Client'}
                    </button>
                </div>

                {/* --- REVENUE CARD --- */}
                <div className="studio-card revenue-section">
                    <h3>💰 Business Revenue</h3>
                    <div className="revenue-stats">
                        <div className="stat-box">
                            <span>Today</span>
                            <h4>₹ 0</h4>
                        </div>
                        <div className="stat-box">
                            <span>Total Earnings</span>
                            <h4>₹ 0</h4>
                        </div>
                    </div>
                    <button className="action-btn withdraw-btn">Withdraw Funds</button>
                </div>
            </div>

            {/* --- CLIENTS LIST TABLE --- */}
            <div className="clients-list-container">
                <div className="list-header">
                    <h3>👥 My Recent Clients</h3>
                    <button className="refresh-btn" onClick={fetchClients} disabled={fetching}>
                        {fetching ? '...' : '🔄 Refresh'}
                    </button>
                </div>
                
                <div className="table-responsive">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Client Name</th>
                                <th>Mobile Number</th>
                                <th>Uploaded Items</th>
                                <th>Joined Date</th>
                                <th>Status</th> {/* ✅ Status back in header */}
                                <th>Actions</th> {/* ✅ Actions for Delete */}
                            </tr>
                        </thead>
                        <tbody>
                            {clients.length > 0 ? (
                                clients.map((client, idx) => (
                                    <tr key={idx}>
                                        <td className="bold-text">{client.name}</td>
                                        <td>{client.mobile}</td>
                                        <td><span className="badge">{client.uploadedData?.length || 0} Files</span></td>
                                        <td>{new Date(client.joinedDate).toLocaleDateString()}</td>
                                        <td><span className="status-active">Active</span></td> {/* ✅ Active status is here */}
                                        <td>
                                            <button 
                                                className="delete-btn-table" 
                                                onClick={() => handleDeleteClient(client.mobile)}
                                            >
                                                🗑️ Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="empty-msg">No clients added yet. Start by uploading data.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StudioDashboard;