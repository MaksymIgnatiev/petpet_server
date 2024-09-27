# Configuration for the project

### You can us both, the configuration files and command flag arguments to spsify features that you want to use in project

There are 2 configuration files available: `config.toml`, `.env`  
They will be applied in such order:  
- If `config.toml` is specified - it will be used (unless flag is not set)  
- If `config.toml` and `.env` files are specified - `config.toml` will have more previligies and will be used  
- If `config.toml` is not specified, but `.env` is specified - `.env` will be used  
- If none of thee files are spesifid - default values will be used  

## Toml configuration (`config.toml`) (default values are used):

```toml
# Time in ms to cache the gif from last use
cache_time = 900000

# Wether to use cache or not
cache = true

# Wether to not perform a clean up after {cache_time} passed. Gifs will be stored in cache permanently
petmanent_cache = false 

# Cache type, store cache: "in-code" - in code directly; "fs" - in file system; "both" - both types together
cache_type = "in-code"

# Wether to output some information during work, or to be compleately quiet with no output
quiet = false
```

## Env configuration (`.env`) (default value are used):
```env
# Time in ms to cache the gif from last use
cache_time = 900000
```
