import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // URL से पेमेंट का स्टेटस और ID निकालना
  const paymentId = searchParams.get('payment_id');
  const paymentStatus = searchParams.get('payment_status');

  return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      {paymentStatus === 'Credit' ? (
        <>
          <h1 style={{ color: 'green' }}>🎉 Payment Successful!</h1>
          <p>Your Payment ID is: <strong>{paymentId}</strong></p>
          <p style={{ color: '#555' }}>Coins have been successfully added to your wallet.</p>
        </>
      ) : (
        <>
          <h1 style={{ color: 'red' }}>❌ Payment Failed</h1>
          <p>Something went wrong with your transaction. Please try again.</p>
        </>
      )}
      
      <br />
      <button 
        onClick={() => navigate('/dashboard')} // यहाँ अपने डैशबोर्ड का सही लिंक डाल देना
        style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
      >
        Go to Dashboard
      </button>
    </div>
  );
};

export default PaymentSuccess;