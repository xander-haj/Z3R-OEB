# Overworld Editor Properties Panel Guide

This guide explains the fields in the Overworld Workbench `Properties` side
menu. It is written from the editor implementation, not from guesswork.

The editor does not edit the ROM directly in the browser. It edits in-memory
data loaded from `assets/overworld_dump`, then `Save` writes sparse patch JSON
into the selected mod. The Project Menu can validate, build, apply, or dump the
selected mod through the local launcher server.

Most numeric inputs accept decimal or `0x` hexadecimal. Read-only fields are
shown so you can confirm which dumped row or fixed slot you are editing.

## Coordinate And Tile Units

- `Area` is the logical overworld area header. Light World areas are usually
  `0x00..0x3F`, Dark World areas are `0x40..0x7F`, and Special areas are
  `0x80..0x9F`.
- `Screen` is the rendered atlas screen cell under the pointer. Large areas can
  cover more than one screen, so `Screen` and `Area` can differ.
- `Map32` is one 32x32-pixel terrain block. Each normal screen is 16x16 Map32
  cells.
- `Map16` is one 16x16-pixel quadrant inside a Map32 block. A normal screen is
  32x32 Map16 cells.
- `Map8` is one 8x8-pixel SNES BG tile word inside a Map16 block. A normal
  screen is 64x64 Map8 cells.
- Secret items, entrances, fall holes, static overlays, and sprite placements
  use a 16px grid unless the field explicitly says it is pixel based.
- A `small` area is one screen. `big` is 2x2 screens, `wide` is 2x1, and `tall`
  is 1x2. On the 16px grid, that means small areas usually allow `0..31`; big,
  wide, or tall extend the matching axis to `0..63`.

## Properties

### Sprite set

Chooses which overworld sprite progression set is displayed and targeted.

- `First part` shows/edits the `first` sprite set.
- `Beginning` shows/edits the `beginning` sprite set.
- `Second part` shows/edits the `second` sprite set.
- `All sets` draws merged unique sprite placements from all available sets.

For Light World areas, the game has separate progression-specific sprite sets.
For Dark World areas, the compiler treats the visible choices as one shared
sprite set. When painting a saved sprite asset, this same control decides which
stage receives the new sprite. If it is set to `All sets`, the editor uses the
saved asset's own stages, or falls back to `first`.

### Map32

Shows the Map32 tile id from the currently selected terrain cell or selected
saved terrain asset, such as `0x03E6`.

This field is a reference/readout in the current editor. Typing a value into it
does not by itself paint or save terrain. Terrain painting uses the selected
asset from the Assets panel, and the transform buttons use the currently
selected map cell or multi-selected map cells.

### Left / Right / Flip H / Flip V

Transforms the selected Map32 cell. With Command/Alt multi-selection on the
canvas, the same button applies to every selected Map32 cell.

- `Left` rotates the selected Map32's 4x4 Map8-word grid left.
- `Right` rotates the selected Map32's 4x4 Map8-word grid right.
- `Flip H` mirrors the grid horizontally and toggles each Map8 word's
  horizontal flip bit.
- `Flip V` mirrors the grid vertically and toggles each Map8 word's vertical
  flip bit.

If the transformed Map16 or Map32 definition already exists, the editor reuses
that id. Otherwise it creates generated Map16/Map32 definitions and places the
new Map32 id into the selected terrain cell.

### Fit

Resets zoom and pan so the active world group fits inside the canvas.

## Map Header

This section edits the selected area's overworld header metadata.

### Area

Read-only selected area id. This tells you which area header will be edited by
`Apply Header`.

### Size

The topology size for the selected area: `small`, `big`, `wide`, or `tall`.
Changing this rewrites the generated topology ownership model so the editor and
compiler agree about which child screens belong to the area.

The editor validates that the new size fits in the 8x8 world grid and that it
does not partially absorb another area's owned screens. Size changes are only
valid on an area head, not on a child screen of another large area.

### BG GFX

The area's background graphics group byte, compiled from `Header.gfx`. It
selects the BG graphics context used to render that area's terrain.

### BG Palette

The area's background palette group byte, compiled from `Header.palette`. It
selects the BG color context used to render that area's terrain.

### Sign Text

The area's sign text id, compiled from `Header.sign_text`. It is a text-table
index used by overworld sign/message behavior for areas that use that header
field.

### Beginning / Zelda rescued / Master sword / Agahnim defeated

These are progression-specific music slots in the area header. Each row has a
music select plus an `Ambient` select.

- `Beginning` is the area's music/ambient before later progression states.
- `Zelda rescued` is the music/ambient slot for the Zelda-rescued state.
- `Master sword` is the music/ambient slot for the Master Sword state.
- `Agahnim defeated` is the music/ambient slot for the post-Agahnim state.
- `Ambient` is the area's ambient sound/effect selection for that same state,
  such as `None` or `Heavy rain`.

Light World areas expose all four progression tags. Areas outside the Light
World only expose the header music/ambient tags that the local compiler can
write; in the current implementation that means the `Agahnim defeated` tag.

### Apply Header

Applies the header fields as one undoable metadata edit. The edit is saved into
the mod's metadata patch on `Save`.

## Navigation Record

This section edits detailed travel and dungeon-exit rows. It is active when you
select a travel point or dungeon exit marker. Entrances and fall holes have
their own simpler section.

### Record

Read-only marker category, such as a travel point or exit point.

### Key

The fixed identity for the selected row.

- Bird travel rows show `bird slot N`.
- Whirlpool travel rows show the whirlpool source area, and that field is
  editable.
- Exit rows show `exit N, room 0xRRRR`.

### XY

The player/destination position in area-local pixels. The editor also uses this
as the on-canvas marker position for travel and exit markers.

### Scroll

The scroll position pair in area-local pixels. The compiler adds the owning
area's screen base when writing the fixed travel or exit tables.

### Camera

The camera scroll pair in area-local pixels. This is compiled into the travel
or exit camera table fields.

### Load

The Map16 load-source offset pair. This is not a normal pixel coordinate. It is
one of the small fixed-table values used with `Scroll` to rebuild the encoded
load offset.

### Unk

Two signed byte values preserved from the original travel/exit tables. The
editor can round-trip them, but their gameplay meaning is not named in the
local code. Change them only when deliberately copying a known-good record.

### Extra

Read-only summary of optional payloads attached to the row.

For exit rows, the editor may also generate extra fields below `Extra`:

- `Door Type`, `Door X`, and `Door Y` edit an optional exit door animation
  payload. Door types are `None`, `Wooden`, `Bombable`, `Sanctuary`, and
  `Palace`.
- Special-exit rows expose `Dir`, `Spr GFX`, `Aux GFX`, `BG Pal`, `Spr Pal`,
  `Top`, `Bottom`, `Left`, `Right`, `Left Edge`, `Unk4`, `Unk5`, `Unk6`, and
  `Unk7`. These are fixed `kSpExit_*` payload fields. The `Unk` fields are
  signed 16-bit values preserved by the dump/compile path.

### Apply Navigation

Applies the full navigation row replacement as one undoable edit.

## Gravestone

This section edits the fixed-index overworld gravestone records. It is active
when the Gravestones layer is visible and you select a gravestone marker.

### Index

Read-only fixed gravestone table index.

### X / Y

The gravestone's world-space pixel coordinates. These are not area-local grid
coordinates. The editor derives the owning area from the world position.

### Tilemap

Read-only tilemap position calculated from `X`, `Y`, and the derived area. The
editor validates that this calculated value matches the gravestone record.

### Special

Read-only special behavior marker. Most gravestones are blank. Index `0x0D` is
marked `stairs`; index `0x0E` is marked `hole`.

### Apply Gravestone

Applies edited `X` and `Y`, then recalculates the area and tilemap-derived
fields. If the resulting position is outside the derived area, the edit is
rejected.

## Navigation Allocation

This section manages which fixed slot/source owns a navigation row, and can add,
move, or delete rows. It works on travel, entrance, fall-hole, exit, and
special-exit markers.

### Selected

Read-only summary of the currently selected navigation marker. It shows `none`
when no navigation marker is selected.

### Type

The allocation family:

- `Travel` for bird or whirlpool travel destinations.
- `Entrance` for overworld entrance slots.
- `Fall Hole` for fall-hole slots.
- `Exit` for normal dungeon exit rows.
- `Special Exit` for exits with `kSpExit_*` special-area payloads.

### Target Area

The area that should own the new or moved row. When a terrain tile is selected,
this defaults to that tile's area. When a navigation marker is selected, it
defaults to the marker's current area.

### Slot / Source

The fixed identity value for the selected allocation type.

- `Travel` uses bird slot `0..8` for bird rows, or a whirlpool source area for
  whirlpool rows.
- `Entrance` uses entrance slot `0..128`.
- `Fall Hole` uses fall-hole slot `0..18`.
- `Exit` and `Special Exit` use exit slot `0..78`.

The editor rejects duplicate allocated slots/sources before the patch reaches
the compiler.

### Special Room

Only meaningful for `Special Exit`. This is the special room id, normally in
the `0x180..0x18F` range, used to pick the `kSpExit_*` visual/payload slot.

### Add Copy

Adds a row for the chosen type.

- For `Entrance` and `Fall Hole`, selecting a terrain tile is enough; the
  editor creates a default grid row at that tile.
- For `Travel`, `Exit`, and `Special Exit`, select an existing compatible row
  first so the editor has a known-good record to copy.
- If a matching deleted fixed slot exists, the editor reuses it.

### Apply Slot

Reassigns the selected row to the requested slot/source within the same
navigation list. It does not change the row's area.

### Move Area

Moves the selected row to `Target Area`. Grid-based rows are clamped to the new
area's size.

### Delete

Deletes the selected entrance, fall hole, or exit row by replacing it with a
deleted-slot marker. Travel rows cannot be deleted from this control because
they are fixed live destinations; move or edit them instead.

## Entrance / Hole

This section edits grid-based overworld entrances and fall holes. It is active
when you select an entrance marker or fall-hole marker.

### Type

Read-only marker category.

### Record

Read-only fixed slot, such as `slot 27`.

### X / Y

Area-local 16px grid coordinates for the marker.

For entrances, `Y` can start at `0`. For fall holes, the compiler-valid minimum
`Y` is `8`. The maximum is based on the selected area's size.

### Entrance ID

The destination entrance id reached when Link uses that overworld entrance or
falls through that hole.

### Apply Entrance / Hole

Applies `X`, `Y`, and `Entrance ID` to the selected entrance or fall-hole row.

## Secret Item

This section edits overworld `Items` rows compiled into `kOverworldSecrets`.
It is active when you select a secret item marker, or when a normal Light/Dark
World terrain tile is selected as the target for a new item.

### Record

Read-only record identity.

- `0x1B:3` means area `0x1B`, item row index `3`.
- `0x1B:new` means the selected terrain tile can receive a new item row in
  area `0x1B`.

### X / Y

Area-local 16px grid coordinates for the secret item. These are clamped to the
area size.

### Name

Exact compiler secret name, such as `00-Nothing`, `01-Rupee-G`, `05-Bomb`,
`06-Heart`, `80-Hole`, or `84-Staircase`.

The two-digit prefix is the secret code compiled into `kOverworldSecrets`.
The editor also uses dumped runtime tables to show the spawned object, sprite
type, OAM flags, palette behavior, and random-secret pool in the inspector.

### Add Item

Inserts a new secret item row at the selected terrain tile's area-local 16px
grid coordinate.

### Apply Item

Replaces the selected secret item row with the edited coordinate and name.

### Delete

Deletes the selected secret item row.

## Sprite Context

This section edits the graphics and palette context for an area's overworld
sprite set. It does not move individual sprites.

### Area

Read-only selected area id.

### Stage

The sprite-set stage whose visual context is being edited.

- Light World areas expose `Beginning`, `First part`, and `Second part`.
- Dark World areas expose `Shared`, which writes the shared `first` set.
- Special areas are not editable here.

### Sprite GFX

The sprite graphics group byte for this area/stage. It controls which dumped
sprite graphics packs are loaded for sprite rendering.

### Sprite Palette

The sprite palette group byte for this area/stage.

### Apply Sprite Context

Applies the sprite graphics and palette bytes to the selected area/stage.

## Special Visuals

This section edits special-overworld `kSpExit_*` visual table values. It is
active for compiler-backed Special areas, normally `0x80..0x9F`, that resolve
to a special-exit slot.

### Slot

Read-only resolved special visual slot. A value like
`0x80 -> slot 0 (area 0x5B exit 2)` means the visible Special area uses slot
`0`, and that slot is owned by exit row `2` in area `0x5B`.

If it says `unbacked`, the editor can display the values but cannot safely
apply an edit because no owning special-exit row was found.

### Sprite GFX

Special-area sprite graphics group, from `spExitSprGfx`.

### Aux GFX

Special-area auxiliary BG graphics group, from `spExitAuxGfx`. This is disabled
when the BG context comes from a special scene profile instead of the exit
visual table.

### BG Pal

Special-area BG palette group, from `spExitPalBg`. This is disabled under the
same conditions as `Aux GFX`.

### Sprite Pal

Special-area sprite palette group, from `spExitPalSpr`.

### Apply Special

Applies the special visual record through the owning special-exit row.

## Sprite Placement

This section edits individual overworld sprite placement rows. It is active
when the sprite overlay is enabled and you select an overworld sprite marker.

### Record

Read-only identity of the selected sprite in the form `area:type`, such as
`0x1B:0x3E`.

### Stages

Read-only list of progression stages that contain the same placement. When
`Sprite set` is `All sets`, a single visible marker can represent linked rows
from more than one stage.

### Type

Read-only sprite type byte derived from the selected compiler name.

### Name

Exact compiler sprite name. The editor keeps the selected name and type byte
consistent by deriving the type from the two-digit prefix in the name.

### X / Y

Area-local 16px sprite grid coordinates. The limits depend on the area's size.

### Apply Sprite

Applies the edited name and coordinates. If the selected marker represents
linked rows in multiple stages, the editor applies the same edit to those linked
rows.

### Delete

Deletes the selected sprite placement row or linked rows.

## Static Overlay

This section edits Z-Scream-style static overlay tile writes stored in the
area's `Overlays` metadata. It is active when you select a terrain Map16 tile,
or when the selected tile already has a static overlay record.

### Record

Read-only identity.

- `0x1B:2` means area `0x1B`, overlay row index `2`.
- `0x1B:new` means the selected Map16 tile can receive a new overlay row.

### X / Y

Area-local 16px Map16 coordinates for the overlay write.

### Tile

Map16 tile id written by the overlay, such as `0x0034`.

### Add Overlay

Adds a new overlay row at the selected Map16 coordinate. If an overlay already
exists at the coordinate, the editor updates that row instead.

### Apply Overlay

Replaces the selected overlay row.

### Delete

Deletes the selected overlay row.

## Tile

This section edits the global Map8 tile-type table for the selected terrain
tile. It is intentionally small because the edit is global, not local to one
map cell.

### Type Index

Read-only index into the 512-byte Map8 tile-attribute table. In the editor this
is the low 9-bit Map8 tile id, `map8Word & 0x01FF`.

### Tile Type

The behavior/collision byte for that Map8 tile id. Examples include water,
ledge, damage, walkable, and other gameplay tile behaviors, depending on the
ROM table value.

Changing this affects every place that uses the same Map8 tile id, not just the
one selected cell.

### Apply Tile Type

Writes a sparse `tile.map8-attribute` edit into `patches/tile-attributes.json`
and updates the preview state.

## Inspect

The inspector describes the current selected terrain tile, sprite, or
interaction marker. For terrain, it shows every level from Map32 down to the
Map8 word.

### Inspect

The active inspection grid: `Map32`, `Map16`, or `Map8`. This is chosen from
the toolbar inspection buttons. It controls the selection outline size.

### Screen

The rendered atlas screen cell under the pointer.

### Area

The logical area header used for metadata. A value like `0x1B (big)` means the
screen belongs to area `0x1B`, whose header size is `big`.

### Map32

The selected 32x32 terrain id and its Map32 coordinate inside the screen, such
as `0x03E6 @ 3,2`.

### Map16

The selected 16x16 tile id and its Map16 coordinate inside the screen, such as
`0x0034 @ 7,5`.

### Map8

The full 16-bit Map8 word. This includes the 9-bit tile id plus palette, BG
priority, and flip bits.

### Map8 Tile

The low 9-bit Map8 tile id and its Map8 coordinate inside the screen, such as
`0x0AA @ 14,10`.

### Type Index

The Map8 tile-attribute table index. In this editor it is the same low 9-bit
Map8 tile id shown by `Map8 Tile`.

### Tile Type

The current behavior/collision byte loaded from the dumped Map8 tile-attribute
table. If the dump does not contain the value, the inspector shows `not dumped`.

### Palette

The BG palette row encoded in the Map8 word.

### Flip

Whether the Map8 word has horizontal or vertical flip bits set.

### Priority

Whether the Map8 word has the BG priority bit set. Priority tiles can draw in
front of sprites/Link depending on the SNES layer rules and the game's render
state.

## Selection-Specific Inspector Rows

When a sprite marker is selected, the inspector switches from terrain rows to
sprite rows:

- `Record` describes the sprite placement role.
- `ID` is the sprite type byte.
- `Name` is the compiler/display name.
- `Area` is the owning area.
- `Spawn` is the 16px sprite-grid coordinate.
- `Stages` shows which progression stages contain that marker.
- `Sprite` describes whether the editor has an OAM render recipe or is using a
  fallback marker.
- `Edit Together` warns when the sprite is known to depend on matching terrain.

When an interaction marker is selected, the inspector shows interaction rows:

- `Selection`, `Code`, `Name`, and `Behavior` describe the interaction kind.
- `Grid` is a 16px grid coordinate when the source row is grid based.
- `Pixel` is an area-local pixel coordinate when the source row is pixel based.
- `Sprite`, `Graphics`, and `OAM Flags` appear when the interaction spawns or
  previews a sprite.
- `Spawn State`, `Random Pool`, `Table`, `Source`, and `Runtime Note` are
  source-backed details from the dump and runtime tables.
