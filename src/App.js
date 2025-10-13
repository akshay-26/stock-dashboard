import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import './App.css';
import StockDashboard from './views/stockDashBoard';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/stock-dashboard" element={<StockDashboard />} />
      </Routes>
    </Router>
  );
};

export default App;
