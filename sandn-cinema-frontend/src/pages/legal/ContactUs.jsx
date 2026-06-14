import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ContactUs = () => {
    const navigate = useNavigate();
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        window.scrollTo(0, 0);
        axios.get('https://sandn-cinema.onrender.com/api/auth/get-platform-settings')
            .then(res => {
                if (res.data.success && res.data.data?.policies?.contact) {
                    setContent(res.data.data.policies.contact);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div style={{ minHeight: '100vh', background: '#f4f7f6', padding: '30px 15px', fontFamily: '"Segoe UI", Roboto, sans-serif' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '20px' }}>
                <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#2b5876', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}>
                    <span style={{ fontSize: '18px' }}>←</span> Back to Home
                </button>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto', background: '#ffffff', borderRadius: '12px', padding: '40px 30px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', color: '#333' }}>
                <h1 style={{ textAlign: 'center', color: '#111', marginBottom: '5px', fontSize: '28px', fontWeight: '800' }}>Contact & Support</h1>
                <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '35px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    We are here to help
                </p>

                <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '1px solid #eee', lineHeight: '1.8', fontSize: '15px', color: '#444', whiteSpace: 'pre-line' }}>
                    {loading ? (
                        <p style={{textAlign: 'center', color: '#888', fontStyle: 'italic', margin: 0}}>Loading contact details...</p>
                    ) : (
                        content || "Contact details not found. Please update from the Admin Panel."
                    )}
                </div>
            </div>
            
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#999', fontSize: '13px' }}>
                © {new Date().getFullYear()} Snevio Cloud. All rights reserved.
            </div>
        </div>
    );
};

export default ContactUs;