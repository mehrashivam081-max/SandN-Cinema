import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScannerModal = ({ onClose, onScan }) => {
    const [error, setError] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [useCamera, setUseCamera] = useState(true);
    const [manualCode, setManualCode] = useState('');
    const scannerRef = useRef(null);
    const fileInputRef = useRef(null);
    const html5QrCodeRef = useRef(null);
    const isInitializedRef = useRef(false);

    useEffect(() => {
        if (useCamera && !isInitializedRef.current) {
            startCameraScanner();
        }

        return () => {
            stopCameraScanner();
        };
    }, [useCamera]);

    const startCameraScanner = async () => {
        if (isInitializedRef.current) return;
        
        try {
            setIsScanning(true);
            setError(null);
            isInitializedRef.current = true;

            // Clear any existing content
            const readerElement = document.getElementById("qr-reader");
            if (readerElement) {
                readerElement.innerHTML = '';
            }

            html5QrCodeRef.current = new Html5Qrcode("qr-reader");
            
            await html5QrCodeRef.current.start(
                { facingMode: "environment" }, // Rear camera on mobile
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                (decodedText) => {
                    // QR code scanned successfully
                    const sessionId = extractSessionId(decodedText);
                    if (sessionId) {
                        stopCameraScanner();
                        onScan(sessionId);
                    }
                },
                (errorMessage) => {
                    // Ignore frame-level errors
                }
            );
        } catch (err) {
            console.error('Camera scanner error:', err);
            setError('Unable to access camera. Please upload QR image from gallery.');
            setIsScanning(false);
            isInitializedRef.current = false;
        }
    };

    const stopCameraScanner = async () => {
        if (html5QrCodeRef.current && isInitializedRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
            } catch (err) {
                console.error('Error stopping scanner:', err);
            }
        }
        setIsScanning(false);
        isInitializedRef.current = false;
    };

    const extractSessionId = (qrText) => {
        // Extract sessionId from URL or raw token
        if (qrText.includes('qrSession=')) {
            const match = qrText.match(/qrSession=([^&]+)/);
            return match ? match[1] : null;
        }
        // Check if it's a raw session ID
        if (qrText.startsWith('QR-')) {
            return qrText;
        }
        return null;
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const html5QrCode = new Html5Qrcode("qr-reader");
        
        html5QrCode.scanFile(file, true)
            .then(decodedText => {
                const sessionId = extractSessionId(decodedText);
                if (sessionId) {
                    onScan(sessionId);
                } else {
                    setError('Invalid QR code. Please scan a valid session QR.');
                }
            })
            .catch(err => {
                console.error('QR scan error:', err);
                setError('Unable to decode QR code from image.');
            });
    };

    const handleManualSubmit = () => {
        const sessionId = extractSessionId(manualCode.trim());
        if (sessionId) {
            onScan(sessionId);
        } else {
            setError('Invalid session code. Please enter a valid QR session ID.');
        }
    };

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
            padding: '20px'
        }}>
            <div style={{
                background: '#1a1a2e',
                borderRadius: '20px',
                padding: '30px',
                maxWidth: '400px',
                width: '100%',
                color: '#fff',
                textAlign: 'center',
                border: '2px solid #FFD700'
            }}>
                <h2 style={{ color: '#FFD700', marginBottom: '10px', margin: 0 }}>
                    Scan QR Code
                </h2>
                <p style={{ color: '#aaa', marginBottom: '20px', fontSize: '14px' }}>
                    Position the QR code within the frame
                </p>

                <div style={{ 
                    position: 'relative', 
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '280px'
                }}>
                    {useCamera ? (
                        <>
                            <div 
                                id="qr-reader"
                                style={{ 
                                    width: '280px',
                                    height: '280px',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    border: '2px solid #FFD700'
                                }}
                            />
                            <style>{`
                                #qr-reader video {
                                    width: 100% !important;
                                    height: 100% !important;
                                    object-fit: cover !important;
                                }
                            `}</style>
                            {/* Animated scanning frame */}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '250px',
                                height: '250px',
                                border: '3px solid #FFD700',
                                borderRadius: '12px',
                                pointerEvents: 'none',
                                boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                                animation: 'pulse 2s infinite'
                            }} />
                            <style>{`
                                @keyframes pulse {
                                    0%, 100% { opacity: 1; }
                                    50% { opacity: 0.5; }
                                }
                            `}</style>
                        </>
                    ) : (
                        <div style={{
                            padding: '40px',
                            border: '2px dashed #FFD700',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            width: '280px',
                            height: '280px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }} onClick={() => fileInputRef.current.click()}>
                            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📷</div>
                            <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '14px' }}>
                                Tap to Upload QR Image
                            </div>
                        </div>
                    )}
                    
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                </div>

                {error && (
                    <div style={{ 
                        background: 'rgba(231, 76, 60, 0.2)', 
                        border: '1px solid #e74c3c',
                        padding: '10px', 
                        borderRadius: '8px', 
                        marginBottom: '20px', 
                        fontSize: '14px',
                        color: '#e74c3c'
                    }}>
                        {error}
                    </div>
                )}

                {/* Manual Entry Section */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                        color: '#FFD700', 
                        fontSize: '12px', 
                        marginBottom: '10px',
                        letterSpacing: '1px'
                    }}>
                        — OR ENTER CODE MANUALLY —
                    </div>
                    <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="Enter session ID"
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'rgba(255, 215, 0, 0.1)',
                            border: '1px solid rgba(255, 215, 0, 0.3)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '14px',
                            outline: 'none',
                            marginBottom: '10px'
                        }}
                    />
                    <button
                        onClick={handleManualSubmit}
                        disabled={!manualCode.trim()}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: 'linear-gradient(135deg, #FFD700, #f1c40f)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)'
                        }}
                    >
                        Join Session
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                        onClick={() => {
                            setUseCamera(!useCamera);
                            if (!useCamera) {
                                setTimeout(() => startCameraScanner(), 100);
                            }
                        }}
                        style={{
                            padding: '12px 24px',
                            background: '#2a2a4e',
                            color: '#FFD700',
                            border: '1px solid #FFD700',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {useCamera ? '📷 Upload Image' : '📹 Use Camera'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '12px 24px',
                            background: 'transparent',
                            color: '#888',
                            border: '1px solid #444',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QRScannerModal;
