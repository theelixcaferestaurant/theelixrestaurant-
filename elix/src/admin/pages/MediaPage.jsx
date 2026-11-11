import { Link } from 'react-router-dom';
import MediaField from '../MediaField';
import { Card } from '../ui';

// Every fixed picture and video slot of the public website. (Menu photos are on the Menu page, gallery photos and
// videos on the Gallery page.) A new upload replaces the old file and appears on the website straight away.
const PAGE_IMAGES = [
  ['hero-main', 'Home hero image (used when no hero video is uploaded)', '3:4 portrait'],
  ['hero-accent', 'Home hero small accent image', 'Square'],
  ['welcome', 'Brand introduction image', '4:5 portrait'],
  ['ambience', 'Atmosphere banner (home page)', 'Wide landscape'],
  ['about-story', 'About page: our story image', '4:5 portrait'],
  ['about-ambience', 'About page: atmosphere banner', 'Wide landscape'],
];
const CATEGORIES = [
  ['category-chai', 'Chai & Beverages'],
  ['category-tiffins', 'South Indian Tiffins'],
  ['category-bakery', 'Bakery'],
  ['category-food', 'Restaurant Food'],
];

export default function MediaPage() {
  return (
    <>
      <div className="a-pagehead">
        <div>
          <h1>Website media</h1>
          <p>Upload, preview, replace or remove the website’s images and videos. Choose a file to preview it first; it goes live only when you press Publish.</p>
        </div>
      </div>

      <Card title="Home page hero video and banner">
        <p className="a-hint">The cinematic video on the first screen. Plays silently and loops. Use a portrait or square MP4/WebM clip of 8–15 seconds.</p>
        <div className="a-media-grid">
          <MediaField ownerType="site" ownerId="hero-video" kind="video" label="Hero video" />
          <MediaField ownerType="site" ownerId="hero-poster" kind="image" label="Hero video cover photo (shown while loading)" />
        </div>
      </Card>

      <Card title="Homepage banners and page photographs">
        <div className="a-media-grid">
          {PAGE_IMAGES.map(([key, label, shape]) => (
            <MediaField key={key} ownerType="site" ownerId={key} kind="image" label={label} hint={`Recommended shape: ${shape}.`} />
          ))}
        </div>
      </Card>

      <Card title="Category pictures">
        <p className="a-hint">Shown on the Explore page, the category cards and the top of each category page. A short clip can also play on hover.</p>
        <div className="a-media-grid">
          {CATEGORIES.map(([key, label]) => (
            <MediaField key={`${key}-img`} ownerType="site" ownerId={key} kind="image" label={`${label}: picture`} />
          ))}
          {CATEGORIES.map(([key, label]) => (
            <MediaField key={`${key}-vid`} ownerType="site" ownerId={key} kind="video" label={`${label}: video`} />
          ))}
        </div>
      </Card>

      <Card title="Menu and gallery pictures">
        <p className="a-hint">
          Photos and videos of individual dishes are uploaded inside each item on the <Link to="/admin/menu">Menu management</Link> page.
          Gallery photos and videos are on the <Link to="/admin/gallery">Gallery</Link> page, where you can also add and delete entries.
        </p>
      </Card>
    </>
  );
}
