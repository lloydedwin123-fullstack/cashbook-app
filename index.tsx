import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// import './index.css'; // Commented out for hybrid support (Tailwind CDN used in preview)
import { register } from './registerServiceWorker';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for PWA support
register();
