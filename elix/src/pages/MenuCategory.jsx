import CategoryPage from '../components/CategoryPage';
import NotFound from './NotFound';
import { hasLoadedContent, useContentVersion } from '../lib/content';
import { THEMES } from '../themes/themeConfig';
import { useParams } from 'react-router-dom';

// A category created in the dashboard (Menu management > Categories). It has no page of its own in the code:
// this one page serves every such category at /menu/<key>, using the same layout as the built-in category pages.
export default function MenuCategory() {
  const { key } = useParams();
  useContentVersion(); // the category arrives with the live content: show it as soon as it is there
  const theme = THEMES[key];

  if (!theme || !theme.custom) {
    // Still loading: show nothing for a moment instead of flashing "Page not found".
    return hasLoadedContent() ? <NotFound /> : null;
  }
  return <CategoryPage category={key} hero="split" menuTitle={`The ${theme.label} menu`} />;
}
