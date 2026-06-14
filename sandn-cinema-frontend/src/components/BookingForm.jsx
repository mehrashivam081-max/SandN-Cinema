import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BookingForm.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const BookingForm = ({ onClose }) => {
    // --- FORM STATES ---
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        startDate: '',
        endDate: '',
        type: '', // Will be set to first dynamic service by default later
        location: '',
        eventPlaceName: ''
    });
    
    // --- DYNAMIC SERVICES STATE ---
    const [availableServices, setAvailableServices] = useState([
        "Wedding Photography", "Pre-Wedding Shoot", "Corporate Event", "Fashion / Portfolio", "Other Media Service"
    ]);

    // --- OTP & VERIFICATION STATES ---
    const [otp, setOtp] = useState('');
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [isMobileVerified, setIsMobileVerified] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);

    // --- TERMS & CONDITIONS STATE ---
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const [loading, setLoading] = useState(false);

    // 🟢 FETCH SERVICES FROM BACKEND ON MOUNT
    useEffect(() => {
        const fetchServices = async () => {
            try {
                // If you have a real endpoint to fetch dynamic services, it will hit here
                const res = await axios.get(`${API_BASE}/get-services`);
                if (res.data.success && res.data.services.length > 0) {
                    setAvailableServices(res.data.services);
                    setFormData(prev => ({ ...prev, type: res.data.services[0].name || res.data.services[0] }));
                }
            } catch (error) {
                // Defaulting to the first fallback service if backend API fails
                setFormData(prev => ({ ...prev, type: "Wedding Photography" }));
            }
        };
        fetchServices();
    }, []);

    // --- HANDLERS ---
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        // Reset verification if mobile number is edited after verification
        if (e.target.name === 'mobile') {
            setIsMobileVerified(false);
            setIsOtpSent(false);
        }
    };

    // 📩 SEND OTP LOGIC
    const handleSendOtp = async () => {
        if (formData.mobile.length !== 10) return alert("Please enter a valid 10-digit mobile number.");
        setOtpLoading(true);
        try {
            // Setup this API route on your backend
            const res = await axios.post(`${API_BASE}/send-otp`, { mobile: formData.mobile });
            if (res.data.success) {
                setIsOtpSent(true);
                alert("OTP sent to your mobile number!");
            } else {
                alert("Development Mode: OTP is 1234"); // Fallback
                setIsOtpSent(true);
            }
        } catch (error) {
            alert("Development Mode: Assuming OTP sent successfully (Use 1234).");
            setIsOtpSent(true);
        } finally {
            setOtpLoading(false);
        }
    };

    // 🔐 VERIFY OTP LOGIC
    const handleVerifyOtp = async () => {
        if (!otp) return alert("Please enter OTP.");
        
        // Development fallback check
        if (otp === '1234') {
            setIsMobileVerified(true);
            alert("✅ Mobile Verified Successfully!");
            return;
        }

        try {
            const res = await axios.post(`${API_BASE}/verify-otp`, { mobile: formData.mobile, otp });
            if (res.data.success) {
                setIsMobileVerified(true);
                alert("✅ Mobile Verified Successfully!");
            } else {
                alert("❌ Invalid OTP!");
            }
        } catch (error) {
            alert("Error verifying OTP.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Advanced Validations
        if (!isMobileVerified) return alert("⚠️ Please verify your mobile number first!");
        if (!agreedToTerms) return alert("⚠️ Please accept the Terms & Conditions.");
        if (!formData.startDate || !formData.endDate) return alert("⚠️ Please select booking dates.");
        if (new Date(formData.endDate) < new Date(formData.startDate)) return alert("⚠️ End Date cannot be before Start Date.");

        setLoading(true);
        try {
            // ✅ REAL DATABASE CONNECTION
            const res = await axios.post(`${API_BASE}/create-booking`, formData);
            
            if (res.data.success) {
                alert("✅ Booking Request Sent Successfully! Our team will contact you soon.");
                onClose(); 
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="modal-header" style={{ marginBottom: '20px' }}>
                    <h3>📅 Book a Shoot</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                
                {/* ✅ Form connected to Submit Logic */}
                <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444' }}>Full Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter your full name" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} disabled={isMobileVerified} />

                    {/* MOBILE VERIFICATION ROW */}
                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444' }}>Mobile Number</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input type="number" name="mobile" value={formData.mobile} onChange={handleChange} required placeholder="10-digit mobile number" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', flex: 1 }} disabled={isMobileVerified} />
                        {!isMobileVerified && (
                            <button type="button" onClick={handleSendOtp} disabled={otpLoading || formData.mobile.length !== 10} style={{ padding: '0 15px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {otpLoading ? '...' : isOtpSent ? 'Resend' : 'Get OTP'}
                            </button>
                        )}
                        {isMobileVerified && <span style={{ padding: '0 15px', background: '#e8f8f5', color: '#2ecc71', border: '1px solid #2ecc71', borderRadius: '5px', display: 'flex', alignItems: 'center', fontWeight: 'bold', fontSize: '12px' }}>✓ Verified</span>}
                    </div>

                    {/* OTP INPUT BLOCK */}
                    {isOtpSent && !isMobileVerified && (
                        <div style={{ display: 'flex', gap: '10px', background: '#fef9e7', padding: '10px', borderRadius: '5px', border: '1px dashed #f1c40f' }}>
                            <input type="number" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #f1c40f', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }} />
                            <button type="button" onClick={handleVerifyOtp} style={{ background: '#2ecc71', color: 'white', border: 'none', padding: '0 20px', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>Verify</button>
                        </div>
                    )}

                    {/* DYNAMIC SERVICE SELECTOR */}
                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444' }}>Event / Shoot Type</label>
                    <select name="type" value={formData.type} onChange={handleChange} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontFamily: 'inherit' }}>
                        <option value="" disabled>Select a service...</option>
                        {availableServices.map((service, index) => (
                            <option key={index} value={service.name || service}>{service.name || service}</option>
                        ))}
                    </select>

                    {/* DATES (FROM - TO) */}
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444', marginBottom: '5px' }}>Start Date</label>
                            <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required min={new Date().toISOString().split('T')[0]} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontFamily: 'inherit' }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444', marginBottom: '5px' }}>End Date</label>
                            <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required min={formData.startDate || new Date().toISOString().split('T')[0]} style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontFamily: 'inherit' }} />
                        </div>
                    </div>

                    {/* LOCATION DETAILS */}
                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444' }}>City / Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleChange} required placeholder="e.g. Indore" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />

                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#444' }}>Event Place / Venue Name</label>
                    <input type="text" name="eventPlaceName" value={formData.eventPlaceName} onChange={handleChange} required placeholder="e.g. Grand Sheraton Hotel" style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />

                    {/* TERMS AND CONDITIONS */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginTop: '10px', border: '1px solid #eee' }}>
                        <input type="checkbox" id="tcCheckbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} style={{ marginTop: '3px', transform: 'scale(1.2)', cursor: 'pointer' }} />
                        <label htmlFor="tcCheckbox" style={{ fontSize: '12px', color: '#555', cursor: 'pointer', lineHeight: '1.4' }}>
                            I agree to the <span style={{ color: '#e50914', fontWeight: 'bold', textDecoration: 'underline' }} onClick={(e) => { e.preventDefault(); alert("1. 30% advance required.\n2. Non-refundable on cancellation within 7 days.\n3. Outstation travel borne by client."); }}>Terms & Conditions</span> regarding booking, payment, and cancellation.
                        </label>
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button 
                        type="submit" 
                        className="pay-btn" 
                        disabled={loading || !isMobileVerified || !agreedToTerms}
                        style={{ 
                            marginTop: '15px', 
                            padding: '15px', 
                            background: (loading || !isMobileVerified || !agreedToTerms) ? '#95a5a6' : '#e50914', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: '5px', 
                            fontWeight: 'bold', 
                            cursor: (loading || !isMobileVerified || !agreedToTerms) ? 'not-allowed' : 'pointer',
                            transition: '0.3s'
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