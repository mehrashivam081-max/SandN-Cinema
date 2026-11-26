import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const QRClaimModal = ({ sessionId, onClose, onSuccess }) => {
    const [currentStep, setCurrentStep] = useState(0); // 0: Center, 1: Left, 2: Right
    const [videoStream, setVideoStream] = useState(null);
    const [capturedAngles, setCapturedAngles] = useState({ center: null, left: null, right: null });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const steps = [
        { title: 'Look Straight (Center)', subtitle: 'Position your face in the center of the frame' },
        { title: 'Turn Slightly Left', subtitle: 'Rotate your head about 30 degrees to the left' },
        { title: 'Turn Slightly Right', subtitle: 'Rotate your head about 30 degrees to the right' }
    ];

    useEffect(() => {
        startCamera();
        return () => {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            setVideoStream(stream);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                };
            }
        } catch (error) {
            console.error('Camera error:', error);
            setError('Unable to access camera. Please check permissions.');
        }
    };

    const compressImage = (canvas) => {
        const maxWidth = 800;
        const scale = maxWidth / canvas.width;
        const scaledWidth = Math.min(maxWidth, canvas.width);
        const scaledHeight = canvas.height * scale;

        const compressedCanvas = document.createElement('canvas');
        compressedCanvas.width = scaledWidth;
        compressedCanvas.height = scaledHeight;
        
        const ctx = compressedCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);

        return compressedCanvas.toDataURL('image/jpeg', 0.7);
    };

    const captureAngle = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            const compressedImage = compressImage(canvas);
            
            const angleKeys = ['center', 'left', 'right'];
            setCapturedAngles(prev => ({
                ...prev,
                [angleKeys[currentStep]]: compressedImage
            }));

            if (currentStep < 2) {
                setCurrentStep(currentStep + 1);
            } else {
                submitRegistration();
            }
        }
    };

    const retakeAngle = () => {
        const angleKeys = ['center', 'left', 'right'];
        setCapturedAngles(prev => ({
            ...prev,
            [angleKeys[currentStep]]: null
        }));
    };

    const submitRegistration = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await axios.post(`/api/qr-session/${sessionId}/register-face`, {
                mobile: localStorage.getItem('userMobile') || '',
                email: localStorage.getItem('userEmail') || '',
                name: localStorage.getItem('userName') || '',
                faceAngles: capturedAngles
            });

            if (response.data.success) {
                onSuccess(response.data);
            } else {
                setError(response.data.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            setError('Error registering face. Please try again.');
        } finally {
            setIsSubmitting(false);
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
                maxWidth: '600px',
                width: '100%',
                color: '#fff',
                textAlign: 'center'
            }}>
                <h2 style={{ marginBottom: '10px', color: '#64b5f6' }}>
                    Face Registration
                </h2>
                <p style={{ marginBottom: '20px', color: '#aaa', fontSize: '14px' }}>
                    {steps[currentStep].title}
                </p>
                <p style={{ marginBottom: '20px', color: '#888', fontSize: '12px' }}>
                    {steps[currentStep].subtitle}
                </p>

                <div style={{ position: 'relative', marginBottom: '20px' }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: '100%',
                            borderRadius: '15px',
                            transform: 'scaleX(-1)'
                        }}
                    />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                {/* Progress Indicator */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                    {[0, 1, 2].map((step) => (
                        <div
                            key={step}
                            style={{
                                width: '30px',
                                height: '8px',
                                borderRadius: '4px',
                                background: step <= currentStep ? '#64b5f6' : '#333',
                                transition: 'background 0.3s'
                            }}
                        />
                    ))}
                </div>

                {error && (
                    <div style={{ background: '#e74c3c', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    {capturedAngles[['center', 'left', 'right'][currentStep]] ? (
                        <>
                            <button
                                onClick={retakeAngle}
                                disabled={isSubmitting}
                                style={{
                                    padding: '12px 24px',
                                    background: '#e74c3c',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}
                            >
                                Retake
                            </button>
                            {currentStep === 2 ? (
                                <button
                                    onClick={submitRegistration}
                                    disabled={isSubmitting}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#2ecc71',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Complete Registration'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setCurrentStep(currentStep + 1)}
                                    disabled={isSubmitting}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#64b5f6',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    Next
                                </button>
                            )}
                        </>
                    ) : (
                        <button
                            onClick={captureAngle}
                            disabled={isSubmitting}
                            style={{
                                padding: '12px 24px',
                                background: '#64b5f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold'
                            }}
                        >
                            Capture
                        </button>
                    )}
                </div>

                <button
                    onClick={onClose}
                    style={{
                        marginTop: '20px',
                        background: 'transparent',
                        color: '#888',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default QRClaimModal;
