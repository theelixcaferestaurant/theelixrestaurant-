// Sample gallery entries. Each entry looks for an image named  gallery-<id>  first,
// then for the menu item image named by itemId. Missing images show a demo placeholder.

export const GALLERY_GROUPS = ['Interiors', 'Food', 'Bakery', 'Beverages', 'Tiffins'];

export const GROUP_TONE = {
  Interiors: 'interior',
  Food: 'food',
  Bakery: 'bakery',
  Beverages: 'chai',
  Tiffins: 'tiffins',
};

export const GALLERY = [
  { id: 'interior-1', title: 'Main dining area', group: 'Interiors', ratio: '4 / 3' },
  { id: 'food-biryani', title: 'Chicken Dum Biryani', group: 'Food', itemId: 'chicken-dum-biryani', ratio: '4 / 5' },
  { id: 'bakery-cake', title: 'Chocolate Truffle Cake', group: 'Bakery', itemId: 'chocolate-truffle-cake', ratio: '1 / 1' },
  { id: 'bev-chai', title: 'Irani Chai', group: 'Beverages', itemId: 'irani-chai', ratio: '4 / 5' },
  { id: 'tiffin-dosa', title: 'Masala Dosa', group: 'Tiffins', itemId: 'masala-dosa', ratio: '4 / 3' },
  { id: 'interior-2', title: 'Tea lounge corner', group: 'Interiors', ratio: '1 / 1' },
  { id: 'food-tikka', title: 'Chicken Tikka', group: 'Food', itemId: 'chicken-tikka', ratio: '4 / 3' },
  { id: 'bakery-croissant', title: 'Butter Croissant', group: 'Bakery', itemId: 'butter-croissant', ratio: '4 / 5' },
  { id: 'bev-coffee', title: 'Cold Coffee', group: 'Beverages', itemId: 'cold-coffee', ratio: '1 / 1' },
  { id: 'tiffin-idli', title: 'Plain Idli', group: 'Tiffins', itemId: 'plain-idli', ratio: '4 / 5' },
  { id: 'interior-3', title: 'Bakery counter', group: 'Interiors', ratio: '4 / 3' },
  { id: 'food-paneer', title: 'Paneer Butter Masala', group: 'Food', itemId: 'paneer-butter-masala', ratio: '1 / 1' },
  { id: 'bakery-cheesecake', title: 'Blueberry Cheesecake', group: 'Bakery', itemId: 'blueberry-cheesecake', ratio: '4 / 3' },
  { id: 'bev-mojito', title: 'Fresh Lime Mojito', group: 'Beverages', itemId: 'fresh-lime-mojito', ratio: '4 / 5' },
  { id: 'tiffin-vada', title: 'Medu Vada', group: 'Tiffins', itemId: 'medu-vada', ratio: '1 / 1' },
  { id: 'food-mandi', title: 'Chicken Mandi', group: 'Food', itemId: 'chicken-mandi', ratio: '4 / 3' },
];

export const galleryImageKeys = (entry) => [`gallery-${entry.id}`, entry.itemId].filter(Boolean);

export const galleryVideoKeys = (entry) => [`gallery-${entry.id}`, entry.itemId].filter(Boolean);
