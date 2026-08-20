import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/app.css';
import { AuthProvider } from './auth/AuthContext.jsx';

createRoot(document.getElementById('root')).render(
  React.createElement(
    BrowserRouter,
    null,
    React.createElement(AuthProvider, null, React.createElement(App))
  )
);
