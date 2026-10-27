'use client';

/** Root-level failsafe: untranslated, dependency-free, always renders. */
export default function GlobalError({reset}: {error: Error & {digest?: string}; reset: () => void}) {
  return (
    <html lang="fr">
      <body style={{fontFamily: 'system-ui, sans-serif', padding: 32, textAlign: 'center'}}>
        <h1>Une erreur est survenue / An error occurred / حدث خطأ</h1>
        <button
          type="button"
          onClick={() => reset()}
          style={{padding: '8px 16px', cursor: 'pointer', marginTop: 12}}
        >
          Réessayer / Retry / إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
