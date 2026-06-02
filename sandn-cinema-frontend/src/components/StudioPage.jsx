import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './UserDashboard.css'; // Purani styling use kar lenge

const API_BASE = 'https://sandn-cinema-backend-test.onrender.com/api/auth';
const SERVER_URL = 'https://sandn-cinema-backend-test.onrender.com/';

const StudioPage = () => {
    const { studioName } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [studioData, setStudioData] = useState(null);
    const [posts, setPosts] = useState([]);
    const [previewMedia, setPreviewMedia] = useState(null);

    useEffect(() => {
        const fetchStudioProfile = async () => {
            try {
                const res = await axios.get(`${API_BASE}/studio-page/${encodeURIComponent(studioName)}`);
                if (res.data.success) {
                    setStudioData(res.data.studio);
                    setPosts(res.data.posts);
                } else {
                    alert(res.data.message);
                    navigate('/'); // Not found toh home pe fenk do
                }
            } catch (err) {
                console.error(err);
                alert("Failed to load studio profile.");
            } finally {
                setLoading(false);
            }
        };
        fetchStudioProfile();
    }, [studioName, navigate]);

    const getCleanUrl = (filePath) => {
        if (!filePath) return '';
        if (filePath.startsWith('http')) return filePath; 
        return `${SERVER_URL}${filePath.replace(/\\/g, '/')}`; 
    };

    if (loading) return <div className="loading-state-vip" style={{height: '100vh', display:'flex', alignItems:'center', justifyContent:'center'}}>Loading Studio Profile...</div>;
    if (!studioData) return <div className="loading-state-vip">Studio Not Found</div>;

    return (
        <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff', paddingBottom: '50px' }}>
            
            {/* 🚀 STUDIO BANNER */}
            <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)', padding: '40px 20px', textAlign: 'center', borderBottom: '2px solid #f1c40f', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '200px', height: '200px', background: 'rgba(241, 196, 15, 0.1)', borderRadius: '50%', filter: 'blur(50px)' }}></div>
                
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: '3px solid #f1c40f', margin: '0 auto 15px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 5px 15px rgba(241, 196, 15, 0.3)' }}>
                    {studioData.profileImage ? (
                        <img src={studioData.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="DP" />
                    ) : (
                        <span style={{ fontSize: '40px' }}>📸</span>
                    )}
                </div>
                
                <h1 style={{ margin: '0 0 5px 0', fontSize: '28px', color: '#fff' }}>
                    {studioData.studioName} {studioData.isVerified && <span title="Verified Studio" style={{fontSize:'20px'}}>✨</span>}
                </h1>
                <p style={{ margin: '0 0 15px 0', color: '#aaa', fontSize: '14px' }}>📍 {studioData.location}</p>
                
                <button onClick={() => navigate('/login')} style={{ background: '#2ecc71', color: '#fff', border: 'none', padding: '10px 25px', borderRadius: '30px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(46, 204, 113, 0.4)' }}>
                    Book a Shoot
                </button>
            </div>

            {/* 📸 STUDIO PORTFOLIO FEED */}
            <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
                <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', color: '#f1c40f' }}>Portfolio & Works ({posts.length})</h3>
                
                {posts.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px', marginTop: '20px' }}>
                        {posts.map((post, idx) => (
                            <div key={idx} onClick={() => setPreviewMedia(post)} style={{ background: '#1a1a2e', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #333', position: 'relative' }}>
                                <div style={{ height: '180px', width: '100%', background: '#000' }}>
                                    {post.fileType === 'video' ? (
                                        <>
                                            <video src={getCleanUrl(post.file)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '24px' }}>▶️</div>
                                        </>
                                    ) : (
                                        <img src={getCleanUrl(post.file)} alt="Post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}
                                </div>
                                <div style={{ padding: '10px' }}>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '50px 20px', color: '#888' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>📭</div>
                        <p>This studio hasn't uploaded any public portfolio yet.</p>
                    </div>
                )}
            </div>

            {/* 🌐 POWERED BY SNEVIO BANNER */}
            <div style={{ textAlign: 'center', marginTop: '40px', padding: '20px', borderTop: '1px solid #222' }}>
                <p style={{ fontSize: '12px', color: '#666', margin: '0 0 10px 0' }}>This digital portfolio is proudly powered by</p>
                <h2 style={{ margin: 0, fontSize: '20px', letterSpacing: '2px', color: '#fff', cursor: 'pointer' }} onClick={() => navigate('/')}>
                    SNE<span style={{ color: '#f1c40f' }}>VIO</span>
                </h2>
            </div>

            {/* FULL SCREEN PREVIEW MODAL */}
            {previewMedia && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <button onClick={() => setPreviewMedia(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px', cursor: 'pointer', zIndex: 10 }}>✖</button>
                    
                    <div style={{ width: '90%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', justifyContent: 'center', background: '#000', borderRadius: '15px', overflow: 'hidden' }}>
                        {previewMedia.fileType === 'video' ? (
                            <video src={getCleanUrl(previewMedia.file)} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                            <img src={getCleanUrl(previewMedia.file)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        )}
                    </div>
                    <p style={{ color: '#fff', marginTop: '15px', fontSize: '14px', textAlign: 'center', maxWidth: '80%' }}>{previewMedia.description}</p>
                </div>
            )}
        </div>
    );
};

export default StudioPage;