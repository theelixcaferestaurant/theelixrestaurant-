-- THE ELIX seed data: the current demonstration content. Run after 0001_schema_rls_storage.sql. Safe to re-run (never overwrites your edits).

insert into public.categories (key,label,heading,intro,short_text,subcategories,sort_order) values
('chai','Chai & Beverages','A Perfect Cup of Happiness.','Discover comforting teas, refreshing beverages and carefully crafted drinks.','Comforting teas, coffees and chilled drinks in a warm, golden lounge.',array['Tea','Coffee','Coolers','Juices and Shakes'],0),
('tiffins','South Indian Tiffins','Freshness in Every Bite.','Experience the comfort and flavour of traditional South Indian breakfast.','Idli, dosa, vada and breakfast favourites, fresh and natural.',array['Idli','Dosa','Vada','Breakfast Specials','Combos'],1),
('bakery','Bakery','A Little Sweetness in Every Moment.','Explore freshly presented pastries, cakes, desserts and bakery favourites.','Cakes, pastries, brownies and desserts, elegantly presented.',array['Cakes','Pastries','Brownies','Cookies','Donuts','Desserts'],2),
('food','Restaurant Food','Discover the Art of Flavour.','Explore rich flavours, carefully presented dishes and memorable restaurant favourites.','Biryani, mandi, tandoori and more, rich with flavour.',array['Biryani','Chinese','Tandoori','Mandi','Indian','Mughlai','Kebabs'],3)
on conflict (key) do nothing;

insert into public.restaurant_info (id,name,tagline,address,phone,email) values (1,'The Elix','A Taste Beyond Expectations.','H 6-126, Kondakal – Shankarpally Road, Opp. Sri Sri Bramarambika Temple, Mokila, Hyderabad, Telangana – 501203.','+91 6262626466','theelixcaferestaurant@gmail.com') on conflict (id) do nothing;

insert into public.opening_hours (days,hours,sort_order)
select * from (values ('Monday to Friday','Hours placeholder',1),('Saturday and Sunday','Hours placeholder',2)) v(days,hours,sort_order)
where not exists (select 1 from public.opening_hours);

insert into public.social_links (platform,url) values ('instagram',''),('facebook',''),('youtube',''),('maps','') on conflict (platform) do nothing;

insert into public.site_settings (key,value) values
('hero_lead','Chai, South Indian tiffins, a bakery and restaurant food, together in one destination.'),
('welcome_heading','Welcome to The Elix.'),
('welcome_text','Welcome message placeholder. The owner''s own words of greeting will appear here before launch.'),
('brand_heading','One restaurant, four ways to enjoy it.'),
('brand_text','Brand introduction placeholder. The story, values and personality of The Elix will be written with the owner. For this demonstration, each of the four categories below has been given its own look.'),
('ambience_title','The atmosphere'),
('ambience_text','Ambience placeholder. Interior photography and a description of the space will replace this panel.'),
('demo_notice','Demonstration website. Menu items, prices, photographs, reviews and business details are sample content for owner review.')
on conflict (key) do nothing;

insert into public.menu_items (id,category_key,sub,name,price,veg,description,featured,hot,sort_order) values
('irani-chai','chai','Tea','Irani Chai',40,true,'A slow-brewed, milk-rich tea with a warm, fragrant finish.',true,true,0),
('masala-chai','chai','Tea','Masala Chai',35,true,'Black tea simmered with aromatic spices and fresh milk.',false,true,1),
('ginger-tea','chai','Tea','Ginger Tea',30,true,'A clean, gently spiced tea with fresh ginger.',false,true,2),
('lemon-tea','chai','Tea','Lemon Tea',35,true,'A light, bright tea finished with fresh lemon.',false,true,3),
('filter-coffee','chai','Coffee','Filter Coffee',45,true,'Traditional filter coffee, strong and smooth.',false,true,4),
('cappuccino','chai','Coffee','Cappuccino',90,true,'Espresso topped with velvety steamed milk foam.',false,true,5),
('cold-coffee','chai','Coolers','Cold Coffee',110,true,'Chilled coffee blended to a rich, creamy texture.',false,false,6),
('chocolate-milkshake','chai','Juices and Shakes','Chocolate Milkshake',120,true,'A thick chocolate milkshake, served chilled.',false,false,7),
('fresh-lime-mojito','chai','Coolers','Fresh Lime Mojito',100,true,'A refreshing lime cooler with mint and soda.',false,false,8),
('watermelon-juice','chai','Juices and Shakes','Watermelon Juice',90,true,'Freshly pressed watermelon, lightly chilled.',false,false,9),
('plain-idli','tiffins','Idli','Plain Idli',40,true,'Soft steamed rice cakes served with chutney and sambar.',false,true,10),
('ghee-idli','tiffins','Idli','Ghee Idli',65,true,'Idli finished with a touch of ghee for a richer taste.',false,true,11),
('medu-vada','tiffins','Vada','Medu Vada',45,true,'Crisp, golden lentil fritters with a soft centre.',false,true,12),
('plain-dosa','tiffins','Dosa','Plain Dosa',65,true,'A thin, crisp fermented rice and lentil crepe.',false,true,13),
('masala-dosa','tiffins','Dosa','Masala Dosa',85,true,'A crisp dosa filled with spiced potato, served with chutneys.',true,true,14),
('mysore-masala-dosa','tiffins','Dosa','Mysore Masala Dosa',110,true,'Dosa spread with a spiced red chutney and filled with savoury potato.',false,true,15),
('ghee-karam-dosa','tiffins','Dosa','Ghee Karam Dosa',100,true,'Dosa brushed with ghee and a fiery spice powder.',false,true,16),
('poori','tiffins','Breakfast Specials','Poori (2 pcs)',70,true,'Two golden puffed breads served with potato masala.',false,true,17),
('upma','tiffins','Breakfast Specials','Upma',55,true,'Semolina cooked with vegetables and tempered with mustard seeds.',false,true,18),
('pongal','tiffins','Breakfast Specials','Pongal',75,true,'A creamy rice and lentil dish with black pepper and ghee.',false,true,19),
('chocolate-truffle-cake','bakery','Cakes','Chocolate Truffle Cake',120,null,'Layers of dark chocolate sponge with a silky truffle ganache.',true,false,20),
('red-velvet-pastry','bakery','Pastries','Red Velvet Pastry',110,null,'Red velvet sponge with a smooth cream cheese layer.',false,false,21),
('black-forest-pastry','bakery','Pastries','Black Forest Pastry',100,null,'Chocolate sponge layered with cherries and whipped cream.',false,false,22),
('blueberry-cheesecake','bakery','Desserts','Blueberry Cheesecake',160,null,'A baked cheesecake crowned with blueberry compote.',false,false,23),
('chocolate-brownie','bakery','Brownies','Chocolate Brownie',90,null,'A dense, fudgy brownie with a crackled top.',false,false,24),
('butter-croissant','bakery','Pastries','Butter Croissant',85,null,'Flaky, layered pastry with a buttery finish.',false,false,25),
('chocolate-donut','bakery','Donuts','Chocolate Donut',75,null,'A soft donut dipped in glossy chocolate.',false,false,26),
('choco-chip-cookies','bakery','Cookies','Choco Chip Cookies',60,null,'Crisp-edged cookies studded with chocolate chips.',false,false,27),
('walnut-brownie','bakery','Brownies','Walnut Brownie',110,null,'A rich brownie with toasted walnuts.',false,false,28),
('chocolate-mousse','bakery','Desserts','Chocolate Mousse',130,null,'A light, airy chocolate mousse.',false,false,29),
('veg-dum-biryani','food','Biryani','Veg Dum Biryani',180,true,'Fragrant basmati layered with seasonal vegetables and saffron.',false,true,30),
('chicken-dum-biryani','food','Biryani','Chicken Dum Biryani',240,false,'Slow-cooked dum biryani with tender chicken and fragrant rice.',true,true,31),
('chicken-65','food','Indian','Chicken 65',190,false,'Crisp, spiced fried chicken with curry leaves and green chilli.',false,true,32),
('paneer-butter-masala','food','Mughlai','Paneer Butter Masala',210,true,'Soft paneer simmered in a rich, creamy tomato gravy.',false,true,33),
('butter-naan','food','Tandoori','Butter Naan',45,true,'Leavened bread from the tandoor, brushed with butter.',false,true,34),
('chicken-tikka','food','Kebabs','Chicken Tikka',230,false,'Marinated chicken chargrilled in the tandoor.',false,true,35),
('chicken-mandi','food','Mandi','Chicken Mandi',320,false,'Smoky, slow-roasted chicken served over fragrant rice.',false,true,36),
('mutton-mandi','food','Mandi','Mutton Mandi',420,false,'Tender mutton with smoked rice and traditional spices.',false,true,37),
('veg-fried-rice','food','Chinese','Veg Fried Rice',150,true,'Wok-tossed rice with fresh vegetables and soy.',false,true,38),
('chicken-fried-rice','food','Chinese','Chicken Fried Rice',190,false,'Wok-tossed rice with chicken, spring onion and soy.',false,true,39)
on conflict (id) do nothing;

insert into public.gallery_items (id,title,grp,ratio,item_id,sort_order) values
('interior-1','Main dining area','Interiors','4 / 3',null,0),
('food-biryani','Chicken Dum Biryani','Food','4 / 5','chicken-dum-biryani',1),
('bakery-cake','Chocolate Truffle Cake','Bakery','1 / 1','chocolate-truffle-cake',2),
('bev-chai','Irani Chai','Beverages','4 / 5','irani-chai',3),
('tiffin-dosa','Masala Dosa','Tiffins','4 / 3','masala-dosa',4),
('interior-2','Tea lounge corner','Interiors','1 / 1',null,5),
('food-tikka','Chicken Tikka','Food','4 / 3','chicken-tikka',6),
('bakery-croissant','Butter Croissant','Bakery','4 / 5','butter-croissant',7),
('bev-coffee','Cold Coffee','Beverages','1 / 1','cold-coffee',8),
('tiffin-idli','Plain Idli','Tiffins','4 / 5','plain-idli',9),
('interior-3','Bakery counter','Interiors','4 / 3',null,10),
('food-paneer','Paneer Butter Masala','Food','1 / 1','paneer-butter-masala',11),
('bakery-cheesecake','Blueberry Cheesecake','Bakery','4 / 3','blueberry-cheesecake',12),
('bev-mojito','Fresh Lime Mojito','Beverages','4 / 5','fresh-lime-mojito',13),
('tiffin-vada','Medu Vada','Tiffins','1 / 1','medu-vada',14),
('food-mandi','Chicken Mandi','Food','4 / 3','chicken-mandi',15)
on conflict (id) do nothing;
