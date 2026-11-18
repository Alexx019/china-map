import type { Place, PracticalField, Source } from '../../data/types';
import { Icon, type IconName } from '../../ui/icons';
import css from './Place.module.css';

// Orden pensado para decidir rápido: cuándo se puede ir y cuánto cuesta, luego cómo llegar y normas.
const FIELDS: { key: PracticalField; label: string; icon: IconName }[] = [
  { key: 'showtimes', label: 'Pases', icon: 'calendar' },
  { key: 'hours', label: 'Horario', icon: 'clock' },
  { key: 'closed_days', label: 'Días de cierre', icon: 'calendar' },
  { key: 'booking', label: 'Reserva', icon: 'calendarCheck' },
  { key: 'tickets', label: 'Entrada', icon: 'ticket' },
  { key: 'price_per_person', label: 'Precio por persona', icon: 'wallet' },
  { key: 'dishes', label: 'Qué pedir', icon: 'comer' },
  { key: 'menu', label: 'Carta', icon: 'fileText' },
  { key: 'duration', label: 'Duración', icon: 'timer' },
  { key: 'best_time', label: 'Mejor hora', icon: 'sun' },
  { key: 'best_spot', label: 'Mejor sitio para verlo', icon: 'ver' },
  { key: 'how_to_get', label: 'Cómo llegar', icon: 'train' },
  { key: 'payment', label: 'Pago', icon: 'card' },
  { key: 'passport', label: 'Pasaporte', icon: 'idCard' },
  { key: 'rules', label: 'Normas', icon: 'shield' },
];

const DOUBT = /^por confirmar:?\s*/i;

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
};

/** Solo enlaces http(s): un `javascript:` en los datos no debe acabar en un href. */
const safe = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined);

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\.|^m\./, '');
  } catch {
    return url;
  }
};

function Value({ v }: { v: string | null }) {
  if (v === null) return <span className={css.pending}>Por confirmar</span>;
  if (DOUBT.test(v))
    return (
      <>
        <span className={css.doubt}>Por confirmar</span> {v.replace(DOUBT, '')}
      </>
    );
  return <>{v}</>;
}

export function PracticalSection({ place }: { place: Place }) {
  const pr = place.practical;
  return (
    <section className={css.section} aria-labelledby="practica">
      <h2 id="practica" className={css.h2}>
        Información práctica
      </h2>
      {!pr ? (
        <p className={css.muted}>Pendiente de investigar.</p>
      ) : (
        <>
          {'before_you_go' in pr && (
            <div className={css.callout}>
              <Icon name="alert" size={18} />
              <div>
                <div className={css.calloutTitle}>Antes de ir</div>
                <div className={css.calloutText}>
                  <Value v={pr.before_you_go ?? null} />
                </div>
              </div>
            </div>
          )}
          <dl className={css.facts}>
            {FIELDS.filter((f) => f.key in pr).map((f) => (
              <div key={f.key} className={css.fact}>
                <dt className={css.factLabel}>
                  <Icon name={f.icon} size={17} />
                  {f.label}
                </dt>
                <dd className={css.factValue}>
                  <Value v={pr[f.key] ?? null} />
                </dd>
              </div>
            ))}
          </dl>
          <Sources sources={pr.sources} verifiedAt={pr.verified_at} />
        </>
      )}
    </section>
  );
}

function Sources({ sources, verifiedAt }: { sources: Source[]; verifiedAt: string }) {
  return (
    <details className={css.sources}>
      <summary>
        Verificado el {fmtDate(verifiedAt)} · {sources.length} {sources.length === 1 ? 'fuente' : 'fuentes'}
        <Icon name="chevronDown" size={16} className={css.summaryIcon} />
      </summary>
      <ul>
        {sources.map((s) => (
          <li key={s.url}>
            <a href={safe(s.url)} target="_blank" rel="noopener noreferrer">
              <span className={css.sourceTitle}>{s.title}</span>
              <span className={css.sourceHost}>
                {host(s.url)}
                <Icon name="external" size={12} />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function TipsSection({ place }: { place: Place }) {
  const tips = place.tips;
  return (
    <section className={css.section} aria-labelledby="consejos">
      <h2 id="consejos" className={css.h2}>
        Consejos de gente que ha ido
      </h2>
      {!tips ? (
        <p className={css.muted}>Pendiente de investigar.</p>
      ) : tips.length === 0 ? (
        <p className={css.muted}>No hemos encontrado consejos fiables.</p>
      ) : (
        <ul className={css.tips}>
          {tips.map((t, i) => (
            <li key={i} className={css.tip}>
              <p>{t.text}</p>
              <a href={safe(t.source.url)} target="_blank" rel="noopener noreferrer" className={css.tipSource}>
                {host(t.source.url)}
                <Icon name="external" size={12} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
