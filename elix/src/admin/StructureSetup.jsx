import { STRUCTURE_SQL_FILE, STRUCTURE_SQL_TEXT } from './menuStructure';
import { Button, Card, useToast } from './ui';

// Shown while migration 0014 has not been run: explains the one database step and offers the SQL with a Copy button.
export default function StructureSetup() {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(STRUCTURE_SQL_TEXT);
      toast.success('SQL copied. Paste it into the Supabase SQL Editor and press Run.');
    } catch {
      toast.error('Could not copy automatically. Open the file below and copy its text.');
    }
  };
  return (
    <Card title="One database step is needed first">
      <p className="a-hint">
        Adding, hiding, reordering and deleting categories and subcategories needs a small database update. Open the Supabase Dashboard › SQL Editor › New query,
        paste the SQL below and press Run, then reload this page. It only adds a table and a few columns and copies the structure your menu already has. It never deletes, hides or changes any dish, price or photograph, and it is safe to run more than once.
      </p>
      <div className="a-actions">
        <Button onClick={copy}>Copy the SQL</Button>
      </div>
      <p className="a-hint">File in your project: <code>{STRUCTURE_SQL_FILE}</code></p>
      <textarea className="a-input" readOnly rows={8} value={STRUCTURE_SQL_TEXT} onFocus={(e) => e.target.select()} aria-label="SQL to run in Supabase" />
    </Card>
  );
}
