'use client';

import { useEffect, useRef } from 'react';
import type { RoomId } from './types';
import type { HouseScene } from './scene/createScene';

type WorldCanvasProps = {
  activeRoom: RoomId | null;
  onReady: (scene: HouseScene) => void;
  onNearbyRoom: (room: RoomId | null) => void;
  onOpenRoom: (room: RoomId) => void;
};

export function WorldCanvas({ activeRoom, onReady, onNearbyRoom, onOpenRoom }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HouseScene | null>(null);
  const callbackRef = useRef({ onNearbyRoom, onOpenRoom });
  useEffect(() => { callbackRef.current = { onNearbyRoom, onOpenRoom }; }, [onNearbyRoom, onOpenRoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    import('./scene/createScene').then(({ createHouseScene }) => {
      if (disposed) return;
      const scene = createHouseScene({
        canvas,
        onNearbyRoom: (room) => callbackRef.current.onNearbyRoom(room),
        onOpenRoom: (room) => callbackRef.current.onOpenRoom(room),
      });
      sceneRef.current = scene; onReady(scene);
    });
    return () => { disposed = true; sceneRef.current?.dispose(); sceneRef.current = null; };
  }, [onReady]);

  useEffect(() => { sceneRef.current?.setActiveRoom(activeRoom); }, [activeRoom]);

  return <canvas ref={canvasRef} aria-label="Interactive virtual house. Use arrow keys or W A S D to move between rooms." />;
}
