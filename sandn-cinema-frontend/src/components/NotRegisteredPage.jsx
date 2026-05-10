import React from 'react';

// Props: onTryAgain, onLogin
const NotRegisteredPage = ({ onTryAgain, onLogin }) => {
  return (
    // यह पूरा कंटेनर स्क्रीन के ऊपर एक काली परत (Overlay) बनाएगा
    <div style={styles.overlayContainer}>
      
      {/* यह बीच वाला सफ़ेद बॉक्स (Popup) है */}
      <div style={styles.modalBox}>
        <div style={styles.attentionBox}>Attention Please</div>
        
        <h2 style={styles.errorMessage}>
          Your M.N No. is not Registered !
        </h2>

        <p style={styles.greenMessage}>Please Create Account & Enjoy Moments</p>
        
        {/* Try Again बटन दबाने पर यह Popup बंद हो जाएगा */}
        <button style={styles.tryAgainBtn} onClick={onTryAgain}>
          Try Again
        </button>

        <p style={styles.linkText}>
          To create Account : 
          <span style={styles.link} onClick={onLogin}> click here</span>
        </p>

        <div style={styles.suggestionBox}>
          <p style={styles.suggestionLabel}>Suggesion :</p>
          <p style={styles.suggestionText}>create SandN Cinema account.</p>
          <p style={styles.suggestionText}>you have already account so waiit 24/hours.</p>
        </div>
      </div>

    </div>
  );
};

// --- Updated CSS Styles ---
const styles = {
  // 1. Overlay (Background Dimmer)
  overlayContainer: {
    position: 'fixed', // स्क्रीन पर फिक्स
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // काला रंग 60% पारदर्शिता के साथ (Opacity effect)
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center', // बॉक्स को बिल्कुल बीच में लाएगा
    zIndex: 10000, // सबसे ऊपर
    backdropFilter: 'blur(3px)' // (Optional) पीछे का बैकग्राउंड थोड़ा धुंधला दिखेगा
  },

  // 2. Main Popup Box
  modalBox: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '15px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)', // गहरा साया (Shadow)
    textAlign: 'center',
    width: '90%',
    maxWidth: '400px',
    border: '2px solid #8b0000', // लाल बॉर्डर
    position: 'relative',
    animation: 'popIn 0.3s ease-out' // थोड़ा एनीमेशन (नीचे CSS में नहीं चलेगा, पर React में ठीक है)
  },

  attentionBox: {
    border: '1px solid #b22222',
    color: '#b22222',
    display: 'inline-block',
    padding: '5px 25px',
    fontSize: '18px',
    marginBottom: '20px',
    boxShadow: 'inset 0 0 5px rgba(0,0,0,0.1)',
    fontWeight: 'bold',
    backgroundColor: '#fff0f0'
  },
  errorMessage: {
    fontSize: '22px',
    color: 'black',
    margin: '15px 0',
    fontFamily: '"Times New Roman", serif',
  },
  greenMessage: {
    color: '#32cd32', // Lime Green
    margin: '10px 0',
    fontWeight: '500',
    fontSize: '16px'
  },
  
  // Buttons & Links
  tryAgainBtn: {
    backgroundColor: '#32cd32',
    color: 'white',
    border: 'none',
    padding: '10px 30px',
    borderRadius: '25px',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '15px',
    fontWeight: 'bold',
    boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
    transition: 'transform 0.1s'
  },
  
  linkText: { fontSize: '15px', margin: '20px 0 10px 0' },
  link: { color: 'blue', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' },
  
  suggestionBox: {
    textAlign: 'left',
    marginTop: '25px',
    fontSize: '13px',
    color: '#444',
    backgroundColor: '#f9f9f9',
    padding: '10px',
    borderRadius: '5px'
  },
  suggestionLabel: { marginBottom: '5px', fontWeight: 'bold' },
  suggestionText: { margin: '2px 0' },
};

export default NotRegisteredPage;