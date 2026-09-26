import React from "react";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Verification from './pages/Verification';
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-root">
        <Routes>
          <Route path="/*" element={<Verification />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
