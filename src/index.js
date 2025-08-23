import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css'; 
import MeetingsDashboard from './components/MeetingsDashboard'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MeetingsDashboard />
  </React.StrictMode>
);
