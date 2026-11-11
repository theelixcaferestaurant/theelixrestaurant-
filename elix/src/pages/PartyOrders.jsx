import CategoryPage from '../components/CategoryPage';
import ContactButtons from '../components/ContactButtons';

// Party Orders (Take Away): a category-style menu page with the Orchid & Slate theme.
// Items come from src/data/menuData.js; the rows use the same component as the Beverage menu.
export default function PartyOrders() {
  return <CategoryPage category="party" hero="split" menuTitle="The party menu" footer={<ContactButtons variant="party" />} />;
}
