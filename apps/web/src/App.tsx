import { DebugPage } from './debug/DebugPage.tsx';

/** Phase 0 has one real page. React Router arrives with the app shell (P1.1). */
export function App() {
  if (window.location.pathname.replace(/\/+$/, '') === '/debug') return <DebugPage />;
  return (
    <main>
      <h1>Toe to Toe</h1>
      <p>
        <a href="/debug">Debug page</a>
      </p>
    </main>
  );
}
