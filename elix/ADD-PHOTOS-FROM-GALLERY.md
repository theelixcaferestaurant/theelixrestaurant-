# Adding photos and videos from your phone or computer gallery

Every picture slot on the website now has buttons at the bottom of the box:

- **Add image** / **Replace image**: opens your gallery or file picker. The chosen photo replaces the "Demo image" panel straight away.
- **Add video** (every slot): pick a short clip. It plays when the cursor goes over that photo (on a phone, when the item is opened). On the two wide ambience banners the clip plays by itself, muted and looping.
- The small **x** removes the photo you added from this device.

A small round button at the bottom-left of the page shows or hides all these buttons.

## Where your pictures are kept
- Pictures you add this way are saved in your own browser, on the same device. They stay after a refresh.
- They are NOT visible to other visitors yet. To publish them for everyone, sign in at /admin first (Supabase must be set up, see README-BACKEND.md). While you are signed in, the same buttons upload to the live site as well.
- Alternatively, copy the files into src/assets/images/<category>/ and src/assets/videos/<category>/ with the names in each folder's README.txt.

## Before the public launch
Set VITE_EDIT_MEDIA=false in your .env file so visitors do not see the buttons.

Limits: photos up to 15 MB, videos up to 60 MB (MP4 or WebM, 5-10 seconds works best).
