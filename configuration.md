# Configuration for the project

You can use both, the configuration files and command line arguments to specify features that you want to use in project. They will override the default values that can be found in `@/src/config.ts` file.

There are 2 configuration files available: `config.toml`, `.env`  
They will be applied in such order:  
- If `config.toml` is specified - it will be used (unless flag is not set)  
- If `config.toml` and `.env` files are specified - `config.toml` will have more previligies and will be used  
- If `config.toml` is not specified, but `.env` is specified - `.env` will be used  
- If none of thee files are spesifid - default values will be used  

Or in other words: `config.toml` > `.env` > `default`

---
Use the `bun start -g [toml|env]` command to generate a config file with default values to see and modify them to the needs.
