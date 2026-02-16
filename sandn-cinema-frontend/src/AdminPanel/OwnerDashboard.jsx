import React from 'react';

const OwnerDashboard = () => {
    const cardStyle = { background: 'var(--bg-card)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' };
    return (
        <div style={{ padding: '40px' }}>
            <h2 style={{ color: 'var(--accent-gold)', textAlign: 'center', marginBottom: '40px' }}>👑 Super Admin Control</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px' }}>
                <div style={cardStyle}>
                    <h3>Total Users</h3>
                    <p style={{ fontSize: '2.5rem', color: 'var(--primary-red)' }}>120</p>
                </div>
                <div style={{ ...cardStyle, borderColor: 'var(--accent-gold)' }}>
                    <h3>Active Studios</h3>
                    <p style={{ fontSize: '2.5rem', color: 'var(--accent-gold)' }}>15</p>
                </div>
                <div style={cardStyle}>
                    <h3>Content Manager</h3>
                    <button style={{ marginTop: '20px', padding: '10px 20px', background: '#444', color: 'white', border: 'none', borderRadius: '5px' }}>Edit Terms</button>
                </div>
            </div>
        </div>
    );
};
export default OwnerDashboard;