import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  UserPlus,
  Camera,
  ShieldCheck,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/register', icon: UserPlus, label: 'Register' },
  { to: '/attendance', icon: Camera, label: 'Scanner' },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Ambient background blobs */}
      <div
        className="ambient-blob"
        style={{
          width: 600,
          height: 600,
          background: '#6366f1',
          top: '-200px',
          left: '-200px',
        }}
      />
      <div
        className="ambient-blob"
        style={{
          width: 400,
          height: 400,
          background: '#06b6d4',
          bottom: '-100px',
          right: '-100px',
        }}
      />

      {/* Sidebar */}
      <aside
        style={{
          width: '240px',
          minHeight: '100vh',
          background: 'rgba(13, 20, 36, 0.95)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 16px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          backdropFilter: 'blur(20px)',
          zIndex: 10,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '8px 12px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} color="white" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#f1f5f9',
                  lineHeight: 1.2,
                }}
              >
                AttendAI
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.5px' }}>
                Face Recognition
              </div>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={{ textDecoration: 'none' }}
            >
              {({ isActive }) => (
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.1))'
                      : 'transparent',
                    border: isActive
                      ? '1px solid rgba(99,102,241,0.35)'
                      : '1px solid transparent',
                    transition: 'background 0.2s, border 0.2s',
                  }}
                >
                  <Icon
                    size={18}
                    color={isActive ? '#818cf8' : '#64748b'}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#c7d2fe' : '#94a3b8',
                      letterSpacing: '0.2px',
                    }}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      style={{
                        marginLeft: 'auto',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#6366f1',
                        boxShadow: '0 0 8px rgba(99,102,241,0.8)',
                      }}
                    />
                  )}
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            marginTop: '16px',
          }}
        >
          <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', lineHeight: 1.6 }}>
            Offline-First · Privacy-Safe
            <br />
            All data stored locally
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="page-wrapper"
        style={{
          flex: 1,
          padding: '32px',
          overflowY: 'auto',
          minHeight: '100vh',
        }}
      >
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
