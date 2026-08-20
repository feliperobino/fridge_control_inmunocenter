export function PlaceholderPage({ title, subtitle, note }) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-card">
        <span className="brand-kicker">Fridge Monitor</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {note ? <small>{note}</small> : null}
      </div>
    </section>
  );
}