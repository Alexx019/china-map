import { useEffect, useState } from 'react';
import { loadTripData } from './data/load';
import type { TripData } from './data/types';

// Fase 0: comprobación de que la app arranca y lee los datos. El mapa llega en la fase 1.
export function App() {
  const [data, setData] = useState<TripData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTripData().then(setData, (e: unknown) => setError(String(e)));
  }, []);

  return (
    <main style={{ padding: '72px 20px', display: 'grid', gap: 8 }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 750, letterSpacing: '-0.025em' }}>china-map</h1>
      {error && <p style={{ color: 'var(--accent-text)' }}>{error}</p>}
      {data && (
        <p style={{ margin: 0, color: 'var(--text-2)' }}>
          {data.places.length} sitios en {data.zones.length} zonas
        </p>
      )}
    </main>
  );
}
