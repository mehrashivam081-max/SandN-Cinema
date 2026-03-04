import React, { useState } from 'react';
import axios from 'axios';
import './BookingForm.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const BookingForm = ({ onClose }) => {
    // --- FORM STATES ---
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        date: '',
        type: 'Wedding Photography' // Default selection
    });
    const [loading, setLoading] = useState(false);

    // --- HANDLERS ---
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Basic Validation
        if (formData.mobile.length !== 10) {
            return alert("Please enter a valid 10-digit mobile number.");
        }
        
        setLoading(true);
        try {
            // ✅ REAL DATABASE CONNECTION
            const res = await axios.post(`${API_BASE}/create-booking`, formData);
            
            if (res.data.success) {
                alert("✅ Booking Request Sent Successfully! Our team will contact you soon.");
                onClose(); // Form band kardo
            } else {
                alert("❌ Failed to send request: " + res.data.message);
            }
        } catch (error) {
            console.error("Booking Error:", error);
            alert("Server Error. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    return (
        // ✅ Clicking outside the box closes the modal
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>📅 Book a Shoot</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                
                {/* ✅ Form connected to Submit Logic */}
                <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444' }}>Full Name</label>
                    <input 
                        type="text" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleChange} 
                        required 
                        placeholder="Enter your full name" 
                        style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />

                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444', marginTop: '10px' }}>Mobile Number</label>
                    <input 
                        type="number" 
                        name="mobile" 
                        value={formData.mobile} 
                        onChange={handleChange} 
                        required 
                        placeholder="10-digit mobile number" 
                        style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                    />

                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444', marginTop: '10px' }}>Preferred Date</label>
                    <input 
                        type="date" 
                        name="date" 
                        value={formData.date} 
                        onChange={handleChange} 
                        required 
                        style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontFamily: 'inherit' }}
                    />

                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444', marginTop: '10px' }}>Event / Shoot Type</label>
                    <select 
                        name="type" 
                        value={formData.type} 
                        onChange={handleChange}
                        style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontFamily: 'inherit' }}
                    >
                        <option value="Wedding Photography">Wedding Photography</option>
                        <option value="Pre-Wedding Shoot">Pre-Wedding Shoot</option>
                        <option value="Corporate Event">Corporate Event</option>
                        <option value="Fashion / Portfolio">Fashion / Portfolio</option>
                        <option value="Other Media Service">Other Media Service</option>
                    </select>

                    <button 
                        type="submit" 
                        className="pay-btn" 
                        disabled={loading}
                        style={{ 
                            marginTop: '25px', 
                            padding: '15px', 
                            background: loading ? '#95a5a6' : '#e50914', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: '5px', 
                            fontWeight: 'bold', 
                            cursor: loading ? 'not-allowed' : 'pointer' 
                        }}
                    >
                        {loading ? 'SUBMITTING REQUEST...' : 'CONFIRM BOOKING'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BookingForm;