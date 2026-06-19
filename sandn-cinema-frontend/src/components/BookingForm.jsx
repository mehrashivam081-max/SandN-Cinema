import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BookingForm.css';

const API_BASE = import.meta.env.VITE_API_BASE;

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
        // ✅ Premium Cinematic Overlay
        <div className="modal-overlay" onClick={onClose} style={{ fontFamily: "'Poppins', sans-serif" }}>
            <div className="booking-card-glass" onClick={(e) => e.stopPropagation()}>
                
                {/* 🔥 Header */}
                <div className="modal-header" style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                    <h3 style={{ margin: 0, color: '#FFD700', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '700' }}>📅 Book a Shoot</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '28px', cursor: 'pointer', opacity: 0.7, transition: '0.3s' }} onMouseEnter={(e)=>e.currentTarget.style.opacity=1} onMouseLeave={(e)=>e.currentTarget.style.opacity=0.7}>&times;</button>
                </div>
                
                {/* 🔥 Premium Form */}
                <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    
                    <div className="input-group">
                        <label className="luxe-label">Full Name</label>
                        <input type="text" name="name" className="luxe-input" value={formData.name} onChange={handleChange} required placeholder="Enter your full name" disabled={isMobileVerified} />
                    </div>

                    {/* 🔥 MOBILE VERIFICATION ROW */}
                    <div className="input-group">
                        <label className="luxe-label">Mobile Number</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="number" name="mobile" className="luxe-input" value={formData.mobile} onChange={handleChange} required placeholder="10-digit mobile number" disabled={isMobileVerified} style={{ flex: 1 }} />
                            {!isMobileVerified && (
                                <button type="button" onClick={handleSendOtp} disabled={otpLoading || formData.mobile.length !== 10} className="btn-otp-luxe">
                                    {otpLoading ? '...' : isOtpSent ? 'RESEND' : 'GET OTP'}
                                </button>
                            )}
                            {isMobileVerified && <span className="verified-badge">✔️ VERIFIED</span>}
                        </div>
                    </div>

                    {/* 🔥 OTP INPUT BLOCK */}
                    {isOtpSent && !isMobileVerified && (
                        <div className="otp-box-glass fade-in">
                            <input type="number" placeholder="Enter 6-Digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} className="luxe-input-otp" autoFocus />
                            <button type="button" onClick={handleVerifyOtp} className="btn-verify-luxe">VERIFY</button>
                        </div>
                    )}

                    {/* 🔥 DYNAMIC SERVICE SELECTOR */}
                    <div className="input-group">
                        <label className="luxe-label">Event / Shoot Type</label>
                        <select name="type" value={formData.type} onChange={handleChange} className="luxe-input" style={{ cursor: 'pointer', appearance: 'none' }}>
                            <option value="" disabled>Select a premium service...</option>
                            {availableServices.map((service, index) => (
                                <option key={index} value={service.name || service} style={{ background: '#1b1b1b', color: '#fff' }}>{service.name || service}</option>
                            ))}
                        </select>
                    </div>

                    {/* 🔥 DATES (FROM - TO) */}
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label className="luxe-label">Start Date</label>
                            <input type="date" name="startDate" className="luxe-input date-picker-dark" value={formData.startDate} onChange={handleChange} required min={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label className="luxe-label">End Date</label>
                            <input type="date" name="endDate" className="luxe-input date-picker-dark" value={formData.endDate} onChange={handleChange} required min={formData.startDate || new Date().toISOString().split('T')[0]} />
                        </div>
                    </div>

                    {/* 🔥 LOCATION DETAILS */}
                    <div className="input-group">
                        <label className="luxe-label">City / Location</label>
                        <input type="text" name="location" className="luxe-input" value={formData.location} onChange={handleChange} required placeholder="e.g. Mumbai, Maharashtra" />
                    </div>

                    <div className="input-group">
                        <label className="luxe-label">Event Place / Venue Name</label>
                        <input type="text" name="eventPlaceName" className="luxe-input" value={formData.eventPlaceName} onChange={handleChange} required placeholder="e.g. The Taj Mahal Palace" />
                    </div>

                    {/* 🔥 TERMS AND CONDITIONS */}
                    <div className="checkbox-wrapper-glass">
                        <input type="checkbox" id="tcCheckbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                        <label htmlFor="tcCheckbox">
                            I agree to the <span onClick={(e) => { e.preventDefault(); alert("1. 30% advance required.\n2. Non-refundable on cancellation within 7 days.\n3. Outstation travel borne by client."); }} className="link-text-gold">Terms & Conditions</span> regarding booking.
                        </label>
                    </div>

                    {/* 🔥 SUBMIT BUTTON */}
                    <button 
                        type="submit" 
                        className="btn-primary-luxe"
                        disabled={loading || !isMobileVerified || !agreedToTerms}
                        style={{ marginTop: '10px' }}
                    >
                        {loading ? 'SUBMITTING REQUEST...' : 'CONFIRM BOOKING ⚡'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BookingForm;