import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fontsource-variable/inter';
// Design system global : chargé une seule fois, avant le CSS des pages
import './styles/theme.css';
import './index.css';
import './styles/animations.css';
import './styles/Buttons.css';
import './styles/ModalSystem.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
