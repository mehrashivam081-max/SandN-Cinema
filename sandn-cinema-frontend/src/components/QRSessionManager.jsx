import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';

const QRSessionManager = ({ onClose, studioMobile }) => {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        expiresAt: '',
        maxDownloads: 10
    });
    const [uploadUrls, setUploadUrls] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            const response = await axios.post('/api/qr-session/list');
            if (response.data.success) {
                setSessions(response.data.sessions);
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
        }
    };

    const createSession = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post('/api/qr-session/create', formData);
            if (response.data.success) {
                setShowCreateForm(false);
                setFormData({ title: '', expiresAt: '', maxDownloads: 10 });
                loadSessions();
                setSelectedSession(response.data.session);
            } else {
                setError(response.data.message || 'Failed to create session');
            }
        } catch (error) {
            console.error('Error creating session:', error);
            setError('Error creating session');
        } finally {
            setLoading(false);
        }
    };

    const uploadPhotos = async () => {
        if (!selectedSession || !uploadUrls.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const urls = uploadUrls.split('\n').map(url => url.trim()).filter(url => url);
            const response = await axios.post(`/api/qr-session/${selectedSession.sessionId}/upload`, {
                photoUrls: urls
            });

            if (response.data.success) {
                setUploadUrls('');
                loadSessionDetails(selectedSession.sessionId);
                alert('Photos uploaded successfully!');
            } else {
                setError(response.data.message || 'Failed to upload photos');
            }
        } catch (error) {
            console.error('Error uploading photos:', error);
            setError('Error uploading photos');
        } finally {
            setLoading(false);
        }
    };

    const loadSessionDetails = async (sessionId) => {
        try {
            const response = await axios.post(`/api/qr-session/${sessionId}/details`);
            if (response.data.success) {
                setSelectedSession(response.data.session);
            }
        } catch (error) {
            console.error('Error loading session details:', error);
        }
    };

    const copyLink = () => {
        const link = `${window.location.origin}/?qrSession=${selectedSession.sessionId}`;
        navigator.clipboard.writeText(link);
        alert('Link copied to clipboard!');
    };

    const downloadQR = () => {
        const svgElement = document.querySelector('svg');
        if (svgElement) {
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const link = document.createElement('a');
                link.download = `qr-${selectedSession.sessionId}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            
            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
        }
    };

    const isExpired = (date) => new Date() > new Date(date);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 9999999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            overflowY: 'auto'
        }}>
            <div style={{
                background: '#1a1a2e',
                borderRadius: '20px',
                padding: '30px',
                maxWidth: '900px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                color: '#fff'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ color: '#64b5f6', margin: 0 }}>QR Session Manager</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#e74c3c',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>

                {error && (
                    <div style={{ background: '#e74c3c', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>
                        {error}
                    </div>
                )}

                {!showCreateForm && !selectedSession && (
                    <>
                        <button
                            onClick={() => setShowCreateForm(true)}
                            style={{
                                background: '#2ecc71',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px 24px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                marginBottom: '20px'
                            }}
                        >
                            + Create New Session
                        </button>

                        <h3 style={{ color: '#64b5f6', marginBottom: '15px' }}>Your Sessions</h3>
                        {sessions.length === 0 ? (
                            <p style={{ color: '#888' }}>No sessions created yet</p>
                        ) : (
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {sessions.map(session => (
                                    <div
                                        key={session.sessionId}
                                        onClick={() => loadSessionDetails(session.sessionId)}
                                        style={{
                                            background: '#2a2a4e',
                                            padding: '15px',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            border: isExpired(session.expiresAt) ? '2px solid #e74c3c' : '2px solid #64b5f6'
                                        }}
                                    >
                                        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{session.title}</div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>
                                            ID: {session.sessionId}
                                        </div>
                                        <div style={{ fontSize: '12px', color: isExpired(session.expiresAt) ? '#e74c3c' : '#2ecc71' }}>
                                            {isExpired(session.expiresAt) ? 'Expired' : 'Active'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#888' }}>
                                            Photos: {session.uploadedPhotos.length} | Users: {session.registeredUsers.length}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {showCreateForm && (
                    <form onSubmit={createSession}>
                        <h3 style={{ color: '#64b5f6', marginBottom: '15px' }}>Create New QR Session</h3>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>Event Title</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: '#2a2a4e',
                                    border: '1px solid #444',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>Expiry Date & Time</label>
                            <input
                                type="datetime-local"
                                value={formData.expiresAt}
                                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: '#2a2a4e',
                                    border: '1px solid #444',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>Max Downloads per User</label>
                            <input
                                type="number"
                                value={formData.maxDownloads}
                                onChange={(e) => setFormData({ ...formData, maxDownloads: parseInt(e.target.value) })}
                                min="1"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: '#2a2a4e',
                                    border: '1px solid #444',
                                    borderRadius: '8px',
                                    color: '#fff'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: '#2ecc71',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold'
                                }}
                            >
                                {loading ? 'Creating...' : 'Create Session'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreateForm(false)}
                                style={{
                                    padding: '12px 24px',
                                    background: '#e74c3c',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {selectedSession && (
                    <div>
                        <button
                            onClick={() => setSelectedSession(null)}
                            style={{
                                background: 'transparent',
                                color: '#64b5f6',
                                border: 'none',
                                cursor: 'pointer',
                                marginBottom: '20px',
                                fontSize: '14px'
                            }}
                        >
                            ← Back to Sessions
                        </button>

                        <h3 style={{ color: '#64b5f6', marginBottom: '15px' }}>{selectedSession.title}</h3>
                        
                        <div style={{ background: '#2a2a4e', padding: '20px', borderRadius: '15px', marginBottom: '20px', textAlign: 'center' }}>
                            <div style={{ marginBottom: '15px' }}>
                                <QRCodeSVG value={`${window.location.origin}/?qrSession=${selectedSession.sessionId}`} size={200} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <button
                                    onClick={copyLink}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#64b5f6',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Copy Link
                                </button>
                                <button
                                    onClick={downloadQR}
                                    style={{
                                        padding: '10px 20px',
                                        background: '#2ecc71',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Download QR
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ color: '#64b5f6', marginBottom: '10px' }}>Upload Photos</h4>
                            <textarea
                                value={uploadUrls}
                                onChange={(e) => setUploadUrls(e.target.value)}
                                placeholder="Enter photo URLs (one per line)"
                                rows={5}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: '#2a2a4e',
                                    border: '1px solid #444',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    marginBottom: '10px'
                                }}
                            />
                            <button
                                onClick={uploadPhotos}
                                disabled={loading || !uploadUrls.trim()}
                                style={{
                                    padding: '10px 20px',
                                    background: '#64b5f6',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: loading || !uploadUrls.trim() ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {loading ? 'Uploading...' : 'Upload Photos'}
                            </button>
                        </div>

                        <div>
                            <h4 style={{ color: '#64b5f6', marginBottom: '10px' }}>
                                Registered Users ({selectedSession.registeredUsers.length})
                            </h4>
                            {selectedSession.registeredUsers.length === 0 ? (
                                <p style={{ color: '#888' }}>No users registered yet</p>
                            ) : (
                                <div style={{ display: 'grid', gap: '10px' }}>
                                    {selectedSession.registeredUsers.map((user, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                background: '#2a2a4e',
                                                padding: '15px',
                                                borderRadius: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '15px'
                                            }}
                                        >
                                            {user.faceAngles?.center && (
                                                <img
                                                    src={user.faceAngles.center}
                                                    alt="Face"
                                                    style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover'
                                                    }}
                                                />
                                            )}
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{user.name || 'Unknown'}</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>{user.mobile}</div>
                                                <div style={{ fontSize: '12px', color: '#888' }}>
                                                    {new Date(user.registeredAt).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRSessionManager;
