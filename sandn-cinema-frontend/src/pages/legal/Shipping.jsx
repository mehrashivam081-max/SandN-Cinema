import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Shipping = () => {
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
                <h1 style={{ textAlign: 'center', color: '#111', marginBottom: '5px', fontSize: '28px', fontWeight: '800' }}>Shipping & Delivery Policy</h1>
                <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '35px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Snevio Cloud | Digital Delivery
                </p>

                <div style={{ lineHeight: '1.8', fontSize: '15px', color: '#444' }}>
                    
                    <p style={{ marginBottom: '20px', fontSize: '16px' }}>
                        Snevio is a premium digital cloud platform. Please note that <strong>no physical products are shipped</strong> unless specifically mentioned in a custom package or studio deal.
                    </p>

                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>1. Delivery Method</h3>
                    <p style={{ marginBottom: '15px' }}>
                        All media (photos and videos) are delivered strictly via secure <strong>Digital Links and Cloud Galleries</strong>. You will receive access through your registered mobile number and password.
                    </p>

                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>2. Delivery Timeline</h3>
                    <p style={{ marginBottom: '15px' }}>
                        Standard media is usually processed and delivered within <strong>24 to 72 hours</strong> post-event or shoot. Custom editing and heavy video rendering may take additional time as communicated by your studio.
                    </p>

                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>3. Access & Storage</h3>
                    <p style={{ marginBottom: '15px' }}>
                        You will have uninterrupted access to your cloud gallery for <strong>12 months</strong> from the date of upload. We highly recommend downloading and backing up your media to your local devices within this timeframe.
                    </p>

                    <div style={{ marginTop: '40px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #2b5876' }}>
                        <h4 style={{ color: '#111', marginBottom: '8px', fontSize: '16px' }}>Delivery Issues?</h4>
                        <p style={{ fontSize: '14px', color: '#555', margin: 0 }}>
                            If your delivery timeline has passed and you haven't received your gallery, please contact us at <strong>support@snevio.com</strong>.
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

export default Shipping;