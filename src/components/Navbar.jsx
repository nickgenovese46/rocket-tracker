import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-logo">ORBIT</NavLink>
      <div className="navbar-links">
        <NavLink to="/"           end       className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Mission Control</NavLink>
        <NavLink to="/archive"              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Archive</NavLink>
        <NavLink to="/space-race"           className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Space Race</NavLink>
        <NavLink to="/builder"              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Rocket Builder</NavLink>
      </div>
      <div className="navbar-live">
        <span className="live-dot" />
        <span className="live-text">LIVE</span>
      </div>
    </nav>
  );
}