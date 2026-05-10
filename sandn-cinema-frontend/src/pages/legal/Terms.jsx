import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const Terms = () => {
    const [termsContent, setTermsContent] = useState("");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Jab page khule toh scroll ekdum top par aa jaye
    useEffect(() => {
        window.scrollTo(0, 0);
        const fetchData = async () => {
            try {
                const res = await axios.get(`${API_BASE}/get-platform-settings`);
                if (res.data.success && res.data.data?.policies?.terms) {
                    setTermsContent(res.data.data.policies.terms);
                }
            } catch (e) {
                console.log("Error fetching terms");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
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

            {/* 📄 MAIN CONTENT BOX (White box with dark text for clear visibility) */}
            <div style={{ 
                maxWidth: '800px', 
                margin: '0 auto', 
                background: '#ffffff', 
                borderRadius: '12px', 
                padding: '40px 30px', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)', 
                color: '#333' // 🔥 FIX: Explicit dark text color
            }}>
                <h1 style={{ textAlign: 'center', color: '#111', marginBottom: '5px', fontSize: '28px', fontWeight: '800' }}>Terms & Conditions</h1>
                <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '35px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Last Updated: April 2026 | Snevio Cloud
                </p>

                <div style={{ lineHeight: '1.8', fontSize: '15px', color: '#444', whiteSpace: 'pre-line' }}>
    {loading ? (
        <p style={{textAlign: 'center', color: '#888'}}>Fetching latest terms...</p>
    ) : (
        termsContent || "No terms and conditions found. Please update from Admin Panel."
    )}
</div>
            </div>
            
            {/* Footer space */}
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#999', fontSize: '13px' }}>
                © 2026 Snevio Cloud. All rights reserved.
            </div>
        </div>
    );
};

export default Terms;