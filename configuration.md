# Configuration for the project

You can use configuration file or flags to specify features that you want to use in project. They will override the default values that can be found in [`./src/config.ts`](https://github.com/MaksymIgnatiev/petpet_server/blob/master/src/config.ts#L69) file under the [`globalOptionsDefault`](https://github.com/MaksymIgnatiev/petpet_server/blob/master/src/config.ts#L69) object on line [`69`](https://github.com/MaksymIgnatiev/petpet_server/blob/master/src/config.ts#L69). Flags will override the config file values. Priority is: `flags` > `config file` > `default`.  

There are 1 configuration file available: `config.toml`  
- If `config.toml` is specified - it will be used
- If `config.toml` is not specified - default values will be used  

Or in other words: `config.toml` > `default`

Config files can be omitted with `-O`/`--omit-config` flag. Then none of configuration files will be loaded and parsed.  
Project can be run with the `-w`/`--watch` flag to watch for changes in the configuration files, and restart the server when changes occur (full restart, not patch values)

_Note!_ Flag `-w`/`--watch` will watch for: file creation, file content change, and file removal.  

---
Use the `bun start -g` command to generate a default config file with default values to see and modify them to the needs.  

Use `bun start -h/--help [section]` or `bun run help [section]` (more preferable) to see all flags and their descriptions or a specific section of the help page.  

_Note!_ Flags `-W`/`--no-warnings`/`-E`/`--no-errors` will affect only warnings and errors during runtime after the flags are parsed. Warnings and errors will be shown if there will be an warning/error during the process of parsing flags.  
_Note!_ Flag `-q`/`--quiet` will affect all output during whole project runtime. To remove `$ bun {command}` notation of the script, add `--silent` flag before script name or file. Examples: `bun --silent start`, `bun run --silent help`. Bun understands the omitted `run` command before script name, but `bun help` prints the bun's built-in help page. So to run any script without concerns, use `run` command.  


## Format options for `timestampFormat` option/flag

| format | description |
|:------:|:------------|
| u | microseconds |
| S | milliseconds |
| s | seconds |
| m | minutes |
| h | hours (24h format, 12:00, 13:00, 24:00, 01:00) |
| H | hours (12h format, 12 PM,  1 PM, 12 AM,  1 AM) |
| P | `AM`/`PM` indicator |
| d | day (first 3 letters of the day of the week) |
| D | day (of month) |
| M | month (number) |
| N | month (3 first letters of the month name) |
| Y | year |

_Note!_ To escape some character that are listed in formating - use backslash symbol `\` before character (from command line you would probably need second one, to escape the escape character like `\n`, `\t` or others).  

*Examples*:
| format | description |
|:-------|:------------|
| "m:s:S.u"     | `minutes:seconds:milliseconds.microseconds` |
| "s:m:h D.M.Y" | `seconds:minutes:hours day(of month).month(number).year` |
| "Y N d m:h"   | `year month(3 first letters of the month name) day(first 3 letters of the day of the week) minutes:hours` |
| "s/m/h"       | `seconds/minutes/hours` |
| "m:h"         | `minutes:hours` |


## Cache
Information about cache can be found in [cache.md](/cache.md) file. Be patient, and read all document if you need to understand in depth how it works. Or you can read the source code directly :)  
