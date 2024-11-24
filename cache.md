# Cache in the project

There are 2 types of cache: in code, in filesystem
The third, `both` combines them into one type, but has priority in the code. Filesystem cache serves as a kind of insurance, or duplication of everything that is present in the code. If for some reason the code goes wrong (this is unlikely to happen, since there are checks everywhere) - the lost cache will be loaded from the file system. And vice versa.  

How it works (`->` arrows indicates different tasks and branches with `if`/`else if`/`else` keywords):
(assuming that cache and avatars are enabled, otherwise don't even look at cache, because cache will return a nullable value, representing absence of object/buffer)
(if cache time is enabled, and permanent cache not, otherwise don't perform a check at all)

PetPet object: object with following type `{ hash: Hash; id: string; lastSeen: number; gif: Buffer; }`
Avatar object: object with following type `{ id: string; avatar: Buffer; }`
Nullable value: non successfull value received from a function/object when expected successfull one

## Type `code`:

## Request
-> check if request parameters are correct: if not: send a JSON response with 400 status code and explanation what is wrong -> Response (JSON)
-> create hash from request UID and parameters
-> if requested hash is in the cache Map object: get the PetPet object from cache, decompress the GIF buffer, and send with 200 status code -> Response (Buffer)
   else if hash is in the queue (generating process): get the promise for GIF generation, get the buffer, send with 200 status code -> Response (Buffer)
   else if hash is not in the queue: add the generation process to the queue, and repeat previous step -> Response (Buffer)
-> if there was a problem with 3rd party API: send a JSON response with status code of the response from API -> Response (JSON)
-> if there was a problem during processing the request: send a JSON response with 500 status code -> Response (JSON)

## Generation process
-> if avatar by UID is in the cache Map object: get the Avatar object from cache, decompress the afatar buffer, use it in GIF generation, repeat previous steps
   else if avatar is in the queue (fetching process): get the promise, get the buffer, repeat previous steps
   else if avatar is not in the queue: add the fetching task to the queue, repeat previous steps
-> returns a buffer representing ready petpet GIF

## Cache checking
-> every `n` milliseconds perform a check for old cache by iterating through the cache Map object, and comparing delta time between now and last seen time
-> if delta is bigger than cache time: remove the GIF
   else skip
-> check avatars for dependencies (does any GIF for given UID need them?)
-> if at least 1 PetPet object that has field `id` === UID is in the cache: skip
   else remove from cache


## Type `fs`:

### Request
-> check if request parameters are correct: if not: send a JSON response with 400 status code and explanation what is wrong -> Response (JSON)
-> create hash from request UID and parameters
-> if requested hash is in the filesystem cache (./cache/gif/): read the `{hash}.gif` file, read the `{hash}.json` file (if exist), modify the `lastSeen` property on JSON object, write the JSON file as a `{hash}.json`, send the buffer with 200 status code -> Response
   else if hash is in the queue (generating process): get the promise for GIF generation, get the buffer, create PetPet object, write this PetPet object to filesystem cache as a `{hash}.gif`, `{hash}.json` files, send the buffer with 200 status code -> Response
   else if hash is not in the queue: add the generation process to the queue, and repeat previous step -> Response

### Generation process
-> if avatar by UID is in the filesystem cache (./cache/avatar/): read the `{UID}.png` file, use it in generation process, repeat previous steps
   else if avatar is in the queue: get the promise, get the buffer from it, write the avatar buffer to the cache as `{UID}.png`, use this buffer for generation process, repeat previous steps
   else if avatar is not in the queue: add the fetch task to the queue, repeat previous steps
-> returns a buffer representing ready petpet GIF

### Cache checking
-> every `n` milliseconds perform a check for old cache by iterating through the filesystem cache `{hash}.json` file
-> read the `{hash}.json` file
-> if delta time is bigger than cache time: remove `{hash}.gif`, `{hash}.json` files from the filesystem cache
   else skip
-> check avatars for dependencies
-> if at least one file from GIF filesystem cache in the name includes UID: skip
   else remove from cache


## Type `both`:

(overall it's the same as 2 different types on their own, but filesystem is checked much less often. Here will be only things that differ from regular behaviour. Tasks are not 100% in the same order, but just for indication that they differ)

### Request
-> if hash is not in the cache Map object: chech for `{hash}.gif` file in the filesystem

### Generation process
-> if avatar is not in the cache Map object: check for `{UID}.png` file in the filesystem

### Cache checking
-> every `n` milliseconds perform a check for old cache and the reliability of both caches by first iterating through cache Map object first, and then filesystem cache
(iteration through code cache)
-> if file `{hash}.gif` or `{hash}.json` files can't be found on each iteration: use PetPet object from cache to replace them, and assign the lastSeen property to the current date
(iteration through filesystem cache)
-> if PetPet object with field `id` === UID can't be found in cache Map object: read the `{hash}.gif`, `{hash}.json` files to create new PetPet object, and assign the lastSeen property to the current date
