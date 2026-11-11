-- THE ELIX (OPTIONAL): delete the 32 hidden placeholder sample dishes created by 0002_seed_content.sql.
-- They are NOT part of your 327-item menu and have never been shown on the website. Migration 0010 only hides them,
-- so the dashboard menu list counts 359 items until you run this file (327 real + 32 hidden placeholders).
-- Safe: it deletes ONLY rows that are hidden, have no display price (price_text is null, i.e. never part of the real menu
-- and never saved from the dashboard) and carry one of the 32 placeholder ids. A copy of the table as it was before
-- migration 0010 stays in public.menu_items_backup_pre0010. Run once; running it again changes nothing.
delete from public.menu_items
 where available = false
   and price_text is null
   and id in (
     'irani-chai','masala-chai','ginger-tea','lemon-tea','filter-coffee','cappuccino','cold-coffee','chocolate-milkshake',
     'fresh-lime-mojito','watermelon-juice','plain-idli','ghee-idli','medu-vada','mysore-masala-dosa','ghee-karam-dosa','pongal',
     'chocolate-truffle-cake','red-velvet-pastry','black-forest-pastry','blueberry-cheesecake','chocolate-brownie',
     'butter-croissant','chocolate-donut','choco-chip-cookies','walnut-brownie','chocolate-mousse','veg-dum-biryani',
     'chicken-dum-biryani','chicken-65','paneer-butter-masala','chicken-mandi','mutton-mandi');

-- Check: should now show 327 (plus any items you added yourself).
select count(*) as menu_items_now from public.menu_items;
