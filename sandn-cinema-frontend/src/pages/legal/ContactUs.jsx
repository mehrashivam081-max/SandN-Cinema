import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ContactUs = () => {
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
                <h1 style={{ textAlign: 'center', color: '#111', marginBottom: '5px', fontSize: '28px', fontWeight: '800' }}>Contact & Support</h1>
                <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '35px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Snevio Cloud | Photography Platform
                </p>

                <div style={{ lineHeight: '1.8', fontSize: '15px', color: '#444' }}>
                    
                    <p style={{ marginBottom: '30px', fontSize: '16px', textAlign: 'center' }}>
                        Have a question about a booking, your cloud gallery, or need technical support? We're here to help! Reach out to us using the details below.
                    </p>

                    <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '1px solid #eee' }}>
                        
                        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>🏢</span>
                            <div>
                                <strong style={{ color: '#2b5876', display: 'block', fontSize: '16px' }}>Business Details</strong>
                                <span>Snevio Cloud (ms_stu.dio)<br/>Proprietor: Shivam Mehar</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>📞</span>
                            <div>
                                <strong style={{ color: '#2b5876', display: 'block', fontSize: '16px' }}>Phone / WhatsApp</strong>
                                <span>+91 91115 52126</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>✉️</span>
                            <div>
                                <strong style={{ color: '#2b5876', display: 'block', fontSize: '16px' }}>Email Address</strong>
                                <a href="mailto:mehrashivam081@gmail.com" style={{ color: '#444', textDecoration: 'none' }}>mehrashivam081@gmail.com</a>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>📍</span>
                            <div>
                                <strong style={{ color: '#2b5876', display: 'block', fontSize: '16px' }}>Office Address</strong>
                                <span>Shankar Bag Silari, Sandiya Road,<br/>Pipariya, Madhya Pradesh - 461775</span>
                            </div>
                        </div>

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

export default ContactUs;