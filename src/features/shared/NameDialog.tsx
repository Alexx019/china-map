import { useState } from 'react';
import { useShared } from '../../state/shared';
import { useStore } from '../../state/store';
import css from './Shared.module.css';

/** Ejecuta la acción; si aún no se sabe quién usa este móvil, lo pregunta antes (una sola vez). */
export function useWithMe() {
  const setAskName = useStore((s) => s.setAskName);
  return (fn: () => void) => {
    if (useShared.getState().me) fn();
    else setAskName(fn);
  };
}

export function NameDialog() {
  const pending = useStore((s) => s.askName);
  const setAskName = useStore((s) => s.setAskName);
  const setMe = useShared((s) => s.setMe);
  const [name, setName] = useState('');
  if (!pending) return null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setMe(name);
    setAskName(null);
    pending();
  };

  return (
    <div className={css.backdrop} onClick={() => setAskName(null)}>
      <form className={css.dialog} role="dialog" aria-modal="true" aria-labelledby="who" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <h2 id="who" className={css.dialogTitle}>
          ¿Quién eres?
        </h2>
        <p className={css.dialogText}>Se guarda en este móvil y sale junto a lo que marques, para que los demás sepan quién fue.</p>
        <label className={css.srOnly} htmlFor="me">
          Tu nombre
        </label>
        <input id="me" className={css.input} autoFocus maxLength={30} placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <div className={css.dialogActions}>
          <button type="button" className={css.ghost} onClick={() => setAskName(null)}>
            Cancelar
          </button>
          <button type="submit" className={css.primary} disabled={!name.trim()}>
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
