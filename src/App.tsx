/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Participants } from './pages/Participants';
import { TopicsManager } from './pages/TopicsManager';
import { ImagesManager } from './pages/ImagesManager';
import { Round1 } from './pages/Round1';
import { Round2 } from './pages/Round2';
import { Round3 } from './pages/Round3';
import { BuzzerControl } from './pages/BuzzerControl';
import { Results } from './pages/Results';
import { Settings } from './pages/Settings';
import { ExcelPage } from './pages/ExcelPage';
import { EventHistory } from './pages/EventHistory';
import { ProjectorDisplay } from './pages/ProjectorDisplay';
import { Master } from './pages/Master';
import { StationModals } from './components/StationModals';

const AppContent: React.FC = () => {
  const { currentPage, isConnected, soundUnlocked, unlockSound } = useApp();

  // If page is Projector Display mode, render pure stage without organizer layout
  if (currentPage === 'projector') {
    return (
      <>
        <ProjectorDisplay />
        <StationModals />
      </>
    );
  }

  // Check URL query for standalone mobile buzzer receiver mode
  const isMobileMode = new URLSearchParams(window.location.search).get('mode') === 'mobile';
  if (isMobileMode) {
    return (
      <>
        <BuzzerControl />
        <StationModals />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Outfit'] selection:bg-purple-600 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Page Stage Container */}
        <main className="flex-1 overflow-y-auto relative bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]">
          {currentPage === 'dashboard' && <Dashboard />}
          {currentPage === 'master' && <Master />}
          {currentPage === 'participants' && <Participants />}
          {currentPage === 'topics' && <TopicsManager />}
          {currentPage === 'images' && <ImagesManager />}
          {currentPage === 'round1' && <Round1 />}
          {currentPage === 'round2' && <Round2 />}
          {currentPage === 'round3' && <Round3 />}
          {currentPage === 'buzzer' && <BuzzerControl />}
          {currentPage === 'results' && <Results />}
          {currentPage === 'settings' && <Settings />}
          {currentPage === 'excel' && <ExcelPage />}
          {currentPage === 'history' && <EventHistory />}
        </main>
      </div>

      {/* Global Station Takeover & Reset Confirmation Modals */}
      <StationModals />

      {/* Audio Unlock Prompt floating banner if browser has audio context suspended */}
      {!soundUnlocked && (
        <div className="fixed bottom-4 right-4 z-50 bg-purple-950/90 border border-purple-500/50 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce">
          <span className="text-xs text-purple-200 font-semibold">🔊 Audio is standby</span>
          <button
            onClick={unlockSound}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-950"
          >
            Enable Sound
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
