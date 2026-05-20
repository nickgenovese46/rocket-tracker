import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Navbar        from './components/Navbar';
import Home          from './pages/Home';
import Archive       from './pages/Archive';
import RocketBuilder from './pages/RocketBuilder';
import SpaceRace     from './pages/SpaceRace';

import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"            element={<Home />} />
        <Route path="/archive"     element={<Archive />} />
        <Route path="/space-race"  element={<SpaceRace />} />
        <Route path="/builder"     element={<RocketBuilder />} />
      </Routes>
    </BrowserRouter>
  );
}
