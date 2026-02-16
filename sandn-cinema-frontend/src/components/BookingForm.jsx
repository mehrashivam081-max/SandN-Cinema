import React from 'react';
import './BookingForm.css'; // Assume similar modal styles in global or create specific

const BookingForm = ({ onClose }) => {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>🎬 Book Ticket</h3>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                
                <div className="modal-body">
                    <label>Select Movie/Show</label>
                    <select>
                        <option>Morning Show (10 AM)</option>
                        <option>Matinee Show (1 PM)</option>
                        <option>Evening Show (6 PM)</option>
                    </select>

                    <label>Number of Seats</label>
                    <input type="number" min="1" max="10" placeholder="1" />

                    <div className="price-summary">
                        <p>Price per ticket: ₹200</p>
                        <h4>Total: ₹200</h4>
                    </div>

                    <button className="pay-btn">PROCEED TO PAY</button>
                </div>
            </div>
        </div>
    );
};

export default BookingForm;