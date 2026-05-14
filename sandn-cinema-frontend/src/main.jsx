import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/variables.css';
import './styles/global.css';
import './styles/responsive.css'; // Assuming this exists or is part of global
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// 🔥 ZOMBIE KILLER: Purane Service Worker ko hamesha ke liye maar do taaki naya code load ho!
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister().then(bool => {
        console.log("🧟‍♂️ Zombie Service Worker Killed: ", bool);
      });
    }
  });
  
  // Cache storage ko bhi saaf kar do
  if (window.caches) {
      caches.keys().then((keyList) => {
          Promise.all(keyList.map((key) => caches.delete(key)));
      });
  }
}