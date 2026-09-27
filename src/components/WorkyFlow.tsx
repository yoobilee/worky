/** A restrained W/check motif. It never implies a successful save. */
export default function WorkyFlow({ compact = false }: { compact?: boolean }) {
  return <span className={`wk-flow${compact ? " wk-flow--compact" : ""}`} aria-hidden="true">
    <span /><span /><span />
  </span>;
}
