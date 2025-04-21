import React from 'react'; // Import React
import ReactDOM from 'react-dom/client'; // Use ReactDOM
import './index.css'; // Import CSS (including GDS)
import App from './App.tsx';
import { initAll } from 'govuk-frontend'; // Import GDS JS

ReactDOM.createRoot(document.getElementById('root')!).render( // Use ReactDOM
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Initialize GOV.UK Frontend JavaScript components AFTER initial render
initAll();
