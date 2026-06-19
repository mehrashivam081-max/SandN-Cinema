import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE;

const Terms = () => {
    const [termsContent, setTermsContent] = useState("");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

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
        <div style={{ minHeight: '100vh', background: '#0a0a0c', padding: '40px 20px', fontFamily: "'Poppins', sans-serif" }}>
            
            {/* 🔙 BACK BUTTON */}
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '25px' }}>
                <button onClick={() => navigate('/')} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '30px', textTransform: 'uppercase', letterSpacing: '1px', backdropFilter: 'blur(10px)', transition: '0.3s' }} onMouseEnter={(e)=>e.currentTarget.style.background='rgba(255,215,0,0.1)'} onMouseLeave={(e)=>e.currentTarget.style.background='rgba(255, 255, 255, 0.05)'}>
                    <span style={{ fontSize: '16px' }}>←</span> Back to Home
                </button>
            </div>

            {/* 📄 MAIN CONTENT BOX (Premium Glass Theme) */}
            <div style={{ maxWidth: '800px', margin: '0 auto', background: 'rgba(25, 25, 30, 0.7)', borderRadius: '24px', padding: '40px', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(20px)' }}>
                <h1 style={{ textAlign: 'center', color: '#FFD700', marginBottom: '5px', fontSize: '28px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>Terms & Conditions</h1>
                <p style={{ textAlign: 'center', color: '#888', fontSize: '12px', marginBottom: '35px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Last Updated: {new Date().getFullYear()} | Snevio Cloud
                </p>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '30px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', lineHeight: '1.8', fontSize: '14px', color: '#ccc', whiteSpace: 'pre-line', fontWeight: '300', letterSpacing: '0.5px' }}>
                    {loading ? (
                        <p style={{textAlign: 'center', color: '#FFD700', margin: 0, fontWeight: '500'}}>Fetching latest terms...</p>
                    ) : (
                        termsContent || "No terms and conditions found. Please update from Admin Panel."
                    )}
                </div>
            </div>
            
            {/* Footer space */}
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#555', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                © {new Date().getFullYear()} Snevio Cloud. All rights reserved.
            </div>
        </div>
    );
};

export default Terms;