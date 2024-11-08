# Routes for the HTTP server

`/`:
- Status code: `204`
- Explanation: no content, nothing special

`/:id`:
- Parameters:
    - size: `'integer'` of the avatar image in pixels, whole GIF is `112`x`112` px, integer ∈ (0, +Infinity). Ex: '100', '50', '200'
    - resize: `'{number}x{number}'` the base image from center by `X` and `Y` pixels on `X` and `Y` axises, '{X}x{Y}', '{horizontal}x{vertical}', number ∈ (-Infinity, +Infinity). Ex: '5x-10', '20x6', '-5x8'
    - shift: `'{number}x{number}'` the base image from the original position by `X` and `Y` pixels on `X` and `Y` axises, '{X}x{Y}' axis, '{horizontal}x{vertical}', number ∈ (-Infinity, +Infinity). Ex: '5x-10', '20x6', '-5x8'
    - squeeze: `'number'` factor in the middle of animation (hand down) in pixels, number ∈ (-Infinity, +Infinity). Ex: '3', '8', '4'
    - fps: `'integer'` desire FPS for the gif, integer ∈ [1, 50). Ex: '16', '12', '24'. _Note!_ Please take notice about gif frame rate compatiability. Read 'https://www.fileformat.info/format/gif/egff.htm' for more information
    - upd: Forse generate the GIF despite it can potensialy be in cache. Just include it in the params as `&upd`/`?upd` with no/optional value just for indication proposes
- Status code: `200`/`400`/`4xx`/`500`/`5xx`
- Explanation: Success / Incorect parameter usage / Internal server error / Bad third-partly API response
- Content-Type: `"image/gif"` | `"application/json"`
- Response: Petpet GIF with the avatar of Discord's user ID 

`/avatar/:id`:
- Status code: `200`/`4xx`/`5xx`
- Explanation: Success / Bad third-partly API response
- Content-Type: `"image/png"` | `"application/json"`
- Response: Avatar for Discord's user ID

`*` (all other routes):
- Status code: `204`
- Explanation: no content, nothing special

More routes are expected to be added in the future and the avatar database will be expanded to other platforms in form of the `/{platform_name}/:id` route for GIF and `/avatar/{platform_name}/:id` route for avatars.  
