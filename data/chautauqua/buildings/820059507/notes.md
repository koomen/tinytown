# Water Works and police office behind the Colonnade

Refreshed 2026-09-15 in response to the building appearing compressed into the ground.

## Located Street View evidence

- [Water Works entrance and main block](https://www.google.com/maps/@42.2102133,-79.4668596,416a,80y,7h,95t/data=!3m7!1e1!3m5!1sj-7pQh4BvCV0E8n5mn1MjQ!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D-5%26panoid%3Dj-7pQh4BvCV0E8n5mn1MjQ%26yaw%3D7!7i13312!8i6656?entry=ttu&g_ep=EgoyMDI2MDkxMy4wIKXMDSoASAFQAw%3D%3D), captured at heading 7°, imagery Jul 2012. The front faces SSE (+v of 820059507). Two labeled doors share a white gabled canopy; the taller brick block has low windows, taller upper windows, a raised right-hand door, and a shallow gabled roof.
- [Police office and adjoining utility entrance](https://www.google.com/maps/@42.2101627,-79.4669739,416a,80y,4h,100t/data=!3m7!1e1!3m5!1s2fXVR5f0bLSium-Y8U9IJw!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D-10%26panoid%3D2fXVR5f0bLSium-Y8U9IJw%26yaw%3D4!7i13312!8i6656?entry=ttu&g_ep=EgoyMDI2MDkwOS4wIKXMDSoASAFQAw%3D%3D), heading 4°, imagery Jul 2012. The low hip-roofed office is left of the taller Water Works. Police entrance is on the SSE (-u of 1416213287) facade, with pale window/door trim and a broad brick stack.
- [Western service wall](https://www.google.com/maps/@42.2101637,-79.4672992,417a,55y,56h,96t/data=!3m7!1e1!3m5!1suoxFIH_MVd-itKJDsbNsIw!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D-6%26panoid%3DuoxFIH_MVd-itKJDsbNsIw%26yaw%3D56!7i13312!8i6656?entry=ttu&g_ep=EgoyMDI2MDkwOS4wIKXMDSoASAFQAw%3D%3D), heading 56°, imagery Jul 2012. Plain brick parapet with a pale masonry band and a central service door.
- The eastern screened yard is visible in front_820059507_+u.png: low hip roof, pale eave trim and windows behind screening. The northern capture is obscured by trees; northern window arrangement remains a simplification.

The capture indexes retain panorama IDs, positions, angles and URLs. These are fresh captures of the available July 2012 imagery, not a claim of recent photography.

## Cause and model correction

The enclosing OSM outline 820059507 included a west volume duplicating the separately modeled footprint 1416213287. Its windows and hip roof intersected the office. Its western service door also selected a floor at -5.789 m; ground at the eastern front corner reached -2.957 m, swallowing most of the short walls.

Removed the duplicate west volume; the office remains represented by 1416213287. The Water Works now derives its floor from the photographed SSE public entrance. Restored a 5.7 m main eave, shallow gabled roof, two rows of windows, paired doors/signs and shared white canopy. The east wing has a low hip roof and plain eave band. Kept its uphill service door above the floor-datum selection range. Default wall/foundation support follows the sloped ground.

The office retains its distinct lower hip roof and police entrance, with one brick chimney and no duplicate windows. Extended its walls below the downhill ground. Its eastern party wall meets the taller Water Works without exposed windows.

Dimensions are visual estimates within the existing geographic frames. Building count and footprint coordinates are unchanged. The intentional 65% volume coverage warning for 820059507 reflects the separately represented office footprint; the elevated door/low-window overlap warning is a two-dimensional lint check (their vertical extents are disjoint).

## Validation

Blueprint lint has no errors; the two advisory warnings above are understood. Compare the assembled original and streamed views under runs/model-edits-20260915/colonnade-rear. Original-scene inspection confirms a floor datum of -4.139 m (1.650 m higher), a distinct taller gabled block, one office hip roof, and one brick chimney. The lower front sills are 0.7 m above the corrected floor so the uphill end stays visible. Route validation passes all seven tests.
