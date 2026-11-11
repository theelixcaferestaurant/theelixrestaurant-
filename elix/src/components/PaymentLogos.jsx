import { PAYMENT_ROWS } from '../data/paymentMethods';

// One white rounded badge holding one payment-method label, set in the site's body font.
function PaymentBadge({ item }) {
  return (
    <span className="pay-badge" aria-label={item.label}>
      <span className="pay-label" aria-hidden="true">
        {item.text}
      </span>
    </span>
  );
}

// WE ACCEPT: shown inside the footer's first column, below the tagline.
export default function PaymentLogos() {
  return (
    <div className="pay-accept">
      <h2 className="footer-title">We Accept</h2>
      {PAYMENT_ROWS.map((row, index) => (
        <div key={index} className="pay-row">
          {row.map((item) => (
            <PaymentBadge key={item.key} item={item} />
          ))}
        </div>
      ))}
    </div>
  );
}
