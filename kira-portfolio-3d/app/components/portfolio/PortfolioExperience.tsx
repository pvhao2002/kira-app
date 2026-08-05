'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PortfolioAudio } from './audio';
import { rooms } from './data';
import { RoomDetail } from './RoomDetail';
import { StaticOverview } from './StaticOverview';
import type { HouseScene } from './scene/createScene';
import type { RoomId } from './types';
import { ROOM_IDS } from './types';
import { WorldCanvas } from './WorldCanvas';

const validRoom = (value: string): value is RoomId => ROOM_IDS.some((room) => room === value);

export function PortfolioExperience() {
  const [activeRoom, setActiveRoom] = useState<RoomId | null>(null);
  const [nearbyRoom, setNearbyRoom] = useState<RoomId | null>(null);
  const [staticMode, setStaticMode] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const sceneRef = useRef<HouseScene | null>(null);
  const activeRoomRef = useRef<RoomId | null>(null);
  const audioRef = useRef<PortfolioAudio | null>(null);

  useEffect(() => { audioRef.current = new PortfolioAudio(); return () => audioRef.current?.dispose(); }, []);
  useEffect(() => {
    const fromHash = () => { const value = window.location.hash.replace('#', ''); if (validRoom(value)) setActiveRoom(value); };
    fromHash(); window.addEventListener('hashchange', fromHash); return () => window.removeEventListener('hashchange', fromHash);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setStaticMode(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (!activeRoom) return; window.history.replaceState(null, '', `#${activeRoom}`); sceneRef.current?.setActiveRoom(activeRoom); }, [activeRoom]);

  const selectRoom = useCallback((room: RoomId) => { audioRef.current?.playDoor(); setActiveRoom(room); }, []);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  const setScene = useCallback((scene: HouseScene) => { sceneRef.current = scene; scene.setActiveRoom(activeRoomRef.current); }, []);
  const returnHome = useCallback(() => { setActiveRoom(null); setNearbyRoom(null); sceneRef.current?.setActiveRoom(null); window.history.replaceState(null, '', window.location.pathname); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);
  const toggleSound = useCallback(async () => { const next = !soundOn; setSoundOn(next); await audioRef.current?.toggle(next); }, [soundOn]);

  if (staticMode) return <StaticOverview onExplore={() => setStaticMode(false)} />;
  return <main className="portfolio">
    <header className="site-header"><a className="brand" href="#top">KIRA.PHAM</a><div className="header-actions"><button className="icon-button" type="button" onClick={toggleSound} aria-pressed={soundOn}>{soundOn ? '◌ Ambience on' : '◌ Ambience off'}</button><button className="text-button" type="button" onClick={() => setStaticMode(true)}>View static portfolio</button><button className="icon-button" type="button" aria-label="Menu"><span>Menu</span><span className="hamburger"><span /><span /></span></button></div></header>
    <section className="hero" id="top" aria-labelledby="portfolio-title"><div className="canvas-wrap"><WorldCanvas activeRoom={activeRoom} onReady={setScene} onNearbyRoom={setNearbyRoom} onOpenRoom={selectRoom} /></div><div className="hero-vignette" />
      <div className="hero-copy"><h1 id="portfolio-title">A portfolio you can walk through.</h1><p>Visit each room to discover the work behind it.</p><button className="static-link" type="button" onClick={() => setStaticMode(true)}>Prefer less motion? View static portfolio →</button></div>
      <nav className="room-labels" aria-label="Choose a room">{rooms.map((room) => <button key={room.id} type="button" onClick={() => sceneRef.current?.moveTo(room.id)}>{room.label}</button>)}</nav>
      {nearbyRoom && !activeRoom && <div className="proximity">Press <kbd>Enter</kbd> to open {rooms.find((room) => room.id === nearbyRoom)?.label}<button type="button" onClick={() => sceneRef.current?.openNearby()}>Open now</button></div>}
      <div className="interaction-bar"><span className="control-hint"><span className="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span> or arrows</span><span className="bar-divider" /><span className="control-hint"><kbd>Enter</kbd> Open door</span></div>
      <div className="touch-nav" aria-label="Touch movement controls"><button type="button" aria-label="Move forward" onClick={() => sceneRef.current?.nudge(0, -.6)}>▴</button><button type="button" aria-label="Move backward" onClick={() => sceneRef.current?.nudge(0, .6)}>▾</button><button type="button" aria-label="Move left" onClick={() => sceneRef.current?.nudge(-.6, 0)}>◂</button><button type="button" aria-label="Move right" onClick={() => sceneRef.current?.nudge(.6, 0)}>▸</button></div>
    </section>
    {activeRoom && <RoomDetail room={activeRoom} onBack={returnHome} />}
  </main>;
}
