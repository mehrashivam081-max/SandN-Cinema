import React, { useRef, useState, useEffect } from 'react';
import YouTube from 'react-youtube';

const SyncPlayer = ({ ytVideoId, audioUrl }) => {
    const audioRef = useRef(null);
    const ytPlayerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);

    // ⚙️ YOUTUBE PLAYER OPTIONS
    const opts = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 0,
            mute: 1,         // 🔥 MOST IMPORTANT: YouTube hamesha mute rahega
            controls: 1,     // Controls dikhayenge taaki user aage-peeche kar sake
            rel: 0,          // Related videos hide karega
            modestbranding: 1
        },
    };

    // ✅ JAB YOUTUBE LOAD HO JAYE
    const onReady = (event) => {
        ytPlayerRef.current = event.target;
        setIsReady(true);
    };

    // 🚀 THE SYNC ENGINE (Play, Pause, Buffer, Seek)
    const onStateChange = (event) => {
        if (!audioRef.current || !ytPlayerRef.current) return;

        // YT.PlayerState.PLAYING = 1
        // YT.PlayerState.PAUSED = 2
        // YT.PlayerState.BUFFERING = 3

        const ytTime = ytPlayerRef.current.getCurrentTime();

        if (event.data === 1) {
            // JAB VIDEO PLAY HO: Audio ko exact us time pe set karo aur play karo
            // 0.2 second ka threshold taaki minor lag pe audio na atke
            if (Math.abs(audioRef.current.currentTime - ytTime) > 0.2) {
                audioRef.current.currentTime = ytTime;
            }
            audioRef.current.play().catch(e => console.log("Audio Play Blocked by Browser"));
        } 
        else if (event.data === 2 || event.data === 3) {
            // JAB VIDEO PAUSE YA BUFFER HO: Audio ko turant rok do
            audioRef.current.pause();
            audioRef.current.currentTime = ytTime; // Time sync karke ready rakho
        }
    };

    // 🔄 CONTINUOUS SYNC CHECKER (Agar internet lag kare)
    useEffect(() => {
        if (!isReady) return;
        
        const syncInterval = setInterval(() => {
            if (ytPlayerRef.current && audioRef.current && ytPlayerRef.current.getPlayerState() === 1) {
                const ytTime = ytPlayerRef.current.getCurrentTime();
                const audioTime = audioRef.current.currentTime;
                
                // Agar audio aur video mein 0.5 second se zyada ka farq aaye, toh zabardasti sync karo
                if (Math.abs(ytTime - audioTime) > 0.5) {
                    console.log("Sync Adjusting...");
                    audioRef.current.currentTime = ytTime;
                }
            }
        }, 1000); // Har 1 second mein check karega

        return () => clearInterval(syncInterval);
    }, [isReady]);

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto', background: '#000', borderRadius: '15px', overflow: 'hidden', aspectRatio: '16/9', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            
            {/* 🔊 HIDDEN CLOUD AUDIO PLAYER */}
            <audio ref={audioRef} src={audioUrl} preload="auto" />

            {/* 🎥 YOUTUBE IFRAME (Muted) */}
            <div style={{ width: '100%', height: '100%', pointerEvents: isReady ? 'auto' : 'none', opacity: isReady ? 1 : 0.5, transition: 'opacity 0.5s' }}>
                <YouTube 
                    videoId={ytVideoId} 
                    opts={opts} 
                    onReady={onReady} 
                    onStateChange={onStateChange} 
                    style={{ width: '100%', height: '100%' }}
                    iframeClassName="yt-iframe-custom"
                />
            </div>

            {!isReady && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontWeight: 'bold' }}>
                    Loading Player Elements...
                </div>
            )}
        </div>
    );
};

export default SyncPlayer;
