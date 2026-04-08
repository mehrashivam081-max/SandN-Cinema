import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Refund = () => {
    const navigate = useNavigate();

    // Jab page khule toh scroll ekdum top par aa jaye
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div style={{ minHeight: '100vh', background: '#f4f7f6', padding: '30px 15px', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            
            {/* 🔙 BACK BUTTON */}
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '20px' }}>
                <button 
                    onClick={() => navigate('/')} 
                    style={{ background: 'none', border: 'none', color: '#2b5876', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
                >
                    <span style={{ fontSize: '18px' }}>←</span> Back to Home
                </button>
            </div>

            {/* 📄 MAIN CONTENT BOX (White box with dark text) */}
            <div style={{ 
                maxWidth: '800px', 
                margin: '0 auto', 
                background: '#ffffff', 
                borderRadius: '12px', 
                padding: '40px 30px', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)', 
                color: '#333' // 🔥 FIX: Explicit dark text color
            }}>
                <h1 style={{ textAlign: 'center', color: '#111', marginBottom: '5px', fontSize: '28px', fontWeight: '800' }}>Refund & Cancellation Policy</h1>
                <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '35px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Snevio Cloud | Photography Services
                </p>

                <div style={{ lineHeight: '1.8', fontSize: '15px', color: '#444' }}>
                    
                    <p style={{ marginBottom: '20px', fontSize: '16px' }}>
                        At <strong>Snevio</strong>, we provide premium digital photography and studio services. Please review our policies regarding refunds and cancellations below.
                    </p>

                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>1. Digital Media & Downloads</h3>
                    <p style={{ marginBottom: '15px' }}>
                        Due to the nature of digital content, once high-resolution photos or videos are delivered or downloaded by the client, <strong>no refunds will be issued</strong>.
                    </p>

                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>2. Event & Studio Bookings</h3>
                    <ul style={{ paddingLeft: '20px', marginBottom: '15px' }}>
                        <li style={{ marginBottom: '8px' }}>
                            <strong>48 Hours Notice:</strong> Cancellations made at least 48 hours before the scheduled shoot or booking are eligible for a <strong>50% refund</strong>.
                        </li>
                        <li style={{ marginBottom: '8px' }}>
                            <strong>24 Hours Notice:</strong> Cancellations made within 24 hours of the shoot are <strong>strictly non-refundable</strong>.
                        </li>
                    </ul>

                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>3. Technical Issues</h3>
                    <p style={{ marginBottom: '15px' }}>
                        We ensure our cloud delivery is seamless. However, if you face any technical issues with digital downloads, corrupted files, or access links, please contact us for a resolution <strong>within 7 days</strong> of delivery.
                    </p>

                    <div style={{ marginTop: '40px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #2b5876' }}>
                        <h4 style={{ color: '#111', marginBottom: '8px', fontSize: '16px' }}>Need Help with a Booking?</h4>
                        <p style={{ fontSize: '14px', color: '#555', margin: 0 }}>
                            If you need to reschedule or request a refund, please reach out to us at <strong>support@snevio.com</strong>.
                        </p>
                    </div>

                </div>
            </div>
            
            {/* Footer space */}
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#999', fontSize: '13px' }}>
                © 2026 Snevio Cloud. All rights reserved.
            </div>
        </div>
    );
};

export default Refund;