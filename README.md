# Petpet HTTP server  

## Petpet HTTP server written in TypeScript, supported with Bun.js, Hono, Sharp.js, and Gifwrap

First of all, you need a Bun runtime to run this project.  

To install Bun:  
1. Head over to [Bun's official website](https://bun.sh)  
2. Follow instruction on how to install per operating system (GNU+Linux/Mac/Windows)  

To use the server:

Clone the repo:
```sh
git clone https://github.com/MaksymIgnatiev/petpet_server.git
```

Install dependencies:  
```sh
bun install
```

Run the projct:
```sh
bun start 
```

To see help page:
```sh
# More preferable
bun run help
# or
bun start -h
```

You can spesify runtime options in `config.toml` file in the root of the project, or with flags. Read [configuration.md](/configuration.md) file for more, or see the help page with available flags.  
There are different routes available. Documentation can be found in [routes.md](/routes.md) file.  
Information about cache can be found in [cache.md](/cache.md) file. 


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.  
