# Configuration for the project

You can use configuration files to specify features that you want to use in project. They will override the default values that can be found in `./src/config.ts` file under the `globalOptionsDefault` object on line `69`.  

There are 2 configuration files available: `config.toml`, `.env`  
They will be applied in such order:  
- If `config.toml` is specified - it will be used
- If `config.toml` and `.env` files are specified - `config.toml` will have more previligies and will be used  
- If `config.toml` is not specified, but `.env` is specified - `.env` will be used  
- If none of thee files are specifid - default values will be used  

Or in other words: `config.toml` > `.env` > `default`

Config files can be omitted with `-O` flag. Then none of configuration files will be loaded and parsed.  
Project can be run with the `-w` flag to watch for changes in the configuration files, and restart the server when changes occur (full restart, not patch values)

_Note!_ Flag `-w` will watch for: file creation, file content change, and file removal.  

---
Use the `bun start -g [toml|env]` command to generate a default config file for given type with default values to see and modify them to the needs.  

_Note!_ To specify options inside `.env` file, use the `petpet_` prefix to avoid conflicts with existing environment variables.  
_Note!_ To specify object options inside `.env` file, use dot symbol `.` to separate object name from object keys like "member access operator".
Example:
```env
# Set the `port` property on `server` object to the value of `3000`
petpet_server.port = 3000
```

_Note!_ Despite the fact that all values in `env` file are strings, they will be converted automatically based on schema inside the project.
