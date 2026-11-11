// Decorative steam wisps for hot items. The parent must be position: relative.
// Visible always when "always" is set, otherwise on hover of the parent card.
export default function Steam({ always = false }) {
  return (
    <span className={`steam ${always ? 'always' : ''}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
