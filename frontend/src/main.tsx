import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#1a1a2e',
                        color: '#e0e0e8',
                        border: '1px solid #1e1e30',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.8rem',
                    },
                    success: {
                        iconTheme: { primary: '#00ff41', secondary: '#000' },
                    },
                    error: {
                        iconTheme: { primary: '#ff0040', secondary: '#000' },
                    },
                }}
            />
            <App />
        </BrowserRouter>
    </React.StrictMode>
);
