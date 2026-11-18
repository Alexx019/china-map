import { useEffect, useState } from 'react';
import { loadTripData } from './data/load';
import { loadPhotoManifest } from './data/photos';
import { ExploreSheet } from './features/explore/ExploreSheet';
import { PlaceScreen } from './features/place/PlaceScreen';
import { PhotoViewer } from './features/viewer/PhotoViewer';
import { MoodBoard } from './features/zone/MoodBoard';
import { TopBar } from './features/explore/TopBar';
import { MapView } from './map/MapView';
import { useHashNav } from './state/nav';
import { useStore } from './state/store';
import { useApplyTheme } from './state/theme';
import { TabBar } from './ui/TabBar';

export function App() {
  const setData = useStore((s) => s.setData);
  const ready = useStore((s) => s.data !== null);
  const [error, setError] = useState<string | null>(null);

  useApplyTheme();
  useHashNav();

  useEffect(() => {
    Promise.all([loadTripData(), loadPhotoManifest()]).then(
      ([data, photos]) => setData(data, photos),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [setData]);

  if (error) {
    return (
      <main style={{ padding: '96px 24px', display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>No se pudieron cargar los datos</h1>
        <p style={{ margin: 0, color: 'var(--text-2)' }}>{error}</p>
      </main>
    );
  }

  return (
    <>
      <MapView />
      {ready && (
        <>
          <TopBar />
          <ExploreSheet />
          <TabBar />
          <PlaceScreen />
          <MoodBoard />
          <PhotoViewer />
        </>
      )}
    </>
  );
}
